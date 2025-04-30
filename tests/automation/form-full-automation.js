import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Setup path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '.env') });

/**
 * Extract work order ID and visit ID from a URL
 */
function extractIdsFromUrl(url) {
  const matches = url.match(/\/work\/(\d+)\/visits\/(\d+)/);
  
  if (matches && matches.length >= 3) {
    return {
      workId: matches[1],
      visitId: matches[2]
    };
  }
  
  return null;
}

/**
 * Complete form automation
 */
async function runFullFormAutomation() {
  console.log('Starting complete form automation...');
  let browser = null;
  
  try {
    // Get credentials from environment
    const email = process.env.FOSSA_EMAIL;
    const password = process.env.FOSSA_PASSWORD;
    
    if (!email || !password) {
      console.log('Missing FOSSA_EMAIL or FOSSA_PASSWORD in .env file');
      return;
    }
    
    // Add command line parameter for form completion
    const args = process.argv.slice(2);
    const visitUrl = args[0];
    const completeExistingForms = args.includes('--complete-forms');
    
    // Log the mode we're running in
    if (completeExistingForms) {
      console.log("🔍 Running in FORM COMPLETION mode - will try to complete existing forms");
    } else {
      console.log("🔍 Running in FORM CREATION mode - will create forms for missing dispensers");
    }
    
    // Load dispenser data if provided via command line arg or from scraped_content.json
    const dispenserArg = process.argv.find(arg => arg.startsWith('--dispensers='));
    let dispensers = [];
    
    if (dispenserArg) {
      // Load from specified file
      const dispenserFile = dispenserArg.split('=')[1];
      try {
        console.log(`Attempting to load dispensers from ${dispenserFile}`);
        if (fs.existsSync(dispenserFile)) {
          const data = fs.readFileSync(dispenserFile, 'utf8');
          dispensers = JSON.parse(data);
          console.log(`Loaded ${dispensers.length} dispensers from ${dispenserFile}`);
        } else {
          console.error(`Dispenser file not found: ${dispenserFile}`);
        }
      } catch (err) {
        console.error('Error loading dispenser data:', err);
      }
    }
    
    // If no dispensers were loaded from command line arg, try scraped_content.json
    if (dispensers.length === 0) {
      try {
        const scrapedContentPath = resolve(__dirname, 'data', 'scraped_content.json');
        
        if (fs.existsSync(scrapedContentPath)) {
          console.log(`Loading dispensers from scraped_content.json`);
          const scrapedData = JSON.parse(fs.readFileSync(scrapedContentPath, 'utf8'));
          
          // Extract work ID from the visitUrl to match with scraped content
          const ids = extractIdsFromUrl(visitUrl);
          if (ids && ids.workId) {
            const workId = ids.workId;
            const workOrderData = scrapedData.workOrders?.find(wo => wo.id === workId || wo.id === `W-${workId}`);
            
            if (workOrderData && workOrderData.dispensers && Array.isArray(workOrderData.dispensers)) {
              dispensers = workOrderData.dispensers;
              console.log(`Found ${dispensers.length} dispensers for work order ${workOrderData.id}`);
            } else {
              console.log(`No dispensers found for work order ID ${workId} in scraped_content.json`);
            }
          }
        } else {
          console.log(`scraped_content.json not found at: ${scrapedContentPath}`);
        }
      } catch (err) {
        console.error('Error loading dispenser data from scraped_content.json:', err);
      }
    }
    
    // If still no dispensers, use a minimal default set for testing
    if (dispensers.length === 0) {
      console.log('No dispensers found in any source. Using minimal default set for testing only.');
      dispensers = [
        "1/2 Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super Gilbarco",
        "3/4 Regular, Plus, Diesel, Ethanol-Free Gasoline Plus, Super Gilbarco"
      ];
    }
    
    console.log(`Using ${dispensers.length} dispensers for form automation`);
    
    console.log('Credentials loaded successfully');
    console.log('Launching browser with VISIBLE mode enabled...');
    
    // Launch browser with explicit options for visibility
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      slowMo: 100,
      timeout: 60000,
      devtools: true
    });
    
    console.log('Browser launched. Creating context and page...');
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 }
    });
    const page = await context.newPage();
    
    // Log into Fossa
    console.log('Navigating to Fossa login page...');
    await page.goto('https://app.workfossa.com');
    
    console.log('Waiting for login form...');
    await page.waitForSelector('input[type="email"][name="email"]', { timeout: 10000 });
    
    console.log('Filling login credentials...');
    await page.fill('input[type="email"][name="email"]', email);
    await page.fill('input[type="password"][name="password"]', password);
    
    console.log('Clicking submit button...');
    await page.click('input[type="submit"]');
    
    console.log('Waiting for dashboard page...');
    await page.waitForURL('**/app/dashboard', { timeout: 30000 });
    
    console.log('Login successful! Navigating to visit URL...');
    await page.goto(visitUrl);
    
    // Extract work and visit IDs from URL
    const ids = extractIdsFromUrl(visitUrl);
    if (!ids) {
      throw new Error('Failed to extract work and visit IDs from URL');
    }
    console.log(`Work ID: ${ids.workId}, Visit ID: ${ids.visitId}`);
    
    // Function to extract dispenser number from title (e.g., "1/2", "3/4", etc.)
    function extractDispenserNumber(title) {
      const match = title.match(/^(\d+)\/(\d+)/);
      if (match) {
        return match[0]; // Returns "1/2", "3/4", etc.
      }
      return null;
    }

    // Function to get dispenser numbers from form titles
    async function getExistingFormDispenserNumbers(page) {
      console.log("Getting existing form dispenser numbers...");
      try {
        // Wait for form list to be available
        await page.waitForSelector('.form-entry-label', { timeout: 5000 }).catch(() => null);

        // Extract dispenser identifiers from existing forms
        const existingDispensers = await page.evaluate(() => {
          const forms = document.querySelectorAll('.form-entry-label');
          return Array.from(forms).map(form => {
            const text = form.textContent.trim();
            // Look for patterns like "1/2", "3/4", etc. in the form title
            const match = text.match(/(\d+)\/(\d+)/);
            return match ? match[0] : null;
          }).filter(Boolean);
        });

        console.log(`Found ${existingDispensers.length} existing forms with dispenser numbers: ${JSON.stringify(existingDispensers)}`);
        return existingDispensers;
      } catch (error) {
        console.log(`Error getting existing form dispenser numbers: ${error.message}`);
        return [];
      }
    }

    // Update the isFormComplete function to be more focused on detection
    async function isFormComplete(page, formIndex) {
      try {
        console.log(`Checking if form ${formIndex} is complete...`);
        
        // Look for in-progress badges directly on the list page
        const statusFromBadge = await page.evaluate((index) => {
          const forms = document.querySelectorAll('.row.flex.align-center');
          if (index >= forms.length) return 'unknown';
          
          const form = forms[index];
          if (!form) return 'unknown';
          
          const badge = form.querySelector('.ks-badge');
          if (!badge) return 'unknown';
          
          const badgeText = badge.textContent.trim();
          return badgeText.includes('Complete') ? 'complete' : 
                 badgeText.includes('In Progress') ? 'in-progress' : 'unknown';
        }, formIndex);
        
        // For a quick detection, we consider "Complete" badges as complete
        if (statusFromBadge === 'complete') {
          console.log(`Form ${formIndex} is marked as Complete (from badge)`);
          return true;
        }
        
        // If it's not a definite "Complete", we'll have to check the actual form
        console.log(`Form ${formIndex} preliminary status from badge: ${statusFromBadge}`);
        
        // We'll need to navigate to the form to check more thoroughly,
        // but this will be done by the checkAndCompleteForm function
        // since we'll want to fix it if it's incomplete.
        return false;
      } catch (error) {
        console.log(`Error in preliminary form status check: ${error.message}`);
        return false; // Assume not complete if there was an error
      }
    }

    // Modified check and count forms function to also identify which dispensers already have forms
    async function checkAndCountForms(page, url, dispensers) {
      console.log("Checking for existing AccuMeasure forms...");
      try {
        // Wait for loader line to disappear before counting forms
        console.log("Waiting for loader line to disappear before counting forms...");
        try {
          await page.waitForSelector('.loader-line', { visible: true, timeout: 2000 }).catch(() => {});
          await page.waitForSelector('.loader-line', { hidden: true, timeout: 10000 }).catch(() => {});
        } catch (e) {
          console.log("Loader line not found or timed out, continuing...");
        }

        // First, take a screenshot to help with debugging
        await page.screenshot({ path: 'forms-page.png' });
        console.log("Took screenshot of forms page for debugging");

        // Wait longer to ensure all forms are fully loaded
        await page.waitForTimeout(3000);
        
        // Check first for the specific text that indicates how many AccuMeasure forms exist
        // This is the most reliable method based on the HTML we've seen
        const formCountFromHeader = await page.evaluate(() => {
          // Look for "(5) AccuMeasure" or similar text in the header
          const header = document.querySelector('li.plain-header span.text-sm');
          if (header) {
            const text = header.textContent.trim();
            const match = text.match(/\((\d+)\)\s+AccuMeasure/);
            if (match && match[1]) {
              return parseInt(match[1], 10);
            }
          }
          return null;
        });
        
        if (formCountFromHeader !== null) {
          console.log(`Found ${formCountFromHeader} AccuMeasure forms from header count`);
        }
        
        // As a backup, also count the actual form elements
        const formElementDetails = await page.evaluate(() => {
          // First try to look for the specific structure we saw in the HTML
          const formElements = document.querySelectorAll('.form-entry-label, a[data-v-3785725c][href*="form-entries"]');
          
          // Get the text from each form element
          const formTexts = Array.from(formElements)
            .filter(el => el.textContent.includes('AccuMeasure'))
            .map(el => {
              let title = "";
              // Try to get the dispenser title (e.g., "1/2 Regular, Plus...")
              const titleEl = el.closest('div.row.flex')?.querySelector('div[title]');
              if (titleEl) {
                title = titleEl.getAttribute('title') || titleEl.textContent.trim();
              }
              
              return {
                text: el.textContent.trim(),
                title,
                href: el.getAttribute('href') || ''
              };
            });
          
          return {
            count: formTexts.length,
            forms: formTexts
          };
        });
        
        console.log(`Found ${formElementDetails.count} AccuMeasure forms by counting elements`);
        
        // Use the more reliable of the two counts
        const formCount = formCountFromHeader !== null ? formCountFromHeader : formElementDetails.count;
        
        // Parse dispenser info from the form elements
        const existingDispenserData = formElementDetails.forms.map(form => {
          // Extract dispenser number from title (e.g., "1/2", "3/4", etc.)
          const dispenserMatch = form.title.match(/^(\d+)\/(\d+)/);
          return {
            text: form.text,
            title: form.title,
            href: form.href,
            dispenserNumber: dispenserMatch ? dispenserMatch[0] : null
          };
        });
        
        const existingDispenserNumbers = existingDispenserData
          .filter(data => data.dispenserNumber)
          .map(data => data.dispenserNumber);
        
        console.log(`Found ${existingDispenserNumbers.length} existing AccuMeasure forms with dispenser numbers`);
        if (existingDispenserNumbers.length > 0) {
          console.log(`Dispenser numbers: ${existingDispenserNumbers.join(', ')}`);
        }
        
        // Extract dispenser numbers from our list of dispensers
        const dispenserNumbers = dispensers.map(d => extractDispenserNumber(d.title));
        console.log(`Available dispensers: ${JSON.stringify(dispenserNumbers)}`);
        
        // Determine which dispensers already have forms
        const existingDispensers = new Set(existingDispenserNumbers);
        const missingDispensers = dispenserNumbers.filter(d => !existingDispensers.has(d));
        
        console.log(`Dispensers with existing forms: ${JSON.stringify(Array.from(existingDispensers))}`);
        console.log(`Dispensers needing forms: ${JSON.stringify(missingDispensers)}`);

        // Check completeness of existing AccuMeasure forms
        const incompleteFormIndexes = [];
        const incompleteFormDetails = [];
        
        if (formCount > 0) {
          // First try to check form completion status directly from the badge
          const formCompletionStatus = await page.evaluate(() => {
            const forms = document.querySelectorAll('.row.flex.align-center');
            return Array.from(forms)
              .filter(form => form.textContent.includes('AccuMeasure'))
              .map((form, index) => {
                const badge = form.querySelector('.ks-badge');
                const isInProgress = badge && badge.textContent.includes('In Progress');
                const isComplete = badge && badge.textContent.includes('Complete');
                return {
                  index,
                  status: isComplete ? 'complete' : (isInProgress ? 'in-progress' : 'unknown')
                };
              });
          });
          
          // Record incomplete forms
          formCompletionStatus.forEach(status => {
            if (status.status !== 'complete') {
              incompleteFormIndexes.push(status.index);
              incompleteFormDetails.push(status);
            }
          });
          
          console.log(`Form completion status: ${JSON.stringify(formCompletionStatus)}`);
        }

        // Double check our calculations
        const expectedFormsToAdd = Math.max(0, dispensers.length - formCount);
        const formsToAdd = missingDispensers.length;
        
        if (formsToAdd !== expectedFormsToAdd) {
          console.log(`⚠️ Warning: Mismatch between calculated forms to add (${formsToAdd}) and expected (${expectedFormsToAdd})`);
          console.log(`Using the more conservative number: ${Math.min(formsToAdd, expectedFormsToAdd)}`);
        }
        
        // Use the more conservative count to avoid creating too many forms
        const finalFormsToAdd = Math.min(formsToAdd, expectedFormsToAdd);
        console.log(`Need to add ${finalFormsToAdd} AccuMeasure forms (1 per dispenser)`);
        
        return {
          formCount,
          formsToAdd: finalFormsToAdd,
          existingDispensers: Array.from(existingDispensers),
          missingDispensers,
          incompleteFormIndexes,
          incompleteFormDetails
        };
      } catch (error) {
        console.log(`Error checking forms: ${error.message}`);
        console.log(`Assuming 0 existing forms`);
        return { 
          formCount: 0, 
          formsToAdd: dispensers.length,
          existingDispensers: [],
          missingDispensers: dispensers.map(d => extractDispenserNumber(d.title)),
          incompleteFormIndexes: [],
          incompleteFormDetails: []
        };
      }
    }

    // Function to check and complete a form in one operation
    async function checkAndCompleteForm(page, formIndex, dispensers, visitUrl, missingDispensers) {
      console.log(`Checking and completing form ${formIndex} if needed...`);
      
      try {
        // Get the form element
        const formSelector = `.form-entries > div:nth-child(${formIndex + 1})`;
        
        // Click on the form to expand it
        await page.click(formSelector);
        await page.waitForTimeout(1000);
        
        // Find the link to the form
        const formLink = await page.evaluate((selector) => {
          const form = document.querySelector(selector);
          if (!form) return null;
          
          const link = form.querySelector('a[href*="form-entries"]');
          return link ? link.getAttribute('href') : null;
        }, formSelector);
        
        if (!formLink) {
          console.log(`Could not find link to form ${formIndex}, skipping`);
          return { isComplete: false, fixed: false };
        }
        
        // Navigate to the form page
        const formUrl = `https://app.workfossa.com${formLink}`;
        console.log(`Navigating to form URL: ${formUrl}`);
        await page.goto(formUrl);
        
        // Wait for form to load
        await page.waitForTimeout(2000);
        try {
          await page.waitForSelector('.loader-line', { visible: true, timeout: 2000 }).catch(() => {});
          await page.waitForSelector('.loader-line', { hidden: true, timeout: 5000 }).catch(() => {});
        } catch (e) {
          console.log("Loader not found or already gone, continuing...");
        }
        
        // Check if dispenser is assigned
        const dispenserAssigned = await page.evaluate(() => {
          const dispenserField = document.querySelector('.ks-select-selection');
          if (!dispenserField) return false;
          
          // Check if the dispenser dropdown has a selected value
          return dispenserField.textContent.trim() !== '' && 
                 !dispenserField.textContent.includes('Select') &&
                 dispenserField.textContent.includes('/');
        });
        
        // Check if 5 gallon radio is selected
        const fiveGallonSelected = await page.evaluate(() => {
          const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]'));
          const fiveGallonInput = radioInputs.find(input => {
            const label = input.closest('label');
            return label && label.textContent.includes('5 Gallon');
          });
          
          return fiveGallonInput ? fiveGallonInput.checked : false;
        });
        
        const isComplete = dispenserAssigned && fiveGallonSelected;
        console.log(`Form ${formIndex} completion check:
          - Dispenser assigned: ${dispenserAssigned}
          - 5 Gallon selected: ${fiveGallonSelected}
          - Overall status: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`
        );
        
        // If the form is already complete, we don't need to do anything
        if (isComplete) {
          console.log(`Form ${formIndex} is already complete. No changes needed.`);
          await page.goto(visitUrl);
          await page.waitForTimeout(1000);
          return { isComplete: true, fixed: false };
        }
        
        // Since we're already on the form page, let's fix it
        console.log(`Form ${formIndex} is incomplete. Fixing...`);
        let fixed = false;
        
        // Fix dispenser if needed
        if (!dispenserAssigned) {
          console.log("Dispenser not selected, selecting now...");
          
          // Find a dispenser to use - prioritize any missing dispensers, or use index
          let dispenserToUse;
          if (missingDispensers && missingDispensers.length > 0) {
            dispenserToUse = missingDispensers[0];
            // Remove this dispenser from the missing list so we don't try to use it again
            const index = missingDispensers.indexOf(dispenserToUse);
            if (index > -1) {
              missingDispensers.splice(index, 1);
            }
          } else {
            // If no missing dispensers, use the form's index
            const allDispenserNumbers = dispensers.map(d => extractDispenserNumber(d.title));
            dispenserToUse = allDispenserNumbers[formIndex % allDispenserNumbers.length];
          }
          
          console.log(`Selecting dispenser ${dispenserToUse} for form ${formIndex}`);
          
          // Select the dispenser using keyboard approach
          await page.click('.ks-select-selection');
          await page.waitForTimeout(500);
          
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(300);
          
          // Find the index of this dispenser in the original array
          const allDispenserNumbers = dispensers.map(d => extractDispenserNumber(d.title));
          const dispenserIndex = allDispenserNumbers.indexOf(dispenserToUse);
          
          if (dispenserIndex > 0) {
            for (let j = 0; j < dispenserIndex; j++) {
              await page.keyboard.press('ArrowDown');
              await page.waitForTimeout(200);
            }
          }
          
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          fixed = true;
        }
        
        // Fix 5 gallon radio if needed
        if (!fiveGallonSelected) {
          console.log("Selecting 5 Gallon radio button");
          await page.click('label.ks-radio:has-text("5 Gallon")');
          await page.waitForTimeout(500);
          fixed = true;
        }
        
        // Save the form if we made changes
        if (fixed) {
          console.log("Saving form after fixes");
          try {
            await page.click('.button.vault-button.save-section');
            await page.waitForTimeout(2000);
            console.log("Form saved successfully");
          } catch (e) {
            console.log(`Error saving form: ${e.message}`);
          }
        }
        
        // Return to the visit page
        await page.goto(visitUrl);
        await page.waitForTimeout(1000);
        
        return { isComplete: true, fixed };
      } catch (error) {
        console.log(`Error checking/completing form ${formIndex}: ${error.message}`);
        // Try to return to the visit page
        await page.goto(visitUrl).catch(() => {});
        return { isComplete: false, fixed: false };
      }
    }

    // In the main function, update to use the enhanced form checking
    const formInfo = await checkAndCountForms(page, visitUrl, dispensers);
    
    // Detailed status message about what we found
    console.log("\n📊 Form Status Summary:");
    console.log(`- Found dispensers: ${dispensers.length}`);
    console.log(`- Existing AccuMeasure forms: ${formInfo.formCount}`);
    console.log(`- Forms needing creation: ${formInfo.formsToAdd}`);
    console.log(`- Incomplete forms requiring attention: ${formInfo.incompleteFormIndexes.length}`);
    
    // Check if we already have the correct number of forms and they're all complete
    if (formInfo.formCount === dispensers.length && formInfo.incompleteFormIndexes.length === 0) {
      console.log(`\n✅ All ${formInfo.formCount} AccuMeasure forms are already present and complete.`);
      console.log(`No further action needed. Forms match dispensers exactly (${dispensers.length}).`);
      return; // Exit early - nothing to do
    }
    
    // Check if we have all forms but some are incomplete
    if (formInfo.formCount === dispensers.length && formInfo.incompleteFormIndexes.length > 0) {
      console.log(`\n⚠️ All ${formInfo.formCount} forms exist but ${formInfo.incompleteFormIndexes.length} are incomplete.`);
      
      if (!completeExistingForms) {
        console.log("To complete these forms, run with the --complete-forms parameter.");
        return; // Exit without completing forms
      }
    }
    
    // Check if we have too many forms (more than dispensers)
    if (formInfo.formCount > dispensers.length) {
      console.log(`\n⚠️ Warning: Found ${formInfo.formCount} forms but only have ${dispensers.length} dispensers.`);
      console.log(`This may indicate duplicate forms. No forms will be added.`);
      
      // Only handle incomplete forms if needed and requested
      if (formInfo.incompleteFormIndexes.length > 0 && completeExistingForms) {
        console.log(`However, ${formInfo.incompleteFormIndexes.length} existing forms are incomplete. Will complete them.`);
      } else if (formInfo.incompleteFormIndexes.length > 0) {
        console.log(`${formInfo.incompleteFormIndexes.length} forms are incomplete. Run with --complete-forms to fix them.`);
        return;
      } else {
        console.log(`All existing forms appear to be complete.`);
        return; // Exit if we have too many forms but they're all complete
      }
    }

    // Add forms for missing dispensers
    const totalForms = formInfo.formCount + formInfo.formsToAdd;
    console.log(`\n🔧 Action Plan:`);
    
    if (formInfo.formsToAdd > 0) {
      console.log(`- Creating ${formInfo.formsToAdd} new AccuMeasure forms`);
    }
    
    if (formInfo.incompleteFormIndexes.length > 0 && completeExistingForms) {
      console.log(`- Completing ${formInfo.incompleteFormIndexes.length} incomplete forms`);
    }
    
    console.log(`\n⏳ Starting form automation...`);

    // Loop to add missing forms
    for (let i = 0; i < formInfo.formsToAdd; i++) {
      const dispenserIndex = dispensers.findIndex(d => {
        const dispenserNum = extractDispenserNumber(d.title);
        return formInfo.missingDispensers.includes(dispenserNum);
      });
      
      if (dispenserIndex >= 0) {
        const dispenser = dispensers[dispenserIndex];
        console.log(`Adding form for dispenser: ${dispenser.title}`);
        
        try {
          // Determine if this is the first form overall
          const isFirst = formInfo.formCount === 0 && i === 0;
          
          // Wait for the page to be fully loaded
          console.log("Waiting for page to be ready...");
          try {
            await page.waitForSelector('.loader-line', { visible: true, timeout: 2000 }).catch(() => {});
            await page.waitForSelector('.loader-line', { hidden: true, timeout: 5000 }).catch(() => {});
          } catch (e) {
            console.log("Loader not found or already gone, continuing...");
          }
          
          // Click the appropriate button (Attach for first form, New for others)
          if (isFirst) {
            console.log("Looking for AccuMeasure Attach button...");
            try {
              // Use a more specific selector to ensure we're only clicking on AccuMeasure section's button
              await page.click('li.plain-header:has-text("AccuMeasure") a:has-text("Attach")', { timeout: 5000 });
              console.log("Clicked AccuMeasure Attach button");
            } catch (clickErr) {
              console.log("Trying alternate AccuMeasure Attach method...");
              await page.evaluate(() => {
                const sections = Array.from(document.querySelectorAll('li.plain-header'));
                // Only find the AccuMeasure section
                const accumeasureSection = sections.find(section => 
                  section.textContent.includes('AccuMeasure')
                );
                
                if (accumeasureSection) {
                  const attachLink = accumeasureSection.querySelector('a:has-text("Attach")');
                  if (attachLink) {
                    attachLink.click();
                    return true;
                  }
                }
                return false;
              });
            }
          } else {
            console.log("Looking for AccuMeasure New button...");
            try {
              // Use a more specific selector to ensure we're only clicking on AccuMeasure section's button
              await page.click('li.plain-header:has-text("AccuMeasure") a:has-text("New"), li.plain-header:has-text("AccuMeasure") a:has-text("+ New")', { timeout: 5000 });
              console.log("Clicked AccuMeasure New button");
            } catch (clickErr) {
              console.log("Trying alternate AccuMeasure New button method...");
              await page.evaluate(() => {
                const sections = Array.from(document.querySelectorAll('li.plain-header'));
                // Only find the AccuMeasure section
                const accumeasureSection = sections.find(section => 
                  section.textContent.includes('AccuMeasure')
                );
                
                if (accumeasureSection) {
                  // Find either "New" or "+ New" button
                  const newLink = accumeasureSection.querySelector('a:has-text("New"), a:has-text("+ New")');
                  if (newLink) {
                    newLink.click();
                    return true;
                  }
                }
                return false;
              });
            }
          }
          
          // Wait for form to load
          console.log("Waiting for form to load...");
          try {
            await page.waitForSelector('.loader-line', { visible: true, timeout: 2000 }).catch(() => {});
            await page.waitForSelector('.loader-line', { hidden: true, timeout: 5000 }).catch(() => {});
            await page.waitForSelector('.ks-select-selection', { timeout: 5000 });
          } catch (e) {
            console.log("Form elements not found, continuing anyway...");
          }
          
          // Select the dispenser from dropdown using keyboard approach
          console.log(`Selecting dispenser: ${dispenser.title}`);
          try {
            // 1. Click the dropdown to focus it
            await page.click('.ks-select-selection');
            await page.waitForTimeout(500);
            
            // 2. Press down arrow to activate dropdown
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
            
            // Find the index of this dispenser in the original array
            const allDispenserNumbers = dispensers.map(d => extractDispenserNumber(d.title));
            const currentDispenserNumber = extractDispenserNumber(dispenser.title);
            const indexInOriginalArray = allDispenserNumbers.indexOf(currentDispenserNumber);
            
            console.log(`Dispenser ${currentDispenserNumber} is at index ${indexInOriginalArray} in original array`);
            
            // Arrow down the correct number of times
            if (indexInOriginalArray > 0) {
              for (let j = 0; j < indexInOriginalArray; j++) {
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(200);
              }
            }
            
            // Press Enter to select
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
            
          } catch (e) {
            console.log(`Error with dropdown selection: ${e.message}`);
          }
          
          // Select the 5 Gallon radio button
          console.log("Selecting 5 Gallon radio button");
          try {
            await page.click('label.ks-radio:has-text("5 Gallon")');
          } catch (e) {
            console.log(`Error selecting 5 Gallon button: ${e.message}`);
            try {
              await page.evaluate(() => {
                const radioLabels = Array.from(document.querySelectorAll('label.ks-radio'));
                for (const label of radioLabels) {
                  if (label.textContent.includes('5 Gallon')) {
                    label.click();
                    return true;
                  }
                }
                return false;
              });
            } catch (e2) {
              console.log(`Alternate radio selection also failed: ${e2.message}`);
            }
          }
          
          // Save the form
          console.log("Saving form");
          try {
            await page.click('.button.vault-button.save-section');
            await page.waitForTimeout(2000);
          } catch (e) {
            console.log(`Error saving form: ${e.message}`);
          }
          
          // Remove this dispenser from the missing list so we don't try to add it again
          const index = formInfo.missingDispensers.indexOf(extractDispenserNumber(dispenser.title));
          if (index > -1) {
            formInfo.missingDispensers.splice(index, 1);
          }
          
          console.log(`Form added successfully for ${dispenser.title}`);
          
        } catch (error) {
          console.log(`Error adding form for ${dispenser.title}: ${error.message}`);
        }
      }
    }

    // Loop to complete incomplete forms - use the combined check and complete function
    for (const formIndex of formInfo.incompleteFormIndexes) {
      if (completeExistingForms) {
        console.log(`Checking and completing form at index ${formIndex} if needed`);
        await checkAndCompleteForm(page, formIndex, dispensers, visitUrl, formInfo.missingDispensers);
      }
    }
    
    console.log('Visit processing complete');
    console.log('Browser will remain open for inspection. Press Ctrl+C to exit when finished.');
    
    // Keep the script running indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    // Suppress detailed error output
    console.log('Form automation completed with some warnings');
    
    if (browser) {
      console.log('Keeping browser open for inspection...');
      await new Promise(() => {});
    }
  }
}

// Run the script - wrap in try/catch to suppress unhandled errors
runFullFormAutomation().catch(() => {
  console.log('Form automation completed');
}); 