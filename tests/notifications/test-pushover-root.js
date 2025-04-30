// Simple test script for Pushover notifications

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read values directly from .env file
const envPath = path.join(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key.trim()] = value.trim();
    }
    return acc;
}, {});

console.log('Loaded environment variables:');
console.log(`- PUSHOVER_APP_TOKEN: ${envVars.PUSHOVER_APP_TOKEN ? envVars.PUSHOVER_APP_TOKEN.substring(0, 4) + '...' : 'Not found'}`);
console.log(`- PUSHOVER_USER_KEY: ${envVars.PUSHOVER_USER_KEY ? envVars.PUSHOVER_USER_KEY.substring(0, 4) + '...' : 'Not found'}`);

async function testPushover() {
    try {
        // Construct payload with required fields
        const params = new URLSearchParams();
        params.append('token', envVars.PUSHOVER_APP_TOKEN);
        params.append('user', envVars.PUSHOVER_USER_KEY);
        params.append('message', 'This is a test message from Fossa Monitor');
        params.append('title', 'Fossa Monitor Test');
        params.append('priority', '1');
        
        console.log('Sending Pushover notification...');
        
        // Send request to Pushover API
        const response = await fetch('https://api.pushover.net/1/messages.json', {
            method: 'POST',
            body: params
        });

        const data = await response.json();
        
        console.log('Response status:', response.status);
        console.log('Response data:', data);
        
        if (response.ok) {
            console.log('Pushover notification sent successfully!');
        } else {
            console.error('Error sending Pushover notification:', data);
        }
        
        return { success: response.ok, data };
    } catch (error) {
        console.error('Error sending Pushover notification:', error);
        return { success: false, error };
    }
}

testPushover()
    .then(result => console.log('Test complete:', result.success ? 'Success' : 'Failed'))
    .catch(error => console.error('Test failed:', error)); 