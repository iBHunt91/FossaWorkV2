/**
 * Utility functions for Puppeteer interactions
 */

/**
 * Waits for network to be idle (no requests for a period of time)
 * @param {Object} page - Puppeteer page object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function waitForNetworkIdle(page, timeout = 5000) {
    try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout });
    } catch (error) {
        console.warn('Warning: Network idle timeout exceeded:', error.message);
        // Continue execution despite timeout
    }
}

/**
 * Scrolls to the bottom of the page
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<void>}
 */
export async function scrollToBottom(page) {
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
}

/**
 * Executes a function with retries
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for retries
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.delay - Delay between retries in milliseconds
 * @returns {Promise<any>}
 */
export async function withRetries(fn, { maxRetries = 3, delay = 1000 } = {}) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${i + 1} failed:`, error.message);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

export default {
    waitForNetworkIdle,
    scrollToBottom,
    withRetries
}; 