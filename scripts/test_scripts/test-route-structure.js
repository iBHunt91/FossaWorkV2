import fetch from 'node-fetch';

async function testRouteStructure() {
  console.log('Testing route structure...\n');
  
  const baseUrl = 'http://localhost:3001';
  const userId = '7bea3bdb7e8e303eacaba442bd824004';
  
  const testUrls = [
    { method: 'GET', url: `${baseUrl}/api/users` },
    { method: 'GET', url: `${baseUrl}/api/users/test` },
    { method: 'GET', url: `${baseUrl}/api/users/${userId}/test` },
    { method: 'PUT', url: `${baseUrl}/api/users/${userId}/credentials` },
  ];
  
  for (const test of testUrls) {
    console.log(`\nTesting: ${test.method} ${test.url}`);
    
    try {
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (test.method === 'PUT') {
        options.body = JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword'
        });
      }
      
      const response = await fetch(test.url, options);
      const data = await response.json();
      
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

testRouteStructure();