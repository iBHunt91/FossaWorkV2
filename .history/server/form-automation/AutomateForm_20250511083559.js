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
  ACCUMEASURE: 'AccuMeasure',
  OPEN_NECK_PROVER: 'Open Neck Prover'
};

// Job identification and cancellation tracking
let currentJobId = null;
let activeJobIds = new Set(); // Track all active job IDs
let isCancelled = false;

// Status tracking for single job
let jobStatus = {
  status: 'idle',
  progress: 0,
  message: ''
};

// Helper function to update status for a single job
const updateStatus = (status, message, progress = null) => {
  jobStatus = {
    ...jobStatus,
    status,
    message,
    progress: progress !== null ? progress : jobStatus.progress
  };
  
  // Also log the status change
  logger.info(`Status updated: ${status} - ${message}`, 'FORM_PREP');
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
  timestamp: null   // Initialize to null
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
async function prepareForm(page, dispensers, formCount = null, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE) {
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
      await fillFormDetails(page, formUrls, dispensers, isSpecificDispensers, formType);
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
async function fillFormDetails(page, formUrls, dispensers, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE) {
  try {
    logger.info('Starting to fill form details...', 'FORM_PREP');
    console.log('====== STARTING FORM AUTOMATION ======');
    updateStatus('running', 'Filling form details...');
    
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
      
      // Use the dispenser matching this form's index, NEVER default to the first dispenser
      // Only use a dispenser if we have one at this index
      if (!dispensers[i]) {
        logger.warn(`No dispenser available for form ${i+1}, skipping this form`, 'FORM_PREP');
        continue;
      }
      
      const dispenser = dispensers[i];
      
      logger.info(`Processing form ${i + 1}/${formUrls.length}: ${formUrl}`, 'FORM_PREP');
      logger.info(`Using dispenser: ${dispenser.title}`, 'FORM_PREP');
      console.log(`\n>>> PROCESSING FORM ${i + 1}/${formUrls.length}`);
      console.log(`Using dispenser: ${dispenser.title}`);
      updateStatus('running', `Filling form ${i + 1}/${formUrls.length} with dispenser: ${dispenser.title}`);
      
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
          const fuelSectionsProcessed = await processAllFuelSections(page, dispenser, isSpecificDispensers, formType);
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
            const fuelSectionsProcessed = await processAllFuelSections(page, dispenser, isSpecificDispensers, formType);
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
async function processAllFuelSections(page, dispenser, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE) {
  try {
    logger.info('=== ENTERING MULTI-SECTION MODE: Starting to process all fuel sections... ===');
    logger.info('=== ENTERING MULTI-SECTION MODE: Starting to process all fuel sections... ===', 'FORM_PREP');
    
    // Click the "Next" button to move to the first fuel type section
    try {
      const nextButtonExists = await page.waitForSelector('a.next-section', { 
        timeout: 5000,
        state: 'visible' 
      }).then(() => true).catch(() => false);
      
      if (!nextButtonExists) {
        logger.warn('Next button not found - unable to proceed to fuel sections');
        logger.warn('Next button not found - unable to proceed to fuel sections', 'FORM_PREP');
        return false;
      }
      
      logger.info('Found Next button, clicking to proceed to fuel sections...');
      logger.info('Found Next button, clicking to proceed to fuel sections...', 'FORM_PREP');
      
      // Click the next button
      await page.click('a.next-section');
      logger.info('Clicked Next button to proceed to fuel sections');
      logger.info('Clicked Next button to proceed to fuel sections', 'FORM_PREP');
      
      // Load prover preferences from JSON file
      logger.info('Loading prover preferences...');
      logger.info('Loading prover preferences...', 'FORM_PREP');
      const proverPreferences = await loadProverPreferences();
      if (!proverPreferences) {
        logger.warn('Could not load prover preferences, using default selection');
        logger.warn('Could not load prover preferences, using default selection', 'FORM_PREP');
      } else {
        logger.info(`Loaded preferences for ${proverPreferences.provers.length} provers`);
        logger.info(`Loaded preferences for ${proverPreferences.provers.length} provers`, 'FORM_PREP');
      }
      
      // Extract all fuel grades from the dispenser
      let fuelGrades = [];
      if (dispenser.fields && dispenser.fields.Grade) {
        fuelGrades = dispenser.fields.Grade.split(',').map(grade => grade.trim());
      } else if (dispenser.title) {
        // Try to extract grades from title if fields are not available
        const titleParts = dispenser.title.split('-');
        if (titleParts.length > 1) {
          const gradesSection = titleParts[1].trim();
          fuelGrades = gradesSection.split(',').map(grade => grade.trim());
        }
      }
      
      logger.info(`Found ${fuelGrades.length} fuel grades to process: ${fuelGrades.join(', ')}`);
      logger.info(`Found ${fuelGrades.length} fuel grades to process: ${fuelGrades.join(', ')}`, 'FORM_PREP');
      
      // Add detailed debugging information
      logger.info(`DEBUG - Raw fuel grades: ${JSON.stringify(fuelGrades)}`);
      logger.info(`DEBUG - Raw fuel grades: ${JSON.stringify(fuelGrades)}`, 'FORM_PREP');
      const normalizedGrades = fuelGrades.map(grade => grade.split(':').pop().trim());
      logger.info(`DEBUG - Normalized fuel grades: ${JSON.stringify(normalizedGrades)}`);
      logger.info(`DEBUG - Normalized fuel grades: ${JSON.stringify(normalizedGrades)}`, 'FORM_PREP');
      
      // Check for Premium and Super combination
      const hasPremium = normalizedGrades.some(grade => grade === 'Premium');
      const hasSuper = normalizedGrades.some(grade => grade === 'Super' || grade === 'Super Premium' || grade === 'Ultra');
      if (hasPremium && hasSuper) {
        logger.info(`DEBUG - Special case detected: Premium and Super variants exist together`);
        logger.info(`DEBUG - Special case detected: Premium and Super variants exist together`, 'FORM_PREP');
      }
      
      // Check if there are any iterations visible
      const anyIterationsExist = await page.evaluate(() => {
        return document.querySelectorAll('[id^="iteration-"]').length > 0;
      });
      
      if (!anyIterationsExist) {
        logger.warn('No iteration sections found on the page');
        logger.warn('No iteration sections found on the page', 'FORM_PREP');
        return false;
      }
      
      // Get total number of iterations for progress tracking
      const totalIterations = await page.evaluate(() => {
        return document.querySelectorAll('[id^="iteration-"]').length;
      });
      
      logger.info(`Found ${totalIterations} total fuel sections to process`);
      logger.info(`Found ${totalIterations} total fuel sections to process`, 'FORM_PREP');
      updateStatus('running', `Found ${totalIterations} fuel sections to process`);
      
      // Process each fuel type section (iteration)
      let currentIteration = 0;
      let moreIterationsExist = true;
      let processedIterations = 0;
      
      while (moreIterationsExist) {
        // Check if current iteration exists
        try {
          logger.info(`Checking for iteration ${currentIteration}...`);
          logger.info(`Checking for iteration ${currentIteration}...`, 'FORM_PREP');
          
          const iterationExists = await page.waitForSelector(`#iteration-${currentIteration}`, { 
            timeout: 5000,
            state: 'visible' 
          }).then(() => true).catch(() => false);
          
          if (!iterationExists) {
            logger.info(`No more iterations found after iteration ${currentIteration - 1}`);
            logger.info(`No more iterations found after iteration ${currentIteration - 1}`, 'FORM_PREP');
            moreIterationsExist = false;
            break;
          }
          
          logger.info(`Found iteration ${currentIteration}, checking if expanded...`);
          logger.info(`Found iteration ${currentIteration}, checking if expanded...`, 'FORM_PREP');
          
          // Check if iteration is already open/expanded
          const isExpanded = await page.evaluate((iterationId) => {
            const panel = document.querySelector(`#${iterationId} .panel-body`);
            return panel && window.getComputedStyle(panel).display !== 'none';
          }, `iteration-${currentIteration}`);
          
          // If not expanded, click to expand it
          if (!isExpanded) {
            logger.info(`Iteration ${currentIteration} is collapsed, expanding...`);
            logger.info(`Iteration ${currentIteration} is collapsed, expanding...`, 'FORM_PREP');
            
            await page.click(`#iteration-${currentIteration} .panel-header a`);
            logger.info(`Expanded iteration ${currentIteration}`);
            logger.info(`Expanded iteration ${currentIteration}`, 'FORM_PREP');
            await page.waitForTimeout(500);
            
          } else {
            logger.info(`Iteration ${currentIteration} is already expanded`);
            logger.info(`Iteration ${currentIteration} is already expanded`, 'FORM_PREP');
          }
          
          // Get the current fuel type
          const fuelType = await page.evaluate((iterationId) => {
            const headerText = document.querySelector(`#${iterationId} .panel-header a span`);
            if (headerText) {
              return headerText.textContent.trim().replace(':', '').trim();
            }
            return null;
          }, `iteration-${currentIteration}`);
          
          if (fuelType) {
            // Update status with progress information
            processedIterations++;
            updateStatus('running', `Processing fuel type: ${fuelType} (${processedIterations}/${totalIterations}) - Dispenser #${dispenser.dispenserNumber || dispenser.title || 'Unknown'}`);
            
            logger.info(`Processing fuel type: ${fuelType} (iteration ${currentIteration}, ${processedIterations}/${totalIterations})`);
            logger.info(`Processing fuel type: ${fuelType} (iteration ${currentIteration}, ${processedIterations}/${totalIterations})`, 'FORM_PREP');
            
            // Log details of fuel grades before processing
            logger.info(`FUEL GRADES DEBUG: About to process ${fuelType}`);
            logger.info(`FUEL GRADES DEBUG: About to process ${fuelType}`, 'FORM_PREP');
            logger.info(`FUEL GRADES DEBUG: All fuel grades available: ${JSON.stringify(fuelGrades)}`);
            logger.info(`FUEL GRADES DEBUG: All fuel grades available: ${JSON.stringify(fuelGrades)}`, 'FORM_PREP');
            // Make sure we're passing the correct fuel type information for dispenser meter determination
            logger.info(`FUEL GRADES DEBUG: Raw fuelGrades array type: ${Array.isArray(fuelGrades) ? 'Array' : typeof fuelGrades}`);
            logger.info(`FUEL GRADES DEBUG: Raw fuelGrades array type: ${Array.isArray(fuelGrades) ? 'Array' : typeof fuelGrades}`, 'FORM_PREP');
            
            // Fill out the form for this fuel type
            await fillFuelTypeForm(page, fuelType, fuelGrades, proverPreferences, isSpecificDispensers, formType);
            
            // Click Save for this section
            try {
              const saveButtonExists = await page.waitForSelector(`#iteration-${currentIteration} button.save-section`, {
                timeout: 5000,
                state: 'visible'
              }).then(() => true).catch(() => false);
              
              if (saveButtonExists) {
                await page.click(`#iteration-${currentIteration} button.save-section`);
                logger.info(`Saved form for fuel type: ${fuelType}`);
                logger.info(`Saved form for fuel type: ${fuelType}`, 'FORM_PREP');
                console.log(`Saved form for fuel type: ${fuelType}`);
                await page.waitForTimeout(1000); // Wait for save to complete
              } else {
                logger.warn(`Save button not found for iteration ${currentIteration}`);
                logger.warn(`Save button not found for iteration ${currentIteration}`, 'FORM_PREP');
                console.log(`Save button not found for iteration ${currentIteration}`);
              }
            } catch (error) {
              logger.warn(`Error saving form for fuel type ${fuelType}: ${error.message}`);
              logger.warn(`Error saving form for fuel type ${fuelType}: ${error.message}`, 'FORM_PREP');
              console.log(`Error saving form for fuel type ${fuelType}: ${error.message}`);
            }
          } else {
            logger.warn(`Could not determine fuel type for iteration ${currentIteration}`);
            logger.warn(`Could not determine fuel type for iteration ${currentIteration}`, 'FORM_PREP');
            console.log(`Could not determine fuel type for iteration ${currentIteration}`);
          }
          
          // Move to next iteration
          currentIteration++;
          
        } catch (error) {
          logger.warn(`Error processing iteration ${currentIteration}: ${error.message}`);
          logger.warn(`Error processing iteration ${currentIteration}: ${error.message}`, 'FORM_PREP');
          moreIterationsExist = false;
        }
      }
      
      // Update status with completion information
      updateStatus('running', `Processed ${processedIterations}/${totalIterations} fuel sections, completing form`);
      
      logger.info(`=== COMPLETED MULTI-SECTION PROCESSING: Processed ${processedIterations}/${totalIterations} fuel sections ===`);
      console.log(`=== COMPLETED MULTI-SECTION PROCESSING: Processed ${processedIterations}/${totalIterations} fuel sections ===`);
      return true;
    } catch (error) {
      logger.error(`Error processing fuel sections: ${error.message}`);
      console.log(`Error processing fuel sections: ${error.message}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error processing fuel sections: ${error.message}`);
    console.log(`Error processing fuel sections: ${error.message}`);
    return false;
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
async function fillFuelTypeForm(page, fuelType, allFuelTypes, proverPreferences, isSpecificDispensers = false, formType = FORM_TYPES.ACCUMEASURE) {
  try {
    logger.info(`=== FILLING FUEL TYPE FORM: ${fuelType} (isSpecificDispensers=${isSpecificDispensers}, formType=${formType}) ===`);
    logger.info(`=== FILLING FUEL TYPE FORM: ${fuelType} (isSpecificDispensers=${isSpecificDispensers}, formType=${formType}) ===`, 'FORM_PREP');
    
    // We intentionally skip entering fuel price as requested
    logger.info('Skipping fuel price entry as requested');
    console.log('Skipping fuel price entry as requested');
    
    // Determine if this fuel type has a meter
    const hasMeters = shouldHaveMeter(fuelType, allFuelTypes);
    logger.info(`Meter determination for ${fuelType}: ${hasMeters ? 'YES' : 'NO'}`);
    console.log(`Meter determination for ${fuelType}: ${hasMeters ? 'YES' : 'NO'}`);
    
    // Enhanced "Has Meter" selection with multiple fallback methods
    try {
      logger.info(`Attempting to select '${hasMeters ? 'Yes' : 'No'}' for Has Meter`);
      console.log(`Attempting to select '${hasMeters ? 'Yes' : 'No'}' for Has Meter`);
      
      // First try direct attribute approach
      const radiosSelected = await page.evaluate((shouldHaveMeter) => {
        try {
          // Reset all radios first to avoid conflicts
          const allRadios = document.querySelectorAll('input[type="radio"]');
          allRadios.forEach(radio => {
            if (radio.closest('.ks-radio-wrapper')) {
              radio.checked = false;
            }
          });
          
          // First approach: Direct attribute selection
          // Multiple selectors to handle different field name patterns
          const selectors = [
            `input[type="radio"][value="${shouldHaveMeter ? '1' : '2'}"]`,
            // Add field IDs based on form type (5438 for AccuMeasure, 5462 for Open Neck Prover)
            `input[name="field[${formType === FORM_TYPES.OPEN_NECK_PROVER ? '5462' : '5438'}]"][value="${shouldHaveMeter ? '1' : '2'}"]`,
            // Fallback to old field ID for backward compatibility
            `input[name="field[4857]"][value="${shouldHaveMeter ? '1' : '2'}"]`,
            `input[name="field[Has Meter]"][value="${shouldHaveMeter ? '1' : '2'}"]`
          ];
          
          for (const selector of selectors) {
            const radioInput = document.querySelector(selector);
            if (radioInput) {
              // Set checked state
              radioInput.checked = true;
              
              // Trigger events
              radioInput.dispatchEvent(new Event('change', { bubbles: true }));
              radioInput.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Try to click the label for UI feedback
              const label = radioInput.closest('label.ks-radio');
              if (label) {
                label.click();
              }
              
              return { 
                success: true, 
                method: 'direct-selector',
                selector: selector
              };
            }
          }
          
          // Second approach: Find by label text
          const labels = document.querySelectorAll('label.ks-radio');
          const targetText = shouldHaveMeter ? 'Yes' : 'No';
          
          for (const label of labels) {
            const labelText = label.querySelector('.ks-radio-label-wrapper, .ks-radio-label');
            if (labelText && labelText.textContent.trim() === targetText) {
              // Click the label
              label.click();
              
              // Also set the input directly
              const input = label.querySelector('input[type="radio"]');
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }
              
              return { 
                success: true, 
                method: 'label-text',
                labelText: labelText.textContent.trim()
              };
            }
          }
          
          // Third approach: Find by containing the text (less strict)
          for (const label of labels) {
            if (label.textContent.includes(targetText)) {
              // Click the label
              label.click();
              
              // Also set the input directly
              const input = label.querySelector('input[type="radio"]');
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }
              
              return { 
                success: true, 
                method: 'label-contains-text',
                labelText: label.textContent.trim()
              };
            }
          }
          
          // Fourth approach (all radios): Log all available radio options for debugging
          const allRadioOptions = [];
          const radioInputs = document.querySelectorAll('input[type="radio"]');
          
          radioInputs.forEach((input, idx) => {
            const label = input.closest('label');
            const labelText = label ? label.textContent.trim() : 'No label';
            const value = input.value;
            const name = input.name;
            allRadioOptions.push({ idx, labelText, value, name });
          });
          
          return { 
            success: false, 
            error: `No matching radio buttons found for "${targetText}"`,
            availableOptions: allRadioOptions
          };
        } catch (err) {
          return { 
            success: false, 
            error: err.message || 'Unknown error' 
          };
        }
      }, hasMeters);
      
      if (radiosSelected.success) {
        logger.info(`Has Meter selection successful - Method: ${radiosSelected.method}`);
        logger.info(`Has Meter selection successful - Method: ${radiosSelected.method}`, 'FORM_PREP');
        console.log(`Has Meter selection successful - Method: ${radiosSelected.method}`);
      } else {
        logger.warn(`Has Meter selection failed: ${radiosSelected.error}`);
        logger.warn(`Has Meter selection failed: ${radiosSelected.error}`, 'FORM_PREP');
        console.log(`Has Meter selection failed: ${radiosSelected.error}`);
        
        // Enhanced logging for radio button failures
        logger.info(`Form type: ${formType}, Fuel type: ${fuelType}`);
        logger.info(`Attempting to select: ${hasMeters ? 'Yes' : 'No'}`);
        
        if (radiosSelected.availableOptions) {
          logger.info(`Available radio options: ${JSON.stringify(radiosSelected.availableOptions)}`);
          logger.info(`Available radio options: ${JSON.stringify(radiosSelected.availableOptions)}`, 'FORM_PREP');
          console.log(`Available radio options: ${JSON.stringify(radiosSelected.availableOptions)}`);
          
          // Log the HTML structure of the radio section for debugging
          try {
            const radioHTML = await page.evaluate(() => {
              const radioGroup = document.querySelector('.radio');
              return radioGroup ? radioGroup.outerHTML : 'Radio group not found';
            });
            logger.info(`Radio HTML structure: ${radioHTML}`);
          } catch (htmlError) {
            logger.warn(`Could not extract radio HTML: ${htmlError.message}`);
          }
          
          // If we found radio options, try one more direct approach with Playwright
          try {
            // Check if we found field names from the available options
            if (radiosSelected.availableOptions.length > 0) {
              const hasMeterOption = radiosSelected.availableOptions.find(opt => 
                opt.name && (opt.name.includes('Meter') || opt.labelText.includes('Meter'))
              );
              
              if (hasMeterOption) {
                logger.info(`Found Has Meter radio by name: ${hasMeterOption.name}`);
                
                // Playwright method - click the radio button directly
                await page.evaluate((optionData, shouldHaveMeter) => {
                  const selector = `input[name="${optionData.name}"][value="${shouldHaveMeter ? '1' : '2'}"]`;
                  const radio = document.querySelector(selector);
                  if (radio) {
                    radio.click();
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                  }
                  return false;
                }, hasMeterOption, hasMeters);
              }
            }
            
            // If nothing else worked, try the most basic approach: click Yes or No directly
            const labelToClick = hasMeters ? 'Yes' : 'No';
            await page.evaluate((labelText) => {
              // Try to find any element containing just this text
              const elements = Array.from(document.querySelectorAll('label, div, span'))
                .filter(el => el.textContent.trim() === labelText);
              
              if (elements.length > 0) {
                elements[0].click();
                return true;
              }
              return false;
            }, labelToClick);
            
            logger.info(`Attempted last-resort click on "${labelToClick}" text`);
          } catch (err) {
            logger.warn(`Last resort approach also failed: ${err.message}`);
          }
        }
      }
      
      // Verify the selection
      const verification = await page.evaluate((shouldHaveMeter) => {
        try {
          // Check radios
          const yesRadio = document.querySelector('input[type="radio"][value="1"]');
          const noRadio = document.querySelector('input[type="radio"][value="2"]');
          
          // Check by selection state
          if (yesRadio && noRadio) {
            if (shouldHaveMeter && yesRadio.checked) {
              return { success: true, status: 'Yes radio confirmed selected' };
            } else if (!shouldHaveMeter && noRadio.checked) {
              return { success: true, status: 'No radio confirmed selected' };
            } else if (yesRadio.checked) {
              return { success: false, status: 'Yes is selected but should be No' };
            } else if (noRadio.checked) {
              return { success: false, status: 'No is selected but should be Yes' };
            } else {
              return { success: false, status: 'Neither radio is selected' };
            }
          }
          
          // Check by looking at labeled status
          const labels = document.querySelectorAll('label.ks-radio');
          let selectedLabel = null;
          
          for (const label of labels) {
            const input = label.querySelector('input[type="radio"]');
            if (input && input.checked) {
              selectedLabel = label.textContent.trim();
              break;
            }
          }
          
          if (selectedLabel) {
            return { 
              success: selectedLabel.includes(shouldHaveMeter ? 'Yes' : 'No'),
              status: `Label "${selectedLabel}" is selected`
            };
          }
          
          return { success: false, status: 'Unable to verify radio selection' };
        } catch (err) {
          return { success: false, status: `Verification error: ${err.message}` };
        }
      }, hasMeters);
      
      if (verification.success) {
        logger.info(`Has Meter verification: ${verification.status}`);
        logger.info(`Has Meter verification: ${verification.status}`, 'FORM_PREP');
        console.log(`Has Meter verification: ${verification.status}`);
      } else {
        logger.warn(`Has Meter verification failed: ${verification.status}`);
        logger.warn(`Has Meter verification failed: ${verification.status}`, 'FORM_PREP');
        console.log(`Has Meter verification failed: ${verification.status}`);
      }
      
      // Final wait to ensure the form has time to update
      logger.info('Waiting for form to update after Has Meter selection');
      console.log('Waiting for form to update after Has Meter selection');
      await page.waitForTimeout(2000);
      
      // Apply aggressive approach to all fuel types to ensure proper selection
      logger.info(`Applying aggressive selection confirmation for ${fuelType}`);
      
      // ULTRA AGGRESSIVE APPROACH FOR ALL FUEL TYPES
      try {
        // First attempt: Direct click approach with Playwright
        await page.waitForTimeout(300); // Small pause to ensure DOM is stable
        
        try {
          // Get the radio button through multiple selectors
          const radioSelectors = [
            `input[type="radio"][value="${hasMeters ? '1' : '2'}"]`, 
            `input[name="field[${formType === FORM_TYPES.OPEN_NECK_PROVER ? '5462' : '5438'}]"][value="${hasMeters ? '1' : '2'}"]`,
            `input[name="field[4857]"][value="${hasMeters ? '1' : '2'}"]`,
            `input[name="field[Has Meter]"][value="${hasMeters ? '1' : '2'}"]`
          ];
          
          // Try clicking directly with Playwright
          for (const selector of radioSelectors) {
            const exists = await page.$(selector);
            if (exists) {
              logger.info(`Found ${fuelType} Has Meter ${hasMeters ? 'Yes' : 'No'} radio with selector: ${selector}, clicking directly`);
              await page.click(selector, { force: true });
              await page.waitForTimeout(200);
              break;
            }
          }
        } catch (clickErr) {
          logger.warn(`Direct click attempt failed: ${clickErr.message}`);
        }
        
        // Second attempt: Label-based approach with Playwright
        try {
          // Find and click the Yes/No label
          const labelText = hasMeters ? 'Yes' : 'No';
          const labelSelectors = [
            `label.ks-radio >> text=${labelText}`,
            `label:has-text("${labelText}")`,
            `label.ks-radio-wrapper >> text=${labelText}`
          ];
          
          for (const selector of labelSelectors) {
            const exists = await page.$(selector);
            if (exists) {
              logger.info(`Found ${fuelType} Has Meter ${labelText} label with selector: ${selector}, clicking directly`);
              await page.click(selector, { force: true });
              await page.waitForTimeout(200);
              break;
            }
          }
        } catch (labelErr) {
          logger.warn(`Label click attempt failed: ${labelErr.message}`);
        }
        
        // Third attempt: Brute force with JavaScript
        await page.evaluate((shouldHaveMeter) => {
          // Force the correct value for this fuel type
          console.log(`BRUTE FORCE: Setting all possible ${shouldHaveMeter ? 'Yes' : 'No'} radios`);
          
          // Clear all radio first
          document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.checked = false;
          });
          
          // Find and check radios by value
          document.querySelectorAll(`input[type="radio"][value="${shouldHaveMeter ? '1' : '2'}"]`).forEach(radio => {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('input', { bubbles: true }));
            radio.dispatchEvent(new Event('click', { bubbles: true }));
            
            // Also click the label if possible
            const label = radio.closest('label');
            if (label) {
              label.click();
            }
            
            console.log('Set radio to checked state:', radio);
          });
          
          // Find anything else that looks like a Yes/No radio
          const targetText = shouldHaveMeter ? 'Yes' : 'No';
          const targetLabels = Array.from(document.querySelectorAll('label'))
            .filter(label => label.textContent.trim() === targetText);
            
          targetLabels.forEach(label => {
            label.click();
            const input = label.querySelector('input[type="radio"]');
            if (input) {
              input.checked = true;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('click', { bubbles: true }));
              console.log(`Set ${targetText} radio via label:`, input);
            }
          });
        }, hasMeters);
        
        // Fourth attempt: Direct DOM method to force selection
        await page.waitForTimeout(300);
        const fullVerification = await page.evaluate((shouldHaveMeter) => {
          // Final check
          const allRadios = document.querySelectorAll('input[type="radio"]');
          console.log(`Found ${allRadios.length} total radio buttons on page`);
          
          const targetRadios = Array.from(document.querySelectorAll(`input[type="radio"][value="${shouldHaveMeter ? '1' : '2'}"]`));
          console.log(`Found ${targetRadios.length} ${shouldHaveMeter ? 'Yes' : 'No'} radio buttons (value="${shouldHaveMeter ? '1' : '2'}")`);
          
          // If any target radio is not checked, check it
          let changed = false;
          targetRadios.forEach(radio => {
            if (!radio.checked) {
              // One last brute force attempt
              console.log(`FINAL ATTEMPT: Forcing ${shouldHaveMeter ? 'Yes' : 'No'} radio checked state:`, radio);
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              radio.dispatchEvent(new Event('input', { bubbles: true }));
              changed = true;
            }
          });
          
          // Take a detailed inventory of all radio buttons for debugging
          const radioInventory = Array.from(allRadios).map((radio, idx) => {
            const label = radio.closest('label');
            return {
              index: idx,
              name: radio.name || 'unnamed',
              value: radio.value,
              checked: radio.checked,
              labelText: label ? label.textContent.trim() : 'no label',
              id: radio.id || 'no-id'
            };
          });
          
          return {
            success: targetRadios.some(radio => radio.checked),
            changed,
            radioCount: allRadios.length,
            targetRadioCount: targetRadios.length,
            radioInventory: radioInventory
          };
        }, hasMeters);
        
        if (fullVerification.success) {
          logger.info(`SUCCESSFUL Radio verification for ${fuelType}: ${fullVerification.targetRadioCount} ${hasMeters ? 'Yes' : 'No'} radios, ${fullVerification.radioCount} total radios`);
        } else {
          logger.warn(`FAILED Radio verification for ${fuelType}: ${JSON.stringify(fullVerification)}`);
        }
        
      } catch (aggressiveError) {
        logger.error(`Ultra-aggressive approach failed for ${fuelType}: ${aggressiveError.message}`);
      }
    } catch (error) {
      logger.warn(`Error selecting Has Meter option: ${error.message}`);
      console.log(`Error selecting Has Meter option: ${error.message}`);
    }
    
    // Type of fill - Top is default and usually pre-selected, but confirm
    // Optimized version
    try {
      // Fast direct DOM selection and setting
      const typeOfFillSelected = await page.evaluate(() => {
        try {
          // Direct attribute selection by specific name/value (fastest)
          const topRadio = document.querySelector('input[name="field[4858]"][value="1"]');
          
          if (topRadio) {
            // Check if already selected to avoid unnecessary operations
            if (!topRadio.checked) {
              // Direct property setting
              topRadio.checked = true;
              
              // Dispatch necessary events
              topRadio.dispatchEvent(new Event('change', { bubbles: true }));
              topRadio.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Also click parent label for visual feedback
              const label = topRadio.closest('label.ks-radio');
              if (label) {
                label.click();
              }
              
              return { success: true, status: 'selected', method: 'direct-attribute' };
            } else {
              return { success: true, status: 'already-selected' };
            }
          }
          
          // Try finding by label text if direct attribute fails
          const labels = document.querySelectorAll('label.ks-radio');
          for (const label of labels) {
            const labelText = label.querySelector('.ks-radio-label-wrapper');
            if (labelText && labelText.textContent.trim() === 'Top') {
              // Click the label directly
              label.click();
              
              // Also check the input directly
              const input = label.querySelector('input[type="radio"]');
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
              
              return { success: true, status: 'selected', method: 'label-text' };
            }
          }
          
          return { success: false, error: 'Type of fill radio not found' };
        } catch (err) {
          return { success: false, error: err.message || 'Unknown error' };
        }
      });
      
      if (typeOfFillSelected.success) {
        if (typeOfFillSelected.status === 'already-selected') {
          logger.info('Top already selected for Type of fill');
          console.log('Top already selected for Type of fill');
        } else {
          logger.info(`Selected Top for Type of fill using ${typeOfFillSelected.method}`);
          logger.info(`Selected Top for Type of fill using ${typeOfFillSelected.method}`, 'FORM_PREP');
          console.log(`Selected Top for Type of fill using ${typeOfFillSelected.method}`);
        }
      } else {
        logger.warn(`Type of fill radio options issue: ${typeOfFillSelected.error}`);
        logger.warn(`Type of fill radio options issue: ${typeOfFillSelected.error}`, 'FORM_PREP');
        console.log(`Type of fill radio options issue: ${typeOfFillSelected.error}`);
      }
    } catch (error) {
      logger.warn(`Error selecting Type of fill: ${error.message}`);
      logger.warn(`Error selecting Type of fill: ${error.message}`, 'FORM_PREP');
      console.log(`Error selecting Type of fill: ${error.message}`);
    }
    
    // For Open Neck Prover forms and when Has Meter is Yes, handle Blend Ratio fields
    if (formType === FORM_TYPES.OPEN_NECK_PROVER && hasMeters) {
      try {
        // Fill the Blend Ratio fields
        logger.info(`Filling Blend Ratio fields for ${fuelType}`);
        console.log(`Filling Blend Ratio fields for ${fuelType}`);
        
        // Determine values based on fuel type - 100 for Regular, 0 for anything else
        // Extract the base fuel type for more accurate detection
        const baseFuelType = fuelType.split(':').pop().trim().toLowerCase();
        const isRegular = baseFuelType.includes('regular');
        const ratioValue = isRegular ? '100' : '0';
        
        logger.info(`Fuel type "${baseFuelType}" detected as ${isRegular ? 'Regular' : 'Non-Regular'}, setting ratio to ${ratioValue}`);
        console.log(`Fuel type "${baseFuelType}" detected as ${isRegular ? 'Regular' : 'Non-Regular'}, setting ratio to ${ratioValue}`);
        
        // Wait for a moment to ensure any dynamic form changes have completed
        await page.waitForTimeout(1000);
        
        // First, check if the fields are visible and available
        const fieldsExist = await page.evaluate(() => {
          // Check for any input fields on the form
          const allInputs = Array.from(document.querySelectorAll('input[type="text"]'));
          console.log(`Found ${allInputs.length} text inputs on form`);
          
          // Look for any labels containing "Blend Ratio"
          const labels = Array.from(document.querySelectorAll('label')).filter(
            l => l.textContent.trim().includes('Blend Ratio')
          );
          console.log(`Found ${labels.length} labels with "Blend Ratio"`);
          
          return { inputCount: allInputs.length, labelCount: labels.length };
        });
        
        logger.info(`Fields check: Found ${fieldsExist.inputCount} text inputs and ${fieldsExist.labelCount} "Blend Ratio" labels`);
        console.log(`Fields check: Found ${fieldsExist.inputCount} text inputs and ${fieldsExist.labelCount} "Blend Ratio" labels`);
        
        // Try a more direct approach - fill all visible text fields with names containing field_5 or field_6
        const directFillResult = await page.evaluate((ratioValue) => {
          try {
            // For debugging, log all input fields
            const allInputs = Array.from(document.querySelectorAll('input[type="text"]')).map(i => ({
              name: i.getAttribute('name'),
              id: i.getAttribute('id'),
              value: i.value,
              visible: i.offsetParent !== null,
              placeholder: i.getAttribute('placeholder') || ''
            }));
            
            console.log('All text inputs:', JSON.stringify(allInputs));
            
            // First try - find visible form groups that appeared after selecting "Yes"
            // These are likely to contain the blend ratio fields
            const blendRatioGroups = Array.from(document.querySelectorAll('.ks-form-group, .form-group')).filter(
              group => group.textContent.includes('Blend Ratio') && 
                      window.getComputedStyle(group).display !== 'none'
            );
            
            console.log(`Found ${blendRatioGroups.length} visible blend ratio groups`);
            
            const filled = [];
            
            // If we found specific groups, get inputs from them
            if (blendRatioGroups.length > 0) {
              for (const group of blendRatioGroups) {
                const input = group.querySelector('input[type="text"]');
                if (input) {
                  // Clear first
                  input.value = '';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  // Set value
                  input.value = ratioValue;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  filled.push('group: ' + group.textContent.trim().substring(0, 20) + '...');
                }
              }
            }
            
            // If that didn't work, try all the selectors
            if (filled.length === 0) {
              // Try all possible blend ratio field selectors
              const selectors = [
                'input[name="field_5"]', 'input[name="field_6"]',
                '#field_5', '#field_6',
                'input[placeholder*="Blend Ratio A"]', 'input[placeholder*="Blend Ratio B"]',
                'input[name*="blend"]', 'input[id*="blend"]',
                // Additional selectors for dynamically added fields
                'input[name^="field_new_"]', 
                'input[name$="_blend_ratio"]',
                'input.blend-ratio-field'
              ];
              
              for (const selector of selectors) {
                const inputs = document.querySelectorAll(selector);
                for (const input of inputs) {
                  if (input.offsetParent !== null) { // Check if visible
                    // Clear first
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Set value
                    input.value = ratioValue;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    filled.push(selector);
                  }
                }
              }
            }
            
            // If nothing found by selectors, try finding by nearby labels
            if (filled.length === 0) {
              const labels = Array.from(document.querySelectorAll('label')).filter(
                l => l.textContent.includes('Blend Ratio') && l.offsetParent !== null
              );
              
              for (const label of labels) {
                // Get nearby input
                let input = null;
                const forAttr = label.getAttribute('for');
                
                if (forAttr) {
                  input = document.getElementById(forAttr);
                } else {
                  const container = label.closest('.ks-form-group') || label.closest('.form-group');
                  if (container) {
                    input = container.querySelector('input[type="text"]');
                  }
                }
                
                if (input && input.offsetParent !== null) {
                  // Clear first
                  input.value = '';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  
                  // Set value
                  input.value = ratioValue;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  filled.push('by-label: ' + label.textContent.trim());
                }
              }
            }
            
            // Last attempt - if still nothing found, try to fill ALL visible text inputs 
            // (but only if there are 2 or fewer to avoid filling wrong fields)
            if (filled.length === 0) {
              const visibleInputs = allInputs.filter(info => info.visible);
              if (visibleInputs.length <= 2) {
                for (const inputInfo of visibleInputs) {
                  const input = document.querySelector(`input[name="${inputInfo.name}"]`) || 
                                document.getElementById(inputInfo.id);
                  
                  if (input) {
                    // Clear first
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Set value
                    input.value = ratioValue;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    filled.push('fallback: ' + (inputInfo.name || inputInfo.id));
                  }
                }
              }
            }
            
            return { 
              success: filled.length > 0,
              filled: filled,
              inputsFound: allInputs.length,
              visibleInputs: allInputs.filter(i => i.visible).length,
              blendRatioGroups: blendRatioGroups.length
            };
          } catch (err) {
            return { 
              success: false, 
              error: err.message || 'Unknown error',
              stack: err.stack
            };
          }
        }, ratioValue);
        
        if (directFillResult.success) {
          logger.info(`Successfully filled blend ratio fields: ${directFillResult.filled.join(', ')}`);
          logger.info(`Successfully filled blend ratio fields: ${directFillResult.filled.join(', ')}`, 'FORM_PREP');
          console.log(`Successfully filled blend ratio fields: ${directFillResult.filled.join(', ')}`);
        } else {
          logger.warn(`Failed to set Blend Ratio: ${directFillResult.error || 'No fields found'}`);
          logger.warn(`Failed to set Blend Ratio: ${directFillResult.error || 'No fields found'}`, 'FORM_PREP');
          console.log(`Failed to set Blend Ratio: ${directFillResult.error || 'No fields found'}`);
          logger.warn(`Found ${directFillResult.inputsFound} input fields but couldn't identify blend ratio fields`);
          logger.warn(`Found ${directFillResult.inputsFound} input fields but couldn't identify blend ratio fields`, 'FORM_PREP');
          console.log(`Found ${directFillResult.inputsFound} input fields but couldn't identify blend ratio fields`);
          if (directFillResult.stack) {
            logger.warn(`Error stack: ${directFillResult.stack}`);
          }
        }
      } catch (error) {
        logger.warn(`Error setting Blend Ratio values: ${error.message}`);
        logger.warn(`Error setting Blend Ratio values: ${error.message}`, 'FORM_PREP');
        console.log(`Error setting Blend Ratio values: ${error.message}`);
        if (error.stack) {
          logger.warn(`Error stack: ${error.stack}`);
        }
      }
    }
    
    // Always attempt to select provers regardless of job type
    if (proverPreferences && Object.keys(proverPreferences).length > 0) {
      // Get the preferred prover and select it
      const proverId = getPreferredProver(fuelType, proverPreferences, allFuelTypes);
      
      if (proverId) {
        logger.info(`Found preferred prover ${proverId} for fuel type ${fuelType}`);
        logger.info(`Found preferred prover ${proverId} for fuel type ${fuelType}`, 'FORM_PREP');
        console.log(`Found preferred prover ${proverId} for fuel type ${fuelType}`);
        
        try {
          // Check if prover dropdown exists
          const proverDropdownExists = await page.evaluate(() => {
            const elements = document.querySelectorAll('.ks-select-selection');
            if (elements.length > 0) {
              console.log(`Found ${elements.length} dropdown elements`);
              return true;
            } else {
              console.log("No dropdown elements found");
              return false;
            }
          });
          
          if (!proverDropdownExists) {
            logger.warn('Prover dropdown not found on the page');
            console.log('Prover dropdown not found on the page');
            return true;
          }
          
          // Find which dropdown is for the prover
          // Look for all dropdowns and identify them
          await page.evaluate(() => {
            const dropdowns = document.querySelectorAll('.ks-select-selection');
            for (let i = 0; i < dropdowns.length; i++) {
              const dropdown = dropdowns[i];
              console.log(`Dropdown ${i+1}: "${dropdown.textContent.trim()}"`);
              
              // Look for labels near this dropdown
              const parentElement = dropdown.closest('.form-group');
              if (parentElement) {
                const labels = parentElement.querySelectorAll('label');
                if (labels.length > 0) {
                  console.log(`  Label: "${labels[0].textContent.trim()}"`);
                }
              }
            }
          });
          
          // Click the dropdown to open it (assume the first one is for prover)
          await page.click('.ks-select-selection');
          logger.info('Clicked to open prover dropdown');
          console.log('Clicked to open prover dropdown');
          
          // Wait for dropdown to appear
          const dropdownVisible = await page.waitForSelector('.ks-select-dropdown', { 
            state: 'visible', 
            timeout: 5000 
          }).then(() => true).catch(() => false);
          
          if (!dropdownVisible) {
            logger.warn('Prover dropdown did not appear after click');
            console.log('Prover dropdown did not appear after click');
            return true;
          }
          
          // Log available options in the dropdown
          await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('.autocomplete-list li'));
            console.log(`Available prover options (${options.length}):`);
            options.forEach((opt, idx) => console.log(`  ${idx+1}. ${opt.textContent.trim()}`));
          });
          
          // Find and click the option matching our prover ID
          const proverSelected = await page.evaluate((proverId) => {
            const options = Array.from(document.querySelectorAll('.autocomplete-list li'));
            console.log(`Looking for prover ID: "${proverId}" among ${options.length} options`);
            
            // Try exact match first
            for (const option of options) {
              const text = option.textContent.trim();
              if (text.includes(proverId)) {
                console.log(`Found prover match: "${text}"`);
                option.click();
                return { success: true, selected: text };
              }
            }
            
            // Log the problem if nothing found
            console.log(`No matching prover found for ID: "${proverId}"`);
            return { success: false };
          }, proverId);
          
          if (proverSelected.success) {
            logger.info(`Selected prover: ${proverSelected.selected} for fuel type: ${fuelType}`);
            logger.info(`Selected prover: ${proverSelected.selected} for fuel type: ${fuelType}`, 'FORM_PREP');
            console.log(`Selected prover: ${proverSelected.selected} for fuel type: ${fuelType}`);
            
            // Verify the selection
            await page.waitForTimeout(250); // Reduced from 500
            const selectionVerified = await page.evaluate(() => {
              const selectionText = document.querySelector('.ks-select-selection');
              return selectionText ? selectionText.textContent.trim() : 'No selection text found';
            });
            
            logger.info(`Prover selection verification: "${selectionVerified}"`);
            logger.info(`Prover selection verification: "${selectionVerified}"`, 'FORM_PREP');
            console.log(`Prover selection verification: "${selectionVerified}"`);
          } else {
            logger.warn(`Could not find prover with ID: ${proverId}, leaving prover unselected`);
            logger.warn(`Could not find prover with ID: ${proverId}, leaving prover unselected`, 'FORM_PREP');
            console.log(`Could not find prover with ID: ${proverId}, leaving prover unselected`);
            // Close the dropdown without selecting anything
            await page.keyboard.press('Escape');
          }
        } catch (error) {
          logger.warn(`Error selecting prover: ${error.message}`);
          logger.warn(`Error selecting prover: ${error.message}`, 'FORM_PREP');
          console.log(`Error selecting prover: ${error.message}`);
        }
      } else {
        logger.info(`No preferred prover found for ${fuelType}, leaving prover unselected`);
        logger.info(`No preferred prover found for ${fuelType}, leaving prover unselected`, 'FORM_PREP');
        console.log(`No preferred prover found for ${fuelType}, leaving prover unselected`);
      }
    } else {
      logger.info(`No prover preferences available for ${fuelType}, using default behavior`);
      logger.info(`No prover preferences available for ${fuelType}, using default behavior`, 'FORM_PREP');
      console.log(`No prover preferences available for ${fuelType}, using default behavior`);
    }
    
    logger.info(`=== COMPLETED FILLING FUEL TYPE FORM: ${fuelType} ===`);
    logger.info(`=== COMPLETED FILLING FUEL TYPE FORM: ${fuelType} ===`, 'FORM_PREP');
    console.log(`=== COMPLETED FILLING FUEL TYPE FORM: ${fuelType} ===`);
    return true;
  } catch (error) {
    logger.error(`Error filling fuel type form for ${fuelType}: ${error.message}`);
    logger.error(`Error filling fuel type form for ${fuelType}: ${error.message}`, 'FORM_PREP');
    console.log(`Error filling fuel type form for ${fuelType}: ${error.message}`);
    return false;
  }
} 

/**
 * Determines if a fuel type should have a meter based on predefined logic
 * @param {string} fuelType - The current fuel type
 * @param {array} allFuelTypes - All fuel types on the dispenser
 * @returns {boolean} - Whether this fuel type should have a meter
 */
function shouldHaveMeter(fuelType, allFuelTypes) {
  // Validate inputs and provide detailed logs
  if (!fuelType) {
    logger.warn('shouldHaveMeter: Called with empty or null fuelType');
    return true; // Default to Yes if missing data
  }
  
  // Ensure allFuelTypes is an array
  if (!Array.isArray(allFuelTypes)) {
    logger.warn(`shouldHaveMeter: allFuelTypes is not an array: ${JSON.stringify(allFuelTypes)}`);
    allFuelTypes = [];
  }
  
  // Log the inputs for debugging
  logger.info(`shouldHaveMeter: Called with fuelType="${fuelType}", allFuelTypes=${JSON.stringify(allFuelTypes)}`);
  
  // Extract the base fuel type (remove any text after a colon)
  const baseFuelType = fuelType.split(':').pop().trim();
  logger.info(`shouldHaveMeter: Normalized base fuel type is "${baseFuelType}"`);
  
  // Types that always have meters
  const typesWithMeters = [
    'Regular', 'Diesel', 'Super', 'Super Premium', 'Ultra', 
    'Ethanol-Free Gasoline Plus', 'Ethanol-Free', 'Rec Fuel 90', 'Race Fuel'
  ];
  
  // Types that never have meters
  const typesWithoutMeters = [
    'Plus', 'Special 88', 'Extra 89', 'Midgrade 89'
  ];
  
  // Log available fuel types for debugging
  logger.info(`shouldHaveMeter: Available fuel types on this dispenser: ${allFuelTypes.join(', ')}`);
  logger.info(`shouldHaveMeter: Available fuel types on this dispenser: ${Array.isArray(allFuelTypes) ? allFuelTypes.join(', ') : allFuelTypes}`, 'FORM_PREP');
  
  // Special case for Premium
  if (baseFuelType === 'Premium') {
    // Check if Super, Super Premium, or Ultra exist on the same dispenser
    const hasSuperVariants = allFuelTypes.some(type => {
      // Normalize the type first by trimming and removing any text after a colon
      const normalizedType = type.split(':').pop().trim();
      return normalizedType === 'Super' || 
             normalizedType === 'Super Premium' || 
             normalizedType === 'Ultra';
    });
    
    // If any super variants exist, Premium doesn't have a meter
    if (hasSuperVariants) {
      logger.info('shouldHaveMeter: Premium with Super variant detected - selecting No for meter');
      logger.info('shouldHaveMeter: Premium with Super variant detected - selecting No for meter', 'FORM_PREP');
      return false;
    }
    
    // Otherwise Premium has a meter
    logger.info('shouldHaveMeter: Premium without Super variants - selecting Yes for meter');
    logger.info('shouldHaveMeter: Premium without Super variants - selecting Yes for meter', 'FORM_PREP');
    return true;
  }
  
  // Check if it's in the types with meters
  if (typesWithMeters.some(type => baseFuelType.includes(type))) {
    logger.info(`shouldHaveMeter: "${baseFuelType}" matches a type with meters - selecting Yes`);
    logger.info(`shouldHaveMeter: "${baseFuelType}" matches a type with meters - selecting Yes`, 'FORM_PREP');
    return true;
  }
  
  // Check if it's in the types without meters
  if (typesWithoutMeters.some(type => baseFuelType.includes(type))) {
    logger.info(`shouldHaveMeter: "${baseFuelType}" matches a type without meters - selecting No`);
    logger.info(`shouldHaveMeter: "${baseFuelType}" matches a type without meters - selecting No`, 'FORM_PREP');
    return false;
  }
  
  // Default to Yes if we're not sure
  logger.info(`shouldHaveMeter: Fuel type "${baseFuelType}" not in known lists, defaulting to Yes for meter`);
  logger.info(`shouldHaveMeter: Fuel type "${baseFuelType}" not in known lists, defaulting to Yes for meter`, 'FORM_PREP');
  return true;
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
 * Process a single visit
 * @param {string} visitUrl - URL of the visit to process
 * @param {boolean} headless - Whether to run browser in headless mode
 * @param {string} workOrderId - Optional work order ID to get dispenser data
 * @param {string} externalJobId - Job ID passed from API route (optional)
 * @returns {Promise<object>} - Result of the operation
 */
async function processVisit(visitUrl, headless = true, workOrderId = null, externalJobId = null) {
  // Use provided job ID if available, otherwise generate one
  currentJobId = externalJobId || Date.now().toString();
  activeJobIds.add(currentJobId); // Add to active job IDs set
  isCancelled = false;
  
  // Log job tracking for debugging
  logger.info(`Processing visit with job ID: ${currentJobId}`);
  logger.info(`Current active job IDs: ${Array.from(activeJobIds).join(', ')}`);
  
  let browser = null;
  let page = null;
  
  try {
    logger.info(`Processing visit: ${visitUrl} (Job ID: ${currentJobId})`);
    updateStatus('running', `Processing visit: ${visitUrl}`);
    
    // Log active user info
    const activeUser = getActiveUser();
    logger.info(`Active User: ${activeUser || 'None'}`);
    
    // Log file paths for debugging
    const scraperDataPath = resolveUserFilePath('scraped_content.json');
    const dispenserStorePath = resolveUserFilePath('dispenser_store.json');
    const proverPreferencesPath = resolveUserFilePath('prover_preferences.json');
    
    logger.info(`User file paths:`);
    logger.info(`- scraped_content.json: ${scraperDataPath}`);
    logger.info(`- dispenser_store.json: ${dispenserStorePath}`);
    logger.info(`- prover_preferences.json: ${proverPreferencesPath}`);
    
    // Check if files exist
    logger.info(`File existence check:`);
    logger.info(`- scraped_content.json exists: ${fs.existsSync(scraperDataPath)}`);
    logger.info(`- dispenser_store.json exists: ${fs.existsSync(dispenserStorePath)}`);
    logger.info(`- prover_preferences.json exists: ${fs.existsSync(proverPreferencesPath)}`);
    
    // Use the improved loginToFossa function from login.js
    const loginResult = await loginToFossa({ headless });
    
    if (!loginResult.success) {
      throw new Error('Failed to login to Fossa');
    }
    
    // Check for cancellation after login
    if (isCancelled) {
      logger.info('Job cancelled, stopping process after login');
      updateStatus('completed', 'Job cancelled by user');
      await loginResult.browser.close();
      return;
    }
    
    // Get the browser and page objects from the login result
    browser = loginResult.browser;
    page = loginResult.page;
    
    // Store browser instance globally for cancellation access
    global.activeBrowser = browser;
    
    // Navigate to the visit page
    logger.info(`Navigating to visit: ${visitUrl}`);
    updateStatus('running', `Navigating to visit: ${visitUrl}`);
    
    // Ensure the URL is absolute by adding domain if it's a relative URL
    const absoluteUrl = visitUrl.startsWith('/') 
      ? `https://app.workfossa.com${visitUrl}` 
      : visitUrl.startsWith('http') 
        ? visitUrl 
        : `https://app.workfossa.com/${visitUrl}`;
    
    logger.info(`Using absolute URL: ${absoluteUrl}`);
    
    await page.goto(absoluteUrl);
    await page.waitForLoadState('networkidle');
    
    // Check for cancellation after navigation
    if (isCancelled) {
      logger.info('Job cancelled, stopping process after navigation');
      updateStatus('completed', 'Job cancelled by user');
      await browser.close();
      return;
    }
    
    // Get dispenser data and form count
    let dispensers = [];
    let formCount = 0;
    let isSpecificDispensers = false;
    let formType = FORM_TYPES.ACCUMEASURE;
    let instructions = '';
    let dispensersFound = false;
    let serviceCode = null;
    
    // Extract work order ID from the URL or passed workOrderId
    let workOrderIdFromUrl = workOrderId;
    if (!workOrderIdFromUrl) {
      // Try to extract from URL using regex which is more reliable
      const workOrderMatch = visitUrl.match(/\/work\/(\d+)/);
      if (workOrderMatch && workOrderMatch[1]) {
        workOrderIdFromUrl = workOrderMatch[1];
        logger.info(`Extracted work order ID using regex: ${workOrderIdFromUrl}`);
        
        // Add W- prefix if needed for consistency
        if (!workOrderIdFromUrl.startsWith('W-')) {
          workOrderIdFromUrl = `W-${workOrderIdFromUrl}`;
        }
      } else {
        // Fallback to the old method
        const visitUrlParts = visitUrl.split('/');
        const workIndex = visitUrlParts.indexOf('work');
        if (workIndex > 0 && workIndex < visitUrlParts.length - 1) {
          workOrderIdFromUrl = visitUrlParts[workIndex + 1];
          
          logger.info(`Extracted work order ID from URL parts: ${workOrderIdFromUrl}`);
          
          // Add W- prefix if needed for consistency
          if (!workOrderIdFromUrl.startsWith('W-')) {
            workOrderIdFromUrl = `W-${workOrderIdFromUrl}`;
          }
        }
      }
      
      // If we still don't have it, try to extract from page
      if (!workOrderIdFromUrl) {
        logger.info('Could not extract work order ID from URL, trying to extract from page');
        workOrderIdFromUrl = await page.evaluate(() => {
          const workOrderElement = document.querySelector('a[href*="/work/"]');
          if (workOrderElement) {
            const href = workOrderElement.getAttribute('href');
            const matches = href.match(/\/work\/(\d+)/);
            return matches ? `W-${matches[1]}` : null;
          }
          return null;
        });
        
        if (workOrderIdFromUrl) {
          logger.info(`Extracted work order ID from page: ${workOrderIdFromUrl}`);
        } else {
          logger.warn('Could not extract work order ID from page');
        }
      }
    }
    
    // The work order ID should be the one in the URL after /work/ and before /visits/
    // This is a critical fix to ensure we're always using the correct ID
    if (visitUrl.includes('/work/') && visitUrl.includes('/visits/')) {
      const originalId = workOrderIdFromUrl;
      const correctIdMatch = visitUrl.match(/\/work\/(\d+)\/visits\//);
      
      if (correctIdMatch && correctIdMatch[1]) {
        const correctId = correctIdMatch[1];
        if (correctId !== workOrderIdFromUrl.replace(/^W-/, '')) {
          logger.info(`Correcting work order ID from ${workOrderIdFromUrl} to W-${correctId}`);
          workOrderIdFromUrl = `W-${correctId}`;
        }
      }
    }
    
    logger.info(`Final work order ID for lookup: ${workOrderIdFromUrl}`);
    updateStatus('running', 'Analyzing visit details...');
    
    // Step 1: Try to get service code and dispenser data from scraped_content.json
    if (workOrderIdFromUrl) {
      try {
        const scraperDataPath = resolveUserFilePath('scraped_content.json');
        
        if (fs.existsSync(scraperDataPath)) {
          const data = JSON.parse(fs.readFileSync(scraperDataPath, 'utf8'));
          
          // Log available work order IDs for debugging
          const availableIds = data.workOrders ? data.workOrders.map(wo => wo.id).slice(0, 10) : [];
          logger.info(`Available work order IDs in scraped_content.json (first 10): ${availableIds.join(', ')}`);
          logger.info(`Looking for work order ID: ${workOrderIdFromUrl} (also checking without W- prefix: ${workOrderIdFromUrl.replace(/^W-/, '')})`);
          
          // Find the work order
          const normalizedWorkOrderId = workOrderIdFromUrl.replace(/^W-/, '');
          
          // Find work order with or without W- prefix
          const workOrder = data.workOrders.find(wo => 
            wo.id === workOrderIdFromUrl || 
            wo.id === normalizedWorkOrderId ||
            `W-${wo.id}` === workOrderIdFromUrl
          );
          
          if (workOrder) {
            // Save instructions for later use
            instructions = workOrder.instructions || '';
            logger.info(`Found instructions for ${workOrderIdFromUrl}: "${instructions}"`);
            
            // Check if this is a specific dispenser work order or another special type
            if (workOrder.services && workOrder.services.length > 0) {
              // Log all services for debugging
              workOrder.services.forEach((service, index) => {
                logger.info(`Service ${index + 1}: Type=${service.type}, Quantity=${service.quantity}, Description=${service.description}, Code=${service.code}`);
                
                // Remember service code for determining form type
                if (service.code) {
                  serviceCode = service.code;
                }
              });
              
              // Check for specific dispensers (code 2862)
              isSpecificDispensers = workOrder.services.some(service => 
                (service.code === "2862") || 
                (service.description && service.description.includes('Specific Dispenser(s)'))
              );
              
              // Check for open neck prover (code 3146)
              const isOpenNeckProver = workOrder.services.some(service => 
                (service.code === "3146")
              );
              
              if (isOpenNeckProver) {
                formType = FORM_TYPES.OPEN_NECK_PROVER;
                logger.info(`DETECTED: Work order ${workOrderIdFromUrl} requires Open Neck Prover forms (Code 3146)`);
              }
              
              if (isSpecificDispensers) {
                logger.info(`DETECTED: Work order ${workOrderIdFromUrl} requires specific dispensers (Code 2862) - checking instructions`);
              } else {
                logger.info(`This is a standard work order (${serviceCode || 'unknown code'}), will use sequential dispensers`);
              }
            }
            
            // Get dispensers if available
            if (workOrder.dispensers && workOrder.dispensers.length > 0) {
              dispensers = workOrder.dispensers;
              logger.info(`Found ${dispensers.length} dispensers for work order ${workOrderIdFromUrl} in scraped_content.json`);
              dispensers.forEach((dispenser, index) => {
                logger.info(`Dispenser ${index + 1}: ${dispenser.title || 'No title'}`);
              });
              dispensersFound = true;
            }
            
            // Check services for quantity (number of forms to create)
            if (workOrder.services && workOrder.services.length > 0) {
              // Get the total quantity of dispensers from services
              formCount = workOrder.services.reduce((total, service) => {
                return total + (service.quantity || 0);
              }, 0);
              
              if (formCount > 0) {
                logger.info(`Found quantity of ${formCount} in services for work order ${workOrderIdFromUrl}`);
              }
            }
            
            // If this is a specific dispenser work order and we have instructions but no dispensers,
            // try to extract the specific dispensers from the instructions
            if (isSpecificDispensers && instructions) {
              logger.info(`SPECIFIC DISPENSERS: Analyzing instructions to extract dispenser numbers`);
              const specificDispensers = extractSpecificDispensers(instructions);
              
              if (specificDispensers.length > 0) {
                logger.info(`SUCCESS: Extracted ${specificDispensers.length} specific dispensers from instructions`);
                
                // If we already found dispensers elsewhere, log what we're replacing
                if (dispensersFound) {
                  logger.info(`REPLACING: Overriding ${dispensers.length} previously found dispensers with ${specificDispensers.length} specific dispensers`);
                }
                
                dispensers = specificDispensers;
                dispensersFound = true;
                
                // IMPORTANT: Always set form count to exactly match the number of specific dispensers for specific dispenser case
                formCount = specificDispensers.length;
                logger.info(`STRICT UPDATE: Setting form count to exactly ${formCount} to match number of specific dispensers`);
              } else {
                logger.warn(`FAILED: Could not extract specific dispensers from instructions: "${instructions}"`);
              }
            }
          } else {
            logger.warn(`Work order ${workOrderIdFromUrl} not found in scraped_content.json`);
          }
        } else {
          logger.warn('scraped_content.json file not found');
        }
      } catch (error) {
        logger.warn(`Error processing scraped_content.json: ${error.message}`);
      }
      
      // If dispensers weren't found, try the dispenser_store.json file
      if (!dispensersFound) {
        logger.info(`No dispensers found in scraped_content.json, checking dispenser_store.json`);
        
        const dispenserStorePath = resolveUserFilePath('dispenser_store.json');
        if (fs.existsSync(dispenserStorePath)) {
          try {
            const dispenserStoreData = JSON.parse(fs.readFileSync(dispenserStorePath, 'utf8'));
            
            // Check if the work order exists in the dispenser store data
            if (dispenserStoreData.dispenserData && dispenserStoreData.dispenserData[workOrderIdFromUrl]) {
              const workOrderData = dispenserStoreData.dispenserData[workOrderIdFromUrl];
              
              if (workOrderData.dispensers && workOrderData.dispensers.length > 0) {
                dispensers = workOrderData.dispensers;
                logger.info(`Found ${dispensers.length} dispensers for work order ${workOrderIdFromUrl} in dispenser_store.json`);
                dispensersFound = true;
              }
            }
          } catch (error) {
            logger.warn(`Error parsing dispenser_store.json: ${error.message}`);
          }
        }
      }
    }
    
    // Only try getting dispensers from the page if we didn't find any from data files
    if (!dispensersFound) {
      // Get dispenser data from the page as a last resort - but don't rely on it
      logger.info('No dispensers found in data files - attempting basic page check but this will likely not work');
      dispensers = await page.evaluate(() => {
        // Try multiple possible selectors for dispensers
        const selectors = ['div.line-item', 'div.equipment-item', 'div.dispenser-item', 'tr.line-item'];
        let dispenserElements = [];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector ${selector}`);
            dispenserElements = Array.from(elements);
            break;
          }
        }
        
        if (dispenserElements.length === 0) {
          console.log('No dispenser elements found with any selector');
          return [];
        }
        
        return dispenserElements.map(element => {
          let title = '';
          let fields = {};
          
          // Try to find the title - multiple approaches
          const titleElement = element.querySelector('div.text-sm.color-black, div.item-title, td.item-title');
          if (titleElement) {
            title = titleElement.textContent.trim();
          } else {
            // If no dedicated title element, use first text content as fallback
            title = element.textContent.trim().split('\n')[0] || 'Unknown Dispenser';
          }
          
          // Try to extract fields - multiple approaches
          const fieldElements = Array.from(element.querySelectorAll('div.row, tr.row'));
          
          fieldElements.forEach(fieldElement => {
            const cells = Array.from(fieldElement.querySelectorAll('div, td'));
            if (cells.length >= 2) {
              const key = cells[0].textContent.trim().replace(':', '');
              const value = cells[1].textContent.trim();
              fields[key] = value;
            }
          });
          
          return { title, fields };
        });
      });
      
      logger.info(`Found ${dispensers.length} dispensers on page`);
    }

    // Now check dispenser_store.json more thoroughly if we haven't found dispensers yet
    if (dispensers.length === 0) {
      logger.info(`No dispensers found yet. Double-checking dispenser_store.json with work order ID: ${workOrderIdFromUrl}`);
      
      try {
        const dispenserStorePath = resolveUserFilePath('dispenser_store.json');
        if (fs.existsSync(dispenserStorePath)) {
          logger.info(`dispenser_store.json exists, reading content`);
          
          const dispenserStoreData = JSON.parse(fs.readFileSync(dispenserStorePath, 'utf8'));
          
          // Log available work order IDs in dispenser_store.json
          const workOrderIds = dispenserStoreData.dispenserData ? Object.keys(dispenserStoreData.dispenserData).slice(0, 10) : [];
          logger.info(`Available work order IDs in dispenser_store.json (first 10): ${workOrderIds.join(', ')}`);
          
          // Try different variations of the work order ID
          const idVariations = [
            workOrderIdFromUrl,
            workOrderIdFromUrl.replace(/^W-/, ''),
            `W-${workOrderIdFromUrl.replace(/^W-/, '')}`
          ];
          
          logger.info(`Trying these ID variations: ${idVariations.join(', ')}`);
          
          // Check for the work order with any of the variations
          for (const idVariation of idVariations) {
            if (dispenserStoreData.dispenserData && dispenserStoreData.dispenserData[idVariation]) {
              const workOrderData = dispenserStoreData.dispenserData[idVariation];
              
              if (workOrderData.dispensers && workOrderData.dispensers.length > 0) {
                dispensers = workOrderData.dispensers;
                logger.info(`Found ${dispensers.length} dispensers for work order ${idVariation} in dispenser_store.json`);
                dispensers.forEach((disp, idx) => {
                  logger.info(`Dispenser ${idx+1}: ${disp.title || 'No title'}`);
                });
                dispensersFound = true;
                break;
              }
            }
          }
          
          if (!dispensersFound) {
            logger.warn(`No dispensers found in dispenser_store.json for any ID variation of ${workOrderIdFromUrl}`);
          }
        } else {
          logger.warn(`dispenser_store.json file does not exist at ${dispenserStorePath}`);
        }
      } catch (error) {
        logger.warn(`Error processing dispenser_store.json: ${error.message}`);
      }
    }
    
    // If we need to filter out DEF dispensers for Open Neck Prover
    if (formType === FORM_TYPES.OPEN_NECK_PROVER && dispensers.length > 0) {
      const originalCount = dispensers.length;
      dispensers = dispensers.filter(dispenser => {
        if (dispenser.fields && dispenser.fields.Grade) {
          const grade = dispenser.fields.Grade.toLowerCase();
          const hasDEFGrade = grade.includes('def');
          const hasDieselHighFlowGrade = grade.includes('diesel high flow');
          
          if (hasDEFGrade || hasDieselHighFlowGrade) {
            logger.info(`Filtering out dispenser: "${dispenser.title}" - Has DEF or Diesel High Flow`);
            return false;
          }
        }
        return true;
      });
      
      logger.info(`After filtering, ${dispensers.length} dispensers remain (removed ${originalCount - dispensers.length} DEF/DF dispensers)`);
    }
    
    // If we couldn't find a quantity, use the number of dispensers
    if (formCount === 0 && dispensers.length > 0) {
      formCount = dispensers.length;
      logger.info(`Using dispenser count (${formCount}) as form count`);
    }
    
    // Log final information before form preparation
    logger.info(`=== DISPENSER IDENTIFICATION COMPLETE ===`);
    logger.info(`Form Type: ${formType}`);
    logger.info(`Specific Dispensers: ${isSpecificDispensers}`);
    logger.info(`Service Code: ${serviceCode || 'Unknown'}`);
    logger.info(`Dispensers Found: ${dispensers.length}`);
    logger.info(`Form Count: ${formCount}`);
    
    // Check if we have any dispensers before continuing
    if (dispensers.length === 0) {
      const errorMessage = `No dispensers found for work order ID: ${workOrderIdFromUrl}. Please ensure:
1. You are connected to the correct user profile
2. You have run "Get Work Order Data" for this work order
3. The work order contains dispenser information`;
      
      logger.error(errorMessage);
      updateStatus('error', errorMessage);
      throw new Error(errorMessage);
    }
    
    // Prepare forms
    updateStatus('running', `Preparing ${formType} forms...`);
    const formsAdded = await prepareForm(page, dispensers, formCount, isSpecificDispensers, formType);
    
    if (!formsAdded) {
      throw new Error('Failed to prepare forms');
    }
    
    // Get form URLs to fill
    const formUrls = await page.evaluate((targetFormType) => {
      const formLinks = Array.from(document.querySelectorAll('a.none, a.text-decoration-none'))
        .filter(link => link.textContent.includes(targetFormType));
      return formLinks.map(link => link.href);
    }, formType);
    
    // Ensure all form URLs are absolute
    const absoluteFormUrls = formUrls.map(url => {
      if (url.startsWith('/')) {
        return `https://app.workfossa.com${url}`;
      } else if (!url.startsWith('http')) {
        return `https://app.workfossa.com/${url}`;
      }
      return url;
    });
    
    logger.info(`Found ${absoluteFormUrls.length} form URLs to fill`);
    
    // Fill form details
    updateStatus('running', `Filling ${formType} form details...`);
    const success = await fillFormDetails(page, absoluteFormUrls, dispensers, isSpecificDispensers, formType);
    
    if (!success) {
      // Check if the failure was due to cancellation
      if (isCancelled) {
        logger.info('Form filling was cancelled by user');
        return { success: false, message: 'Process cancelled by user', jobId: currentJobId };
      }
      throw new Error('Failed to fill form details');
    }
    
    // Update status
    updateStatus('running', `Processing complete, closing browser...`);
    
    return { success: true, message: `Visit processed successfully: ${visitUrl}`, jobId: currentJobId };
    
  } catch (error) {
    logger.error(`Error processing visit: ${error.message}`);
    updateStatus('error', `Error processing visit: ${error.message}`);
    return { success: false, message: `Error: ${error.message}`, jobId: currentJobId };
  } finally {
    if (browser) {
      // Close browser and update final status
      await browser.close();
      global.activeBrowser = null; // Clear the global reference
      updateStatus('completed', `Successfully processed visit: ${visitUrl}`);
      
      // When job is complete (success or error), remove it from active jobs
      if (currentJobId === currentJobId) { // This check is redundant but kept for clarity
        activeJobIds.delete(currentJobId);
      }
    }
  }
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
    updateBatchStatus('running', `Starting batch processing from: ${filePath}`, {
      totalVisits: 0,
      completedVisits: 0,
      completedVisitIds: [],
      currentVisit: null,
      currentVisitStatus: null,
      startTime: new Date().toISOString(),
      timestamp: Date.now().toString() // Use this as batch ID
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
    updateBatchStatus('running', `Found ${visitsToProcess.length} visits to process`, {
      totalVisits: visitsToProcess.length + completedVisitIds.length
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
      const visitStartTime = new Date();
      
      try {
        // Ensure the URL is absolute by adding domain if it's a relative URL
        const visitUrl = visit.url.startsWith('/') 
          ? `https://app.workfossa.com${visit.url}` 
          : visit.url.startsWith('http') 
            ? visit.url 
            : `https://app.workfossa.com/${visit.url}`;
        
        logger.info(`Processing visit ${i + 1}/${visitsToProcess.length}: ${visitUrl}`);
        updateBatchStatus('running', `Processing visit ${i + 1}/${visitsToProcess.length}: Work Order ${visit.id}`, {
          currentVisit: visit.id,
          currentVisitStatus: "Starting"
        });
        
        // Navigate to the visit page with absolute URL
        await page.goto(visitUrl);
        await page.waitForLoadState('networkidle');
        
        // Reset the current status to running before starting this visit
        updateStatus('running', `Processing visit for Work Order ${visit.id}`);
        updateBatchStatus('running', `Processing visit ${i + 1}/${visitsToProcess.length}: Work Order ${visit.id}`, {
          currentVisitStatus: `Processing visit for Work Order ${visit.id}`
        });
        
        // Prepare the form with dispenser data and form count
        await prepareForm(
          page, 
          visit.dispensers, 
          visit.formCount, 
          visit.isSpecificDispensers, 
          visit.formType
        );
        
        // Get form URLs to fill
        const formUrls = await page.evaluate((targetFormType) => {
          const formLinks = Array.from(document.querySelectorAll('a.none, a.text-decoration-none'))
            .filter(link => link.textContent.includes(targetFormType));
          return formLinks.map(link => link.href);
        }, visit.formType);
        
        // Ensure all form URLs are absolute
        const absoluteFormUrls = formUrls.map(url => {
          if (url.startsWith('/')) {
            return `https://app.workfossa.com${url}`;
          } else if (!url.startsWith('http')) {
            return `https://app.workfossa.com/${url}`;
          }
          return url;
        });
        
        logger.info(`Found ${absoluteFormUrls.length} forms to fill`);
        
        // Fill form details
        await fillFormDetails(
          page, 
          absoluteFormUrls, 
          visit.dispensers, 
          visit.isSpecificDispensers, 
          visit.formType
        );
        
        // Update completed count and store the completed visit ID
        updateBatchStatus('running', `Completed visit ${i + 1}/${visitsToProcess.length}: Work Order ${visit.id}`, {
          completedVisits: batchStatus.completedVisits + 1,
          currentVisitStatus: 'Completed',
          completedVisitIds: [...(batchStatus.completedVisitIds || []), visit.id]
        });
        
        // Calculate and log time taken
        const visitEndTime = new Date();
        const visitDuration = Math.round((visitEndTime - visitStartTime) / 1000);
        logger.info(`Visit ${i + 1} completed in ${visitDuration} seconds`);
        
      } catch (error) {
        logger.error(`Error processing visit ${visit.url}: ${error.message}`);
        updateBatchStatus('running', `Error processing visit ${i + 1}/${visitsToProcess.length}: ${error.message}`, {
          currentVisitStatus: `Error: ${error.message}`
        });
        // Continue with the next visit even if one fails
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
        } else {
          logger.info(`Returning status for specific batch job: ${jobId} from history`);
          return {
            jobId: specificStatusFromHistory.jobId,
            status: specificStatusFromHistory.status,
            message: specificStatusFromHistory.message,
            // Prioritize specific totalVisits/completedVisits if they exist in history
            totalVisits: typeof specificStatusFromHistory.totalVisits !== 'undefined' ? specificStatusFromHistory.totalVisits : (specificStatusFromHistory.totalItems || 0),
            completedVisits: typeof specificStatusFromHistory.completedVisits !== 'undefined' ? specificStatusFromHistory.completedVisits : (specificStatusFromHistory.currentItem || 0),
            currentItem: specificStatusFromHistory.currentItem || 0, 
            totalItems: specificStatusFromHistory.totalItems || 0,   
            completedVisitIds: specificStatusFromHistory.completedVisitIds || [],
            currentVisitName: specificStatusFromHistory.currentVisitName || 'N/A from history',
            currentVisitStatus: specificStatusFromHistory.currentVisitStatus || specificStatusFromHistory.message,
            // Add detailed fields from batchStatus if available, falling back to history or defaults
            currentVisitStatusMessage: batchStatus.currentVisitStatusMessage || specificStatusFromHistory.currentVisitStatusMessage || specificStatusFromHistory.message,
            dispenserCount: batchStatus.dispenserCount !== undefined ? batchStatus.dispenserCount : specificStatusFromHistory.dispenserCount,
            dispenserCurrent: batchStatus.dispenserCurrent !== undefined ? batchStatus.dispenserCurrent : specificStatusFromHistory.dispenserCurrent,
            fuelType: batchStatus.fuelType || specificStatusFromHistory.fuelType,
            fuelCurrent: batchStatus.fuelCurrent !== undefined ? batchStatus.fuelCurrent : specificStatusFromHistory.fuelCurrent,
            fuelTotal: batchStatus.fuelTotal !== undefined ? batchStatus.fuelTotal : specificStatusFromHistory.fuelTotal,
            startTime: specificStatusFromHistory.startTime || new Date(0).toISOString(),
            endTime: specificStatusFromHistory.endTime, 
            filePath: specificStatusFromHistory.filePath,
            headless: specificStatusFromHistory.headless,
            timestamp: specificStatusFromHistory.timestamp, 
            lastStatusUpdate: new Date().toISOString() 
          };
        }
      }
      logger.warn(`Batch job ${jobId} not found in history, or it's the active one. Returning current in-memory status.`);
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
    message: batchStatus.message,
    totalVisits: batchStatus.totalVisits || 0,
    completedVisits: batchStatus.completedVisits || 0,
    currentItem: batchStatus.currentItem || 0, 
    totalItems: batchStatus.totalItems || 0,   
    completedVisitIds: batchStatus.completedVisitIds || [],
    currentVisitName: batchStatus.currentVisitName || 
                      ( (batchStatus.status === 'running' || batchStatus.status === 'idle') && (batchStatus.totalVisits > 0) ? 
                        (batchStatus.completedVisits < batchStatus.totalVisits ? `Preparing visit ${batchStatus.completedVisits + 1}` : 'Finalizing...') :
                        (batchStatus.status === 'completed' ? 'Batch Complete' : 'Initializing...') ),
    currentVisitStatus: batchStatus.currentVisitStatus || batchStatus.message,
    // ADD THE DETAILED PROGRESS FIELDS FROM THE LIVE batchStatus OBJECT
    currentVisitStatusMessage: batchStatus.currentVisitStatusMessage,
    dispenserCount: batchStatus.dispenserCount,
    dispenserCurrent: batchStatus.dispenserCurrent,
    formsTotal: batchStatus.dispenserCount, // Alias for frontend compatibility if needed
    formsCurrent: batchStatus.dispenserCurrent, // Alias for frontend
    currentVisitFuelType: batchStatus.fuelType, // Alias for frontend
    fuelType: batchStatus.fuelType,
    fuelCurrent: batchStatus.fuelCurrent,
    fuelTotal: batchStatus.fuelTotal,
    startTime: batchStatus.startTime || new Date(0).toISOString(),
    endTime: batchStatus.endTime, 
    filePath: batchStatus.filePath,
    headless: batchStatus.headless,
    timestamp: batchStatus.timestamp, 
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

function updateRealtimeStatus(status, message, details) {
  // Log incoming arguments
  logger.info('--- updateRealtimeStatus CALLED ---', { status, message, details: JSON.stringify(details) }); 

  // Preserve existing logic for currentJobStatus if it's used for single runs or internal state
  currentJobStatus.status = status;
  currentJobStatus.message = message;
  currentJobStatus.details = details; // details might contain totalFormsForCurrentVisit, currentFormForCurrentVisit etc.
  currentJobStatus.lastStatusUpdate = new Date().toISOString();

  // logger.info('[updateRealtimeStatus] Received: status=' + status + ', message=' + message + ', details=' + JSON.stringify(details));
  
  // Log batchStatus BEFORE any modification in this call
  logger.info('[updateRealtimeStatus] batchStatus BEFORE any update this call: ' + JSON.stringify(batchStatus || {}));

  // Update the global batchStatus object which is used by the API endpoint
  if (batchStatus && batchStatus.jobId === currentBatchJobId) {
    batchStatus.status = status; // Overall batch status
    // batchStatus.message will be set more specifically below if it's an active running batch.
    // If it's a final status like 'completed' or 'error', the message might come directly.
    if (status === 'completed' || status === 'error') {
      batchStatus.message = message || batchStatus.message; // Use new message or keep existing
      batchStatus.endTime = new Date().toISOString();
    }
    batchStatus.lastStatusUpdate = new Date().toISOString();
    // completedVisits is updated in runBatchProcess directly.
  }

  logger.info('[updateRealtimeStatus] batchStatus AFTER initial update: ' + JSON.stringify(batchStatus || {}));
  logger.info('[updateRealtimeStatus] batchStatus BEFORE detailed update: ' + JSON.stringify(batchStatus || {}));
  // If a batch job is active, also update the main batchStatus with detailed current visit progress
  if (currentBatchJobId && batchStatus && batchStatus.jobId === currentBatchJobId && batchStatus.status === 'running') {
    let visitProgressMessage = message; // Default to the main message
    let dispenserTotalForVisit = details.totalFormsForCurrentVisit || 0;
    batchStatus.currentVisitId = details.visitId || batchStatus.currentVisitId;
    batchStatus.currentVisitName = details.visitName || batchStatus.currentVisitName; // CORRECTED LINE
    batchStatus.currentVisitStatusMessage = visitProgressMessage; // This is important
    batchStatus.dispenserCount = dispenserTotalForVisit; // Total forms for this visit
    batchStatus.message = `Processing visit ${batchStatus.completedVisits + 1} of ${batchStatus.totalVisits}: ${details.visitName || batchStatus.currentVisitName || 'Current Visit'}`;
  }
  // Log batchStatus AFTER modification
  logger.info('[updateRealtimeStatus] batchStatus AFTER detailed update: ' + JSON.stringify(batchStatus || {}));

  // Emit status update event (if using an event emitter)
  // statusEmitter.emit('statusUpdate', batchStatus); // Example

  logger.info('[updateRealtimeStatus] batchStatus AFTER initial general update: ' + JSON.stringify(batchStatus || {}));

  // If a batch job is active and running, try to parse detailed progress from the message and details
  if (currentBatchJobId && batchStatus && batchStatus.jobId === currentBatchJobId && batchStatus.status === 'running') {
    logger.info('[updateRealtimeStatus] batchStatus BEFORE detailed update logic: ' + JSON.stringify(batchStatus));

    let visitProgressMessage = message; // Default to the main message
    batchStatus.currentVisitId = details?.visitId || batchStatus.currentVisitId;
    batchStatus.currentVisitName = details?.visitName || batchStatus.currentVisitName;
    batchStatus.currentVisitStatusMessage = visitProgressMessage; // This is important, reflects the latest operation string

    // Try to parse form progress (e.g., "Filling form X/Y")
    const formProgressMatch = new RegExp("form ([0-9]+)/([0-9]+)", "i").exec(message);
    if (formProgressMatch && formProgressMatch.length === 3) {
      const parsedFormCurrent = parseInt(formProgressMatch[1], 10);
      const parsedFormTotal = parseInt(formProgressMatch[2], 10);
      logger.info('[updateRealtimeStatus] Parsed Form Progress:', { parsedFormCurrent, parsedFormTotal });
      batchStatus.dispenserCurrent = parsedFormCurrent; // Corresponds to formsCurrent on frontend
      batchStatus.dispenserCount = parsedFormTotal;   // Corresponds to formsTotal on frontend
      batchStatus.currentVisitPhase = 'forms';
    } else if (details?.totalFormsForCurrentVisit) { // Fallback to details if available
        batchStatus.dispenserCount = details.totalFormsForCurrentVisit;
        // dispenserCurrent would be harder to get from details alone without a specific field
    }

    // Try to parse fuel type progress (e.g., "Processing fuel type: Regular (1/4)")
    const fuelProgressMatch = new RegExp("Processing fuel type: ([\\\\w\\\\s-]+) \\\\(([0-9]+)\\/([0-9]+)\\\\)", "i").exec(message);
    if (fuelProgressMatch && fuelProgressMatch.length === 4) {
      const parsedFuelType = fuelProgressMatch[1].trim();
      const parsedFuelCurrent = parseInt(fuelProgressMatch[2], 10);
      const parsedFuelTotal = parseInt(fuelProgressMatch[3], 10);
      logger.info('[updateRealtimeStatus] Parsed Fuel Progress:', { parsedFuelType, parsedFuelCurrent, parsedFuelTotal });
      batchStatus.fuelType = parsedFuelType;
      batchStatus.fuelCurrent = parsedFuelCurrent;
      batchStatus.fuelTotal = parsedFuelTotal;
      batchStatus.currentVisitPhase = 'filling';
    }
    
    // General message update if not already set by completed/error status
    if (status !== 'completed' && status !== 'error') {
        batchStatus.message = `Processing visit ${batchStatus.completedVisits + 1} of ${batchStatus.totalVisits}: ${details?.visitName || batchStatus.currentVisitName || 'Current Visit'}`;
    }

    logger.info('[updateRealtimeStatus] batchStatus AFTER detailed update logic: ' + JSON.stringify(batchStatus));
  }

  // Emit status update event (if using an event emitter)
  // ... existing code ...
}

// Function to update the batch status, can be called from processVisit or processBatch
// ... existing code ...