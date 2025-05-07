// Test script to send a schedule change notification via Pushover with real data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendScheduleChangePushover } from './scripts/notifications/pushoverService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sendRealDataScheduleTest() {
  console.log('Sending schedule change test notification using real data...');

  // Load real data from scraped_content.json
  const scrapedDataPath = path.join(__dirname, 'data', 'scraped_content.json');
  const scrapedData = JSON.parse(fs.readFileSync(scrapedDataPath, 'utf8'));
  
  // Extract relevant data from the workOrders
  const sampleChanges = [];
  
  if (scrapedData && scrapedData.workOrders && scrapedData.workOrders.length > 0) {
    // Process up to 5 work orders to create schedule changes
    const workOrdersToProcess = scrapedData.workOrders.slice(0, 5);
    
    workOrdersToProcess.forEach((workOrder, index) => {
      // Create different types of changes based on the work order data
      const location = workOrder.customer?.address?.street || '';
      const customer = workOrder.customer?.name || 'Unknown Customer';
      const priority = index === 0 ? 'critical' : (index < 2 ? 'high' : 'normal');
      
      // Get dispenser information if available
      const dispensers = workOrder.dispensers || [];
      
      if (dispensers.length > 0) {
        // Create a replacement change using real dispenser data
        sampleChanges.push({
          type: 'replacement',
          priority,
          old_dispenser_id: dispensers[0].serial || `D${Math.floor(Math.random() * 10000)}`,
          new_dispenser_id: `NEW-${Math.floor(Math.random() * 10000)}`,
          customer,
          location,
          store_location: workOrder.customer?.storeNumber || '',
          reason: 'Calibration inconsistency',
          manufacturer: dispensers[0].make?.replace('Make: ', '') || 'Gilbarco'
        });
        
        if (dispensers.length > 1) {
          // Create a removed change for the second dispenser
          sampleChanges.push({
            type: 'removed',
            priority: priority === 'critical' ? 'high' : (priority === 'high' ? 'normal' : 'high'),
            dispenser_id: dispensers[1].serial || `D${Math.floor(Math.random() * 10000)}`,
            customer,
            location,
            store_location: workOrder.customer?.storeNumber || '',
            reason: 'Flow meter failure',
            return_date: new Date(Date.now() + (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000)
          });
        }
        
        if (dispensers.length > 2) {
          // Create a status change for the third dispenser
          sampleChanges.push({
            type: 'status_changed',
            priority: priority === 'critical' ? 'normal' : (priority === 'high' ? 'critical' : 'high'),
            dispenser_id: dispensers[2].serial || `D${Math.floor(Math.random() * 10000)}`,
            old_status: 'Pending',
            new_status: 'Scheduled',
            customer,
            location,
            store_location: workOrder.customer?.storeNumber || ''
          });
        }
      }
      
      // Add date change notification using visit data if available
      if (workOrder.visits && workOrder.visits.nextVisit) {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + Math.floor(Math.random() * 30) + 1);
        
        sampleChanges.push({
          type: 'date_changed',
          priority: Math.random() > 0.7 ? 'high' : 'normal',
          old_date: workOrder.visits.nextVisit.date,
          new_date: newDate.toISOString(),
          dispenser_id: workOrder.id,
          customer,
          location,
          store_location: workOrder.customer?.storeNumber || ''
        });
      }
      
      // Add new dispenser based on instructions or services
      if (workOrder.services && workOrder.services.length > 0) {
        sampleChanges.push({
          type: 'added',
          priority: Math.random() > 0.8 ? 'critical' : (Math.random() > 0.5 ? 'high' : 'normal'),
          dispenser_id: `NEW-${workOrder.id}-${Math.floor(Math.random() * 1000)}`,
          customer,
          location,
          store_location: workOrder.customer?.storeNumber || '',
          manufacturer: 'Wayne'
        });
      }
    });
  }
  
  // If no changes could be extracted, create some default ones
  if (sampleChanges.length === 0) {
    sampleChanges.push({
      type: 'replacement',
      priority: 'critical',
      old_dispenser_id: 'D1001',
      new_dispenser_id: 'D1002',
      customer: 'Sample Customer',
      location: 'Sample Location',
      store_location: 'Main Store',
      reason: 'Touchscreen failure',
      manufacturer: 'Gilbarco'
    });
  }

  // Create a test user with the Pushover key from .env
  const testUser = {
    id: 'test-user',
    email: 'test@example.com',
    pushoverKey: process.env.PUSHOVER_USER_KEY,
    preferences: {
      notifications: {
        scheduleChanges: true
      }
    }
  };

  console.log(`Created ${sampleChanges.length} schedule changes from real data`);
  
  try {
    // Send the notification
    const result = await sendScheduleChangePushover(sampleChanges, [testUser]);
    console.log('Schedule change notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send schedule change notification:', error);
    throw error;
  }
}

// Execute the test function
sendRealDataScheduleTest()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err)); 