const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Helper to download an image
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                   .on('error', reject)
                   .once('close', () => resolve(filepath));
            } else {
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        });
    });
};

(async () => {
    const queuePath = path.join(__dirname, 'scrape_queue.json');
    const outputPath = path.join(__dirname, 'scraped_roster.json');

    if (!fs.existsSync(queuePath)) {
        console.error('❌ Could not find scrape_queue.json. Please export it from the Admin Panel first!');
        process.exit(1);
    }

    const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    if (!Array.isArray(queueData) || queueData.length === 0) {
        console.error('❌ scrape_queue.json is empty or invalid.');
        process.exit(1);
    }

    // Launch Chrome visibly so the user can log in to bypass Facebook security
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('----------------------------------------------------');
    console.log('🔵 OPENING FACEBOOK - PLEASE LOG IN MANUALLY');
    console.log('----------------------------------------------------\n');
    await page.goto('https://www.facebook.com');

    console.log('⏳ A giant button has been injected into the browser window.');
    console.log('Log into Facebook, let the page redirect, and then click "✅ I am logged in! Continue" on the Facebook page itself.');
    
    // Robust Polling Loop: Survives page navigations!
    // If the user logs in, the page reloads, destroying the DOM. We catch that error 
    // and reinject the button on the new page, waiting until they click it.
    while (true) {
        try {
            const isReady = await page.evaluate(() => {
                if (window.__playwright_ready) return true;
                
                if (!document.getElementById('playwright-resume-btn')) {
                    const btn = document.createElement('button');
                    btn.id = 'playwright-resume-btn';
                    btn.innerHTML = '✅ I am logged in!<br>Start Scraping 🚀';
                    btn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:15px;font-size:18px;background:#c9a55a;color:white;border:none;border-radius:10px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,0.7);font-family:sans-serif;font-weight:bold;line-height:1.4;';
                    btn.onclick = () => {
                        window.__playwright_ready = true;
                        btn.innerHTML = 'Starting...';
                        btn.style.opacity = '0.5';
                    };
                    document.body.appendChild(btn);
                }
                return window.__playwright_ready || false;
            });

            if (isReady) break;

        } catch (e) {
            // "Execution context was destroyed" happens right during the login redirect.
            // We ignore it and loop back around to inject the button on the newly loaded page.
        }
        
        // Wait 1 second before checking again
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n▶️  Resuming script. Scraping family member profiles...\n');

    const scrapedRoster = [];

    for (const member of queueData) {
        console.log(`\nVisiting ${member.fbUrl} for ${member.name} (${member.relation})...`);
        try {
            await page.goto(member.fbUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(5000); 

            // Extract exactly the main profile picture by properly analyzing modern Facebook Timeline DOM
            const imageUrls = await page.evaluate(() => {
                // Primary Strategy: The main timeline profile picture is always an <image> masked inside an <svg role="img">.
                // It usually has a hardcoded CSS height of 168px on desktop and 132px on mobile.
                const svgProfilePic = document.querySelector('svg[role="img"] image');
                if (svgProfilePic) {
                    const href = svgProfilePic.getAttribute('xlink:href');
                    if (href && href.includes('scontent')) return [href];
                }

                // Fallback Strategy: Find any large image or svg <image> 
                // We strictly ignore tiny thumbnails (e.g., 32x32, 40x40, 60x60 in headers).
                const allImages = Array.from(document.querySelectorAll('image, img'));
                const largeSources = allImages
                    .filter(el => {
                        // Check CSS width/height, fallback to getBoundingClientRect()
                        let w = el.width || parseInt(el.style.width || '0', 10);
                        let h = el.height || parseInt(el.style.height || '0', 10);
                        if (!w || !h) {
                            const rect = el.getBoundingClientRect();
                            w = rect.width;
                            h = rect.height;
                        }
                        return w >= 100 && h >= 100;
                    })
                    .map(el => el.src || el.getAttribute('xlink:href'))
                    .filter(src => src && src.includes('scontent') && !src.includes('badge'));

                return largeSources.slice(0, 1);
            });

            let base64Avatar = '';

            if (imageUrls.length > 0) {
                console.log(`  📸 Found profile photo. Downloading...`);
                // Download temporarily to buffer, convert to base64
                base64Avatar = await new Promise((resolve, reject) => {
                    https.get(imageUrls[0], (res) => {
                        const data = [];
                        res.on('data', chunk => data.push(chunk));
                        res.on('end', () => {
                            const buffer = Buffer.concat(data);
                            resolve('data:image/jpeg;base64,' + buffer.toString('base64'));
                        });
                        res.on('error', reject);
                    });
                });
                console.log(`  ✅ Successfully converted photo to base64.`);
            } else {
                console.log(`  ⚠️ No suitable photo found on profile.`);
            }

            // --- STEP 2: EXTRACT PERSONAL DETAILS FOR QUIZZES ---
            let aboutUrl = member.fbUrl;
            if (aboutUrl.includes('profile.php?id=')) {
                aboutUrl += '&sk=about_contact_and_basic_info';
            } else {
                aboutUrl = aboutUrl.replace(/\/$/, '') + '/about_contact_and_basic_info';
            }

            console.log(`  🕵️‍♂️ Analyzing personal info from ${aboutUrl}...`);
            await page.goto(aboutUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000); // Wait for React to render

            const extractedDetails = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                let birthDate = null;
                let birthYear = null;

                for (let i = 0; i < lines.length; i++) {
                    const lineLower = lines[i].toLowerCase();
                    // PT-BR / EN Semantic matching: Label is positioned exactly below value
                    if (lineLower.includes('data de nascimento') || lineLower === 'birthday' || lineLower === 'birth date') {
                        if (i > 0) birthDate = lines[i - 1];
                    }
                    if (lineLower.includes('ano de nascimento') || lineLower === 'birth year') {
                        if (i > 0) birthYear = lines[i - 1];
                    }
                }
                return { birthDate, birthYear };
            });

            // Construct Quizzes based on Semantic Extractions
            const generatedQuizzes = [];
            if (extractedDetails.birthDate) {
                console.log(`  🎉 Found Birthday: ${extractedDetails.birthDate}`);
                generatedQuizzes.push({
                    question: `Quando é o aniversário de ${member.name}?`,
                    answer: extractedDetails.birthDate
                });
            }
            if (extractedDetails.birthYear) {
                console.log(`  🍼 Found Birth Year: ${extractedDetails.birthYear}`);
                generatedQuizzes.push({
                    question: `Em que ano ${member.name} nasceu?`,
                    answer: extractedDetails.birthYear
                });
            }

            // Construct game schema
            const newChar = {
                id: crypto.randomUUID(),
                name: member.name,
                relation: member.relation,
                avatar: base64Avatar,
                color: '#c9a55a', // default gold
                personality: 'sweet',
                messages: {
                    win: ['I knew you could do it!'],
                    firstAce: ['Great start!'],
                    suitComplete: ['One down, three to go!'],
                    stockSpam: ['Take your time, look closely.'],
                    milestone25: ['You are on a roll!'],
                    flip: ['Nice move!'],
                    kingMove: ['The King has arrived!'],
                    undo: ['Changed your mind? That works too.'],
                    foundation: ['Getting closer!']
                },
                quizzes: generatedQuizzes,
                activeEvents: ['win', 'firstAce', 'suitComplete', 'stockSpam', 'flip', 'kingMove'],
                createdAt: Date.now()
            };

            scrapedRoster.push(newChar);

        } catch (e) {
            console.error(`❌ Failed to scrape ${member.fbUrl}:`, e.message);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(scrapedRoster, null, 2));
    console.log(`\n✅ All done! Scraping complete. The file scraped_roster.json has been created.`);
    console.log('You can now use "Import Roster" in the Admin Panel to load these characters!');
    
    await browser.close();
    process.exit(0);
})();
