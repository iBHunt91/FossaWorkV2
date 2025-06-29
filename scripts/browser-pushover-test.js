// Paste this in browser console to test Pushover directly

async function testPushover() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('No auth token found!');
    return;
  }

  try {
    const response = await fetch('http://localhost:8000/api/notifications/test/pushover', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Raw response:', data);
    console.log('Response status:', response.status);
    console.log('Success flag:', data.success);
    console.log('Results:', data.results);
    
    // Show the actual response structure
    console.log('Full response structure:', JSON.stringify(data, null, 2));
    
    // Check what the actual success condition should be
    if (data.success && data.results && data.results.pushover === true) {
      console.log('✅ TEST PASSED - Notification sent!');
    } else {
      console.log('❌ TEST FAILED - Check the response structure above');
    }
    
    return data;
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testPushover();