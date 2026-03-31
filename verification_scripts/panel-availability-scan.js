import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PANELS_DIR = path.join(ROOT, 'src/data/panels');
const SERPER_SITES_PATH = path.join(ROOT, 'data-admin/config/serper-sites.json');
const LOGS_DIR = path.join(ROOT, 'logs');

// Extract API key from command line arguments (e.g., --api=xyz123)
const apiArg = process.argv.find(arg => arg.startsWith('--api='));
const SERPER_API_KEY = apiArg ? apiArg.split('=')[1] : null;

// --- API FUNCTION ---

async function searchUkAvailability(model, siteFilterString) {
    if (!model) return null;

    const query = `"${model}" ${siteFilterString}`;
    
    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: 'uk', // Geolocation: UK
                hl: 'en'  // Language: English
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Return the first organic search result if it exists
        if (data.organic && data.organic.length > 0) {
            return {
                found: true,
                title: data.organic[0].title,
                url: data.organic[0].link,
                domain: new URL(data.organic[0].link).hostname
            };
        }
        
        return { found: false };

    } catch (error) {
        console.error(`Error searching for ${model}:`, error.message);
        return { found: false, error: error.message };
    }
}

// --- MAIN PROCESS ---

async function run() {
    if (!SERPER_API_KEY) {
        console.error("ERROR: You must provide your Serper.dev API key using the --api=YOUR_KEY flag.");
        console.error("Usage: node check-availability.js --api=xyz123");
        process.exit(1);
    }

    let logOutput = "=== UK AVAILABILITY CHECK LOG ===\n\n";
    let panelsChecked = 0;
    let panelsUpdated = 0;

    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        const LOG_FILE = path.join(LOGS_DIR, `panel_availability_check_log_${Date.now()}.txt`);

        const serperConfig = JSON.parse(await fs.readFile(SERPER_SITES_PATH, 'utf-8'));
        const UK_WHITELIST = serperConfig.panels || [];
        // Google restricts queries to ~32 words — keep lists reasonably short or batch in future.
        const SITE_FILTER_STRING = `(${UK_WHITELIST.map(domain => `site:${domain}`).join(' OR ')})`;

        const files = await fs.readdir(PANELS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        console.log(`Starting availability check against ${UK_WHITELIST.length} UK domains (panels list)...\n`);

        for (const file of jsonFiles) {
            const filePath = path.join(PANELS_DIR, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let panels = JSON.parse(fileData);
            let fileModified = false;

            for (let i = 0; i < panels.length; i++) {
                let panel = panels[i];

                // Optimization: Only check panels that haven't been reviewed by a human yet.
                // If a human has reviewed it, we assume the UK availability status is already accurate.
                if (panel.reviewed === true || !panel.model) {
                    continue; 
                }

                panelsChecked++;
                process.stdout.write(`Checking ${panel.model}... `);

                const result = await searchUkAvailability(panel.model, SITE_FILTER_STRING);

                if (result && result.found) {
                    process.stdout.write(`FOUND on ${result.domain}\n`);
                    logOutput += `[FOUND] ${panel.manufacturer} ${panel.model}\n  -> URL: ${result.url}\n\n`;
                    
                    panel.availableUK = true;
                    
                    // Inject the discovered URL into buyLinks if it isn't already there
                    const linkExists = panel.buyLinks.some(link => link.URL === result.url);
                    if (!linkExists) {
                        panel.buyLinks.push({
                            Supplier: result.domain.replace('www.', ''),
                            URL: result.url,
                            isAffiliate: false,
                            Checked: false
                        });
                    }

                    fileModified = true;
                    panelsUpdated++;
                } else {
                    process.stdout.write(`Not found.\n`);
                    logOutput += `[MISSING] ${panel.manufacturer} ${panel.model} - No UK supplier found.\n`;
                    
                    // Optional: If you want the script to automatically set availableUK to false 
                    // when no supplier is found, uncomment the next line:
                    // panel.availableUK = false;
                    
                    // fileModified = true; // Uncomment if changing to false
                }

                // Rate limiting: wait 500ms between API calls to avoid hitting limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Only write back to the disk if we actually updated a panel in this file
            if (fileModified) {
                await fs.writeFile(filePath, JSON.stringify(panels, null, 4));
            }
        }

        logOutput += `\n--- SUMMARY ---\nPanels Checked: ${panelsChecked}\nNew UK Links Found: ${panelsUpdated}\n`;
        
        await fs.writeFile(LOG_FILE, logOutput);
        console.log(`\nProcess complete. ${panelsUpdated} panels updated. Log saved to: ${LOG_FILE}`);

    } catch (error) {
        console.error("A fatal error occurred:", error);
    }
}

run();