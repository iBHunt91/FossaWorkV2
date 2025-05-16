// Import work order data from the local data file
import workOrderData from '../data/scraped_content.json';
// Import form service
import { 
  processSingleVisit, 
  getFormAutomationStatus, 
  processBatchVisits, 
  getBatchAutomationStatus,
  cancelFormAutomation,
  openUrlWithDebugMode,
  FormAutomationStatus,
  BatchAutomationStatus
} from '../services/formService';
import { ENDPOINTS } from '../config/api';

// Add service for retrieving dispenser information
import { getDispensersForWorkOrder } from '../services/dispenserService'; 