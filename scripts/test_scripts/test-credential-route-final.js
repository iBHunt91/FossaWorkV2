import fetch from 'node-fetch';

async function testCredentialRoute() {
  console.log('Testing credential update route...\n');
  
  const baseUrl = 'http://localhost:3001';
  const userId = '7bea3bdb7e8e303eacaba442bd824004';
  
  try {
    // Test the route
    const url = `${baseUrl}/api/users/${userId}/credentials`;
    console.log('Testing:', url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    // Also test if the route structure is correct
    console.log('\nChecking API structure...');
    const usersResponse = await fetch(`${baseUrl}/api/users`);
    if (usersResponse.ok) {
      console.log('✅ Users API is accessible');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCredentialRoute();