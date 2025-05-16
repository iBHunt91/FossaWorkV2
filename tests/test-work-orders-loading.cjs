const fs = require('fs');
const path = require('path');

// Test loading work orders from the data directory
async function testWorkOrdersLoading() {
  console.log('Testing work order loading...\n');
  
  const dataDir = path.join(__dirname, '../data/users');
  
  try {
    // List all user directories
    const userDirs = fs.readdirSync(dataDir).filter(dir => {
      try {
        return fs.statSync(path.join(dataDir, dir)).isDirectory();
      } catch (e) {
        return false;
      }
    });
    
    console.log(`Found ${userDirs.length} user directories:`);
    userDirs.forEach(dir => console.log(`  - ${dir}`));
    console.log();
    
    // Check each user's scraped_content.json
    for (const userDir of userDirs) {
      const scrapedContentPath = path.join(dataDir, userDir, 'scraped_content.json');
      
      if (fs.existsSync(scrapedContentPath)) {
        const content = fs.readFileSync(scrapedContentPath, 'utf8');
        const data = JSON.parse(content);
        
        console.log(`User: ${userDir}`);
        
        if (data.workOrders && Array.isArray(data.workOrders)) {
          console.log(`  - Found ${data.workOrders.length} work orders (array format)`);
        } else if (typeof data === 'object') {
          const orderIds = Object.keys(data);
          console.log(`  - Found ${orderIds.length} work orders (object format)`);
        } else {
          console.log(`  - Unknown format:`, data);
        }
        
        console.log();
      } else {
        console.log(`User: ${userDir}`);
        console.log(`  - No scraped_content.json file`);
        console.log();
      }
    }
    
    // Also check the root data directory
    const rootScrapedContent = path.join(__dirname, '../data/scraped_content.json');
    if (fs.existsSync(rootScrapedContent)) {
      const content = fs.readFileSync(rootScrapedContent, 'utf8');
      const data = JSON.parse(content);
      
      console.log('Root data directory:');
      if (data.workOrders && Array.isArray(data.workOrders)) {
        console.log(`  - Found ${data.workOrders.length} work orders (array format)`);
      } else if (typeof data === 'object') {
        const orderIds = Object.keys(data);
        console.log(`  - Found ${orderIds.length} work orders (object format)`);
      }
    } else {
      console.log('No scraped_content.json in root data directory');
    }
    
  } catch (error) {
    console.error('Error testing work orders:', error);
  }
}

testWorkOrdersLoading();