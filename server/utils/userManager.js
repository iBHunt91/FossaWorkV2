import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
console.log('Project root directory:', projectRoot);

// Create users directory if it doesn't exist
const usersDir = path.join(projectRoot, 'data', 'users');
if (!fs.existsSync(usersDir)) {
  fs.mkdirSync(usersDir, { recursive: true });
  console.log('Created users directory:', usersDir);
}

// Hash email to create a consistent user ID
function getUserId(email) {
  return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
}

// Get the user directory path
function getUserDir(email) {
  const userId = getUserId(email);
  const userDir = path.join(usersDir, userId);
  
  // Create user directory if it doesn't exist
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    
    // Create subdirectories
    fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
  }
  
  return userDir;
}

// Store user credentials
function storeUserCredentials(email, password) {
  const users = listUsers();
  const userId = getUserId(email);
  
  // Check if user already exists
  const existingUserIndex = users.findIndex(user => user.id === userId);
  
  // Update or add user
  if (existingUserIndex >= 0) {
    users[existingUserIndex] = {
      id: userId,
      email,
      password,
      label: email, // Default label is email
      lastUsed: new Date().toISOString()
    };
  } else {
    users.push({
      id: userId,
      email,
      password,
      label: email, // Default label is email
      lastUsed: new Date().toISOString()
    });
  }
  
  // Save users list
  fs.writeFileSync(
    path.join(usersDir, 'users.json'),
    JSON.stringify(users, null, 2),
    'utf8'
  );
  
  return userId;
}

// Get user credentials
function getUserCredentials(userId) {
  const users = listUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return null;
  }
  
  return {
    email: user.email,
    password: user.password
  };
}

// List all users
function listUsers() {
  const usersFile = path.join(usersDir, 'users.json');
  
  if (!fs.existsSync(usersFile)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

// Update user last used timestamp
function updateUserLastUsed(userId) {
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex].lastUsed = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(usersDir, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
  }
}

// Update user label
function updateUserLabel(userId, label) {
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex].label = label || users[userIndex].email;
    
    fs.writeFileSync(
      path.join(usersDir, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    
    return true;
  }
  
  return false;
}

// Update user credentials
function updateUserCredentials(userId, email, password) {
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex].email = email;
    users[userIndex].password = password;
    users[userIndex].lastUsed = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(usersDir, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    
    return true;
  }
  
  return false;
}

// Delete a user and their data
function deleteUser(userId) {
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    // Remove from users list
    users.splice(userIndex, 1);
    
    fs.writeFileSync(
      path.join(usersDir, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    
    // Delete user directory with all data
    const userDir = path.join(usersDir, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    
    return true;
  }
  
  return false;
}

// Get active user from settings
function getActiveUser() {
  const settingsFile = path.join(projectRoot, 'data', 'settings.json');
  
  if (!fs.existsSync(settingsFile)) {
    return null;
  }
  
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    return settings.activeUserId || null;
  } catch (error) {
    console.error('Error reading settings file:', error);
    return null;
  }
}

// Set active user
function setActiveUser(userId) {
  console.log('\n=== START: setActiveUser in userManager ===');
  console.log('Setting active user to:', userId);
  console.log('Project root:', projectRoot);
  
  const settingsFile = path.join(projectRoot, 'data', 'settings.json');
  console.log('Settings file path:', settingsFile);
  
  // Check file permissions
  try {
    const fileStats = fs.statSync(settingsFile);
    console.log('Settings file permissions:', {
      mode: fileStats.mode.toString(8),
      uid: fileStats.uid,
      gid: fileStats.gid,
      writable: fs.accessSync(settingsFile, fs.constants.W_OK) === undefined
    });
  } catch (statError) {
    console.log('Settings file does not exist yet');
  }
  
  let settings = {};
  
  // Read existing settings if available
  if (fs.existsSync(settingsFile)) {
    try {
      console.log('Reading existing settings file...');
      const fileContent = fs.readFileSync(settingsFile, 'utf8');
      console.log('Raw settings file content:', fileContent);
      settings = JSON.parse(fileContent);
      console.log('Current settings:', settings);
    } catch (error) {
      console.error('Error reading settings file:', error);
      console.error('Stack trace:', error.stack);
      throw new Error(`Failed to read settings file: ${error.message}`);
    }
  } else {
    console.log('Settings file does not exist, will create new one');
  }
  
  // Update active user
  const oldActiveUser = settings.activeUserId;
  settings.activeUserId = userId;
  console.log(`Updating active user from ${oldActiveUser} to ${userId}`);
  
  try {
    // Ensure the data directory exists
    const dataDir = path.join(projectRoot, 'data');
    if (!fs.existsSync(dataDir)) {
      console.log('Creating data directory:', dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save settings with atomic write
    console.log('Writing updated settings to file...');
    const settingsJson = JSON.stringify(settings, null, 2);
    console.log('New settings content:', settingsJson);
    
    // Write to a temporary file first
    const tempFile = `${settingsFile}.tmp`;
    fs.writeFileSync(tempFile, settingsJson, 'utf8');
    
    // Verify the temp file was written correctly
    const tempContent = fs.readFileSync(tempFile, 'utf8');
    console.log('Verification - Temp file content:', tempContent);
    
    // Rename temp file to actual file (atomic operation)
    fs.renameSync(tempFile, settingsFile);
    
    // Double check the final file
    const verifyContent = fs.readFileSync(settingsFile, 'utf8');
    console.log('Verification - Final file content:', verifyContent);
    
    // Parse the final content to make absolutely sure it's valid JSON
    const verifySettings = JSON.parse(verifyContent);
    console.log('Verification - Parsed settings:', verifySettings);
    
    if (verifySettings.activeUserId !== userId) {
      throw new Error(`Verification failed: Expected activeUserId to be ${userId} but got ${verifySettings.activeUserId}`);
    }
    
    // Update last used timestamp for the user
    updateUserLastUsed(userId);
    
    console.log('=== END: setActiveUser - Success ===\n');
    return true;
  } catch (error) {
    console.error('\n=== ERROR: setActiveUser Failed ===');
    console.error('Error saving settings:', error);
    console.error('Stack trace:', error.stack);
    console.error('=== End Error Log ===\n');
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

// Helper function to resolve a file path based on the active user
function resolveUserFilePath(relativePath, userId) {
  // If userId is not provided, use the active user
  const activeUserId = userId || getActiveUser();
  
  // If no active user, fallback to root data directory
  if (!activeUserId) {
    return path.join(projectRoot, 'data', relativePath);
  }
  
  // Create user-specific path
  const userDir = path.join(usersDir, activeUserId);
  
  // Ensure the user directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    console.log(`Created user directory: ${userDir}`);
    
    // Create standard subdirectories
    fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
  }
  
  return path.join(userDir, relativePath);
}

// Rename a user to use a friendly name instead of hash
function renameUser(userId, newName) {
  if (!userId || !newName) {
    console.error('Both userId and newName are required');
    return { success: false, error: 'Both userId and newName are required' };
  }
  
  // Make sure newName is filesystem-safe
  const safeName = newName.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Check if user exists
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex < 0) {
    console.error(`User with ID ${userId} not found`);
    return { success: false, error: `User with ID ${userId} not found` };
  }
  
  // Get the current user info
  const user = users[userIndex];
  const oldUserDir = path.join(usersDir, userId);
  const newUserDir = path.join(usersDir, safeName);
  
  // Check if the target directory already exists
  if (fs.existsSync(newUserDir)) {
    console.error(`Directory for name "${safeName}" already exists`);
    return { success: false, error: `Directory for name "${safeName}" already exists` };
  }
  
  // Update the friendly name in users list
  users[userIndex].friendlyName = safeName;
  
  try {
    // Create a symbolic link from the friendly name to the hash ID
    // This maintains compatibility with existing code while providing a readable name
    if (fs.existsSync(oldUserDir)) {
      // Create directory mapping
      if (process.platform === 'win32') {
        try {
          // On Windows, we need to use a junction instead of a symbolic link
          // This works for directories without requiring special permissions
          const symlinkType = 'junction';
          fs.symlinkSync(oldUserDir, newUserDir, symlinkType);
          console.log(`Created junction from ${newUserDir} to ${oldUserDir}`);
        } catch (winError) {
          console.error('Error creating junction:', winError);
          
          // If junction creation fails, try to create a directory and copy the files
          if (!fs.existsSync(newUserDir)) {
            fs.mkdirSync(newUserDir, { recursive: true });
          }
          
          // Update the users file with just the friendly name
          fs.writeFileSync(
            path.join(usersDir, 'users.json'),
            JSON.stringify(users, null, 2),
            'utf8'
          );
          
          return { 
            success: true, 
            message: `User renamed to ${safeName}, but symbolic link could not be created. Please make sure you're running as Administrator.`,
            originalId: userId,
            friendlyName: safeName
          };
        }
      } else {
        // On Unix systems, use a directory symbolic link
        const symlinkType = 'dir';
        fs.symlinkSync(oldUserDir, newUserDir, symlinkType);
        console.log(`Created symbolic link from ${newUserDir} to ${oldUserDir}`);
      }
      
      // Update the users file
      fs.writeFileSync(
        path.join(usersDir, 'users.json'),
        JSON.stringify(users, null, 2),
        'utf8'
      );
      
      return { 
        success: true, 
        message: `User renamed to ${safeName}`,
        originalId: userId,
        friendlyName: safeName
      };
    } else {
      console.error(`User directory ${oldUserDir} not found`);
      return { success: false, error: `User directory ${oldUserDir} not found` };
    }
  } catch (error) {
    console.error('Error renaming user:', error);
    return { success: false, error: error.message };
  }
}

// Get user by friendly name
function getUserByFriendlyName(friendlyName) {
  const users = listUsers();
  return users.find(u => u.friendlyName === friendlyName);
}

// List all user friendly names
function listUserFriendlyNames() {
  const users = listUsers();
  return users.map(user => ({
    id: user.id,
    email: user.email,
    friendlyName: user.friendlyName || null,
    label: user.label
  }));
}

export {
  getUserId,
  getUserDir,
  storeUserCredentials,
  getUserCredentials,
  listUsers,
  updateUserLabel,
  updateUserCredentials,
  deleteUser,
  getActiveUser,
  setActiveUser,
  resolveUserFilePath,
  renameUser,
  getUserByFriendlyName,
  listUserFriendlyNames
}; 