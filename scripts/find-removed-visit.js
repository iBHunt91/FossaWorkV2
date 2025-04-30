// Script to find a removed visit
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// First look at the schedule changes file to get information
function getChangeInfo() {
  const changesPath = path.join(__dirname, '..', 'data', 'schedule_changes.txt');
  if (fs.existsSync(changesPath)) {
    const content = fs.readFileSync(changesPath, 'utf8');
    console.log('Schedule changes file content:');
    console.log(content);
    
    // Extract Visit ID and other information
    const visitMatch = content.match(/Visit #(\d+)/g);
    const storeMatch = content.match(/Store #(\d+)/g);
    const dateMatch = content.match(/(\d{2}\/\d{2}\/\d{4})/g);
    
    if (visitMatch) {
      return {
        visitIds: visitMatch.map(v => v.replace('Visit #', '')),
        storeIds: storeMatch ? storeMatch.map(s => s.replace('Store #', '')) : [],
        dates: dateMatch || []
      };
    }
  }
  
  return { visitIds: ["112099"], storeIds: [], dates: [] }; // Default to original visit ID
}

// Function to find visit in data files by store number first
async function findVisitInFiles() {
  const changeInfo = getChangeInfo();
  
  if (changeInfo.visitIds.length === 0) {
    console.log('No visit IDs found in schedule changes');
    return;
  }
  
  const dataDir = path.join(__dirname, '..', 'data');
  console.log(`\nSearching for Visits ${changeInfo.visitIds.map(id => '#' + id).join(', ')} in all JSON files...`);
  
  if (changeInfo.storeIds.length > 0) {
    console.log(`Associated with stores: ${changeInfo.storeIds.map(id => '#' + id).join(', ')}`);
  }
  
  // Get all JSON files
  const files = fs.readdirSync(dataDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(dataDir, file));
  
  let foundAny = false;
  
  // First, try to find by store number in any file
  if (changeInfo.storeIds.length > 0) {
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);
        
        for (const workOrder of data.workOrders) {
          if (workOrder.customer && 
              workOrder.customer.storeNumber && 
              changeInfo.storeIds.some(store => workOrder.customer.storeNumber.includes(store))) {
            
            console.log(`\nFound Store in file: ${path.basename(file)}`);
            console.log(`Work Order ID: ${workOrder.id}`);
            console.log(`Customer: ${workOrder.customer.name}`);
            console.log(`Store Number: ${workOrder.customer.storeNumber}`);
            console.log(`Address: ${workOrder.customer.address.street}`);
            
            if (workOrder.visits && workOrder.visits.nextVisit) {
              console.log(`Visit ID: ${workOrder.visits.nextVisit.visitId}`);
              console.log(`Visit Date: ${workOrder.visits.nextVisit.date}`);
            }
            
            foundAny = true;
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error.message);
      }
    }
  }
  
  // Next, search for each visit ID
  for (const visitId of changeInfo.visitIds) {
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(visitId)) {
          console.log(`\nFound Visit #${visitId} in file: ${path.basename(file)}`);
          
          // Parse the file to extract detailed information
          const data = JSON.parse(content);
          
          // Look for the visit in work orders
          const workOrder = data.workOrders.find(order => {
            return order.visits && 
                   order.visits.nextVisit && 
                   order.visits.nextVisit.visitId === visitId;
          });
          
          if (workOrder) {
            console.log(`\nWork Order Information:`);
            console.log(`ID: ${workOrder.id}`);
            console.log(`Customer: ${workOrder.customer.name}`);
            console.log(`Store Number: ${workOrder.customer.storeNumber}`);
            console.log(`Address: ${workOrder.customer.address.street}`);
            console.log(`Visit Date: ${workOrder.visits.nextVisit.date}`);
            console.log(`Services: ${workOrder.services.map(s => `${s.quantity} x ${s.description} (${s.type})`).join(', ')}`);
            
            // Count dispensers if available
            if (workOrder.dispensers) {
              console.log(`Dispensers: ${workOrder.dispensers.length}`);
              workOrder.dispensers.forEach((dispenser, index) => {
                console.log(`  ${index + 1}. ${dispenser.title} (${dispenser.serial})`);
              });
            } else {
              console.log(`No dispensers information available`);
            }
            
            foundAny = true;
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error.message);
      }
    }
  }
  
  if (!foundAny) {
    // If nothing found, search for any work orders with the target date
    if (changeInfo.dates.length > 0) {
      console.log(`\nSearching for any work orders scheduled on dates: ${changeInfo.dates.join(', ')}`);
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const data = JSON.parse(content);
          
          for (const workOrder of data.workOrders) {
            if (workOrder.visits && 
                workOrder.visits.nextVisit && 
                changeInfo.dates.includes(workOrder.visits.nextVisit.date)) {
              
              console.log(`\nFound Work Order scheduled for ${workOrder.visits.nextVisit.date} in file: ${path.basename(file)}`);
              console.log(`Work Order ID: ${workOrder.id}`);
              console.log(`Visit ID: ${workOrder.visits.nextVisit.visitId}`);
              console.log(`Customer: ${workOrder.customer.name}`);
              console.log(`Store Number: ${workOrder.customer.storeNumber}`);
              console.log(`Address: ${workOrder.customer.address.street}`);
              
              foundAny = true;
            }
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error.message);
        }
      }
    }
  }
  
  if (!foundAny) {
    console.log(`\nNo matching records were found in any JSON files.`);
  }
}

// Run the search
findVisitInFiles().catch(console.error); 