const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
// Increase limit because base64 avatars are large
app.use(express.json({ limit: '50mb' })); 

// Serve the static frontend files (the entire game directory)
app.use(express.static(path.join(__dirname, '/')));

// Database paths
const ROSTER_PATH = path.join(__dirname, 'data', 'roster.json');
const SCRAPE_QUEUE_PATH = path.join(__dirname, 'scripts', 'scrape_queue.json');
const SCRAPED_ROSTER_PATH = path.join(__dirname, 'scripts', 'scraped_roster.json');

// Ensure roster.json exists
if (!fs.existsSync(ROSTER_PATH)) {
    if (!fs.existsSync(path.dirname(ROSTER_PATH))) fs.mkdirSync(path.dirname(ROSTER_PATH));
    fs.writeFileSync(ROSTER_PATH, '[]');
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// [GET] Load Character Roster
app.get('/api/roster', (req, res) => {
    try {
        const data = fs.readFileSync(ROSTER_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read roster' });
    }
});

// [POST] Save Character Roster (Bulk Update)
app.post('/api/roster', (req, res) => {
    try {
        const characters = req.body;
        if (!Array.isArray(characters)) throw new Error('Body must be an array');
        fs.writeFileSync(ROSTER_PATH, JSON.stringify(characters, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// [POST] Trigger Bulk Facebook Scraper
app.post('/api/scrape', (req, res) => {
    try {
        const queue = req.body; // Array of {name, relation, fbUrl}
        if (!Array.isArray(queue) || queue.length === 0) {
            return res.status(400).json({ error: 'Empty scrape queue provided.' });
        }

        // 1. Write the queue file for the scraper
        fs.writeFileSync(SCRAPE_QUEUE_PATH, JSON.stringify(queue, null, 2));

        // 2. Spawn the Playwright script
        console.log(`🚀 Starting Playwright Scraper for ${queue.length} profiles...`);
        
        const child = exec('node scripts/scrape_facebook.js', { cwd: __dirname });
        
        // Pipe the logs so the user sees them in the server terminal
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);

        child.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Scraper script exited with error.' });
            }

            // 3. Scraper finished. Read the newly generated scraped roster
            if (fs.existsSync(SCRAPED_ROSTER_PATH)) {
                const scrapedData = JSON.parse(fs.readFileSync(SCRAPED_ROSTER_PATH, 'utf8'));
                
                // 4. Merge the newly scraped characters into the main roster!
                const existingRoster = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
                const newRoster = [...existingRoster, ...scrapedData];
                fs.writeFileSync(ROSTER_PATH, JSON.stringify(newRoster, null, 2));
                
                console.log(`✅ Successfully merged ${scrapedData.length} new characters into roster.`);
                
                // Cleanup temp files
                fs.unlinkSync(SCRAPE_QUEUE_PATH);
                fs.unlinkSync(SCRAPED_ROSTER_PATH);

                return res.json({ success: true, added: scrapedData.length });
            } else {
                return res.status(500).json({ error: 'Scraper finished but scraped_roster.json was not found.' });
            }
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start the authoring server
app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🎲 Mom's Solitaire - Local Authoring Server`);
    console.log(`🚀 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`🎮 Game Direct: http://localhost:${PORT}/index.html`);
    console.log('====================================================');
});
