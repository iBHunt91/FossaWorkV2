import { loginToFossa } from '../utils/login.js';

async function testLogin() {
    console.log('Starting test login...');
    try {
        const { browser, page } = await loginToFossa({ headless: true });
        console.log('Login successful!');
        console.log('Current URL:', page.url());
        
        await browser.close();
        console.log('Browser closed');
        return true;
    } catch (error) {
        console.error('Login test failed:', error);
        return false;
    }
}

console.log('Test script started');
testLogin()
    .then(result => {
        console.log('Test completed with result:', result);
        process.exit(result ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    }); 