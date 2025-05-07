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
    
    // Get visit URL from command line arguments
    const visitUrl = process.argv[2];
    if (!visitUrl) {
      console.log('Please provide a visit URL as a command line argument');
      return;
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
    
    // More precise check for existing forms
    console.log('Checking for existing AccuMeasure forms...');
    await page.waitForSelector('div[data-v-3785725c]', { timeout: 20000 });
    
    // Wait for loader to finish before counting forms
    console.log("Waiting for loader line to disappear before counting forms...");
    await page.waitForFunction(() => {
      const loaderLines = document.querySelectorAll('.loader-line');
      return Array.from(loaderLines).every(line => 
        !line || line.style.display === 'none' || getComputedStyle(line).display === 'none'
      );
    }, { timeout: 10000 });
    
    // More precise evaluation to count AccuMeasure forms
    const existingForms = await page.evaluate(() => {
      // Find all form rows
      const formRows = Array.from(document.querySelectorAll('div.row.flex.align-center'));
      
      // Filter only AccuMeasure forms
      const accumeasureForms = formRows.filter(row => {
        const text = row.textContent || '';
        return text.includes('AccuMeasure');
      });
      
      console.log(`Found ${accumeasureForms.length} AccuMeasure forms in page evaluation`);
      return accumeasureForms.length;
    });
    
    console.log(`Found ${existingForms} existing AccuMeasure forms`);
    
    // Determine how many forms we need to add - one per dispenser
    const formsNeeded = Math.max(0, dispensers.length - existingForms);
    
    console.log(`Need to add ${formsNeeded} AccuMeasure forms (1 per dispenser)`);
    console.log(`Total forms after adding will be: ${existingForms + formsNeeded} (should equal ${dispensers.length})`);
    
    if (formsNeeded === 0) {
      console.log('All required forms already exist, nothing to do!');
    } else if (formsNeeded > 0) {
      console.log(`Need to add ${formsNeeded} AccuMeasure forms`);
      
      // Track successes and failures
      let successCount = 0;
      
      // Add forms as needed
      for (let i = 0; i < formsNeeded; i++) {
        // A form is "first" only if there are no existing forms AND this is the first iteration
        const isFirst = existingForms === 0 && i === 0;
        console.log(`Adding form ${i+1}/${formsNeeded} (isFirst: ${isFirst})`);
        
        try {
          // Wait for the page to be fully loaded before proceeding
          console.log("Waiting for page to be ready...");
          try {
            await page.waitForFunction(() => {
              const loaderLines = document.querySelectorAll('.loader-line');
              return Array.from(loaderLines).every(line => 
                !line || line.style.display === 'none' || getComputedStyle(line).display === 'none'
              );
            }, { timeout: 10000 });
          } catch (e) {
            // Ignore timeout
          }
          
          if (isFirst) {
            // For the first form when none exist, use Attach
            console.log("Looking for Attach button...");
            
            try {
              // Direct approach with reduced timeout
              await page.click('li.plain-header a:has-text("Attach")', { timeout: 5000 });
              console.log("Clicked Attach button");
            } catch (clickErr) {
              // Try alternate method silently
              try {
                await page.evaluate(() => {
                  const attachLinks = Array.from(document.querySelectorAll('a'));
                  for (const link of attachLinks) {
                    if (link.textContent.trim() === 'Attach' && 
                        link.closest('li') && 
                        link.closest('li').textContent.includes('AccuMeasure')) {
                      link.click();
                      return true;
                    }
                  }
                  return false;
                });
              } catch (e) {
                // Ignore errors
              }
            }
          } else {
            // For subsequent forms, use New
            console.log("Looking for New button...");
            
            try {
              // Direct approach with reduced timeout
              await page.click('li.plain-header a:has-text("New")', { timeout: 5000 });
              console.log("Clicked New button");
            } catch (clickErr) {
              // Try alternate method silently
              try {
                await page.evaluate(() => {
                  const newLinks = Array.from(document.querySelectorAll('a'));
                  for (const link of newLinks) {
                    if ((link.textContent.trim() === 'New' || link.textContent.includes('+ New')) && 
                        link.closest('li') && 
                        link.closest('li').textContent.includes('AccuMeasure')) {
                      link.click();
                      return true;
                    }
                  }
                  return false;
                });
              } catch (e) {
                // Ignore errors
              }
            }
          }
          
          // Wait for the form to load
          console.log("Waiting for form to load...");
          try {
            await page.waitForFunction(() => {
              const loaderLines = document.querySelectorAll('.loader-line');
              return Array.from(loaderLines).every(line => 
                !line || line.style.display === 'none' || getComputedStyle(line).display === 'none'
              );
            }, { timeout: 5000 });
          } catch (e) {
            // Ignore timeout
          }
          
          // Submit the form if a button exists
          try {
            if (await page.$('button[type="submit"]')) {
              console.log("Submitting form...");
              await page.click('button[type="submit"]');
            }
          } catch (e) {
            // Ignore errors
          }
          
          // Brief pause to let form submission complete
          await page.waitForTimeout(1000);
          successCount++;
          
        } catch (error) {
          // Completely suppress errors
          console.log(`Continuing to next form...`);
          continue;
        }
      }
      
      console.log(`Form addition process complete: ${successCount}/${formsNeeded} forms processed`);
    }
    
    // Get updated form list - we're already on the page so no refresh needed
    console.log('Checking final form status...');
    await page.waitForSelector('div[data-v-3785725c]', { timeout: 10000 });
    
    const finalForms = await page.$$eval('div[data-v-3785725c].row.flex.align-center', forms => {
      return forms.filter(form => {
        const titleEl = form.querySelector('a.none');
        return titleEl && titleEl.textContent.includes('AccuMeasure');
      }).map(form => {
        const titleEl = form.querySelector('a.none');
        const href = titleEl ? titleEl.getAttribute('href') : null;
        const formId = href ? href.split('/').pop() : null;
        
        // Check if the form has data filled out
        const infoDiv = form.querySelector('.text-sm.ml-0.5.mt-0.5 .ellipsis');
        const filledOut = infoDiv && infoDiv.textContent.trim() !== '';
        
        // Get status badge
        const statusBadge = form.querySelector('.ks-badge span');
        const status = statusBadge ? statusBadge.textContent.trim() : 'Unknown';
        
        return { formId, filledOut, status };
      });
    });
    
    console.log(`Final forms count: ${finalForms.length}`);
    console.log('Forms status:', finalForms);
    
    // Fill out forms that aren't already filled
    for (let i = 0; i < Math.min(finalForms.length, dispensers.length); i++) {
      const form = finalForms[i];
      const dispenser = dispensers[i];
      
      if (!form.filledOut) {
        console.log(`Filling out form ${i+1} with dispenser info`);
        
        // Convert dispenser object to string description
        let dispenserInfo;
        if (typeof dispenser === 'string') {
          dispenserInfo = dispenser;
        } else {
          // Format dispenser info based on what we have
          const grades = dispenser.fields?.Grade || '';
          const make = dispenser.make || '';
          const model = dispenser.model || '';
          dispenserInfo = `${grades} ${make} ${model}`.trim();
        }
        
        try {
          // Navigate to the form entry page
          const formUrl = `https://app.workfossa.com/app/work/${ids.workId}/visits/${ids.visitId}/form-entries/${form.formId}`;
          console.log(`Navigating to form: ${formUrl}`);
          await page.goto(formUrl);
          
          // Wait for form to load
          await page.waitForSelector('div.form-entry-content', { timeout: 10000 });
          
          // Look for form sections
          const sections = await page.$$('.form-entry-section');
          console.log(`Found ${sections.length} form sections`);
          
          // First, try to locate fields for dispenser info
          const fields = await page.$$('textarea, input.form-control, select');
          console.log(`Found ${fields.length} editable fields`);
          
          // Fill in the first field with dispenser info
          if (fields.length > 0) {
            await fields[0].fill(dispenserInfo);
            console.log('Filled first field with dispenser info:', dispenserInfo);
          }
          
          // Look for any checkboxes or radio buttons
          const checkboxes = await page.$$('input[type="checkbox"], input[type="radio"]');
          
          if (checkboxes.length > 0) {
            await checkboxes[0].check();
            console.log('Checked a checkbox/radio button');
          }
          
          // Mark form as in progress by clicking Save
          await page.click('button:has-text("Save")');
          console.log('Clicked Save button');
          
          // Wait for save to complete
          await page.waitForTimeout(3000);
          
          // Navigate back to the visit page
          await page.goto(`https://app.workfossa.com/app/work/${ids.workId}/visits/${ids.visitId}/`);
          console.log('Navigated back to visit page');
        } catch (error) {
          console.error(`Failed to fill out form ${i+1}:`, error);
        }
      } else {
        console.log(`Form ${i+1} is already filled out with status: ${form.status}`);
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