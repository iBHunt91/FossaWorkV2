import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create sample data files
function createTestHistoryData() {
  const dataDir = path.join(__dirname, '../data');
  
  // Ensure the data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Create sample data for three dates
  const dates = [
    new Date('2025-04-15T10:00:00'), 
    new Date('2025-04-14T15:30:00'),
    new Date('2025-04-13T08:45:00')
  ];
  
  // Base template for a work order
  const baseWorkOrder = {
    id: "123456",
    customer: {
      name: "Sample Store",
      storeNumber: "#5133",
      address: {
        street: "123 Main St",
        cityState: "Tampa FL",
        zip: "33601"
      }
    },
    services: [
      {
        type: "dispenser",
        quantity: 8,
        description: "Service 8 dispensers"
      }
    ],
    visits: {
      nextVisit: {
        date: "04/20/2025",
        timeWindow: "9:00 AM - 12:00 PM"
      }
    }
  };
  
  // Create the base template with different work orders
  const createSampleData = (modifyFn = null) => {
    const workOrders = [];
    
    // Add 5 work orders
    for (let i = 1; i <= 5; i++) {
      const workOrder = JSON.parse(JSON.stringify(baseWorkOrder));
      workOrder.id = `1120${i}`;
      workOrder.customer.storeNumber = `#${5133 + i}`;
      workOrder.services[0].quantity = 4 + i;
      workOrder.visits.nextVisit.date = `04/${15 + i}/2025`;
      
      // Apply any custom modifications if provided
      if (modifyFn) {
        modifyFn(workOrder, i);
      }
      
      workOrders.push(workOrder);
    }
    
    return {
      workOrders,
      timestamp: new Date().toISOString()
    };
  };
  
  // Create first data file - baseline
  const firstData = createSampleData();
  
  // Create second data file - add a new job and modify one
  const secondData = createSampleData((workOrder, i) => {
    if (i === 3) {
      // Modify the date for this work order
      workOrder.visits.nextVisit.date = "05/01/2025";
    }
  });
  
  // Add a new work order to the second data set
  secondData.workOrders.push({
    id: "112099",
    customer: {
      name: "New Sample Store",
      storeNumber: "#6001",
      address: {
        street: "456 Main St",
        cityState: "Orlando FL",
        zip: "32801"
      }
    },
    services: [
      {
        type: "dispenser",
        quantity: 10,
        description: "Service 10 dispensers"
      }
    ],
    visits: {
      nextVisit: {
        date: "04/25/2025",
        timeWindow: "1:00 PM - 4:00 PM"
      }
    }
  });
  
  // Create third data file - remove a job and replace one
  const thirdData = createSampleData((workOrder, i) => {
    if (i === 2) {
      // Remove this job later by filtering
      workOrder.toRemove = true;
    }
    if (i === 4) {
      // Replace this work order with different one
      workOrder.id = "112044";
      workOrder.customer.storeNumber = "#7001";
      workOrder.services[0].quantity = 12;
    }
  });
  
  // Remove the marked job
  thirdData.workOrders = thirdData.workOrders.filter(wo => !wo.toRemove);
  
  // Write the files with appropriate timestamps
  dates.forEach((date, index) => {
    const formattedDate = date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const fileName = path.join(dataDir, `scraped_content_${formattedDate}.json`);
    
    let data;
    if (index === 0) data = thirdData;
    else if (index === 1) data = secondData;
    else data = firstData;
    
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`Created test file: ${fileName}`);
  });
  
  console.log('Test history data created successfully!');
}

// Run the function
createTestHistoryData(); 