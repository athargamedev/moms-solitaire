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
    const profilesListPath = path.join(__dirname, '..', 'fb-profiles-list.txt');
    const outputPath = path.join(__dirname, 'scraped_roster.json');

    let queueData = [];

    // Try scrape_queue.json first (from admin panel), fall back to fb-profiles-list.txt
    if (fs.existsSync(queuePath)) {
        queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    } else if (fs.existsSync(profilesListPath)) {
        console.log('No scrape_queue.json found. Reading from fb-profiles-list.txt...');
        const lines = fs.readFileSync(profilesListPath, 'utf8').split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                const rest = line.replace(url, '').split('-').map(p => p.trim()).filter(Boolean);
                let name = 'Family', relation = 'Member';
                if (rest.length >= 2) { name = rest[0]; relation = rest[1]; }
                else if (rest.length === 1) { name = rest[0]; relation = rest[0]; }
                else { name = url.split('/').filter(Boolean).pop() || 'User'; }
                queueData.push({ name, relation, fbUrl: url });
            }
        });
        console.log(`Parsed ${queueData.length} profiles from fb-profiles-list.txt`);
    }

    if (!Array.isArray(queueData) || queueData.length === 0) {
        console.error('No profiles to scrape. Either:');
        console.error('  1. Use the Admin Panel bulk scraper, or');
        console.error('  2. Add profiles to fb-profiles-list.txt in format: Name - Relation - https://facebook.com/...');
        process.exit(1);
    }

    // Launch Chrome visibly so the user can log in to bypass Facebook security
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('----------------------------------------------------');
    console.log('OPENING FACEBOOK - PLEASE LOG IN MANUALLY');
    console.log('----------------------------------------------------\n');
    await page.goto('https://www.facebook.com');

    console.log('A giant button has been injected into the browser window.');
    console.log('Log into Facebook, let the page redirect, and then click "I am logged in! Continue" on the Facebook page itself.');

    // Robust Polling Loop: Survives page navigations!
    while (true) {
        try {
            const isReady = await page.evaluate(() => {
                if (window.__playwright_ready) return true;

                if (!document.getElementById('playwright-resume-btn')) {
                    const btn = document.createElement('button');
                    btn.id = 'playwright-resume-btn';
                    btn.innerHTML = 'I am logged in!<br>Start Scraping';
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
            // "Execution context was destroyed" happens during login redirect.
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\nResuming script. Scraping family member profiles...\n');

    const scrapedRoster = [];

    for (const member of queueData) {
        console.log(`\nVisiting ${member.fbUrl} for ${member.name} (${member.relation})...`);
        try {
            // ── STEP 1: PROFILE PHOTO ──
            await page.goto(member.fbUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(5000);

            const imageUrls = await page.evaluate(() => {
                const svgProfilePic = document.querySelector('svg[role="img"] image');
                if (svgProfilePic) {
                    const href = svgProfilePic.getAttribute('xlink:href');
                    if (href && href.includes('scontent')) return [href];
                }

                const allImages = Array.from(document.querySelectorAll('image, img'));
                const largeSources = allImages
                    .filter(el => {
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
                console.log(`  Found profile photo. Downloading...`);
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
                console.log(`  Successfully converted photo to base64.`);
            } else {
                console.log(`  No suitable photo found on profile.`);
            }

            // ── STEP 2: EXTRACT PERSONAL DETAILS FOR QUIZZES ──
            let aboutUrl = member.fbUrl;
            if (aboutUrl.includes('profile.php?id=')) {
                aboutUrl += '&sk=about_contact_and_basic_info';
            } else {
                aboutUrl = aboutUrl.replace(/\/$/, '') + '/about_contact_and_basic_info';
            }

            console.log(`  Analyzing personal info from ${aboutUrl}...`);
            await page.goto(aboutUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);

            const extractedDetails = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                let birthDate = null;
                let birthYear = null;

                for (let i = 0; i < lines.length; i++) {
                    const lineLower = lines[i].toLowerCase();
                    if (lineLower.includes('data de nascimento') || lineLower === 'birthday' || lineLower === 'birth date') {
                        if (i > 0) birthDate = lines[i - 1];
                    }
                    if (lineLower.includes('ano de nascimento') || lineLower === 'birth year') {
                        if (i > 0) birthYear = lines[i - 1];
                    }
                }
                return { birthDate, birthYear };
            });

            // ── STEP 3: EXTRACT WORK, EDUCATION, HOMETOWN ──
            let aboutOverviewUrl = member.fbUrl;
            if (aboutOverviewUrl.includes('profile.php?id=')) {
                aboutOverviewUrl += '&sk=about_overview';
            } else {
                aboutOverviewUrl = aboutOverviewUrl.replace(/\/$/, '') + '/about_overview';
            }

            console.log(`  Analyzing overview from ${aboutOverviewUrl}...`);
            await page.goto(aboutOverviewUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);

            const overviewDetails = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                let workplace = null;
                let education = null;
                let hometown = null;
                let currentCity = null;

                for (let i = 0; i < lines.length; i++) {
                    const lineLower = lines[i].toLowerCase();

                    // Workplace: "Works at X" or "Trabalha na X"
                    if (lineLower.startsWith('works at ') || lineLower.startsWith('trabalha n')) {
                        workplace = lines[i].replace(/^(works at |trabalha na |trabalha no |trabalha em )/i, '').trim();
                    }

                    // Education: "Studied at X" or "Estudou na X"
                    if (lineLower.startsWith('studied at ') || lineLower.startsWith('estudou n') || lineLower.startsWith('went to ')) {
                        education = lines[i].replace(/^(studied at |estudou na |estudou no |estudou em |went to )/i, '').trim();
                    }

                    // Hometown: "From X" or "De X"
                    if (lineLower.startsWith('from ') && !lineLower.includes('from your')) {
                        hometown = lines[i].replace(/^from /i, '').trim();
                    }
                    if (lineLower === 'cidade natal' || lineLower === 'hometown') {
                        if (i > 0 && !lines[i-1].toLowerCase().includes('edit')) {
                            hometown = lines[i - 1];
                        }
                    }

                    // Current city: "Lives in X" or "Mora em X"
                    if (lineLower.startsWith('lives in ') || lineLower.startsWith('mora em ')) {
                        currentCity = lines[i].replace(/^(lives in |mora em )/i, '').trim();
                    }
                }
                return { workplace, education, hometown, currentCity };
            });

            // ── STEP 4: EXTRACT LIFE EVENTS ──
            let lifeEventsUrl = member.fbUrl;
            if (lifeEventsUrl.includes('profile.php?id=')) {
                lifeEventsUrl += '&sk=about_life_events';
            } else {
                lifeEventsUrl = lifeEventsUrl.replace(/\/$/, '') + '/about_life_events';
            }

            console.log(`  Checking life events from ${lifeEventsUrl}...`);
            let lifeEvents = [];
            try {
                await page.goto(lifeEventsUrl, { waitUntil: 'load', timeout: 30000 });
                await page.waitForTimeout(2000);

                lifeEvents = await page.evaluate(() => {
                    const text = document.body.innerText || '';
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    const events = [];

                    for (let i = 0; i < lines.length; i++) {
                        const lineLower = lines[i].toLowerCase();
                        // Look for marriage events
                        if (lineLower.includes('married') || lineLower.includes('casou') || lineLower.includes('casamento')) {
                            // Try to find a year near this line
                            for (let j = Math.max(0, i-2); j < Math.min(lines.length, i+3); j++) {
                                const yearMatch = lines[j].match(/\b(19|20)\d{2}\b/);
                                if (yearMatch) {
                                    events.push({ type: 'marriage', year: yearMatch[0], text: lines[i] });
                                    break;
                                }
                            }
                        }
                        // Graduation
                        if (lineLower.includes('graduated') || lineLower.includes('formou') || lineLower.includes('formatura')) {
                            for (let j = Math.max(0, i-2); j < Math.min(lines.length, i+3); j++) {
                                const yearMatch = lines[j].match(/\b(19|20)\d{2}\b/);
                                if (yearMatch) {
                                    events.push({ type: 'graduation', year: yearMatch[0], text: lines[i] });
                                    break;
                                }
                            }
                        }
                    }
                    return events;
                });
            } catch(e) {
                console.log(`  Could not load life events page (may be private).`);
            }

            // ── STEP 5: GENERATE QUIZZES ──
            const generatedQuizzes = [];

            if (extractedDetails.birthDate) {
                console.log(`  Found Birthday: ${extractedDetails.birthDate}`);
                generatedQuizzes.push({
                    question: `Quando e o aniversario de ${member.name}?`,
                    answer: extractedDetails.birthDate,
                    category: 'birthday',
                    difficulty: 'easy'
                });
            }
            if (extractedDetails.birthYear) {
                console.log(`  Found Birth Year: ${extractedDetails.birthYear}`);
                generatedQuizzes.push({
                    question: `Em que ano ${member.name} nasceu?`,
                    answer: extractedDetails.birthYear,
                    category: 'birthday',
                    difficulty: 'medium'
                });
            }
            if (overviewDetails.hometown) {
                console.log(`  Found Hometown: ${overviewDetails.hometown}`);
                generatedQuizzes.push({
                    question: `De onde e ${member.name}?`,
                    answer: overviewDetails.hometown,
                    category: 'hometown',
                    difficulty: 'medium'
                });
            }
            if (overviewDetails.currentCity && overviewDetails.currentCity !== overviewDetails.hometown) {
                console.log(`  Found Current City: ${overviewDetails.currentCity}`);
                generatedQuizzes.push({
                    question: `Onde ${member.name} mora atualmente?`,
                    answer: overviewDetails.currentCity,
                    category: 'hometown',
                    difficulty: 'medium'
                });
            }
            if (overviewDetails.workplace) {
                console.log(`  Found Workplace: ${overviewDetails.workplace}`);
                generatedQuizzes.push({
                    question: `Onde ${member.name} trabalha?`,
                    answer: overviewDetails.workplace,
                    category: 'work',
                    difficulty: 'medium'
                });
            }
            if (overviewDetails.education) {
                console.log(`  Found Education: ${overviewDetails.education}`);
                generatedQuizzes.push({
                    question: `Onde ${member.name} estudou?`,
                    answer: overviewDetails.education,
                    category: 'education',
                    difficulty: 'hard'
                });
            }

            // Life event quizzes
            lifeEvents.forEach(evt => {
                if (evt.type === 'marriage') {
                    console.log(`  Found Marriage Event: ${evt.year}`);
                    generatedQuizzes.push({
                        question: `Em que ano ${member.name} se casou?`,
                        answer: evt.year,
                        category: 'life_event',
                        difficulty: 'hard'
                    });
                }
                if (evt.type === 'graduation') {
                    console.log(`  Found Graduation Event: ${evt.year}`);
                    generatedQuizzes.push({
                        question: `Em que ano ${member.name} se formou?`,
                        answer: evt.year,
                        category: 'life_event',
                        difficulty: 'hard'
                    });
                }
            });

            // ── STEP 6: BUILD CHARACTER OBJECT ──
            const newChar = {
                id: crypto.randomUUID(),
                name: member.name,
                relation: member.relation,
                avatar: base64Avatar,
                color: '#c9a55a',
                personality: 'sweet',
                // Enhanced fields
                birthday: extractedDetails.birthDate || null,
                birthYear: extractedDetails.birthYear || null,
                hometown: overviewDetails.hometown || null,
                currentCity: overviewDetails.currentCity || null,
                workplace: overviewDetails.workplace || null,
                education: overviewDetails.education || null,
                lifeEvents: lifeEvents,
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
            console.log(`  Generated ${generatedQuizzes.length} quiz questions for ${member.name}.`);

        } catch (e) {
            console.error(`Failed to scrape ${member.fbUrl}:`, e.message);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(scrapedRoster, null, 2));
    console.log(`\nAll done! Scraping complete. The file scraped_roster.json has been created.`);
    console.log(`Scraped ${scrapedRoster.length} profiles with enriched data.`);
    console.log('You can now use "Import Roster" in the Admin Panel to load these characters!');

    await browser.close();
    process.exit(0);
})();
