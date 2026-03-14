import fs from 'fs/promises';
import path from 'path';
import process from 'process';

// --- CONFIGURATION ---
const CONTROLLERS_DIR = path.join(process.cwd(), 'src/data/controllers');
const LOG_FILE = path.join(process.cwd(), `controller_availability_check_log_${Date.now()}.txt`);

// Extract API key from command line arguments (e.g., --api=xyz123)
const apiArg = process.argv.find(arg => arg.startsWith('--api='));
const SERPER_API_KEY = apiArg ? apiArg.split('=')[1] : null;

// Expanded UK Whitelist: Top B2B Wholesalers & Major Retailers
const UK_WHITELIST = [
    'alternergy.co.uk',
    'midsummerwholesale.co.uk',
    'waxmanenergy.co.uk',
    'cclcomponents.com',
    'segen.co.uk',
    'cityplumbing.co.uk',
    'bimblesolar.com',
    'green2go.co.uk',
    'hselec.co.uk',
    'solartradesales.co.uk',
    'itstechnologies.shop',
    'tradesparky.com',
    'voltaconsolar.com'
];

// Google restricts queries to 32 words. 
// This constructs a safe advanced search string: '"Model" (site:a.co.uk OR site:b.co.uk ...)'
const SITE_FILTER_STRING = `(${UK_WHITELIST.map(domain => `site:${domain}`).join(' OR ')})`;

// --- API FUNCTION ---

async function searchUkAvailability(model) {
    if (!model) return null;

    const query = `"${model}" ${SITE_FILTER_STRING}`;
    
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
        console.error("Usage: node controller-availability-scan.js --api=xyz123");
        process.exit(1);
    }

    let logOutput = "=== UK AVAILABILITY CHECK LOG ===\n\n";
    let controllersChecked = 0;
    let controllersUpdated = 0;

    try {
        const files = await fs.readdir(CONTROLLERS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        console.log(`Starting availability check against ${UK_WHITELIST.length} UK domains...\n`);

        for (const file of jsonFiles) {
            const filePath = path.join(CONTROLLERS_DIR, file);
            const fileData = await fs.readFile(filePath, 'utf-8');
            let controllers = JSON.parse(fileData);
            let fileModified = false;

            for (let i = 0; i < controllers.length; i++) {
                let controller = controllers[i];

                // Optimization: Only check controllers that haven't been reviewed by a human yet.
                // If a human has reviewed it, we assume the UK availability status is already accurate.
                if (controller.reviewed === true || (!controller.modelNumber && !controller.name)) {
                    continue; 
                }

                const searchModel = controller.modelNumber || controller.name;

                controllersChecked++;
                process.stdout.write(`Checking ${searchModel}... `);

                const result = await searchUkAvailability(searchModel);

                if (result && result.found) {
                    process.stdout.write(`FOUND on ${result.domain}\n`);
                    logOutput += `[FOUND] ${controller.manufacturer} ${searchModel}\n  -> URL: ${result.url}\n\n`;
                    
                    controller.availableUK = true;
                    
                    if (!controller.buyLinks) controller.buyLinks = [];
                    // Inject the discovered URL into buyLinks if it isn't already there
                    const linkExists = controller.buyLinks.some(link => link.URL === result.url);
                    if (!linkExists) {
                        controller.buyLinks.push({
                            Supplier: result.domain.replace('www.', ''),
                            URL: result.url,
                            isAffiliate: false,
                            Checked: false
                        });
                    }

                    fileModified = true;
                    controllersUpdated++;
                } else {
                    process.stdout.write(`Not found.\n`);
                    logOutput += `[MISSING] ${controller.manufacturer} ${searchModel} - No UK supplier found.\n`;
                    
                    // Optional: If you want the script to automatically set availableUK to false 
                    // when no supplier is found, uncomment the next line:
                    // controller.availableUK = false;
                    
                    // fileModified = true; // Uncomment if changing to false
                }

                // Rate limiting: wait 500ms between API calls to avoid hitting limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Only write back to the disk if we actually updated a controller in this file
            if (fileModified) {
                await fs.writeFile(filePath, JSON.stringify(controllers, null, 4));
            }
        }

        logOutput += `\n--- SUMMARY ---\nControllers Checked: ${controllersChecked}\nNew UK Links Found: ${controllersUpdated}\n`;
        
        await fs.writeFile(LOG_FILE, logOutput);
        console.log(`\nProcess complete. ${controllersUpdated} controllers updated. Log saved to: ${LOG_FILE}`);

    } catch (error) {
        console.error("A fatal error occurred:", error);
    }
}

run();
