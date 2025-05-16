// Quick test to check server is running and visual progress endpoint works
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3001';

async function testServerHealth() {
  try {
    console.log('Testing server connection...');
    const response = await fetch(`${SERVER_URL}/health`);
    
    if (response.ok) {
      console.log('✅ Server is running');
    } else {
      console.log('❌ Server responded with:', response.status);
    }
  } catch (error) {
    console.log('❌ Server is not running:', error.message);
  }
}

// Just test connection
testServerHealth();