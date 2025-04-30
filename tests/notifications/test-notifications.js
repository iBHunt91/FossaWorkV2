import { sendTestPushoverNotification } from './scripts/notifications/pushoverService.js';
import { sendTestEmail } from './scripts/email/emailService.js';

async function runTests() {
    console.log('Testing Pushover notification...');
    try {
        const pushoverResult = await sendTestPushoverNotification();
        console.log('Pushover test result:', JSON.stringify(pushoverResult, null, 2));
    } catch (error) {
        console.error('Pushover test error:', error);
    }
    
    console.log('\nTesting Email notification...');
    try {
        await sendTestEmail();
        console.log('Email test sent successfully');
    } catch (error) {
        console.error('Email test error:', error);
    }
}

runTests(); 