/**
 * Script to remove a dispenser entry from the dispenser_store.json file
 * Run with: node scripts/clear_dispenser.cjs <storeId>
 */

const fs = require('fs');
const path = require('path');

// Get the store ID from command line args
const storeId = process.argv[2];

if (!storeId) {
  console.error('Please provide a store ID as argument');
  console.error('Usage: node scripts/clear_dispenser.cjs <storeId>');
  process.exit(1);
}

const dispenserStorePath = path.resolve(__dirname, '..', 'data', 'dispenser_store.json');

// Check if file exists
if (!fs.existsSync(dispenserStorePath)) {
  console.error(`Dispenser store file not found at: ${dispenserStorePath}`);
  process.exit(1);
}

try {
  // Read the store
  const store = JSON.parse(fs.readFileSync(dispenserStorePath, 'utf8'));
  
  // Check if the ID exists
  if (store.dispenserData && store.dispenserData[storeId]) {
    console.log(`Found dispenser data for store ID: ${storeId}`);
    
    // Delete the entry
    delete store.dispenserData[storeId];
    
    // Update metadata
    store.metadata.lastUpdated = new Date().toISOString();
    store.metadata.totalStores = Object.keys(store.dispenserData).length;
    
    // Write back to file
    fs.writeFileSync(dispenserStorePath, JSON.stringify(store, null, 2));
    
    console.log(`Successfully removed dispenser data for store ID: ${storeId}`);
    console.log(`Updated dispenser store now has ${store.metadata.totalStores} entries`);
  } else {
    console.log(`No dispenser data found for store ID: ${storeId}`);
  }
} catch (error) {
  console.error('Error processing dispenser store:', error);
} 