import fetch from 'node-fetch';

async function testPutRoute() {
  console.log('Testing PUT route for user credentials...\n');
  
  const userId = '7bea3bdb7e8e303eacaba442bd824004';
  const url = `http://localhost:3001/api/users/${userId}/credentials`;
  
  console.log('URL:', url);
  console.log('Method: PUT');
  console.log('Body:', { email: 'test@example.com', password: 'testpassword' });
  
  try {
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
    
    console.log('\nResponse status:', response.status);
    console.log('Response status text:', response.statusText);
    console.log('Response headers:', response.headers);
    
    const data = await response.json();
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testPutRoute();