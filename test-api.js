import fetch from 'node-fetch';

async function testApi() {
  try {
    console.log('Testing /api/form-automation endpoint...');
    const response = await fetch('http://localhost:3001/api/form-automation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitUrl: 'https://workfossa.com/visits/12345',
        headless: true
      })
    });

    const statusCode = response.status;
    console.log(`Status Code: ${statusCode}`);
    
    const responseBody = await response.json();
    console.log('Response Body:', JSON.stringify(responseBody, null, 2));
    console.log('Has jobId:', !!responseBody.jobId);
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testApi(); 