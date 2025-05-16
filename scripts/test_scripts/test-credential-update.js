import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env') });

const BASE_URL = 'http://localhost:3000';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  label: 'Test User'
};

const updatedCredentials = {
  email: 'newemail@example.com', 
  password: 'newpassword123'
};

const invalidCredentials = {
  email: 'invalid@example.com',
  password: 'wrongpassword'
};

async function testCredentialUpdate() {
  console.log('Starting credential update test...\n');

  try {
    // Step 1: Add a test user first
    console.log('1. Adding test user...');
    const addUserRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (!addUserRes.ok) {
      const error = await addUserRes.json();
      console.error('Failed to add test user:', error);
      
      // If the user already exists, let's get their ID instead
      console.log('User might already exist, fetching user list...');
      const usersRes = await fetch(`${BASE_URL}/api/users`);
      const usersData = await usersRes.json();
      
      const existingUser = usersData.users?.find(u => u.email === testUser.email);
      if (!existingUser) {
        throw new Error('Could not add or find test user');
      }
      
      console.log('Found existing test user:', existingUser.id);
      var userId = existingUser.id;
    } else {
      const addData = await addUserRes.json();
      console.log('Test user added successfully:', addData.userId);
      var userId = addData.userId;
    }

    // Step 2: Test updating with invalid credentials (should fail)
    console.log('\n2. Testing update with INVALID credentials...');
    const invalidUpdateRes = await fetch(`${BASE_URL}/api/users/${userId}/credentials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidCredentials)
    });
    
    const invalidUpdateData = await invalidUpdateRes.json();
    
    if (invalidUpdateRes.ok) {
      console.error('❌ ERROR: Invalid credentials were accepted!');
      console.error('Response:', invalidUpdateData);
    } else {
      console.log('✅ SUCCESS: Invalid credentials were properly rejected');
      console.log('Error message:', invalidUpdateData.message);
    }

    // Step 3: Test updating with valid credentials (should succeed)
    console.log('\n3. Testing update with VALID credentials...');
    
    // For this test to work properly, we need to use real Fossa credentials
    // Let's check if we have valid credentials in the environment
    const validEmail = process.env.FOSSA_EMAIL;
    const validPassword = process.env.FOSSA_PASSWORD;
    
    if (!validEmail || !validPassword) {
      console.log('⚠️  No valid Fossa credentials found in environment');
      console.log('Skipping valid credential test...');
    } else {
      const validUpdateRes = await fetch(`${BASE_URL}/api/users/${userId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword
        })
      });
      
      const validUpdateData = await validUpdateRes.json();
      
      if (validUpdateRes.ok) {
        console.log('✅ SUCCESS: Valid credentials were accepted');
        console.log('Response:', validUpdateData.message);
      } else {
        console.error('❌ ERROR: Valid credentials were rejected!');
        console.error('Response:', validUpdateData);
      }
    }

    // Step 4: Verify the credentials were actually updated
    console.log('\n4. Verifying credentials were updated...');
    const usersRes = await fetch(`${BASE_URL}/api/users`);
    const usersData = await usersRes.json();
    
    const updatedUser = usersData.users?.find(u => u.id === userId);
    if (updatedUser) {
      console.log('User found with email:', updatedUser.email);
      
      if (validEmail && updatedUser.email === validEmail) {
        console.log('✅ SUCCESS: Email was properly updated');
      } else if (!validEmail) {
        console.log('⚠️  Could not verify email update (no valid credentials)');
      } else {
        console.error('❌ ERROR: Email was not updated correctly');
      }
    }

    // Step 5: Test the verify-credentials endpoint
    console.log('\n5. Testing verify-credentials endpoint...');
    
    // Test with invalid credentials
    const verifyInvalidRes = await fetch(`${BASE_URL}/api/users/verify-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidCredentials)
    });
    
    const verifyInvalidData = await verifyInvalidRes.json();
    console.log('Invalid credentials verification:', verifyInvalidData.success ? '❌ FAIL (should be false)' : '✅ SUCCESS (properly rejected)');
    
    // Test with valid credentials (if available)
    if (validEmail && validPassword) {
      const verifyValidRes = await fetch(`${BASE_URL}/api/users/verify-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword
        })
      });
      
      const verifyValidData = await verifyValidRes.json();
      console.log('Valid credentials verification:', verifyValidData.success ? '✅ SUCCESS (properly accepted)' : '❌ FAIL (should be true)');
    }

    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/users`);
    if (!res.ok) {
      throw new Error('Server not responding');
    }
    return true;
  } catch (error) {
    console.error('❌ Server is not running. Please start the server with: npm run server');
    return false;
  }
}

// Run the test
async function main() {
  console.log('=== Credential Update Test ===\n');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await testCredentialUpdate();
}

main();