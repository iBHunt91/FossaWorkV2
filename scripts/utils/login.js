import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import * as logger from './logger.js';

// Configure logger for this environment
logger.configure({
  useColors: process.platform !== 'win32',
  useSimpleFormat: process.platform === 'win32'
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the .env file in the project root
const envPath = path.resolve(__dirname, '../..', '.env');
dotenv.config({ path: envPath });

// Display environment variables status
logger.info('Environment Configuration', [
  `Loading environment from: ${envPath}`,
  'Status:',
  `  FOSSA_EMAIL:    ${process.env.FOSSA_EMAIL ? '[SET]' : '[NOT SET]'}`,
  `  FOSSA_PASSWORD: ${process.env.FOSSA_PASSWORD ? '[SET]' : '[NOT SET]'}`
]);

/**
 * Log in to the Work Fossa website and return the authenticated page
 * @param {Object} options Optional parameters
 * @param {boolean} options.headless Whether to run the browser in headless mode (default: true)
 * @param {string} options.email Custom email to use (overrides env variable)
 * @param {string} options.password Custom password to use (overrides env variable)
 * @returns {Object} The authenticated page and browser
 */
export async function loginToFossa(options = {}) {
    const { headless = true, email, password } = options;
    let browser;
    let page;

    // Set the browser viewport and window size
    const viewportWidth = 1200;
    const viewportHeight = 800;

    try {
        // Use provided credentials or fall back to environment variables
        const fossaEmail = email || process.env.FOSSA_EMAIL;
        const fossaPassword = password || process.env.FOSSA_PASSWORD;

        if (!fossaEmail || !fossaPassword) {
            throw new Error('FOSSA_EMAIL or FOSSA_PASSWORD environment variables are not set');
        }

        console.log(`Logging in with email: ${fossaEmail}`);

        const browserOptions = {
            headless: headless,
            args: [
                '--disable-web-security',
                '--start-maximized',
                '--disable-extensions',
                '--disable-infobars',
                '--window-size=1920,1080' // Explicitly set window size
            ],
            ignoreDefaultArgs: ['--enable-automation'], // Make it look more like regular Chrome
            defaultViewport: null // Important: this prevents Playwright from constraining the viewport
        };
        
        // Add additional launch options if provided
        if (options.browserOptions) {
            Object.assign(browserOptions, options.browserOptions);
        }
        
        browser = await chromium.launch(browserOptions);
        
        // Create a context with the specified viewport size or a default larger size
        // Note: when defaultViewport is null above, this setting becomes less important
        const context = await browser.newContext({
            viewport: null // This allows the browser window to control viewport size
        });
        
        page = await context.newPage();

        // Navigate to the login page
        await page.goto('https://app.workfossa.com');

        // Fill in the login form
        await page.fill('input[type="email"][name="email"]', fossaEmail);
        await page.fill('input[type="password"][name="password"]', fossaPassword);
        
        // Click the submit button
        await page.click('input[type="submit"]');

        // Wait for either error message or successful navigation
        const errorSelector = '.error-message, .form-error, .login-error, .alert-error';
        
        // Race between success (navigation) and failure (error message)
        const result = await Promise.race([
            // Success case: wait for navigation to dashboard
            page.waitForURL('**/app/dashboard', { timeout: 10000 })
                .then(() => ({ success: true })),
            
            // Failure case: check for error message
            page.waitForSelector(errorSelector, { timeout: 10000, state: 'visible' })
                .then(async () => {
                    // Get the error message text
                    const errorText = await page.textContent(errorSelector) || 'Invalid credentials';
                    return { success: false, error: errorText.trim() };
                })
                .catch(() => null), // Ignore if no error element found
            
            // General timeout if neither happens
            new Promise(resolve => setTimeout(() => resolve({ 
                success: false, 
                error: 'Login verification timed out. Please check the credentials and try again.' 
            }), 12000))
        ]);
        
        // If result is null, it means we didn't find an error element but we also didn't navigate to dashboard
        if (!result) {
            // Try to detect if we're still on login page
            const currentUrl = page.url();
            if (currentUrl.includes('login') || currentUrl.includes('signin')) {
                throw new Error('Invalid credentials. Login failed.');
            }
        }
        
        // Handle explicit failure
        if (result && !result.success) {
            throw new Error(result.error || 'Login failed');
        }

        logger.success('Authentication', 'Login successful!');
        
        // Return the browser, context, and page objects for further use
        return { success: true, browser, page, error: null };
    } catch (error) {
        logger.error('Login Failed', error);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

// If the script is run directly
if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
    loginToFossa({ headless: false }) // Use visible browser when run directly for debugging
        .then(async ({ browser }) => {
            logger.info('Test Status', 'Test login completed, closing browser.');
            await browser.close();
        })
        .catch(error => {
            logger.error('Script Error', error);
            process.exit(1);
        });
} 