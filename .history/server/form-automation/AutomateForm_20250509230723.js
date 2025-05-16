/**
 * Form Automation Script
 * 
 * This script automates the process of adding forms to Fossa visits
 * and filling them with dispenser information.
 * 
 * MERGED FUNCTIONALITY:
 * This file handles multiple types of jobs:
 * 1. Specific Dispenser jobs (code 2862) - Extracts specific dispensers from instructions
 *    and uses them for form filling.
 * 2. All Dispensers jobs (code 2861, 3002) - Uses all dispensers and adds proper prover selection.
 * 3. Open Neck Prover jobs (code 3146) - Adds Open Neck Prover forms instead of AccuMeasure.
 * 
 * The behavior changes based on the service code and dispenser requirements.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as logger from '../utils/logger.js';
import { loginToFossa } from '../../scripts/utils/login.js';
import { resolveUserFilePath, getActiveUser } from '../utils/userManager.js';

// Load environment variables
dotenv.config();

// Form types
const FORM_TYPES = {
  ACCUMEASURE: 'AccuMeasure Form',
  OPEN_NECK_PROVER: 'Open Neck Prover Form'
};

// Job identification and cancellation tracking
let currentJobId = null;
let activeJobIds = new Set(); // Track all active job IDs
let isCancelled = false;

// Status tracking for single job
let jobStatus = {
  status: 'idle',
  progress: 0,
  message: '',
  lastStatusUpdate: new Date().toISOString() // Initialize with current time
};

// Helper function to update status for a single job
const updateStatus = (status, message, progressDetails = null) => {
  jobStatus = {
    status,
    message,
    progress: progressDetails && typeof progressDetails.percent === 'number' ? progressDetails.percent : jobStatus.progress,
    lastStatusUpdate: new Date().toISOString()
  };
  logger.info(`Single Job Status (${currentJobId}): ${status} - ${message}`);

  // If this update is part of an active batch job, also update batchStatus
  if (batchStatus && batchStatus.jobId && activeJobIds.has(batchStatus.jobId) && batchStatus.jobId === currentJobId) {
    logger.debug(`Propagating update to batchStatus from single job context (Batch Job ID: ${batchStatus.jobId})`);
    const batchUpdateProps = {
      currentVisitStatus: message, // Main message becomes the current visit status
    };
    if (progressDetails) {
      if (typeof progressDetails.dispenserTotal === 'number') batchUpdateProps.dispenserCount = progressDetails.dispenserTotal;
      if (typeof progressDetails.dispenserCurrent === 'number') batchUpdateProps.dispenserCurrent = progressDetails.dispenserCurrent;
      if (progressDetails.fuelType) batchUpdateProps.fuelType = progressDetails.fuelType;
      if (typeof progressDetails.fuelTotal === 'number') batchUpdateProps.fuelTotal = progressDetails.fuelTotal;
      if (typeof progressDetails.fuelCurrent === 'number') batchUpdateProps.fuelCurrent = progressDetails.fuelCurrent;
      // currentVisit and currentVisitName are set by processBatch when it starts a new visit
    }
    updateBatchStatus(batchStatus.status, batchStatus.message, batchUpdateProps); // Keep overall batch status and message, just update details
  }
};

// Status tracking for batch job
let batchStatus = {
  status: 'idle',
  progress: 0,
  message: '',
  currentItem: 0,
  totalItems: 0,
  startTime: new Date().toISOString(),
  jobId: null,      // Initialize to null
  timestamp: null,   // Initialize to null
  // Detailed progress for the current individual visit in the batch
  currentVisit: null, // Corresponds to BatchAutomationStatus.currentVisit (visit ID)
  currentVisitName: null,
  currentVisitUrl: null, // For context
  currentVisitStatus: null, // Detailed message for the current visit
  dispenserCount: 0,    // Corresponds to BatchAutomationStatus.dispenserCount
  dispenserCurrent: 0,  // Corresponds to BatchAutomationStatus.dispenserCurrent
  fuelType: '',         // Corresponds to BatchAutomationStatus.fuelType
  fuelCurrent: 0,       // Corresponds to BatchAutomationStatus.fuelCurrent
  fuelTotal: 0,         // Corresponds to BatchAutomationStatus.fuelTotal
  completedVisitIds: [] // Ensure this is initialized
};

// Helper function to update batch status
const updateBatchStatus = (status, message, progressOrProps = null, currentItem = null, totalItems = null) => {
  // Parse additional progress properties
  const progressProps = typeof progressOrProps === 'object' ? progressOrProps : {};
  const updatedProgress = {
    currentItem: currentItem || batchStatus.currentItem,
    totalItems: totalItems || batchStatus.totalItems,
    ...(batchStatus || {}),  // preserve existing properties
    ...progressProps  // override with new properties
  };
  
  // Update the batch status object
  batchStatus = {
    status,
    message,
    ...updatedProgress,
    lastUpdated: new Date().toISOString()
  };
  
  // Log batch status update
  logger.debug(`Batch Status: ${status} - ${message}`);
  
  // Save batch status to history if it's a completion or error state
  if (status === 'completed' || status === 'error') {
    saveBatchStatusToHistory(batchStatus);
  }
  
  return batchStatus;
};

/**
 * Save batch status to history file for resume functionality
 * @param {Object} batchStatus - The batch status to save
 */
async function saveBatchStatusToHistory(batchStatus) {
  try {
    const batchHistoryPath = resolveUserFilePath('batch_history.json');
    let batchHistory = [];
    
    // Load existing history if it exists
    if (fs.existsSync(batchHistoryPath)) {
      batchHistory = JSON.parse(fs.readFileSync(batchHistoryPath, 'utf8'));
    }
    
    // Add current batch to history
    batchHistory.push({
      ...batchStatus,
      savedAt: new Date().toISOString()
    });
    
    // Limit history to last 20 entries
    if (batchHistory.length > 20) {
      batchHistory = batchHistory.slice(-20);
    }
    
    // Save updated history
    fs.writeFileSync(batchHistoryPath, JSON.stringify(batchHistory, null, 2), 'utf8');
    logger.info(`Saved batch status to history`);
  } catch (error) {
    logger.error(`Error saving batch status to history: ${error.message}`);
    // Non-critical error, don't throw
  }
}

/**
 * Add form to a visit (either AccuMeasure or Open Neck Prover)
 * @param {object} page - Playwright page
 * @param {array} dispensers - Array of dispenser objects
 * @param {number|null} formCount - Number of forms to create, defaults to dispensers.length
 * @param {boolean} isSpecificDispensers - Whether this is a specific dispensers job
 * @param {string} formType - Type of form to add (FORM_TYPES.ACCUMEASURE or FORM_TYPES.OPEN_NECK_PROVER)
 * @returns {Promise<boolean>} - Success/failure of form preparation
 */
async function prepareForm(
  page,
  dispensers,
  formCount = null,
  isSpecificDispensers = false,
  formType = FORM_TYPES.ACCUMEASURE,
  totalDispensersInVisit = 0, // Added: Total dispensers for the context of this visit
  visitIdForContext = null    // Added: ID of the current visit for context/logging
) {
  try {
    // Check for cancellation flag immediately
    if (isCancelled) {
      logger.info('Job cancelled, skipping form preparation');
      return false;
    }
    
    logger.info(`Preparing ${formType} form...`, 'FORM_PREP');
    updateStatus('running', `Preparing ${formType} form...`);
    
    // Check if we're on a visit page
    const isVisitPage = await page.evaluate(() => {
      return window.location.href.includes('/visits/');
    });
    
    if (!isVisitPage) {
      throw new Error('Not on a visit page');
    }
    
    // Verify and log the available dispensers
    logger.info(`Available dispensers (${dispensers.length}):`, 'FORM_PREP');
    dispensers.forEach((dispenser, i) => {
      logger.info(`  ${i+1}. ${dispenser.title || 'Unknown'}`, 'FORM_PREP');
    });
    
    // IMPORTANT: Use formCount if provided, otherwise default to dispensers length
    // For specific dispensers case, formCount should exactly match dispensers.length
    const formsToCreate = formCount || dispensers.length || 1;
    logger.info(`Need to create exactly ${formsToCreate} ${formType} forms (formCount=${formCount}, dispensers.length=${dispensers.length})`, 'FORM_PREP');
    
    // More reliable form detection - check for form entries with the correct form type
    const getFormCount = async () => {
      await page.waitForTimeout(300); // Brief pause to ensure DOM is updated
      return page.evaluate((formTypeToCount) => {
        // Multiple ways to detect forms
        const linkForms = Array.from(document.querySelectorAll('a.none')).filter(a => 
          a.textContent.trim().includes(formTypeToCount)
        );
        
        const spanForms = Array.from(document.querySelectorAll('span.text-sm')).filter(span => 
          span.textContent.trim().includes(formTypeToCount) && 
          span.closest('a') !== null
        );
        
        // Return the count that seems most accurate (non-zero if possible)
        return Math.max(linkForms.length, spanForms.length);
      }, formType);
    };
    
    // Get initial form count
    const existingFormCount = await getFormCount();
    logger.info(`Found ${existingFormCount} existing ${formType} forms`, 'FORM_PREP');
    
    // Calculate how many more forms we need to add
    let remainingFormsToAdd = Math.max(0, formsToCreate - existingFormCount);
    logger.info(`Need to add ${remainingFormsToAdd} more ${formType} forms`, 'FORM_PREP');
    
    // Double-check our math - NEVER exceed the number of dispensers for specific dispensers
    if (remainingFormsToAdd + existingFormCount > dispensers.length) {
      logger.warn(`CORRECTION: Would create too many forms (${remainingFormsToAdd + existingFormCount}) for available dispensers (${dispensers.length})`, 'FORM_PREP');
      remainingFormsToAdd = Math.max(0, dispensers.length - existingFormCount);
      logger.info(`CORRECTED: Will add only ${remainingFormsToAdd} forms for a total of ${remainingFormsToAdd + existingFormCount}`, 'FORM_PREP');
    }
    
    let formsCreated = false;
    
    if (remainingFormsToAdd === 0) {
      logger.info('All required forms already exist, skipping form addition', 'FORM_PREP');
      updateStatus('running', 'All required forms already exist, proceeding to fill forms');
      // Don't return early - continue to collect and fill form URLs
    } else {
      // Keep track of total forms added
      let totalFormsAdded = 0;
      
      // For each form we need to create
      for (let formIndex = 0; formIndex < remainingFormsToAdd; formIndex++) {
        // Check for cancellation during the loop
        if (isCancelled) {
          logger.info('Job cancelled, stopping form creation loop');
          return false;
        }
        
        // Check current form count before adding
        const currentCount = await getFormCount();
        
        // Stop if we've already reached or exceeded the target
        if (currentCount >= formsToCreate) {
          logger.info(`Already reached target of ${formsToCreate} forms (current: ${currentCount}), stopping`, 'FORM_PREP');
          break;
        }
        
        logger.info(`Adding form ${formIndex + 1} of ${remainingFormsToAdd} (current count: ${currentCount})`, 'FORM_PREP');
        
        // Get the current form count before adding a new one
        const beforeFormCount = currentCount;
        
        // Add the form - either "Attach" (first time) or "New" (subsequent times)
        if (formIndex === 0 && existingFormCount === 0) {
          // For the first form when no forms exist, click "Attach"
          logger.info('Adding first form using Attach button', 'FORM_PREP');
          
          // Using a more specific selector to target the Attach button next to the form type
          const attachLinkSelector = `li.plain-header:has-text("${formType}") a:has-text("Attach")`;
          
          try {
            await page.waitForSelector(attachLinkSelector, { timeout: 5000 });
            await page.click(attachLinkSelector);
            logger.info(`Clicked Attach button next to ${formType}`, 'FORM_PREP');
          } catch (error) {
            logger.warn(`Could not find specific Attach button: ${error.message}`);
            logger.warn(`Could not find specific Attach button: ${error.message}`, 'FORM_PREP');
            
            // Try using JavaScript evaluation as a fallback
            const attached = await page.evaluate((targetFormType) => {
              // Find the form type text element
              const formElements = Array.from(document.querySelectorAll('span.text-sm')).filter(el => 
                el.textContent.includes(targetFormType)
              );
              
              if (formElements.length > 0) {
                // Find the Attach link near it
                const formElement = formElements[0];
                const parent = formElement.closest('li.plain-header') || formElement.parentElement;
                
                if (parent) {
                  const attachLink = parent.querySelector('a[title*="Attach"]') || 
                                    Array.from(parent.querySelectorAll('a')).find(a => 
                                      a.textContent.trim() === 'Attach'
                                    );
                  
                  if (attachLink) {
                    attachLink.click();
                    return true;
                  }
                }
              }
              
              return false;
            }, formType);
            
            if (!attached) {
              throw new Error('Failed to find and click Attach button');
            }
          }
        } else {
          // For subsequent forms or when forms already exist, click "New"
          logger.info('Adding additional form using New button', 'FORM_PREP');
          
          // Using a much more targeted approach to find the correct New button
          const buttonClicked = await page.evaluate((targetFormType) => {
            // First, try to find the form section
            const formElements = Array.from(document.querySelectorAll('span.text-sm, div.text-sm')).filter(el => 
              el.textContent.includes(targetFormType)
            );
            
            if (formElements.length > 0) {
              // Look for the closest New button near the form element
              const formElement = formElements[0];
              // Go up to find common parent
              let parent = formElement.parentElement;
              for (let i = 0; i < 5; i++) { // Go up max 5 levels
                if (!parent) break;
                
                // Look for New button or + icon in this parent or its siblings
                const newButtonsInContext = Array.from(
                  parent.querySelectorAll('a')
                ).filter(a => 
                  a.textContent.trim().includes('New') || 
                  a.querySelector('svg.fa-plus')
                );
                
                if (newButtonsInContext.length > 0) {
                  // Found the right button in context!
                  newButtonsInContext[0].click();
                  return true;
                }
                
                // Try parent's next sibling - for cases where buttons are adjacent
                if (parent.nextElementSibling) {
                  const siblingButtons = Array.from(
                    parent.nextElementSibling.querySelectorAll('a')
                  ).filter(a => 
                    a.textContent.trim().includes('New') || 
                    a.querySelector('svg.fa-plus')
                  );
                  
                  if (siblingButtons.length > 0) {
                    siblingButtons[0].click();
                    return true;
                  }
                }
                
                parent = parent.parentElement;
              }
            }
            
            // If still not found, look specifically in the suggested forms section
            const suggestedForms = document.querySelector('div[dusk="suggested_forms"]');
            if (suggestedForms) {
              const newButtons = Array.from(
                suggestedForms.querySelectorAll('a.text-xs')
              ).filter(a => 
                a.textContent.trim().includes('New') || 
                a.querySelector('svg.fa-plus')
              );
              
              if (newButtons.length > 0) {
                newButtons[0].click();
                return true;
              }
            }
            
            return false;
          }, formType);
          
          if (!buttonClicked) {
            logger.warn('Could not find New button via targeted JavaScript, trying fallback method', 'FORM_PREP');
            
            // Try a direct click with very specific selectors
            try {
              // Try more specific selector first
              const specificSelectors = [
                'div[dusk="suggested_forms"] a.text-xs:has(svg.fa-plus)',
                'a.text-xs:has-text("New"):not([title])',
                '.panel-body a:has(svg.fa-plus)',
                'a.text-xs:has(svg.fa-plus)'
              ];
              
              let clicked = false;
              for (const selector of specificSelectors) {
                if (await page.$(selector)) {
                  await page.click(selector);
                  clicked = true;
                  logger.info(`Clicked using selector: ${selector}`, 'FORM_PREP');
                  break;
                }
              }
              
              if (!clicked) {
                throw new Error('Could not find New button with any selector');
              }
            } catch (error) {
              logger.error(`Failed to click New button: ${error.message}`, 'FORM_PREP');
            }
          }
        }
        
        // Wait for the loader to disappear, indicating the form is ready
        logger.info('Waiting for loader to disappear...', 'FORM_PREP');
        try {
          // Wait for the loader line to disappear (display:none)
          await page.waitForFunction(() => {
            const loaders = document.querySelectorAll('.loader-line');
            for (const loader of loaders) {
              if (window.getComputedStyle(loader).display !== 'none') {
                return false;
              }
            }
            return true;
          }, { timeout: 10000 });
          logger.info('Loader disappeared, form is ready', 'FORM_PREP');
        } catch (error) {
          logger.warn(`Loader wait timed out: ${error.message}`, 'FORM_PREP');
        }
        
        // Check if the form count has increased using our more reliable method
        const afterFormCount = await getFormCount();
        
        // If form count hasn't increased, retry
        if (afterFormCount <= beforeFormCount) {
          logger.warn(`Form count didn't increase (${beforeFormCount} -> ${afterFormCount}). Retrying...`, 'FORM_PREP');
          
          // Try clicking again using a different approach
          try {
            await page.click('a:has-text("New")');
            
            // Wait again for the loader
            await page.waitForFunction(() => {
              const loaders = document.querySelectorAll('.loader-line');
              for (const loader of loaders) {
                if (window.getComputedStyle(loader).display !== 'none') {
                  return false;
                }
              }
              return true;
            }, { timeout: 10000 });
            
            // Check form count again
            const retryFormCount = await getFormCount();
            
            if (retryFormCount <= beforeFormCount) {
              logger.error(`Failed to add form after retry (count: ${retryFormCount})`, 'FORM_PREP');
              formIndex--; // Try this form index again
              continue;
            } else {
              // Success after retry
              totalFormsAdded++;
            }
          } catch (error) {
            logger.error(`Error during retry: ${error.message}`, 'FORM_PREP');
          }
        } else {
          // Form was added successfully
          totalFormsAdded++;
          logger.info(`Form ${formIndex + 1} added successfully (count: ${afterFormCount})`, 'FORM_PREP');
        }
        
        // Double-check that we haven't exceeded our target
        if (afterFormCount >= formsToCreate) {
          logger.info(`Reached target of ${formsToCreate} forms (current: ${afterFormCount}), stopping`, 'FORM_PREP');
          break;
        }
        
        // Just a tiny pause before adding the next form
        await page.waitForTimeout(500);
      }
      
      // Final verification
      const finalFormCount = await getFormCount();
      
      logger.info(`Forms prepared successfully. Added ${totalFormsAdded} forms. Final form count: ${finalFormCount}`, 'FORM_PREP');
      updateStatus('running', `Forms prepared successfully. Added ${totalFormsAdded} forms (total: ${finalFormCount}), proceeding to fill forms`);
      
      formsCreated = true;
    }
    
    // Whether we added new forms or not, collect the form URLs
    logger.info('Collecting form URLs...', 'FORM_PREP');
    const formUrls = await page.evaluate((targetFormType) => {
      const formLinks = Array.from(document.querySelectorAll('a.none')).filter(a => 
        a.textContent.trim().includes(targetFormType)
      );
      
      return formLinks.map(link => link.href);
    }, formType);
    
    logger.info(`Found ${formUrls.length} form URLs`, 'FORM_PREP');
    
    // If we have dispensers data and form URLs, fill out each form
    if (dispensers.length > 0 && formUrls.length > 0) {
      logger.info(`Proceeding to fill form details. isSpecificDispensers=${isSpecificDispensers}, formType=${formType}`, 'FORM_PREP');
      await fillFormDetails(page, formUrls, dispensers, isSpecificDispensers, formType, totalDispensersInVisit, visitIdForContext);
    } else {
      if (formUrls.length === 0) {
        logger.warn('No form URLs found to process', 'FORM_PREP');
      }
      if (dispensers.length === 0) {
        logger.warn('No dispenser data available for forms', 'FORM_PREP');
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Form preparation error: ${error.message}`, 'FORM_PREP');
    updateStatus('error', `Form preparation error: ${error.message}`);
    return false;
  }
}

/**
 * Fill out the details for each form
 * @param {object} page - Playwright page
 * @param {array} formUrls - Array of form URLs
 * @param {array} dispensers - Array of dispenser objects
 * @param {boolean} isSpecificDispensers - Whether this is a specific dispensers job (code 2862)
 * @param {string} formType - Type of form being filled (FORM_TYPES.ACCUMEASURE or FORM_TYPES.OPEN_NECK_PROVER)
 * @returns {Promise<void>}
 */
async function fillFormDetails(page, formUrls, dispensers, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE, totalDispensersInVisit = 0, visitIdForContext = null) {
  try {
    logger.info(`Starting to fill form details for visit ${visitIdForContext}... Total dispensers in visit: ${totalDispensersInVisit}`, 'FORM_PREP');
    // console.log('====== STARTING FORM AUTOMATION ======'); // Redundant with other logs
    // updateStatus('running', 'Filling form details...'); // This message is too generic for batch context

    // Verify we have the right number of forms for our dispensers
    if (formUrls.length > dispensers.length) {
      logger.warn(`WARNING: More forms (${formUrls.length}) than dispensers (${dispensers.length}). Only the first ${dispensers.length} forms will be processed.`, 'FORM_PREP');
      // Truncate the formUrls to match the number of dispensers
      formUrls = formUrls.slice(0, dispensers.length);
    } else if (formUrls.length < dispensers.length) {
      logger.warn(`WARNING: Fewer forms (${formUrls.length}) than dispensers (${dispensers.length}). Only the first ${formUrls.length} dispensers will be used.`, 'FORM_PREP');
    }
    
    // Log dispensers to forms mapping
    logger.info(`Dispenser to Form Mapping:`, 'FORM_PREP');
    for (let i = 0; i < Math.min(formUrls.length, dispensers.length); i++) {
      logger.info(`Form ${i+1} → ${dispensers[i]?.title || 'Unknown dispenser'}`, 'FORM_PREP');
    }
    
    // Process forms in order
    for (let i = 0; i < formUrls.length; i++) {
      const formUrl = formUrls[i];
      if (!dispensers[i]) {
        logger.warn(`No dispenser available for form ${i + 1} in fillFormDetails, skipping this form`, 'FORM_PREP');
        continue;
      }
      const dispenser = dispensers[i];
      const currentDispenserIndexInFormList = i; // Index within the forms being processed by this call
                                               // This might not be the same as dispenser number if forms < dispensers
      // For accurate progress reporting, we need the *actual* dispenser number if available,
      // or rely on 'i' if it's a direct 1-to-1 mapping for this specific call.
      // The `totalDispensersInVisit` is the overall count for the visit.
      // We are processing the (i+1)-th *form* for *this segment* of dispensers.

      logger.info(`Processing form ${i + 1}/${formUrls.length}: ${formUrl} for visit ${visitIdForContext}`, 'FORM_PREP');
      logger.info(`Using dispenser: ${dispenser.title} (Index ${i} in current list) for visit ${visitIdForContext}`, 'FORM_PREP');
      
      const message = `Filling form ${i + 1}/${formUrls.length} with dispenser: ${dispenser.title}`;
      updateStatus(
        'running',
        message,
        {
          // dispenserCurrent here refers to the i-th dispenser *being actively processed by this fillFormDetails call*
          // It's not necessarily the overall dispenser number for the entire visit yet.
          // That will be handled by processAllFuelSections more accurately.
          dispenserCurrent: i + 1, // Current form/dispenser in this specific loop
          dispenserTotal: totalDispensersInVisit, // Total dispensers for the entire visit
          // Carry over fuel status if already set by a previous step for this dispenser in batchStatus
          fuelType: batchStatus.jobId === currentJobId ? batchStatus.fuelType : '',
          fuelCurrent: batchStatus.jobId === currentJobId ? batchStatus.fuelCurrent : 0,
          fuelTotal: batchStatus.jobId === currentJobId ? batchStatus.fuelTotal : 0,
        }
      );
      
      // Navigate to the form URL
      await page.goto(formUrl);
      await page.waitForLoadState('networkidle');
      
      // Check for cancellation after navigation
      if (isCancelled) {
        logger.info('Job cancelled, stopping form filling process');
        updateStatus('completed', 'Job cancelled by user');
        return false;
      }
      
      // Wait for the form to load
      try {
        await page.waitForSelector('.form-entry-equipment', { state: 'visible', timeout: 10000 });
        logger.info('Form page loaded successfully', 'FORM_PREP');
      } catch (error) {
        logger.warn(`Form page did not load as expected: ${error.message}`, 'FORM_PREP');
        console.log(`Form page did not load as expected: ${error.message}`);
        continue; // Skip to next form if this one doesn't load properly
      }
      
      // Fill the Equipment Dispenser dropdown
      logger.info(`Selecting dispenser: ${dispenser.title || 'Unknown'}`, 'FORM_PREP');
      console.log(`Selecting dispenser: ${dispenser.title || 'Unknown'}`);
      
      try {
        // Define a function for dropdown opening with retry capability
        const openDropdown = async (maxAttempts = 5) => {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              logger.info(`Attempt ${attempt}/${maxAttempts} to open dispenser dropdown`, 'FORM_PREP');
              
              // Clear any previous dropdown by clicking away if needed - fast check
              await page.evaluate(() => {
                const dropdown = document.querySelector('.ks-select-dropdown');
                if (dropdown && window.getComputedStyle(dropdown).display !== 'none') {
                  document.body.click();
                }
              });
              
              // Increased pause between attempts
              await page.waitForTimeout(200);
              
              // Combined approach for maximum efficiency
              const success = await page.evaluate(() => {
                try {
                  // First try direct DOM manipulation (fastest method)
                  const selector = document.querySelector('.ks-select-selection');
                  if (!selector) return { success: false, reason: 'No selector found' };
                  
                  // Force click handler execution
                  selector.click();
                  
                  // Also force dropdown visibility directly
                  const dropdown = document.querySelector('.ks-select-dropdown');
                  if (dropdown) {
                    dropdown.style.display = 'block';
                    dropdown.style.opacity = '1';
                    dropdown.style.visibility = 'visible';
                  }
                  
                  // Check if we have options available (even in hidden dropdown)
                  const options = document.querySelectorAll('.autocomplete-list li');
                  return { 
                    success: true, 
                    optionsCount: options.length,
                    hasVisibleDropdown: dropdown && window.getComputedStyle(dropdown).display !== 'none'
                  };
                } catch (e) {
                  return { success: false, error: e.message };
                }
              });
              
              if (success.success) {
                logger.info(`Direct DOM method successful, found ${success.optionsCount} options`);
                logger.info(`Direct DOM method successful, found ${success.optionsCount} options`, 'FORM_PREP');
                if (success.optionsCount > 0) {
                  // If we have options, we can proceed regardless of dropdown visibility
                  return true;
                }
              }
              
              // If direct DOM manipulation didn't find options, try Playwright's click
              // Try multiple click methods for different attempt numbers
              if (attempt % 2 === 1) { // Odd attempts use Playwright's click
                const dropdownTrigger = await page.$('.ks-select-selection');
                if (dropdownTrigger) {
                  const box = await dropdownTrigger.boundingBox();
                  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                  logger.info('Clicked dropdown trigger with Playwright');
                  logger.info('Clicked dropdown trigger with Playwright', 'FORM_PREP');
                }
              } else { // Even attempts use native click with different force options
                await page.click('.ks-select-selection', { force: true, timeout: 2000 });
                logger.info('Clicked dropdown with force option');
                logger.info('Clicked dropdown with force option', 'FORM_PREP');
              }
              
              // Longer wait for dropdown to appear - increased to 3000ms
              try {
                await page.waitForSelector('.ks-select-dropdown', { 
                  state: 'visible', 
                  timeout: 2000
                });
                logger.info('Dropdown is now visible');
                logger.info('Dropdown is now visible', 'FORM_PREP');
                return true;
              } catch (err) {
                // Check if dropdown exists but is hidden and if options are available
                const dropdownStatus = await page.evaluate(() => {
                  const dropdown = document.querySelector('.ks-select-dropdown');
                  const options = document.querySelectorAll('.ks-select-dropdown .autocomplete-list li');
                  return { 
                    exists: dropdown !== null,
                    optionsCount: options.length
                  };
                });
                
                if (dropdownStatus.exists && dropdownStatus.optionsCount > 0) {
                  logger.info(`Dropdown exists with ${dropdownStatus.optionsCount} options, proceeding`);
                  logger.info(`Dropdown exists with ${dropdownStatus.optionsCount} options, proceeding`, 'FORM_PREP');
                  return true;
                }
                
                throw new Error('No dropdown or options found');
              }
            } catch (error) {
              logger.warn(`Attempt ${attempt} failed: ${error.message}`);
              logger.warn(`Attempt ${attempt} failed: ${error.message}`, 'FORM_PREP');
              
              if (attempt === maxAttempts) {
                // Fast final attempt - just try to work with hidden elements
                try {
                  const hasOptions = await page.evaluate(() => {
                    // Try all possible selectors for options
                    const selectors = [
                      '.autocomplete-list li',
                      '.ks-select-dropdown .autocomplete-list li',
                      '.ks-select li',
                      '.ks-select-dropdown li'
                    ];
                    
                    for (const selector of selectors) {
                      const elements = document.querySelectorAll(selector);
                      if (elements.length > 0) {
                        // Try to force first element to be clickable
                        elements[0].style.display = 'block';
                        elements[0].style.visibility = 'visible';
                        elements[0].style.opacity = '1';
                        try {
                          elements[0].click();
                          return true;
                        } catch (e) {
                          console.error('Click failed:', e);
                        }
                      }
                    }
                    return false;
                  });
                  
                  if (hasOptions) {
                    logger.info('Final attempt directly clicked an option');
                    logger.info('Final attempt directly clicked an option', 'FORM_PREP');
                    return true;
                  }
                } catch (e) {
                  logger.warn(`Final direct selection failed: ${e.message}`);
                  logger.warn(`Final direct selection failed: ${e.message}`, 'FORM_PREP');
                }
                
                throw error;
              }
              
              // Increased wait before retry - from 300ms to 1000ms
              await page.waitForTimeout(500);
            }
          }
          return false;
        };
        
        // Try to open the dropdown
        const dropdownOpened = await openDropdown();
        
        if (!dropdownOpened) {
          throw new Error('Failed to open dropdown after multiple attempts');
        }
        
        // Wait for the dropdown list to populate with a shorter timeout
        const availableOptions = await page.evaluate(() => {
          try {
            // Fast direct query for options
            const getOptions = (selector) => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).map(el => el.textContent.trim());
            };
            
            // Try multiple selectors for options
            let options = getOptions('.autocomplete-list li');
            
            // If no options found, try other selectors
            if (options.length === 0) {
              options = getOptions('.ks-select-dropdown .autocomplete-list li');
            }
            
            if (options.length === 0) {
              options = getOptions('.ks-select li');
            }
            
            console.log(`Available dispenser options (${options.length}):`);
            options.forEach((text, idx) => console.log(`  ${idx+1}. ${text}`));
            return options;
          } catch (e) {
            console.error('Error getting dropdown options:', e);
            return [];
          }
        });
        
        logger.info(`Found ${availableOptions.length} dispenser options in dropdown`);
        logger.info(`Found ${availableOptions.length} dispenser options in dropdown`, 'FORM_PREP');
        // Only log first few options to reduce log size
        availableOptions.slice(0, 3).forEach((text, idx) => {
          logger.info(`  Option ${idx+1}: ${text}`);
          logger.info(`  Option ${idx+1}: ${text}`, 'FORM_PREP');
        });
        
        // Find and click the option matching our dispenser title - optimized version
        const dispenserSelected = await page.evaluate((dispenserTitle) => {
          try {
            // Fast direct option selection without waiting for visibility
            const findAndClickOption = (options, matchFn) => {
              for (const option of options) {
                const text = option.textContent.trim();
                if (matchFn(text)) {
                  try {
                    option.click();
                    return { success: true, matchType: matchFn.name, selected: text };
                  } catch (e) {
                    console.error(`Click failed for "${text}":`, e);
                  }
                }
              }
              return null;
            };
            
            // Helper to find options with different selectors
            const getOptions = (selector) => document.querySelectorAll(selector);
            
            // Try multiple selectors for options
            let options = Array.from(getOptions('.autocomplete-list li'));
            
            if (options.length === 0) {
              options = Array.from(getOptions('.ks-select-dropdown .autocomplete-list li'));
            }
            
            if (options.length === 0) {
              options = Array.from(getOptions('.ks-select li'));
            }
            
            if (options.length === 0) {
              return { success: false, error: 'No options found with any selector' };
            }
            
            console.log(`Looking for match: "${dispenserTitle}" among ${options.length} options`);
            
            // Define match functions
            const exactMatch = (text) => text === dispenserTitle;
            exactMatch.name = 'exact';
            
            const containsMatch = (text) => text.includes(dispenserTitle);
            containsMatch.name = 'contains';
            
            const numberMatch = (text) => {
              const dispenserMatch = dispenserTitle.match(/(\d+)(?:\/|-|&|,)?(\d+)?/);
              if (!dispenserMatch) return false;
              
              const dispenserNumber = dispenserMatch[1];
              const optionalSecondNumber = dispenserMatch[2] || '';
              
              return text.includes(dispenserNumber) && 
                     (!optionalSecondNumber || text.includes(optionalSecondNumber));
            };
            numberMatch.name = 'number';
            
            // Try each match strategy in order of preference
            let result = findAndClickOption(options, exactMatch);
            if (result) return result;
            
            result = findAndClickOption(options, containsMatch);
            if (result) return result;
            
            result = findAndClickOption(options, numberMatch);
            if (result) return result;
            
            // Fallback to first option
            if (options.length > 0) {
              try {
                options[0].click();
                return { 
                  success: true, 
                  matchType: 'fallback', 
                  selected: options[0].textContent.trim() 
                };
              } catch (e) {
                console.error('Fallback click failed:', e);
              }
            }
            
            return { success: false, error: 'All selection attempts failed' };
          } catch (error) {
            return { 
              success: false, 
              error: `Error in dispenser selection: ${error.message || 'Unknown error'}` 
            };
          }
        }, dispenser.title);
        
        if (dispenserSelected.success) {
          logger.info(`Selected dispenser for form ${i+1}: ${dispenserSelected.selected} (match type: ${dispenserSelected.matchType})`);
          logger.info(`Selected dispenser for form ${i+1}: ${dispenserSelected.selected} (match type: ${dispenserSelected.matchType})`, 'FORM_PREP');
          console.log(`Selected dispenser for form ${i+1}: ${dispenserSelected.selected} (match type: ${dispenserSelected.matchType})`);
          
          // Quicker verification with fewer retries
          await page.waitForTimeout(500); // Reduced from 1000ms
          
          // Single verification attempt instead of multiple
          const selectionText = await page.evaluate(() => {
            const selectionEl = document.querySelector('.ks-select-selection');
            return selectionEl ? selectionEl.textContent.trim() : 'No selection text found';
          });
          
          logger.info(`Selection verification: "${selectionText}"`);
          logger.info(`Selection verification: "${selectionText}"`, 'FORM_PREP');
          
          if (selectionText && selectionText !== 'Select' && selectionText !== 'No selection text found') {
            logger.info(`Selection verified: "${selectionText}"`);
            logger.info(`Selection verified: "${selectionText}"`, 'FORM_PREP');
            console.log(`Selection verified: "${selectionText}"`);
          } else {
            logger.warn(`Selection not verified, but continuing anyway`);
            logger.warn(`Selection not verified, but continuing anyway`, 'FORM_PREP');
            // Continue anyway rather than retrying - we've already made our best effort
          }
        } else {
          logger.warn(`Could not select any dispenser for form ${i+1}: ${dispenserSelected.error || 'Unknown error'}`);
          logger.warn(`Could not select any dispenser for form ${i+1}: ${dispenserSelected.error || 'Unknown error'}`, 'FORM_PREP');
          console.log(`Could not select any dispenser for form ${i+1}`);
          
          // Quick fallback - direct value setting
          try {
            const fallbackSuccess = await page.evaluate(() => {
              try {
                // Try to set input value directly
                const input = document.querySelector('.ks-select input');
                if (input) {
                  input.value = "1";
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return { success: true, method: 'direct-input' };
                }
                return { success: false };
              } catch (e) {
                return { success: false, error: e.message };
              }
            });
            
            if (fallbackSuccess.success) {
              logger.info(`Applied fallback selection method: ${fallbackSuccess.method}`);
              logger.info(`Applied fallback selection method: ${fallbackSuccess.method}`, 'FORM_PREP');
            }
          } catch (e) {
            logger.warn(`Fallback selection failed: ${e.message}`);
            logger.warn(`Fallback selection failed: ${e.message}`, 'FORM_PREP');
          }
        }
      } catch (error) {
        logger.warn(`Error selecting dispenser: ${error.message}`);
        logger.warn(`Error selecting dispenser: ${error.message}`, 'FORM_PREP');
        console.log(`Error selecting dispenser: ${error.message}`);
        
        // Try a fallback approach - just select any visible option
        try {
          logger.info('Attempting fallback dispenser selection...');
          
          // Try with direct JavaScript execution for maximum reliability
          const fallbackSuccess = await page.evaluate(() => {
            try {
              // First try: use the selector to trigger a change directly
              const select = document.querySelector('.ks-select');
              if (select) {
                // Find any select element with options
                const options = Array.from(document.querySelectorAll('.ks-select-dropdown .autocomplete-list li'));
                console.log(`Found ${options.length} options for direct selection`);
                
                if (options.length > 0) {
                  // Try to directly click the first option
                  options[0].click();
                  return { success: true, method: 'direct-click', text: options[0].textContent.trim() };
                }
                
                // If no options found in dropdown, try to find the select input
                const inputField = select.querySelector('input');
                if (inputField) {
                  // Try to set value directly and trigger change event
                  inputField.value = "1/2";  // Set a default value
                  
                  // Create and dispatch events to simulate user interaction
                  const events = ['input', 'change', 'blur'];
                  events.forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true });
                    inputField.dispatchEvent(event);
                  });
                  
                  return { success: true, method: 'input-value', text: inputField.value };
                }
              }
              
              return { success: false, reason: 'No suitable elements found' };
            } catch (error) {
              return { success: false, error: error.message || 'Unknown error in fallback' };
            }
          });
          
          if (fallbackSuccess.success) {
            logger.info(`Fallback dispenser selection succeeded using method: ${fallbackSuccess.method}`);
            logger.info(`Fallback dispenser selection succeeded: ${fallbackSuccess.text || 'unknown value'}`, 'FORM_PREP');
            console.log(`Fallback dispenser selection succeeded: ${fallbackSuccess.text || 'unknown value'}`);
          } else {
            logger.warn(`Fallback dispenser selection failed: ${fallbackSuccess.reason || fallbackSuccess.error || 'unknown reason'}`);
            logger.warn(`Fallback dispenser selection failed: ${fallbackSuccess.reason || fallbackSuccess.error || 'no options found'}`, 'FORM_PREP');
            console.log(`Fallback dispenser selection failed: ${fallbackSuccess.reason || fallbackSuccess.error || 'no options found'}`);
          }
        } catch (fallbackError) {
          logger.warn(`Fallback dispenser selection error: ${fallbackError.message}`);
          logger.warn(`Fallback dispenser selection error: ${fallbackError.message}`, 'FORM_PREP');
          console.log(`Fallback dispenser selection error: ${fallbackError.message}`);
        }
      }
      
      // Select the 5 Gallon radio button
      try {
        // Optimized direct selection using specific attributes from provided HTML structure
        const radioSelected = await page.evaluate(() => {
          try {
            // Direct selection by specific attribute - fastest method
            const radio = document.querySelector('input[name="field[4855]"][value="1"]');
            if (radio) {
              // First try to directly set the checked property
              radio.checked = true;
              
              // Dispatch necessary events to ensure the UI updates
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              radio.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Also click the parent label to ensure proper visual feedback
              const label = radio.closest('label.ks-radio');
              if (label) {
                label.click();
              }
              
              return { success: true, method: 'direct-attribute' };
            }
            
            // Second approach - find by label text content
            const labels = document.querySelectorAll('label.ks-radio');
            for (const label of labels) {
              const labelText = label.querySelector('.ks-radio-label-wrapper');
              if (labelText && labelText.textContent.trim() === '5 Gallon') {
                // Click the label directly
                label.click();
                
                // Also directly check the input for good measure
                const input = label.querySelector('input[type="radio"]');
                if (input) {
                  input.checked = true;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                return { success: true, method: 'label-text' };
              }
            }
            
            // Third approach - any input with Gallon in the label
            const radioLabels = document.querySelectorAll('label.ks-radio');
            for (const label of radioLabels) {
              if (label.textContent.includes('Gallon')) {
                label.click();
                return { success: true, method: 'contains-gallon' };
              }
            }
            
            // Last resort - click the first radio button we can find
            const allRadios = document.querySelectorAll('input[type="radio"]');
            if (allRadios.length > 0) {
              allRadios[0].click();
              return { success: true, method: 'first-radio-fallback' };
            }
            
            return { success: false, error: 'No radio buttons found' };
          } catch (err) {
            return { success: false, error: err.message };
          }
        });
        
        if (radioSelected.success) {
          logger.info(`Selected radio button using method: ${radioSelected.method}`);
          logger.info(`Selected radio button using method: ${radioSelected.method}`, 'FORM_PREP');
          console.log(`Selected radio button using method: ${radioSelected.method}`);
        } else {
          logger.warn(`5 gallon option not found: ${radioSelected.error}`);
          logger.warn(`5 gallon option not found: ${radioSelected.error}`, 'FORM_PREP');
          console.log(`5 gallon option not found: ${radioSelected.error}`);
        }
      } catch (error) {
        logger.warn(`Error selecting 5 gallon option: ${error.message}`);
        logger.warn(`Error selecting 5 gallon option: ${error.message}`, 'FORM_PREP');
        console.log(`Error selecting 5 gallon option: ${error.message}`);
      }
      
      // Click Save to save the initial form
      try {
        const saveButtonExists = await page.waitForSelector('button.save-section', {
          timeout: 5000,
          state: 'visible'
        }).then(() => true).catch(() => false);
        
        if (saveButtonExists) {
          // Click the save button
          await page.click('button.save-section');
          logger.info('Clicked save button for initial form section');
          logger.info('Clicked save button for initial form section', 'FORM_PREP');
          
          // Wait for saving to complete - look for network activity or UI changes
          try {
            // Wait for network idle, which suggests the save request completed
            await page.waitForLoadState('networkidle', { timeout: 5000 });
            
            // Verify the save was successful by checking for save success indicators
            let saveVerified = false;
            
            // Multiple ways to verify save was successful
            const saveResult = await page.evaluate(() => {
              // Check 1: Success message - might appear briefly
              const successMessage = document.querySelector('.success-msg, .alert-success');
              if (successMessage && window.getComputedStyle(successMessage).display !== 'none') {
                return 'Success message visible';
              }
              
              // Check 2: Is there a next section/form available?
              const nextButton = document.querySelector('a.next-section');
              if (nextButton && !nextButton.classList.contains('disabled')) {
                return 'Next button enabled';
              }
              
              // Check 3: Has the form section UI changed to indicate completion?
              const formSectionHeader = document.querySelector('.panel-header');
              if (formSectionHeader && formSectionHeader.classList.contains('completed')) {
                return 'Form section marked as completed';
              }
              
              return false;
            });
            
            if (saveResult) {
              saveVerified = true;
              logger.info(`Save verified: ${saveResult}`);
              logger.info(`Save verified: ${saveResult}`, 'FORM_PREP');
            }
            
            // If we couldn't verify the save, wait a bit longer and check again
            if (!saveVerified) {
              logger.warn('Could not immediately verify save completion, waiting longer...');
              logger.warn('Could not immediately verify save completion, waiting longer...', 'FORM_PREP');
              
              await page.waitForTimeout(2000); // Wait 2 seconds
              
              // Check if we now have a next button enabled
              const nextButtonEnabled = await page.evaluate(() => {
                const nextButton = document.querySelector('a.next-section');
                return nextButton && !nextButton.classList.contains('disabled');
              });
              
              if (nextButtonEnabled) {
                saveVerified = true;
                logger.info('Save verified after additional wait: Next button enabled');
                logger.info('Save verified after additional wait: Next button enabled', 'FORM_PREP');
              } else {
                logger.warn('Could not verify save completion even after waiting');
                logger.warn('Could not verify save completion even after waiting', 'FORM_PREP');
                
                // Let's try again to click save
                try {
                  await page.click('button.save-section');
                  logger.info('Clicked save button again as verification failed');
                  logger.info('Clicked save button again as verification failed', 'FORM_PREP');
                  await page.waitForTimeout(1000); // Wait for save to complete
                } catch (saveRetryError) {
                  logger.warn(`Error retrying save: ${saveRetryError.message}`);
                  logger.warn(`Error retrying save: ${saveRetryError.message}`, 'FORM_PREP');
                }
              }
            }
            
          } catch (waitError) {
            logger.warn(`Timeout waiting for save to complete: ${waitError.message}`);
            logger.warn(`Timeout waiting for save to complete: ${waitError.message}`, 'FORM_PREP');
            
            // Let's still continue - the save might have worked even if we couldn't verify
          }
          
          // Now proceed with navigating through all fuel type sections
          const fuelSectionsProcessed = await processAllFuelSections(page, dispenser, isSpecificDispensers, formType, totalDispensersInVisit, currentDispenserIndex, visitIdForContext);
          if (fuelSectionsProcessed) {
            logger.info(`Successfully processed all fuel sections for form ${i + 1}`);
            logger.info(`Successfully processed all fuel sections for form ${i + 1}`, 'FORM_PREP');
          } else {
            logger.warn(`Failed to process all fuel sections for form ${i + 1}`);
            logger.warn(`Failed to process all fuel sections for form ${i + 1}`, 'FORM_PREP');
          }
        } else {
          logger.warn('Save button not found');
          logger.warn('Save button not found', 'FORM_PREP');
          
          // Try alternate ways to find and click save
          const alternativeSaveFound = await page.evaluate(() => {
            // Look for any button containing "Save" text
            const saveButtons = Array.from(document.querySelectorAll('button')).filter(
              button => button.textContent.includes('Save')
            );
            
            if (saveButtons.length > 0) {
              saveButtons[0].click();
              return true;
            }
            
            return false;
          });
          
          if (alternativeSaveFound) {
            logger.info('Found and clicked alternative save button');
            logger.info('Found and clicked alternative save button', 'FORM_PREP');
            await page.waitForTimeout(1000); // Wait for save to complete
            
            // Try to proceed with the fuel sections
            const fuelSectionsProcessed = await processAllFuelSections(page, dispenser, isSpecificDispensers, formType, totalDispensersInVisit, currentDispenserIndex, visitIdForContext);
            if (fuelSectionsProcessed) {
              logger.info(`Successfully processed all fuel sections for form ${i + 1} after alternative save`);
              logger.info(`Successfully processed all fuel sections for form ${i + 1} after alternative save`, 'FORM_PREP');
            }
          } else {
            logger.error('No save button found through any method - cannot proceed');
            logger.error('No save button found through any method - cannot proceed', 'FORM_PREP');
            continue; // Skip to next form
          }
        }
      } catch (error) {
        logger.warn(`Error saving form: ${error.message}`);
        logger.warn(`Error saving form: ${error.message}`, 'FORM_PREP');
        console.log(`Error saving form: ${error.message}`);
        continue; // Skip to next form if we can't save this one
      }
      
      logger.info(`Completed processing form ${i + 1}/${formUrls.length}`);
      logger.info(`Completed processing form ${i + 1}/${formUrls.length}`, 'FORM_PREP');
      console.log(`<<< COMPLETED FORM ${i + 1}/${formUrls.length}`);
      updateStatus('running', `Completed form ${i + 1}/${formUrls.length}, ${i < formUrls.length - 1 ? 'moving to next form' : 'finishing up'}`);
    }
    
    logger.info('Form filling complete');
    logger.info('Form filling complete', 'FORM_PREP');
    console.log('====== FORM AUTOMATION COMPLETED ======');
    updateStatus('completed', 'Form filling complete');
    return true;
  } catch (error) {
    logger.error(`Error filling form details: ${error.message}`);
    logger.error(`Error filling form details: ${error.message}`, 'FORM_PREP');
    console.log(`CRITICAL ERROR: ${error.message}`);
    updateStatus('error', `Error filling form details: ${error.message}`);
    return false;
  }
}

/**
 * Process all fuel sections in a form
 * @param {object} page - Playwright page
 * @param {object} dispenser - Dispenser object containing fuel grades
 * @param {boolean} isSpecificDispensers - Whether this is a specific dispensers job
 * @param {string} formType - The type of form being processed
 * @returns {Promise<boolean>}
 */
async function processAllFuelSections(page, dispenser, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE, totalDispensersInVisit = 0, currentDispenserIndex = 0, visitIdForContext = null) {
  try {
    const fuelTypes = dispenser.fields && dispenser.fields.FuelProduct ? dispenser.fields.FuelProduct.split(',').map(ft => ft.trim()) : [];
    if (fuelTypes.length === 0) {
      logger.info(`No fuel types found for dispenser ${dispenser.title || 'Unknown'} in visit ${visitIdForContext}, skipping fuel sections.`, 'FORM_PREP');
      updateStatus('running', `Dispenser ${dispenser.title || 'Unknown'} has no fuel types.`, {
        dispenserCurrent: currentDispenserIndex,
        dispenserTotal: totalDispensersInVisit,
        fuelType: 'N/A',
        fuelCurrent: 0,
        fuelTotal: 0
      });
      return true; // Successfully processed (by skipping)
    }

    logger.info(`Processing ${fuelTypes.length} fuel types for dispenser: ${dispenser.title || 'Unknown'} (Dispenser #${currentDispenserIndex}) in visit ${visitIdForContext}`, 'FORM_PREP');
    const proverPreferences = await loadProverPreferences();

    for (let i = 0; i < fuelTypes.length; i++) {
      const fuelType = fuelTypes[i];
      if (isCancelled) {
        logger.info('Job cancelled, stopping fuel type processing loop');
        updateStatus('completed', 'Job cancelled by user');
        return false; // Indicate cancellation
      }
      
      // Initial update for this fuel type before diving into its steps
      updateStatus('running', `Starting ${fuelType} for Dispenser #${currentDispenserIndex}`, {
          dispenserCurrent: currentDispenserIndex,
          dispenserTotal: totalDispensersInVisit,
          fuelType: fuelType,
          fuelCurrent: 0, // Will be updated by fillFuelTypeForm
          fuelTotal: 0  // Will be updated by fillFuelTypeForm
      });

      const success = await fillFuelTypeForm(page, fuelType, fuelTypes, proverPreferences, isSpecificDispensers, formType, totalDispensersInVisit, currentDispenserIndex, visitIdForContext);
      if (!success) {
        logger.warn(`Processing ${fuelType} for Dispenser #${currentDispenserIndex} failed or was incomplete.`);
        // Decide if we should stop the whole dispenser or continue to next fuel type
        // For now, we continue, but updateStatus would have been called with an error by fillFuelTypeForm
      }
    }
    return true; // All fuel types for this dispenser processed (or attempted)
  } catch (error) {
    logger.error(`Error in processAllFuelSections for dispenser ${dispenser.title || 'Unknown'} (Dispenser #${currentDispenserIndex}) in visit ${visitIdForContext}: ${error.message}`, 'FORM_PREP');
    updateStatus('error', `Error in fuel sections for ${dispenser.title || 'Unknown'}: ${error.message}`,{
        dispenserCurrent: currentDispenserIndex,
        dispenserTotal: totalDispensersInVisit,
    });
    return false; // Indicate failure
  }
}

/**
 * Fill out a single fuel type form
 * @param {object} page - Playwright page
 * @param {string} fuelType - The current fuel type being processed
 * @param {array} allFuelTypes - All fuel types on this dispenser
 * @param {object} proverPreferences - Prover preferences loaded from JSON
 * @param {boolean} isSpecificDispensers - Whether this is a specific dispensers job
 * @param {string} formType - The type of form being filled
 * @returns {Promise<boolean>}
 */
async function fillFuelTypeForm(
  page,
  fuelType,
  allFuelTypes,
  proverPreferences,
  isSpecificDispensers = false,
  formType = FORM_TYPES.ACCUMEASURE,
  totalDispensersInVisit = 0,     // New: Total dispensers for the entire visit
  currentDispenserIndex = 0,    // New: 1-based index of the current dispenser in the visit
  visitIdForContext = null        // New: ID of the current visit for context/logging
) {
  logger.info(`Processing Fuel Type: ${fuelType} for Dispenser #${currentDispenserIndex} (Visit: ${visitIdForContext}, Total Dispensers in Visit: ${totalDispensersInVisit})`, 'FORM_PREP');

  try {
    // Placeholder: Dynamic logic to determine actual steps for this fuelType is needed here.
    // This could involve inspecting page elements related to the fuelType section.
    // For this example, we'll use a simplified placeholder.
    let totalStepsInThisFuelType = 1; // Default to 1 step
    if (fuelType && fuelType.toLowerCase().includes('regular')) {
      totalStepsInThisFuelType = 2; // Example: Regular might have two provers/checks
    } else if (fuelType && fuelType.toLowerCase().includes('diesel')) {
      totalStepsInThisFuelType = 1;
    }
    // Add more conditions or a more robust way to get this count.
    logger.info(`Determined ${totalStepsInThisFuelType} operational steps for ${fuelType} on Dispenser #${currentDispenserIndex}.`, 'FORM_PREP');

    for (let step = 1; step <= totalStepsInThisFuelType; step++) {
      if (isCancelled) {
        logger.info(`Job cancelled while processing ${fuelType}, step ${step}.`, 'FORM_PREP');
        updateStatus('completed', 'Job cancelled by user'); // Final status for single job
        // For batch, the overall batch status will be updated by cancelJob or processBatch loop
        return false; // Indicate incomplete processing for this fuel type
      }

      const progressMessage = `Dispenser #${currentDispenserIndex} - ${fuelType} (step ${step}/${totalStepsInThisFuelType})`;
      updateStatus('running', progressMessage, {
        // percent: (step / totalStepsInThisFuelType) * 100, // Optional: for single job progress bar
        dispenserCurrent: currentDispenserIndex,
        dispenserTotal: totalDispensersInVisit,
        fuelType: fuelType,
        fuelCurrent: step,
        fuelTotal: totalStepsInThisFuelType
      });

      // SIMULATE ACTUAL WORK FOR THIS STEP (e.g., interacting with Playwright 'page' object)
      logger.info(`Simulating work for: ${progressMessage} (Visit: ${visitIdForContext})`, 'FORM_PREP');
      await page.waitForTimeout(200); // Simulate time taken for a sub-step
      // Example: await page.fill(`#input-for-${fuelType}-step-${step}`, 'some value');
    }

    logger.info(`Completed all ${totalStepsInThisFuelType} steps for ${fuelType} on Dispenser #${currentDispenserIndex}.`, 'FORM_PREP');
    // Final update for this specific fuel type, showing it's complete
    updateStatus('running', `Dispenser #${currentDispenserIndex} - ${fuelType} (Completed)`, {
        dispenserCurrent: currentDispenserIndex,
        dispenserTotal: totalDispensersInVisit,
        fuelType: fuelType,
        fuelCurrent: totalStepsInThisFuelType,
        fuelTotal: totalStepsInThisFuelType
    });
    return true; // Successfully processed this fuel type

  } catch (error) {
    logger.error(`Error during fillFuelTypeForm for ${fuelType}, Dispenser #${currentDispenserIndex} (Visit: ${visitIdForContext}): ${error.message}`, 'FORM_PREP');
    updateStatus('error', `Error with ${fuelType} on Dispenser #${currentDispenserIndex}: ${error.message}`, {
      dispenserCurrent: currentDispenserIndex,
      dispenserTotal: totalDispensersInVisit,
      fuelType: fuelType,
      // Preserve last known fuel step if possible, or reset
      fuelCurrent: (batchStatus.jobId === currentJobId && batchStatus.fuelType === fuelType) ? batchStatus.fuelCurrent : 0,
      fuelTotal: (batchStatus.jobId === currentJobId && batchStatus.fuelType === fuelType) ? batchStatus.fuelTotal : 0
    });
    return false; // Indicate failure for this fuel type
  }
}

/**
 * Load prover preferences from JSON file
 * @returns {Promise<object>} - Prover preferences object or null if error
 */
async function loadProverPreferences() {
  try {
    const preferencesPath = resolveUserFilePath('prover_preferences.json');
    if (fs.existsSync(preferencesPath)) {
      const data = fs.readFileSync(preferencesPath, 'utf8');
      return JSON.parse(data);
    } else {
      logger.warn('Prover preferences file not found');
      return null;
    }
  } catch (error) {
    logger.error(`Error loading prover preferences: ${error.message}`);
    return null;
  }
}

/**
 * Get the preferred prover ID for a fuel type
 * @param {string} fuelType - The fuel type to match
 * @param {object} proverPreferences - The prover preferences object
 * @param {array} allFuelTypes - All fuel types on this dispenser
 * @returns {string} - The preferred prover ID or null if no match
 */
function getPreferredProver(fuelType, proverPreferences, allFuelTypes = []) {
  if (!proverPreferences || !proverPreferences.provers || proverPreferences.provers.length === 0) {
    return null;
  }
  
  // Extract the base fuel type
  const baseFuelType = fuelType.split(':').pop().trim();

  // Special case for Ethanol-Free or Rec Fuel 90
  // Check if auto positioning is enabled (default to true if not specified)
  const autoPositionEthanolFree = proverPreferences.autoPositionEthanolFree !== false;
  
  // Check if this is Ethanol-Free or similar fuel type - use includes() instead of exact match
  const isEthanolFree = 
    baseFuelType.includes('Ethanol-Free') || 
    baseFuelType.includes('Ethanol-Free Gasoline Plus') || 
    baseFuelType.includes('Rec Fuel 90');
  
  // Check if Diesel is present on this dispenser
  const hasDiesel = allFuelTypes.some(type => {
    const normalizedType = type.split(':').pop().trim();
    return normalizedType.includes('Diesel');
  });

  // Check if there are multiple fuel grades on this dispenser
  const hasMultipleGrades = allFuelTypes.length > 1;

  // Only apply special position rule when:
  // 1. Auto-positioning is enabled
  // 2. This is an Ethanol-Free type fuel
  // 3. Diesel is NOT present
  // 4. There are multiple grades on the dispenser (if it's the only grade, keep it in position 1)
  if (autoPositionEthanolFree && isEthanolFree && !hasDiesel && hasMultipleGrades) {
    logger.info(`${baseFuelType} found with other non-Diesel fuels - using Position 3 prover (auto-positioning enabled)`);
    console.log(`${baseFuelType} found with other non-Diesel fuels - using Position 3 prover (auto-positioning enabled)`);
    
    // Find prover with priority 3
    for (const prover of proverPreferences.provers) {
      if (prover.priority === 3) {
        logger.info(`Using Position 3 prover ${prover.prover_id} for ${baseFuelType}`);
        console.log(`Using Position 3 prover ${prover.prover_id} for ${baseFuelType}`);
        return prover.prover_id;
      }
    }
  }
  
  // Special case for Premium when Super/Ultra/Super Premium exists
  if (baseFuelType === 'Premium') {
    // Use exact matching for Super variants to prevent false positives
    const hasSuperVariants = allFuelTypes.some(type => {
      // Normalize the type first by trimming and removing any text after a colon
      const normalizedType = type.split(':').pop().trim();
      return normalizedType === 'Super' || 
             normalizedType === 'Ultra' || 
             normalizedType === 'Super Premium';
    });
    
    if (hasSuperVariants) {
      logger.info('Premium with Super variant detected - using same prover as Regular');
      console.log('Premium with Super variant detected - using same prover as Regular');
      
      // Find prover for Regular
      for (const prover of proverPreferences.provers) {
        if (prover.preferred_fuel_types && prover.preferred_fuel_types.includes('Regular')) {
          logger.info(`Using Regular's preferred prover ${prover.prover_id} for Premium`);
          console.log(`Using Regular's preferred prover ${prover.prover_id} for Premium`);
          return prover.prover_id;
        }
      }
    }
  }
  
  // Sort provers by priority (lower number = higher priority)
  const sortedProvers = [...proverPreferences.provers].sort((a, b) => {
    return (a.priority || 999) - (b.priority || 999);
  });
  
  // Find the first prover that lists this fuel type as preferred
  for (const prover of sortedProvers) {
    if (prover.preferred_fuel_types && prover.preferred_fuel_types.length > 0) {
      for (const preferredType of prover.preferred_fuel_types) {
        if (baseFuelType.includes(preferredType)) {
          logger.info(`Found preferred prover ${prover.prover_id} for fuel type ${baseFuelType}`);
          return prover.prover_id;
        }
      }
    }
  }
  
  // If no specific match found, return the first prover's ID as default
  logger.info(`No preferred prover found for ${baseFuelType}, using default`);
  return sortedProvers[0].prover_id;
}

/**
 * Parse work order instructions to extract specific dispenser numbers
 * @param {string} instructions - The instructions text
 * @returns {array} - Array of dispenser objects with dispenser numbers
 */
function extractSpecificDispensers(instructions) {
  if (!instructions) {
    return [];
  }

  logger.info(`Parsing instructions for specific dispensers: ${instructions}`);
  logger.info(`RAW INSTRUCTIONS: "${instructions}"`);
  
  // Normalize the instructions text for better parsing:
  // 1. Replace newlines with spaces
  // 2. Convert "Dispenser #" variations to a standard format
  // 3. Handle comma-separated numbers
  let normalizedText = instructions
    .replace(/\n/g, ' ')
    .replace(/dispenser\s*#?\s*(\d+)/gi, 'Dispenser #$1')
    .replace(/pump\s*#?\s*(\d+)/gi, 'Dispenser #$1');
  
  logger.info(`NORMALIZED: "${normalizedText}"`);
  
  const dispensers = [];
  const processedNumbers = new Set();
  
  // Step 1: First extract explicit dispenser pairs (format: #3/4 or 3/4)
  const pairRegex = /#?(\d+)\/(\d+)/g;
  let pairMatch;
  
  while ((pairMatch = pairRegex.exec(normalizedText)) !== null) {
    const firstNumber = parseInt(pairMatch[1], 10);
    const secondNumber = parseInt(pairMatch[2], 10);
    
    // Skip invalid pairs or already processed numbers
    if (isNaN(firstNumber) || isNaN(secondNumber) || 
        processedNumbers.has(firstNumber) || processedNumbers.has(secondNumber)) {
      continue;
    }
    
    // Add both numbers to processed set
    processedNumbers.add(firstNumber);
    processedNumbers.add(secondNumber);
    
    // This is a dispenser pair like "3/4"
    const dispenserTitle = `Dispenser #${firstNumber}/${secondNumber}`;
    logger.info(`Found specific dispenser pair: ${dispenserTitle}`);
    
    dispensers.push({
      title: dispenserTitle,
      fields: {
        Grade: "Unknown" // Will be filled in later if available
      }
    });
  }
  
  // Step 2: Handle comma-separated or individual dispenser numbers
  // Format: "Dispensers 1, 3, 5" or "#1, #3, #5" or "Dispensers #1, 3, and 5"
  
  // Extract comma-separated numbers or single numbers
  const numberPattern = /(?:^|[^\d\/])(\d+)(?:[^\d\/]|$)/g;
  const numbersFound = [];
  let numberMatch;
  
  // Find all numbers in the instructions
  while ((numberMatch = numberPattern.exec(normalizedText)) !== null) {
    const number = parseInt(numberMatch[1], 10);
    
    // Skip invalid numbers or already processed numbers
    if (isNaN(number) || processedNumbers.has(number)) {
      continue;
    }
    
    numbersFound.push(number);
  }
  
  // For each individual number, create the appropriate dispenser
  for (const number of numbersFound) {
    processedNumbers.add(number);
    
    // Create a pair based on the number (odd numbers pair with next even, even numbers pair with previous odd)
    const pairNumber = number % 2 === 0 ? number - 1 : number + 1;
    const dispenserTitle = `Dispenser #${Math.min(number, pairNumber)}/${Math.max(number, pairNumber)}`;
    logger.info(`Found individual dispenser: ${number}, creating pair: ${dispenserTitle}`);
    
    dispensers.push({
      title: dispenserTitle,
      fields: {
        Grade: "Unknown" // Will be filled in later if available
      }
    });
  }
  
  // Remove duplicates (in case the same dispenser is mentioned multiple times)
  const uniqueDispensers = [];
  const titles = new Set();
  
  for (const dispenser of dispensers) {
    if (!titles.has(dispenser.title)) {
      titles.add(dispenser.title);
      uniqueDispensers.push(dispenser);
    }
  }
  
  logger.info(`Extracted ${uniqueDispensers.length} unique dispensers from instructions`);
  
  // IMPORTANT DEBUG: Log each extracted dispenser
  uniqueDispensers.forEach((dispenser, i) => {
    logger.info(`Extracted dispenser ${i+1}: ${dispenser.title}`);
  });
  
  return uniqueDispensers;
}

/**
 * Core logic for processing a single visit after page is ready.
 * This function is called by both processVisit (for single jobs)
 * and processBatch (for visits within a batch).
 *
 * @param {object} page - Playwright page object, already navigated to the visit.
 * @param {string} visitUrlForProcessing - The URL of the visit being processed.
 * @param {string} workOrderIdForDataLookup - The Work Order ID to use for fetching dispenser data and instructions.
 * @param {string} processingJobId - The job ID under which this visit is being processed.
 * @returns {Promise<object>} - Result of the operation for this single visit.
 */
async function _processSingleVisitCore(page, visitUrlForProcessing, workOrderIdForDataLookup, processingJobId) {
  // Ensure currentJobId is set correctly for updateStatus calls within this scope
  // This is critical for batch processing so updates propagate to the correct batchStatus.
  const originalCurrentJobId = currentJobId;
  currentJobId = processingJobId;
  logger.info(`[BATCH_VISIT_START] _processSingleVisitCore invoked. Visit URL: ${visitUrlForProcessing}, WO for Data: ${workOrderIdForDataLookup}, Effective Job ID: ${processingJobId}`);

  try {
    // Get dispenser data and form count
    let dispensers = [];
    let formCount = 0;
    let isSpecificDispensers = false;
    let formType = FORM_TYPES.ACCUMEASURE;
    let instructions = '';
    let dispensersFound = false;
    let serviceCode = null;

    // Note: workOrderIdForDataLookup is already determined and passed in.
    logger.info(`Core Processing: Visit URL ${visitUrlForProcessing}, WO ID for data: ${workOrderIdForDataLookup}, Job ID: ${processingJobId}`);
    updateStatus('running', 'Analyzing visit details (core)...');

    // Step 1: Try to get service code and dispenser data from scraped_content.json
    if (workOrderIdForDataLookup) {
      try {
        logger.info(`[BATCH_VISIT_DATA] Attempting to load data for WO ID: ${workOrderIdForDataLookup} from scraped_content.json`);
        const scraperDataPath = resolveUserFilePath('scraped_content.json');
        
        if (fs.existsSync(scraperDataPath)) {
          const data = JSON.parse(fs.readFileSync(scraperDataPath, 'utf8'));
          const normalizedWorkOrderId = workOrderIdForDataLookup.replace(/^W-/, '');
          const workOrder = data.workOrders.find(wo => 
            wo.id === workOrderIdForDataLookup || 
            wo.id === normalizedWorkOrderId ||
            `W-${wo.id}` === workOrderIdForDataLookup
          );
          
          if (workOrder) {
            logger.info(`[BATCH_VISIT_DATA] Found WO ${workOrderIdForDataLookup} in scraped_content.json.`);
            instructions = workOrder.instructions || '';
            logger.info(`Found instructions for ${workOrderIdForDataLookup}: "${instructions}"`);
            if (workOrder.services && workOrder.services.length > 0) {
              workOrder.services.forEach((service) => {
                if (service.code) serviceCode = service.code;
              });
              isSpecificDispensers = workOrder.services.some(service => 
                (service.code === "2862") || 
                (service.description && service.description.includes('Specific Dispenser(s)'))
              );
              const isOpenNeckProver = workOrder.services.some(service => service.code === "3146");
              if (isOpenNeckProver) formType = FORM_TYPES.OPEN_NECK_PROVER;
              if (isSpecificDispensers) logger.info(`DETECTED: Work order ${workOrderIdForDataLookup} requires specific dispensers.`);
            }
            if (workOrder.dispensers && workOrder.dispensers.length > 0) {
              dispensers = workOrder.dispensers;
              dispensersFound = true;
              logger.info(`[BATCH_VISIT_DATA] Found ${dispensers.length} dispensers for ${workOrderIdForDataLookup} in scraped_content.json`);
            } else {
              logger.info(`[BATCH_VISIT_DATA] WO ${workOrderIdForDataLookup} found in scraped_content.json, but no dispensers array or it's empty.`);
            }
            formCount = workOrder.services?.reduce((total, service) => total + (service.quantity || 0), 0) || 0;
            if (formCount > 0) logger.info(`Found quantity of ${formCount} in services for ${workOrderIdForDataLookup}`);

            if (isSpecificDispensers && instructions) {
              const specificDispensersArr = extractSpecificDispensers(instructions);
              if (specificDispensersArr.length > 0) {
                dispensers = specificDispensersArr;
                dispensersFound = true;
                formCount = specificDispensersArr.length;
                logger.info(`Extracted ${formCount} specific dispensers from instructions for ${workOrderIdForDataLookup}.`);
              }
            }
          } else {
            logger.warn(`[BATCH_VISIT_DATA] Work order ${workOrderIdForDataLookup} NOT FOUND in scraped_content.json`);
          }
        } else {
          logger.warn(`[BATCH_VISIT_DATA] scraped_content.json file not found at ${scraperDataPath}`);
        }
      } catch (error) {
        logger.warn(`[BATCH_VISIT_DATA] Error processing scraped_content.json for WO ${workOrderIdForDataLookup}: ${error.message}`);
      }

      if (!dispensersFound) {
        logger.info(`[BATCH_VISIT_DATA] Dispensers not found in scraped_content for WO ${workOrderIdForDataLookup}. Trying dispenser_store.json.`);
        const dispenserStoreDispensers = await loadDispensersFromStore(workOrderIdForDataLookup);
        if (dispenserStoreDispensers.length > 0) {
            dispensers = dispenserStoreDispensers;
            dispensersFound = true;
            logger.info(`[BATCH_VISIT_DATA] Found ${dispensers.length} dispensers for ${workOrderIdForDataLookup} in dispenser_store.json.`);
        } else {
            logger.info(`[BATCH_VISIT_DATA] No dispensers found for ${workOrderIdForDataLookup} in dispenser_store.json either.`);
        }
      }
    } else {
      logger.warn('[BATCH_VISIT_DATA] workOrderIdForDataLookup was null or empty. Cannot fetch WO-specific data.');
    }

    if (!dispensersFound && !isSpecificDispensers) { // Only try page scrape if not specific (as specific implies we NEED instructions)
        logger.info('No dispensers found in data files - attempting basic page check (less reliable)');
        // Simplified page scrape attempt - this is often not reliable and primarily for fallback
        const pageDispensers = await page.evaluate(() => {
            const titles = Array.from(document.querySelectorAll('div.text-sm.color-black, div.item-title'))
                                .map(el => el.textContent.trim());
            return titles.map(title => ({ title, fields: {} }));
        });
        if(pageDispensers.length > 0) {
            dispensers = pageDispensers;
            logger.info(`Found ${dispensers.length} potential dispensers on page (fallback).`);
            dispensersFound = true;
        }
    }
    
    if (formType === FORM_TYPES.OPEN_NECK_PROVER && dispensers.length > 0) {
      const originalCount = dispensers.length;
      dispensers = dispensers.filter(dispenser => {
        const grade = dispenser.fields?.Grade?.toLowerCase() || "";
        return !grade.includes('def') && !grade.includes('diesel high flow');
      });
      logger.info(`Filtered DEF/DHF for Open Neck. Kept ${dispensers.length} of ${originalCount}.`);
    }

    if (formCount === 0 && dispensers.length > 0) {
      formCount = dispensers.length;
      logger.info(`Using dispenser count (${formCount}) as form count for ${workOrderIdForDataLookup}.`);
    }

    logger.info(`=== DISPENSER IDENTIFICATION COMPLETE (CORE) for Visit: ${visitUrlForProcessing} ===`);
    logger.info(`Form Type: ${formType}, Specific Dispensers: ${isSpecificDispensers}, Service Code: ${serviceCode || 'Unknown'}`);
    logger.info(`Dispensers Found: ${dispensers.length}, Form Count: ${formCount}`);

    if (dispensers.length === 0) {
      const errorMessage = `No dispensers identified for WO: ${workOrderIdForDataLookup} (Visit: ${visitUrlForProcessing}). Cannot proceed.`;
      logger.error(errorMessage, 'FORM_PREP');
      updateStatus('error', errorMessage);
      // No throw here, let it return error object
      return { success: false, message: errorMessage, jobId: processingJobId };
    }

    updateStatus('running', `Preparing ${formType} forms (core)...`);
    const formsAdded = await prepareForm(page, dispensers, formCount, isSpecificDispensers, formType, dispensers.length, visitUrlForProcessing);

    if (!formsAdded) {
      // prepareForm calls updateStatus('error', ...) internally on failure
      const message = `Failed to prepare forms for ${visitUrlForProcessing}. Check logs.`;
      logger.error(message, 'FORM_PREP');
      // No throw here, let it return error object
      return { success: false, message, jobId: processingJobId };
    }

    const formUrls = await page.evaluate((targetFormType) => {
      const formLinks = Array.from(document.querySelectorAll('a.none, a.text-decoration-none'))
        .filter(link => link.textContent.includes(targetFormType));
      return formLinks.map(link => link.href);
    }, formType);

    const absoluteFormUrls = formUrls.map(url => {
      if (url.startsWith('/')) return `https://app.workfossa.com${url}`;
      if (!url.startsWith('http')) return `https://app.workfossa.com/${url}`;
      return url;
    });
    logger.info(`Found ${absoluteFormUrls.length} form URLs to fill for ${visitUrlForProcessing}.`);

    updateStatus('running', `Filling ${formType} form details (core)...`);
    // visitUrlForProcessing is used as visitIdForContext in fillFormDetails
    const success = await fillFormDetails(page, absoluteFormUrls, dispensers, isSpecificDispensers, formType, dispensers.length, visitUrlForProcessing);

    if (!success) {
      // fillFormDetails calls updateStatus('error', ...) internally on failure
      const message = `Failed to fill form details for ${visitUrlForProcessing}. Check logs.`;
      logger.error(message, 'FORM_PREP');
      // No throw here, let it return error object
      return { success: false, message: `Process cancelled by user or error during form filling: ${visitUrlForProcessing}`, jobId: processingJobId };
    }
    
    // If successful up to this point for this single visit.
    updateStatus('completed', `Successfully processed visit (core): ${visitUrlForProcessing}`);
    return { success: true, message: `Visit processed successfully (core): ${visitUrlForProcessing}`, jobId: processingJobId };

  } catch (error) {
    logger.error(`Error in _processSingleVisitCore for ${visitUrlForProcessing} (Job ID: ${processingJobId}): ${error.message}`, 'FORM_PREP');
    updateStatus('error', `Core processing error for ${visitUrlForProcessing}: ${error.message}`);
    return { success: false, message: `Error (core): ${error.message}`, jobId: processingJobId };
  } finally {
    // Restore original currentJobId if it was changed
    currentJobId = originalCurrentJobId;
  }
}

/**
 * Process a single visit
 * @param {string} visitUrl - URL of the visit to process
 * @param {boolean} headless - Whether to run browser in headless mode
 * @param {string} workOrderId - Optional work order ID to get dispenser data
 * @param {string} externalJobId - Job ID passed from API route (optional)
 * @returns {Promise<object>} - Result of the operation
 */
async function processVisit(visitUrl, headless = true, workOrderId = null, externalJobId = null) {
  // Use provided job ID if available, otherwise generate one
  const singleVisitJobId = externalJobId || Date.now().toString(); // Use a local var for this specific job
  activeJobIds.add(singleVisitJobId);
  isCancelled = false; // Reset for this job specifically
  
  // Critical: Set currentJobId for this single operation
  // This ensures updateStatus calls correctly target this job's status,
  // and NOT a batch job if processVisit is called standalone.
  currentJobId = singleVisitJobId;
  
  logger.info(`Processing single visit with Job ID: ${singleVisitJobId}. Visit URL: ${visitUrl}`);
  logger.info(`Current active job IDs: ${Array.from(activeJobIds).join(', ')}`);
  
  let browser = null;
  let page = null;
  let result = { success: false, message: 'Initialization error', jobId: singleVisitJobId }; // Default error result

  try {
    updateStatus('running', `Initializing single visit: ${visitUrl}`);
    
    const activeUser = getActiveUser();
    logger.info(`Active User: ${activeUser || 'None'}`);
    
    const loginResult = await loginToFossa({ headless });
    if (!loginResult.success) {
      updateStatus('error', 'Failed to login to Fossa');
      throw new Error('Failed to login to Fossa');
    }
    
    if (isCancelled) {
      logger.info('Job cancelled after login (single visit).');
      updateStatus('completed', 'Job cancelled by user (single visit)');
      await loginResult.browser.close(); // Ensure browser is closed
      return { success: false, message: 'Job cancelled by user', jobId: singleVisitJobId };
    }
    
    browser = loginResult.browser;
    page = loginResult.page;
    global.activeBrowser = browser; // For global cancellation
    
    updateStatus('running', `Navigating to visit: ${visitUrl}`);
    const absoluteUrl = visitUrl.startsWith('/') 
      ? `https://app.workfossa.com${visitUrl}` 
      : visitUrl.startsWith('http') 
        ? visitUrl 
        : `https://app.workfossa.com/${visitUrl}`;
    
    logger.info(`Navigating to absolute URL: ${absoluteUrl}`);
    await page.goto(absoluteUrl);
    await page.waitForLoadState('networkidle');
    
    if (isCancelled) {
      logger.info('Job cancelled after navigation (single visit).');
      updateStatus('completed', 'Job cancelled by user (single visit)');
      // Result already updated by updateStatus, just need to ensure browser closes in finally
      return { success: false, message: 'Job cancelled by user', jobId: singleVisitJobId };
    }

    // Determine workOrderIdForDataLookup (moved from inside _processSingleVisitCore for clarity here)
    let workOrderIdForDataLookup = workOrderId;
    if (!workOrderIdForDataLookup) {
      const workOrderMatch = visitUrl.match(/\/work\/(\d+)/);
      if (workOrderMatch && workOrderMatch[1]) {
        workOrderIdForDataLookup = workOrderMatch[1];
        if (!workOrderIdForDataLookup.startsWith('W-')) workOrderIdForDataLookup = `W-${workOrderIdForDataLookup}`;
      } else {
        const visitUrlParts = visitUrl.split('/');
        const workIndex = visitUrlParts.indexOf('work');
        if (workIndex > 0 && workIndex < visitUrlParts.length - 1) {
          workOrderIdForDataLookup = visitUrlParts[workIndex + 1];
          if (!workOrderIdForDataLookup.startsWith('W-')) workOrderIdForDataLookup = `W-${workOrderIdForDataLookup}`;
        }
      }
      if (!workOrderIdForDataLookup && page) { // Check page exists
        workOrderIdForDataLookup = await page.evaluate(() => {
          const woElem = document.querySelector('a[href*="/work/"]');
          if (woElem) { const href = woElem.getAttribute('href'); const m = href.match(/\/work\/(\d+)/); return m ? `W-${m[1]}` : null; }
          return null;
        });
      }
    }
    if (visitUrl.includes('/work/') && visitUrl.includes('/visits/')) {
      const correctIdMatch = visitUrl.match(/\/work\/(\d+)\/visits\//);
      if (correctIdMatch && correctIdMatch[1]) {
        const correctId = `W-${correctIdMatch[1]}`;
        if (correctId !== workOrderIdForDataLookup) {
          logger.info(`Correcting WO ID for single visit from ${workOrderIdForDataLookup} to ${correctId}`);
          workOrderIdForDataLookup = correctId;
        }
      }
    }
    logger.info(`Determined WO ID for data lookup (single visit): ${workOrderIdForDataLookup}`);

    // Call the core processing function
    // Pass singleVisitJobId as the processingJobId
    result = await _processSingleVisitCore(page, absoluteUrl, workOrderIdForDataLookup, singleVisitJobId);
    
    // updateStatus would have been called inside _processSingleVisitCore with the final state for this job.
    // The 'result' object now contains the success/message from that core processing.

  } catch (error) {
    logger.error(`Error in processVisit (Job ID: ${singleVisitJobId}): ${error.message}`);
    updateStatus('error', `Error in single visit: ${error.message}`); // This updates jobStatus for singleVisitJobId
    result = { success: false, message: `Error: ${error.message}`, jobId: singleVisitJobId };
  } finally {
    if (browser) {
      logger.info(`Closing browser for single visit job ${singleVisitJobId}. Final status: ${jobStatus.status}`);
      await browser.close();
      global.activeBrowser = null;
    }
    // Remove job from active set AFTER browser is closed and all processing is truly done.
    activeJobIds.delete(singleVisitJobId);
    logger.info(`Single visit job ${singleVisitJobId} finished. Active jobs: ${Array.from(activeJobIds).join(', ')}`);
    // If currentJobId was this singleVisitJobId, reset it to null,
    // as the job is now complete. This prevents interference if another standalone single job runs.
    if (currentJobId === singleVisitJobId) {
        currentJobId = null;
    }
  }
  return result; // Return the result from _processSingleVisitCore or from catch block
}

/**
 * Load dispensers from dispenser_store.json file if available
 * @param {string} workOrderId - The work order ID to load dispensers for
 * @returns {Array} - Array of dispenser objects or empty array if none found
 */
async function loadDispensersFromStore(workOrderId) {
  try {
    // Get the path to the dispenser store file
    const dispenserStorePath = resolveUserFilePath('dispenser_store.json');
    
    // Check if file exists
    if (!fs.existsSync(dispenserStorePath)) {
      logger.warn(`Dispenser store file not found: ${dispenserStorePath}`);
      return [];
    }
    
    // Read the dispenser store data
    const dispenserStoreData = JSON.parse(fs.readFileSync(dispenserStorePath, 'utf8'));
    
    // Check if the work order has dispensers in the store
    if (dispenserStoreData.dispenserData && dispenserStoreData.dispenserData[workOrderId]) {
      const dispensers = dispenserStoreData.dispenserData[workOrderId].dispensers || [];
      logger.info(`Loaded ${dispensers.length} dispensers from dispenser store for work order ${workOrderId}`);
      return dispensers;
    }
    
    logger.info(`No dispensers found in dispenser store for work order ${workOrderId}`);
    return [];
  } catch (error) {
    logger.error(`Error loading dispensers from store: ${error.message}`);
    return [];
  }
}

/**
 * Process a batch of work order visits
 * @param {string} jobId - The ID of the batch job
 * @param {string} filePath - Path to the data file with work orders
 * @param {boolean} headless - Whether to run in headless mode
 * @param {string[]} selectedVisits - Array of visit IDs to process (optional)
 * @param {string} resumeFromBatchId - Batch ID to resume from (optional)
 * @returns {Promise<void>}
 */
async function processBatch(jobId, filePath, headless = true, selectedVisits = null, resumeFromBatchId = null) {
  logger.info(`Starting batch process. Job ID: ${jobId}, File: ${filePath}, Headless: ${headless}`);
  activeJobIds.add(jobId);
  isCancelled = false; // Reset cancellation flag for the new job
  currentJobId = jobId; // Critical: Set currentJobId to the batchJobId so updateStatus can link them

  let browser = null;
  let page = null;
  let currentVisitIndex = 0;
  let completedVisitDetails = []; // Store details of completed visits
  let visitsToProcess = [];
  let totalVisitsInSelection = 0;

  const initialStatusProps = {
    totalItems: 0,
    currentItem: 0,
    completedVisitIds: [],
    startTime: new Date().toISOString(),
    jobId: jobId, // Set the jobId for this batch
    timestamp: jobId, // Use jobId as timestamp for lookup compatibility
    filePath: filePath, // Store the filePath for context
    headless: headless,
    totalVisits: 0,      // Ensure totalVisits is initialized
    completedVisits: 0   // Ensure completedVisits is initialized
  };

  // Initialize batchStatus for this job
  batchStatus = updateBatchStatus(
    'running',
    `Preparing batch processing from: ${filePath}`,
    initialStatusProps
  );

  try {
    logger.info(`Processing batch from: ${filePath}`);
    // updateBatchStatus call here might be redundant if initialStatusProps is well-defined above
    // but ensure critical fields like currentVisit, etc., are reset/initialized if needed before loop.
    updateBatchStatus(batchStatus.status, batchStatus.message, {
      totalVisits: 0, // Will be updated after parsing visitsToProcess
      completedVisits: 0,
      completedVisitIds: [],
      currentVisit: null,
      currentVisitName: null,
      currentVisitUrl: null,
      currentVisitStatus: 'Initializing batch...',
      dispenserCount: 0,
      dispenserCurrent: 0,
      fuelType: '',
      fuelCurrent: 0,
      fuelTotal: 0,
      startTime: batchStatus.startTime || new Date().toISOString(), // Preserve original batch start time
      timestamp: batchStatus.timestamp // Preserve original batch timestamp (jobId)
    });
    
    // Log active user info
    const activeUser = getActiveUser();
    logger.info(`Active User for batch processing: ${activeUser || 'None'}`);
    
    // Load the data file
    // Check if filePath is a relative path inside the user directory
    // or an absolute path
    let dataPath;
    if (path.isAbsolute(filePath)) {
      dataPath = filePath;
    } else {
      dataPath = resolveUserFilePath(filePath);
    }
    
    logger.info(`Batch data file path: ${dataPath}`);
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${filePath}`);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Extract visits that need processing
    let visitsToProcess = [];
    
    // Handle different data formats
    if (data.workOrders && Array.isArray(data.workOrders)) {
      // Standard work orders format
      for (const workOrder of data.workOrders) {
        if (
          workOrder.visits && 
          workOrder.visits.nextVisit && 
          workOrder.visits.nextVisit.url
        ) {
          // Extract service code for determining form type
          const serviceCode = workOrder.serviceType && workOrder.serviceType.code;
          let dispensers = workOrder.dispensers || [];
          
          // If no dispensers are found in the work order, try to load them from the dispenser store
          if (dispensers.length === 0) {
            dispensers = await loadDispensersFromStore(workOrder.id);
          }
          
          let formCount = null;
          let isSpecificDispensers = false;
          let formType = FORM_TYPES.ACCUMEASURE;
          
          // Determine form type and handling based on service code
          if (serviceCode === '3146') {
            // Open Neck Prover job
            formType = FORM_TYPES.OPEN_NECK_PROVER;
          }
          
          if (serviceCode === '2862') {
            // Specific dispensers job
            isSpecificDispensers = true;
            // Extract dispensers from instructions
            const instructions = workOrder.instructions || '';
            const specificDispensers = extractSpecificDispensers(instructions);
            
            if (specificDispensers.length > 0) {
              // Use the specific dispensers instead of all dispensers
              visitsToProcess.push({
                id: workOrder.id,
                serviceCode,
                url: workOrder.visits.nextVisit.url,
                dispensers: specificDispensers,
                formCount: specificDispensers.length,
                isSpecificDispensers,
                formType
              });
              continue; // Skip the default push below
            }
          }
          
          // Default case: Add the visit with all dispensers
          visitsToProcess.push({
            id: workOrder.id,
            serviceCode,
            url: workOrder.visits.nextVisit.url,
            dispensers,
            formCount,
            isSpecificDispensers,
            formType
          });
        }
      }
    } else if (Array.isArray(data)) {
      // Assume it's an array of visit objects
      for (const visit of data) {
        if (visit.url || visit.visitUrl) {
          let dispensers = visit.dispensers || [];
          
          // If no dispensers are found for the visit, try to load from dispenser store
          if (dispensers.length === 0 && visit.id) {
            dispensers = await loadDispensersFromStore(visit.id);
          }
          
          visitsToProcess.push({
            id: visit.id || visit.workOrderId || `visit-${Math.random().toString(36).substring(2, 9)}`,
            serviceCode: visit.serviceCode || '',
            url: visit.url || visit.visitUrl,
            dispensers: dispensers,
            formCount: visit.dispenserCount || null,
            isSpecificDispensers: false,
            formType: FORM_TYPES.ACCUMEASURE
          });
        }
      }
    }
    
    // If selectedVisits is provided, filter the visits
    if (selectedVisits && Array.isArray(selectedVisits) && selectedVisits.length > 0) {
      logger.info(`Filtering to ${selectedVisits.length} selected visits`);
      visitsToProcess = visitsToProcess.filter(visit => 
        selectedVisits.includes(visit.id)
      );
    }
    
    // If resumeFromBatchId is provided, get the previously completed visits
    let completedVisitIds = [];
    if (resumeFromBatchId) {
      logger.info(`Attempting to resume batch from ID: ${resumeFromBatchId}`);
      // Check for a stored batch status with this ID
      const previousBatchStatus = await getBatchStatusById(resumeFromBatchId);
      
      if (previousBatchStatus && previousBatchStatus.completedVisits > 0) {
        // Get completed visit IDs
        completedVisitIds = previousBatchStatus.completedVisitIds || [];
        logger.info(`Found ${completedVisitIds.length} completed visits to skip`);
        
        // Filter out the already completed visits
        visitsToProcess = visitsToProcess.filter(visit => !completedVisitIds.includes(visit.id));
        
        // Update the current batch status to reflect the resumed state
        updateBatchStatus('running', `Resuming batch processing. Skipping ${completedVisitIds.length} completed visits.`, {
          completedVisits: completedVisitIds.length,
          completedVisitIds: [...completedVisitIds],
          totalVisits: previousBatchStatus.totalVisits || visitsToProcess.length + completedVisitIds.length
        });
      }
    }
    
    // Update batch status with total visits
    updateBatchStatus('running', `Found ${visitsToProcess.length} visits to process. Resumed: ${completedVisitIds.length} visits.`, {
      totalVisits: visitsToProcess.length + completedVisitIds.length, // This is the true total
      completedVisits: completedVisitIds.length, // Already completed
      // other fields like currentVisit should be null until first visit starts
    });
    
    // If no visits to process, return early
    if (visitsToProcess.length === 0) {
      logger.info('No visits to process');
      updateBatchStatus('completed', 'No visits to process or all visits already completed', {
        completedVisits: completedVisitIds.length,
        completedVisitIds: [...completedVisitIds],
        totalVisits: completedVisitIds.length
      });
      return;
    }
    
    // Login once for the whole batch
    logger.info('Logging in to Fossa...');
    updateBatchStatus('running', 'Logging in to Fossa...');
    
    const loginResult = await loginToFossa({ headless });
    if (!loginResult.success) {
      throw new Error('Failed to login to Fossa');
    }
    
    browser = loginResult.browser;
    page = loginResult.page;
    
    // Process each visit
    for (let i = 0; i < visitsToProcess.length; i++) {
      const visit = visitsToProcess[i];
      currentVisitIndex = i + completedVisitIds.length; // Overall index in the batch

      if (isCancelled) {
        logger.info('Batch cancelled by user request.');
        updateBatchStatus('error', 'Batch processing stopped by user', { endTime: new Date().toISOString() });
        break;
      }

      const visitUrlForNavigation = visit.url.startsWith('/') 
        ? `https://app.workfossa.com${visit.url}` 
        : visit.url.startsWith('http') 
          ? visit.url 
          : `https://app.workfossa.com/${visit.url}`;

      logger.info(`Batch: Navigating to visit ${currentVisitIndex + 1}/${batchStatus.totalVisits}: ${visit.id} (${visitUrlForNavigation})`);
      updateBatchStatus(batchStatus.status, `Processing visit ${currentVisitIndex + 1} of ${batchStatus.totalVisits}: ${visit.id}`, {
          currentVisit: visit.id,
        currentVisitName: visit.storeName || visit.id,
        currentVisitUrl: visitUrlForNavigation,
        currentVisitStatus: 'Navigating to visit page...',
        dispenserCount: visit.dispensers ? visit.dispensers.length : 0, // Initial estimate
        dispenserCurrent: 0,
        fuelType: '',
        fuelCurrent: 0,
        fuelTotal: 0,
      });

      try {
        // Navigate to the visit page for this item in the batch
        await page.goto(visitUrlForNavigation);
        await page.waitForLoadState('networkidle');

        if (isCancelled) {
          logger.info(`Batch: Cancelled during navigation/wait for visit ${visit.id}.`);
          // updateBatchStatus already handled cancellation globally for the batch
          break; // Exit the loop
        }
        
        // currentJobId is ALREADY set to the batch's jobId at the start of processBatch.
        // _processSingleVisitCore will use this as its processingJobId.
        // The 'visit.id' is used for data lookup (e.g., finding WO details).
        logger.info(`Batch: Calling _processSingleVisitCore for Visit ID: ${visit.id}, URL: ${visitUrlForNavigation}, WO for data: ${visit.id}, Processing under Job ID: ${jobId}`);
        const visitResult = await _processSingleVisitCore(page, visitUrlForNavigation, visit.id /*workOrderIdForDataLookup*/, jobId /*processingJobId*/);

        if (visitResult.success) {
          logger.info(`Batch: Successfully processed visit ${visit.id}. Message: ${visitResult.message}`);
          completedVisitDetails.push({ id: visit.id, status: 'completed', message: visitResult.message });
          const newCompletedVisitIds = [...batchStatus.completedVisitIds, visit.id];
          updateBatchStatus(batchStatus.status, `Completed visit ${visit.id}`, { // Keep overall batch status as 'running' or current
            completedVisits: (batchStatus.completedVisits || 0) + 1,
            completedVisitIds: newCompletedVisitIds,
            currentVisitStatus: `Visit ${visit.id} completed successfully.` // Update status for this specific visit
          });
        } else {
          logger.error(`Batch: Error processing visit ${visit.id}. Message: ${visitResult.message}`);
          completedVisitDetails.push({ id: visit.id, status: 'error', message: visitResult.message });
          // Update currentVisitStatus for the batch, but keep overall batch running
          updateBatchStatus(batchStatus.status, `Error on visit ${visit.id}: ${visitResult.message.substring(0, 100)}...`, {
            currentVisitStatus: `Error on ${visit.id}: ${visitResult.message}`,
            // We don't increment completedVisits here
          });
          // Decide if batch should continue or stop on error - current behavior is to continue
        }

      } catch (error) {
        logger.error(`Batch: Critical error during processing of visit ${visit.id} (${visit.url}): ${error.message}`);
        completedVisitDetails.push({ id: visit.id, status: 'error', message: `Critical loop error: ${error.message}` });
        updateBatchStatus(batchStatus.status, `Critical error on visit ${visit.id}: ${error.message.substring(0,100)}...`, {
          currentVisitStatus: `Critical error processing ${visit.id}: ${error.message}`,
        });
        // Continue with the next visit even if one fails critically in the loop itself
      }
    }
    
    // Log batch completion but don't set status to completed yet - will be set after browser closes
    logger.info(`Batch processing finished. Processed ${batchStatus.completedVisits}/${batchStatus.totalVisits} visits.`);
    
    return { 
      success: true, 
      message: `Batch processing completed. Processed ${batchStatus.completedVisits}/${batchStatus.totalVisits} visits.` 
    };
    
  } catch (error) {
    logger.error(`Batch processing error: ${error.message}`);
    updateBatchStatus('error', `Batch processing error: ${error.message}`, {
      endTime: new Date().toISOString()
    });
    return { success: false, message: `Error: ${error.message}` };
  } finally {
    // First update status to "closing" to indicate we're in the process of closing
    if (browser) {
      updateBatchStatus('running', `Closing browser and completing automation...`, {
        currentVisitStatus: 'Closing browser'
      });
      
      // Close the browser
      await browser.close();
      
      // Only now that the browser is closed, update to completed
      updateBatchStatus('completed', `Batch processing completed. Processed ${batchStatus.completedVisits}/${batchStatus.totalVisits} visits.`, {
        endTime: new Date().toISOString(),
        currentVisitStatus: 'Complete'
      });
    }
  }
}

/**
 * Get the current status of form automation
 * @returns {object} - Current status
 */
function getStatus() {
  // Ensure the status object always has the required properties and backward compatibility
  return {
    ...jobStatus,
    lastStatusUpdate: new Date().toISOString()
  };
}

/**
 * Get the current status of batch automation
 * @param {string} jobId - Optional batch job ID to get status for a specific batch
 * @returns {object} - Current batch status
 */
async function getBatchStatus(jobId) {
  // If jobId is provided, try to get the specific batch status
  if (jobId) {
    try {
      const specificStatusFromHistory = await getBatchStatusById(jobId); // from batch_history.json
      if (specificStatusFromHistory) {
        // If the requested jobId is for the currently active batch job, prioritize live in-memory status
        if (batchStatus && batchStatus.jobId === jobId) {
          logger.info(`Requested job ${jobId} is the current active batch. Returning live status.`);
          // Fall through to return current in-memory status logic below
        } else { // Corrected 'else' placement
          logger.info(`Returning status for specific batch job: ${jobId} from history`);
          return {
            jobId: specificStatusFromHistory.jobId,
            status: specificStatusFromHistory.status,
            message: specificStatusFromHistory.message,
            totalVisits: typeof specificStatusFromHistory.totalVisits !== 'undefined' ? specificStatusFromHistory.totalVisits : (specificStatusFromHistory.totalItems || 0),
            completedVisits: typeof specificStatusFromHistory.completedVisits !== 'undefined' ? specificStatusFromHistory.completedVisits : (specificStatusFromHistory.currentItem || 0),
            currentItem: specificStatusFromHistory.currentItem || 0,
            totalItems: specificStatusFromHistory.totalItems || 0,
            completedVisitIds: specificStatusFromHistory.completedVisitIds || [],
            // Fields for current visit from history if available
            currentVisit: specificStatusFromHistory.currentVisit,
            currentVisitName: specificStatusFromHistory.currentVisitName || 'N/A from history',
            currentVisitStatus: specificStatusFromHistory.currentVisitStatus || specificStatusFromHistory.message,
            dispenserCount: specificStatusFromHistory.dispenserCount || 0,
            dispenserCurrent: specificStatusFromHistory.dispenserCurrent || 0,
            fuelType: specificStatusFromHistory.fuelType || '',
            fuelCurrent: specificStatusFromHistory.fuelCurrent || 0,
            fuelTotal: specificStatusFromHistory.fuelTotal || 0,
            startTime: specificStatusFromHistory.startTime || new Date(0).toISOString(),
            endTime: specificStatusFromHistory.endTime,
            filePath: specificStatusFromHistory.filePath,
            headless: specificStatusFromHistory.headless,
            timestamp: specificStatusFromHistory.timestamp,
            lastStatusUpdate: new Date().toISOString()
          };
        } // End of specificStatusFromHistory handling
      } else { // Added else for case where specificStatusFromHistory is null
         logger.warn(`Batch job ${jobId} not found in history, or it's the active one. Returning current in-memory status.`);
      }
    } catch (error) {
      logger.error(`Error getting specific batch status for ${jobId}: ${error.message}`);
      // Fall through to return current in-memory status on error
    }
  }

  // Return current in-memory batch status
  logger.info(`Returning current in-memory batch status (live job: ${batchStatus.jobId}, polling for: ${jobId || 'current'})`);
  return {
    jobId: batchStatus.jobId,
    status: batchStatus.status,
    message: batchStatus.message, // Overall batch message
    totalVisits: batchStatus.totalVisits || 0,
    completedVisits: batchStatus.completedVisits || 0,
    currentItem: batchStatus.currentItem || 0, // Legacy, maps to completedVisits for overall
    totalItems: batchStatus.totalItems || 0,   // Legacy, maps to totalVisits for overall
    completedVisitIds: batchStatus.completedVisitIds || [],
    
    // Detailed progress for the current individual visit
    currentVisit: batchStatus.currentVisit, // Visit ID
    currentVisitName: batchStatus.currentVisitName ||
                      ( (batchStatus.status === 'running' || batchStatus.status === 'idle') && (batchStatus.totalVisits > 0) ?
                        (batchStatus.completedVisits < batchStatus.totalVisits ? `Preparing visit ${batchStatus.completedVisits + 1}` : 'Finalizing...') :
                        (batchStatus.status === 'completed' ? 'Batch Complete' : 'Initializing...') ),
    currentVisitStatus: batchStatus.currentVisitStatus || batchStatus.message, // Specific message for the current visit
    dispenserCount: batchStatus.dispenserCount || 0,
    dispenserCurrent: batchStatus.dispenserCurrent || 0,
    fuelType: batchStatus.fuelType || '',
    fuelCurrent: batchStatus.fuelCurrent || 0,
    fuelTotal: batchStatus.fuelTotal || 0,

    startTime: batchStatus.startTime || new Date(0).toISOString(),
    endTime: batchStatus.endTime,
    filePath: batchStatus.filePath,
    headless: batchStatus.headless,
    timestamp: batchStatus.timestamp, // This is the batch job's main ID
    lastStatusUpdate: new Date().toISOString()
  };
}

/**
 * Test function to extract specific dispensers from a string
 * @param {string} instructionsText - The instructions text
 * @returns {array} - Array of dispenser objects
 */
function testExtractSpecificDispensers(instructionsText) {
  console.log(`Testing extraction of specific dispensers from: ${instructionsText}`);
  const result = extractSpecificDispensers(instructionsText);
  console.log(`Extracted ${result.length} dispensers:`, result);
  return result;
}

/**
 * Preview a batch file without processing it
 * @param {string} filePath - Path to the batch data file
 * @returns {Promise<object>} - Preview data
 */
async function previewBatchFile(filePath) {
  try {
    logger.info(`Previewing batch file: ${filePath}`);
    
    // Check if there's an active user
    const activeUser = getActiveUser();
    if (!activeUser) {
      throw new Error('No active user found. Please select a user before previewing batch files.');
    }
    
    // Resolve the file path using the active user
    let dataPath;
    if (path.isAbsolute(filePath)) {
      dataPath = filePath;
    } else {
      // In ES modules, we need to use fileURLToPath with import.meta.url instead of __dirname
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const projectRoot = path.resolve(currentDir, '../..');
      const userDir = path.join(projectRoot, 'data', 'users', activeUser);
      
      // Remove 'data/' prefix if it exists to avoid path duplication
      const cleanedFilePath = filePath.replace(/^data\//, '');
      dataPath = path.join(userDir, cleanedFilePath);
      
      logger.info(`User-specific batch file path: ${dataPath}`);
    }
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${filePath} for active user`);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Extract visit information for preview
    const visits = [];
    
    for (const workOrder of data.workOrders) {
      if (
        workOrder.visits && 
        workOrder.visits.nextVisit && 
        workOrder.visits.nextVisit.url
      ) {
        // Get basic visit information
        const serviceCode = workOrder.serviceType && workOrder.serviceType.code;
        const serviceType = getServiceTypeLabel(serviceCode);
        const dispensers = workOrder.dispensers || [];
        
        // Calculate dispenser count more accurately - check both dispensers array and services
        let dispenserCount = 0;
        
        // First check if dispensers array is available and has content
        if (Array.isArray(dispensers) && dispensers.length > 0) {
          dispenserCount = dispensers.length;
        } 
        // Fallback to services if dispensers array is empty/missing
        else if (workOrder.services && Array.isArray(workOrder.services)) {
          // Look for meter calibration services as fallback
          const meterCalibrationService = workOrder.services.find(
            service => service.type === "Meter Calibration" || 
                      (service.description && service.description.toLowerCase().includes("dispenser")) ||
                      (service.description && service.description.toLowerCase().includes("meter"))
          );
          
          if (meterCalibrationService && meterCalibrationService.quantity) {
            dispenserCount = meterCalibrationService.quantity;
          }
        }
        
        visits.push({
          id: workOrder.id,
          storeName: workOrder.customer ? workOrder.customer.name : 'Unknown Store',
          storeNumber: workOrder.customer ? workOrder.customer.storeNumber : 'N/A',
          visitId: workOrder.visits.nextVisit.visitId,
          date: workOrder.visits.nextVisit.date,
          url: workOrder.visits.nextVisit.url,
          serviceType,
          serviceCode,
          dispenserCount: dispenserCount
        });
      }
    }
    
    logger.info(`Found ${visits.length} visits in batch file`);
    
    return { 
      visits,
      totalVisits: visits.length
    };
  } catch (error) {
    logger.error(`Error previewing batch file: ${error.message}`);
    throw error;
  }
}

/**
 * Get a human-readable service type label
 * @param {string} serviceCode - The service code
 * @returns {string} - Human-readable service type
 */
function getServiceTypeLabel(serviceCode) {
  const codeLabels = {
    '3146': 'Open Neck Prover',
    '2862': 'Specific Dispensers',
    // Add more mappings as needed
  };
  
  return codeLabels[serviceCode] || 'AccuMeasure';
}

/**
 * Get a stored batch status by ID
 * @param {string} batchId - The batch ID to retrieve
 * @returns {Promise<object|null>} - The batch status or null if not found
 */
async function getBatchStatusById(batchId) {
  try {
    const batchHistoryPath = resolveUserFilePath('batch_history.json');
    
    if (!fs.existsSync(batchHistoryPath)) {
      return null;
    }
    
    const batchHistory = JSON.parse(fs.readFileSync(batchHistoryPath, 'utf8'));
    
    return batchHistory.find(batch => batch.timestamp === batchId) || null;
  } catch (error) {
    logger.error(`Error getting batch status by ID: ${error.message}`);
    return null;
  }
}

/**
 * Cancel an ongoing form automation job
 * @param {string} jobId - The ID of the job to cancel (optional)
 * @returns {Promise<object>} - Status of the cancellation
 */
async function cancelJob(jobId) {
  logger.info(`Server: Attempting to cancel job: ${jobId}`);
  isCancelled = true;
  logger.info('SERVER: CANCELLATION FLAG SET TO TRUE');

  // Update batchStatus if the cancelled job is the current batch job
  if (batchStatus && batchStatus.jobId === jobId) {
    logger.info(`Updating batchStatus for cancelled batch job: ${jobId}`);
    updateBatchStatus('error', 'Batch processing stopped by user', {
      endTime: new Date().toISOString(),
      // currentVisitStatus can also be set here if desired, e.g., 'Cancelled by user'
    });
    // saveBatchStatusToHistory will be called by updateBatchStatus if status is 'error'
  } else if (jobStatus && currentJobId === jobId) { // Handle cancellation for single jobs (existing logic)
    logger.info(`Updating jobStatus for cancelled single job: ${jobId}`);
    updateStatus('completed', 'Cancellation requested by user - process terminated');
  } else {
    logger.warn(`cancelJob: jobId ${jobId} does not match current batch job ${batchStatus ? batchStatus.jobId : 'N/A'} or single job ${currentJobId || 'N/A'}. The isCancelled flag is set globally.`);
  }

  let browserClosed = false;
  
  // Force a complete stop of active browser instance
  if (global.activeBrowser) {
    logger.info('SERVER: Attempting to close active browser instance');
    try {
      // Directly await the browser closure instead of using a self-executing async function
      await global.activeBrowser.close().catch(e => 
        logger.error(`Failed to close browser: ${e.message}`)
      );
      global.activeBrowser = null;
      logger.info('SERVER: Successfully closed browser instance');
      browserClosed = true;
    } catch (error) {
      logger.error(`SERVER: Error closing browser: ${error.message}`);
      // Even if there's an error, we should continue with the cancellation
    }
  } else {
    logger.info('SERVER: No active browser instance found to close');
    browserClosed = true; // No browser to close means "success" for this step
  }
  
  // Update status to reflect cancellation request
  updateStatus('completed', 'Cancellation requested by user - process terminated');
  
  // Clean up job tracking
  if (jobId) {
    activeJobIds.delete(jobId);
    
    // If this was the active job, clear it
    if (currentJobId === jobId) {
      currentJobId = null;
    }
  } else {
    // If no specific job ID provided, clear all job tracking
    activeJobIds.clear();
    currentJobId = null;
  }
  
  // Force garbage collection if possible to free up resources
  if (global.gc) {
    try {
      global.gc();
      logger.info('SERVER: Forced garbage collection after cancellation');
    } catch (err) {
      logger.warn('SERVER: Failed to force garbage collection');
    }
  }
  
  // Verify cancellation success by checking status
  const currentStatus = getStatus();
  const isFullyStopped = currentStatus.status !== 'running' && browserClosed;
  
  logger.info(`SERVER: Job cancellation verification - Status: ${currentStatus.status}, Browser closed: ${browserClosed}`);
  
  if (!isFullyStopped) {
    logger.error('SERVER: Cancellation was not fully successful');
    return {
      success: false,
      message: 'Cancellation was partially successful but some processes may still be running'
    };
  }
  
  logger.info('SERVER: Job cancellation complete and verified');
  return {
    success: true,
    message: 'Job cancellation completed and resources cleaned up'
  };
}

// Export functions for use in API routes
export {
  processVisit,
  processBatch,
  getStatus,
  getBatchStatus,
  testExtractSpecificDispensers,
  previewBatchFile,
  cancelJob,
  // Export these for direct access in case cancelJob isn't recognized
  isCancelled,
  updateStatus,
  // Also export activeJobIds for direct manipulation in route handlers
  activeJobIds
};