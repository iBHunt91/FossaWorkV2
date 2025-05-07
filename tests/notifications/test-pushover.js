import fetch from 'node-fetch';

async function sendPushoverNotification() {
    // Credentials from .env file
    const appToken = 'ayxnbk5eim41c11ybhivjf4ximp61v';
    const userKey = 'u3h8ajytntb1pu3p6qtmpjy6pgaou2';

    // Notification params
    const params = new URLSearchParams();
    params.append('token', appToken);
    params.append('user', userKey);
    params.append('message', 'This is a test notification from Fossa Monitor');
    params.append('title', 'Fossa Monitor Test');
    params.append('priority', 0);

    try {
        // Send request to Pushover API
        console.log('Sending Pushover notification...');
        const response = await fetch('https://api.pushover.net/1/messages.json', {
            method: 'POST',
            body: params
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Pushover notification sent successfully:', data);
            return { success: true, data };
        } else {
            console.error('Error sending Pushover notification:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('Error sending Pushover notification:', error);
        return { success: false, error };
    }
}

sendPushoverNotification()
    .then(result => {
        console.log('Test completed with result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed with error:', error);
        process.exit(1);
    }); 