import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Enhances the scraped_content.json file with additional metadata and improved formatting
 */
function enhanceScrapeLogs() {
    console.log('Enhancing scrape logs...');
    
    // Path to the scraped content file
    const scrapedContentPath = path.join(__dirname, '..', 'data', 'scraped_content.json');
    
    try {
        // Read the existing file
        if (!fs.existsSync(scrapedContentPath)) {
            console.error('Error: scraped_content.json file not found');
            return;
        }
        
        // Parse the JSON data
        const rawData = fs.readFileSync(scrapedContentPath, 'utf8');
        const data = JSON.parse(rawData);
        
        if (!data.workOrders || !Array.isArray(data.workOrders)) {
            console.error('Error: Invalid data format in scraped_content.json');
            return;
        }
        
        // Count dispensers by manufacturer
        const manufacturers = {};
        const serviceTypes = {};
        const customers = {};
        let totalDispensers = 0;
        
        data.workOrders.forEach(job => {
            // Count by customer
            const customerName = job.customer?.name?.split(' ')[0] || 'Unknown';
            customers[customerName] = (customers[customerName] || 0) + 1;
            
            // Count by service type
            job.services?.forEach(service => {
                const type = service.type || 'Unknown';
                serviceTypes[type] = (serviceTypes[type] || 0) + 1;
            });
            
            // Count dispensers
            if (job.dispensers && Array.isArray(job.dispensers)) {
                totalDispensers += job.dispensers.length;
                
                job.dispensers.forEach(dispenser => {
                    const makeMatch = dispenser.make?.match(/Make:\s*([^,]+)/);
                    const make = makeMatch ? makeMatch[1].trim() : 'Unknown';
                    
                    manufacturers[make] = (manufacturers[make] || 0) + 1;
                });
            }
        });
        
        // Create a human-readable date
        const timestamp = data.metadata?.timestamp || new Date().toISOString();
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
        
        // Enhance the metadata
        data.metadata = {
            timestamp: timestamp,
            humanReadableDate: formattedDate,
            version: '1.0.0',
            totalJobs: data.workOrders.length,
            storeNumbersFound: data.metadata?.storeNumbersFound || 0,
            storeNumbersFailed: data.metadata?.storeNumbersFailed || 0,
            summary: {
                totalDispensers,
                byManufacturer: manufacturers,
                byService: serviceTypes,
                byCustomer: customers
            }
        };
        
        // Write the enhanced data back to the file with pretty formatting
        fs.writeFileSync(scrapedContentPath, JSON.stringify(data, null, 2));
        
        console.log('Scrape logs enhancement complete!');
        console.log('Enhanced metadata:', data.metadata);
    } catch (error) {
        console.error('Error enhancing scrape logs:', error);
    }
}

// Run the enhancement if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    enhanceScrapeLogs();
}

export { enhanceScrapeLogs }; 