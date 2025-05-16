import fetch from 'node-fetch';

async function testApiConnection() {
  console.log('Testing API connection...\n');
  
  const ports = [3001, 3002, 3003, 6173, 5173];
  
  for (const port of ports) {
    console.log(`Testing port ${port}...`);
    
    try {
      // Test ping endpoint
      const pingUrl = `http://localhost:${port}/api/ping`;
      const pingResponse = await fetch(pingUrl, { 
        method: 'GET',
        timeout: 2000 
      });
      
      if (pingResponse.ok) {
        const data = await pingResponse.json();
        console.log(`✅ Port ${port} - API is running!`, data);
        
        // Test users endpoint
        const usersUrl = `http://localhost:${port}/api/users`;
        const usersResponse = await fetch(usersUrl);
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log(`✅ Port ${port} - Users endpoint accessible`, usersData.success);
        }
        
        // Test with express routes
        console.log('\nTesting route structure:');
        console.log('PUT endpoint:', `${usersUrl}/test-id/credentials`);
        
        const putResponse = await fetch(`${usersUrl}/test-id/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'test' })
        });
        
        console.log('PUT response status:', putResponse.status);
        const putData = await putResponse.json();
        console.log('PUT response data:', putData);
        
      } else {
        console.log(`❌ Port ${port} - No API response`);
      }
    } catch (error) {
      console.log(`❌ Port ${port} - Connection failed:`, error.code);
    }
    
    console.log('---\n');
  }
}

testApiConnection();