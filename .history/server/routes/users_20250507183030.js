import express from 'express';
import { 
  storeUserCredentials, 
  listUsers, 
  getUserCredentials, 
  updateUserLabel, 
  deleteUser, 
  getActiveUser, 
  setActiveUser, 
  renameUser, 
  listUserFriendlyNames 
} from '../utils/userManager.js';
import { loginToFossa } from '../../scripts/utils/login.js';

const router = express.Router();

// Get all users (without passwords)
router.get('/', (req, res) => {
  try {
    const users = listUsers().map(user => ({
      id: user.id,
      email: user.email,
      label: user.label,
      lastUsed: user.lastUsed,
      isActive: user.id === getActiveUser()
    }));
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users' 
    });
  }
});

// Get active user
router.get('/active', (req, res) => {
  try {
    const activeUserId = getActiveUser();
    console.log(`GET /active - Current active user ID: ${activeUserId || 'none'}`);
    
    if (!activeUserId) {
      return res.json({
        success: true,
        user: null
      });
    }
    
    const users = listUsers();
    console.log(`Found ${users.length} total users`);
    
    const activeUser = users.find(user => user.id === activeUserId);
    
    if (!activeUser) {
      console.error(`Active user ID ${activeUserId} was found in settings but not in users list!`);
      return res.json({
        success: true,
        user: null
      });
    }
    
    console.log(`Found active user: ${activeUser.email} (${activeUser.label || 'no label'})`);
    
    // Double-check environment variables are set correctly for active user
    if (process.env.FOSSA_EMAIL !== activeUser.email) {
      console.warn(`Environment variable FOSSA_EMAIL is not set to active user's email. 
        Active: ${activeUser.email}, Env: ${process.env.FOSSA_EMAIL}`);
      
      // Fix the environment variables
      process.env.FOSSA_EMAIL = activeUser.email;
      process.env.FOSSA_PASSWORD = activeUser.password;
      console.log(`Updated environment variables to match active user`);
    }
    
    res.json({
      success: true,
      user: {
        id: activeUser.id,
        email: activeUser.email,
        label: activeUser.label,
        lastUsed: activeUser.lastUsed
      }
    });
  } catch (error) {
    console.error('Error fetching active user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch active user' 
    });
  }
});

// Set active user
router.post('/active', (req, res) => {
  try {
    const { userId } = req.body;
    console.log('\n=== START: Set Active User Request ===');
    console.log('Request body:', req.body);
    console.log('Received request to set active user:', userId);
    
    if (!userId) {
      console.error('User ID is required but was not provided');
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const users = listUsers();
    console.log(`Found ${users.length} users in total`);
    console.log('All users:', users.map(u => ({ id: u.id, email: u.email, label: u.label })));
    
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      console.error(`User with ID ${userId} not found in the user list`);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log(`Found user for ID ${userId}:`, {
      email: user.email,
      label: user.label || 'no label',
      id: user.id
    });
    
    // Get current active user for comparison
    const currentActiveUser = getActiveUser();
    console.log(`Current active user: ${currentActiveUser || 'none'}`);
    
    // Set active user in settings file
    console.log(`Setting active user to: ${userId}`);
    const setActiveResult = setActiveUser(userId);
    console.log('setActiveUser result:', setActiveResult);
    
    // Update environment variables with active user credentials
    console.log(`Updating env variables with credentials for: ${user.email}`);
    process.env.FOSSA_EMAIL = user.email;
    process.env.FOSSA_PASSWORD = user.password;
    
    // Log the switch for debugging
    console.log(`User switched to: ${user.email} (${userId})`);
    
    // Force update of any cached data
    try {
      // Clear any cached data that might be user-specific
      global.userDataCache = {};
      global.activeUserId = userId;
      
      console.log('Cleared cached data after user switch');
    } catch (cacheError) {
      console.error('Error clearing cache after user switch:', cacheError);
      // Non-fatal error, continue
    }
    
    // Double-check that active user was updated correctly
    const newActiveUser = getActiveUser();
    console.log(`Verification - New active user: ${newActiveUser || 'none'}`);
    
    if (newActiveUser !== userId) {
      console.error(`ERROR: Active user update failed! Expected ${userId} but got ${newActiveUser}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to update active user - verification failed'
      });
    }
    
    console.log('=== END: Set Active User Request - Success ===\n');
    // Send the response with the updated user info
    res.json({
      success: true,
      message: 'Active user set successfully',
      user: {
        id: user.id,
        email: user.email,
        label: user.label,
        lastUsed: user.lastUsed
      }
    });
  } catch (error) {
    console.error('\n=== ERROR: Set Active User Request Failed ===');
    console.error('Error setting active user:', error);
    console.error('Stack trace:', error.stack);
    console.error('=== End Error Log ===\n');
    res.status(500).json({ 
      success: false, 
      message: `Failed to set active user: ${error.message}` 
    });
  }
});

// Add or update user
router.post('/', async (req, res) => {
  try {
    const { email, password, label } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Test the credentials before saving
    try {
      // Temporarily set environment variables
      const origEmail = process.env.FOSSA_EMAIL;
      const origPassword = process.env.FOSSA_PASSWORD;
      
      process.env.FOSSA_EMAIL = email;
      process.env.FOSSA_PASSWORD = password;
      
      const loginResult = await loginToFossa({ headless: true });
      
      // Close the browser
      if (loginResult.browser) {
        await loginResult.browser.close();
      }
      
      // Restore original environment variables
      process.env.FOSSA_EMAIL = origEmail;
      process.env.FOSSA_PASSWORD = origPassword;
    } catch (loginError) {
      console.error('Login verification failed:', loginError);
      return res.status(400).json({ 
        success: false, 
        message: `Invalid credentials: ${loginError.message}` 
      });
    }
    
    // Store the credentials
    const userId = storeUserCredentials(email, password);
    
    // Set label if provided
    if (label) {
      updateUserLabel(userId, label);
    }
    
    // If this is the first user, make it active
    const users = listUsers();
    if (users.length === 1) {
      setActiveUser(userId);
      
      // Set environment variables to new user
      process.env.FOSSA_EMAIL = email;
      process.env.FOSSA_PASSWORD = password;
    }
    
    res.json({
      success: true,
      message: 'User added successfully',
      userId
    });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add user' 
    });
  }
});

// Update user label
router.patch('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({ 
        success: false, 
        message: 'Label is required' 
      });
    }
    
    const success = updateUserLabel(userId, label);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'User label updated successfully'
    });
  } catch (error) {
    console.error('Error updating user label:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user label' 
    });
  }
});

// Delete user
router.delete('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if this is the active user
    const activeUserId = getActiveUser();
    
    // Delete the user
    const success = deleteUser(userId);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // If we deleted the active user, set a new active user or null
    if (userId === activeUserId) {
      const users = listUsers();
      if (users.length > 0) {
        setActiveUser(users[0].id);
        
        // Set environment variables to new active user
        process.env.FOSSA_EMAIL = users[0].email;
        process.env.FOSSA_PASSWORD = users[0].password;
      } else {
        // No users left, clear active user
        setActiveUser(null);
        
        // Clear environment variables
        delete process.env.FOSSA_EMAIL;
        delete process.env.FOSSA_PASSWORD;
      }
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user' 
    });
  }
});

// Verify credentials without creating a user
router.post('/verify-credentials', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Test the credentials
    try {
      // Temporarily set environment variables
      const origEmail = process.env.FOSSA_EMAIL;
      const origPassword = process.env.FOSSA_PASSWORD;
      
      process.env.FOSSA_EMAIL = email;
      process.env.FOSSA_PASSWORD = password;
      
      console.log(`Verifying credentials for ${email}`);
      const loginResult = await loginToFossa({ headless: true });
      
      // Close the browser
      if (loginResult.browser) {
        await loginResult.browser.close();
      }
      
      // Restore original environment variables
      process.env.FOSSA_EMAIL = origEmail;
      process.env.FOSSA_PASSWORD = origPassword;
      
      // Return success
      return res.json({
        success: true,
        message: 'Credentials verified successfully'
      });
    } catch (loginError) {
      console.error('Credential verification failed:', loginError);
      return res.status(400).json({ 
        success: false, 
        message: `Invalid credentials: ${loginError.message}` 
      });
    }
  } catch (error) {
    console.error('Error verifying credentials:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify credentials' 
    });
  }
});

// Rename a user with a friendly name
router.post('/rename', (req, res) => {
  try {
    const { userId, friendlyName } = req.body;
    
    if (!userId || !friendlyName) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and friendlyName are required'
      });
    }
    
    // Call the renameUser function
    const result = renameUser(userId, friendlyName);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        userId: result.originalId,
        friendlyName: result.friendlyName
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error renaming user:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to rename user: ${error.message}`
    });
  }
});

// List users with friendly names
router.get('/friendly-names', (req, res) => {
  try {
    const friendlyNames = listUserFriendlyNames();
    
    return res.json({
      success: true,
      users: friendlyNames
    });
  } catch (error) {
    console.error('Error listing user friendly names:', error);
    return res.status(500).json({
      success: false,
      message: `Failed to list user friendly names: ${error.message}`
    });
  }
});

// Get user credentials by ID
router.get('/:userId/credentials', (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const credentials = getUserCredentials(userId);
    
    if (!credentials) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json(credentials);
  } catch (error) {
    console.error('Error fetching user credentials:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user credentials' 
    });
  }
});

export default router; 