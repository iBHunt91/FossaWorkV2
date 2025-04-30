import { scrapeDispenserInfo } from '../scrapers/dispenserScrape.js';

console.log('Starting dispenser test script');
scrapeDispenserInfo()
    .then(result => {
        console.log('Dispenser scraping completed successfully:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Dispenser scraping failed:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    });
