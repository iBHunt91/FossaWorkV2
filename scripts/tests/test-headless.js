import { loginToFossa } from './scripts/login.js';

async function testHeadlessBrowser() {
    console.log('Starting headless browser test');
    let browser;
    try {
        // Use a timeout to ensure the script doesn't hang
        const loginPromise = loginToFossa({ headless: true });
        
        // Set up a timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Login timed out after 30 seconds')), 30000);
        });
        
        // Race the promises
        const result = await Promise.race([loginPromise, timeoutPromise]);
        browser = result.browser;
        const { page } = result;
        
        console.log('Login successful');
        
        // Simple browser test
        console.log('Navigating to test page');
        await page.goto('https://example.com');
        console.log('Page loaded');
        
        const title = await page.title();
        console.log('Page title:', title);
        
        // Close the browser
        console.log('Closing browser');
        await browser.close();
        console.log('Test completed successfully');
        
    } catch (error) {
        console.error('Test failed:', error);
        if (browser) {
            console.log('Closing browser after error');
            await browser.close().catch(e => console.error('Error closing browser:', e));
        }
    } finally {
        console.log('Test finished, exiting');
        process.exit(0);
    }
}

testHeadlessBrowser(); 