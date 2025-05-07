import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getUserPushoverSettings } from '../../scripts/pushover/pushoverService.js';
import { buildUrl } from '../config/api';

// Get Electron fs API if available, otherwise use Node.js fs
declare global {
  interface Window {
    electron?: {
      fs: {
        readFile: (path: string, options?: string) => Promise<string>;
        writeFile: (path: string, data: string, options?: string) => Promise<void>;
        exists: (path: string) => boolean;
        mkdir: (path: string, options?: any) => Promise<void>;
        stat: (path: string) => Promise<any>;
        join: (...paths: string[]) => string;
        dirname: (path: string) => string;
      };
    };
  }
}

const isElectron = () => {
  return window && window.electron && window.electron.fs;
};

// Helper functions for file operations that work in both Node.js and Electron contexts
const readFile = async (filePath: string, encoding = 'utf8'): Promise<string> => {
  if (isElectron()) {
    return await window.electron!.fs.readFile(filePath, encoding);
  } else {
    throw new Error('File system operations are only available in Electron');
  }
};

const writeFile = async (filePath: string, data: string, encoding = 'utf8'): Promise<void> => {
  if (isElectron()) {
    return await window.electron!.fs.writeFile(filePath, data, encoding);
  } else {
    throw new Error('File system operations are only available in Electron');
  }
};

const fileExists = (filePath: string): boolean => {
  if (isElectron()) {
    return window.electron!.fs.exists(filePath);
  } else {
    throw new Error('File system operations are only available in Electron');
  }
};

const pathJoin = (...paths: string[]): string => {
  if (isElectron()) {
    return window.electron!.fs.join(...paths);
  } else {
    return path.join(...paths);
  }
};

// Get app directory path or use a relative path for development
let __dirname = '.';
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = dirname(__filename);
} catch (e) {
  console.warn('Unable to determine directory path, using current directory.');
}

// Path to user data file
const USER_DATA_FILE = pathJoin(__dirname, '..', '..', 'data/users.json');

// Define interfaces for TypeScript
interface UserPreferences {
  notifications: {
    scheduleChanges: boolean;
    filters: {
      stores: string[];
      locations: string[];
      severity: string[];
    };
  };
}

interface NotificationSettings {
  enabled: boolean;
  email: {
    enabled: boolean;
    frequency: string; // immediate, daily, weekly
  };
  pushover: {
    enabled: boolean;
    priority: string; // lowest, low, normal, high, emergency
  };
}

interface User {
  id: string;
  email: string;
  pushoverKey?: string;
  preferences?: UserPreferences;
  notificationSettings?: NotificationSettings;
  label?: string;
  name?: string;
  friendlyName?: string;
  lastUsed?: string;
  isActive?: boolean;
}

interface PushoverSettings {
  appToken: string;
  userKey: string;
  preferences: {
    showJobId: boolean;
    showStoreNumber: boolean;
    showStoreName: boolean;
    showLocation: boolean;
    showDate: boolean;
    showDispensers: boolean;
    priorityLevel: string;
    sound: string;
  };
}

interface UserResponse {
  success: boolean;
  message?: string;
  users?: User[];
  user?: User;
  userId?: string;
}

// Default user preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
    notifications: {
        scheduleChanges: true,
        filters: {
            stores: [], // List of store numbers to monitor
            locations: [], // List of locations to monitor
            severity: ['critical', 'high'] // Severity levels to notify about
        }
    }
};

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    email: {
        enabled: true,
        frequency: 'immediate' // immediate, daily, weekly
    },
    pushover: {
        enabled: true, // Always enabled by default, will be checked against credentials
        priority: 'normal' // lowest, low, normal, high, emergency
    }
};

/**
 * Fetch all users from API
 */
export const getUsers = async (): Promise<User[]> => {
  try {
    const url = await buildUrl('/api/users');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success || !data.users) {
      throw new Error(data.message || 'Failed to fetch users');
    }
    
    return data.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    // Fallback to local users if API fails
    return await loadUsers();
  }
};

/**
 * Get active user
 */
export const getActiveUser = async (): Promise<User | null> => {
  console.log('\n=== START: getActiveUser API Call ===');
  try {
    const url = await buildUrl('/api/users/active');
    console.log('Making GET request to:', url);
    
    const response = await fetch(url);
    console.log('Server response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    console.log('Server response data:', data);
    
    if (!data.success) {
      console.error('Server returned unsuccessful response:', data);
      throw new Error(data.message || 'Failed to fetch active user');
    }
    
    console.log('=== END: getActiveUser API Call - Success ===\n');
    return data.user || null;
  } catch (error) {
    console.error('\n=== ERROR: getActiveUser API Call Failed ===');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    console.error('=== End Error Log ===\n');
    throw error;
  }
};

/**
 * Set active user
 */
export const setActiveUser = async (userId: string): Promise<User> => {
  console.log('\n=== START: setActiveUser API Call ===');
  try {
    console.log('Setting active user to:', userId);
    const url = await buildUrl('/api/users/active');
    console.log('Making POST request to:', url);
    console.log('Request body:', { userId });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    console.log('Server response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    console.log('Server response data:', data);
    
    if (!data.success || !data.user) {
      console.error('Server returned unsuccessful response:', data);
      throw new Error(data.message || 'Failed to set active user');
    }
    
    console.log('=== END: setActiveUser API Call - Success ===\n');
    return data.user;
  } catch (error) {
    console.error('\n=== ERROR: setActiveUser API Call Failed ===');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    console.error('=== End Error Log ===\n');
    throw error;
  }
};

/**
 * Add or update user
 */
export const addUser = async (email: string, password: string, label?: string): Promise<string> => {
  try {
    const url = await buildUrl('/api/users');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, label })
    });
    
    if (!response.ok) {
      // Try to parse error message
      const errorData = await response.json();
      throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success || !data.userId) {
      throw new Error(data.message || 'Failed to add user');
    }
    
    return data.userId;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

/**
 * Update user label
 */
export const updateUserLabel = async (userId: string, label: string): Promise<void> => {
  try {
    const url = await buildUrl(`/api/users/${userId}`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ label })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update user label');
    }
  } catch (error) {
    console.error('Error updating user label:', error);
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const url = await buildUrl(`/api/users/${userId}`);
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Verify Fossa credentials without creating a user
 */
export const verifyCredentials = async (email: string, password: string): Promise<boolean> => {
  try {
    const url = await buildUrl('/api/users/verify-credentials');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data: UserResponse = await response.json();
    
    // Return true if success, false if invalid credentials
    return data.success;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return false;
  }
};

/**
 * Rename a user directory with a friendly name
 */
export const renameUserDirectory = async (userId: string, friendlyName: string): Promise<boolean> => {
  try {
    const url = await buildUrl('/api/users/rename');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, friendlyName })
    });
    
    if (!response.ok) {
      // Try to parse error message
      const errorData = await response.json();
      throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data: UserResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to rename user directory');
    }
    
    return true;
  } catch (error) {
    console.error('Error renaming user directory:', error);
    throw error;
  }
};

/**
 * Get user preferences
 * @param {string} userId - User ID
 * @returns {Promise<UserPreferences>} - User preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
        const users = await loadUsers();
        const user = users.find((u: User) => u.id === userId);
        
        if (!user) {
            console.warn(`User ${userId} not found, returning default preferences`);
            return DEFAULT_PREFERENCES;
        }

        return user.preferences || DEFAULT_PREFERENCES;
    } catch (error) {
        console.error('Error getting user preferences:', error);
        return DEFAULT_PREFERENCES;
    }
}

/**
 * Get user notification settings
 * @param {string} userId - User ID
 * @returns {Promise<NotificationSettings>} - User notification settings
 */
export async function getUserNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
        const users = await loadUsers();
        const user = users.find((u: User) => u.id === userId);
        
        if (!user) {
            console.warn(`User ${userId} not found, returning default notification settings`);
            return DEFAULT_NOTIFICATION_SETTINGS;
        }

        return user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
    } catch (error) {
        console.error('Error getting user notification settings:', error);
        return DEFAULT_NOTIFICATION_SETTINGS;
    }
}

/**
 * Update user preferences
 * @param {string} userId - User ID
 * @param {Partial<UserPreferences>} preferences - New preferences
 * @returns {Promise<boolean>} - Success status
 */
export async function updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<boolean> {
    try {
        const users = await loadUsers();
        const userIndex = users.findIndex((u: User) => u.id === userId);
        
        if (userIndex === -1) {
            console.error(`User ${userId} not found`);
            return false;
        }

        users[userIndex].preferences = {
            ...DEFAULT_PREFERENCES,
            ...users[userIndex].preferences,
            ...preferences
        };

        await saveUsers(users);
        return true;
    } catch (error) {
        console.error('Error updating user preferences:', error);
        return false;
    }
}

/**
 * Update user notification settings
 * @param {string} userId - User ID
 * @param {Partial<NotificationSettings>} settings - New notification settings
 * @returns {Promise<boolean>} - Success status
 */
export async function updateUserNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<boolean> {
    try {
        const users = await loadUsers();
        const userIndex = users.findIndex((u: User) => u.id === userId);
        
        if (userIndex === -1) {
            console.error(`User ${userId} not found`);
            return false;
        }

        // Get current notification settings or use defaults
        const currentSettings = users[userIndex].notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
        
        // Perform a deep merge for nested objects rather than a shallow spread
        // This ensures that email and pushover settings are properly merged
        const mergedSettings = {
            ...currentSettings,
            enabled: settings.enabled !== undefined ? settings.enabled : currentSettings.enabled,
            email: settings.email ? {
                ...currentSettings.email,
                ...settings.email
            } : currentSettings.email,
            pushover: settings.pushover ? {
                ...currentSettings.pushover,
                ...settings.pushover
            } : currentSettings.pushover
        };
        
        // Apply the merged settings
        users[userIndex].notificationSettings = mergedSettings;

        console.log(`Updated notification settings for user ${userId}:`, JSON.stringify(mergedSettings, null, 2));
        
        await saveUsers(users);
        return true;
    } catch (error) {
        console.error('Error updating user notification settings:', error);
        return false;
    }
}

/**
 * Load users from file
 * @returns {Promise<User[]>} - Array of users
 */
export async function loadUsers(): Promise<User[]> {
    try {
        // Try to load the users.json file from userManager first
        // This will have the display names like "Bruce Hunt" instead of just emails
        const userManagerFile = pathJoin(__dirname, '..', '..', 'data', 'users', 'users.json');
        if (fileExists(userManagerFile)) {
            try {
                const userManagerData = await readFile(userManagerFile, 'utf8');
                const userManagerUsers = JSON.parse(userManagerData);
                
                // Check if we have users in the user manager
                if (Array.isArray(userManagerUsers) && userManagerUsers.length > 0) {
                    console.log('Loaded users from user manager:', userManagerUsers.map((u: User) => ({ id: u.id, label: u.label })));
                    return userManagerUsers;
                }
            } catch (e) {
                console.warn('Failed to load users from user manager:', e);
                // Continue with the fallback method
            }
        }
        
        // Fallback to the original user data file
        if (!fileExists(USER_DATA_FILE)) {
            // Create default user if file doesn't exist
            const defaultUser: User = {
                id: 'main',
                email: process.env.VITE_RECIPIENT_EMAIL || 'user@example.com',
                pushoverKey: process.env.PUSHOVER_USER_KEY,
                preferences: DEFAULT_PREFERENCES,
                notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
            };
            await saveUsers([defaultUser]);
            return [defaultUser];
        }

        const data = await readFile(USER_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

/**
 * Save users to file
 * @param {User[]} users - Array of users
 * @returns {Promise<void>}
 */
export async function saveUsers(users: User[]): Promise<void> {
    try {
        await writeFile(USER_DATA_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
        throw error;
    }
}

/**
 * Get all users with notifications enabled
 * @returns {Promise<User[]>} - Array of users with notifications enabled
 */
export async function getUsersWithNotificationsEnabled(): Promise<User[]> {
    try {
        const users = await loadUsers();
        console.log('Loaded users:', users.map((u: User) => ({ id: u.id, email: u.email })));
        
        // Validate users array
        if (!Array.isArray(users)) {
            console.error('loadUsers did not return an array');
            return [];
        }
        
        // Filter users with notifications enabled
        const enabledUsers = users.filter(user => {
            // Validate user object
            if (!user || typeof user !== 'object') {
                console.warn('Invalid user object found:', user);
                return false;
            }

            // Get notification settings
            const settings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
            console.log(`Checking notifications for user ${user.id}:`, {
                enabled: settings.enabled,
                emailEnabled: settings.email?.enabled,
                pushoverEnabled: settings.pushover?.enabled
            });
            
            // Check if notifications are enabled
            if (!settings.enabled) {
                console.log(`Notifications disabled for user ${user.id}`);
                return false;
            }

            // Check if email is enabled
            if (settings.email?.enabled) {
                console.log(`Email notifications enabled for user ${user.id}`);
                return true;
            }

            // Check if Pushover is enabled and credentials are available
            if (settings.pushover?.enabled) {
                const pushoverSettings = getUserPushoverSettings() as PushoverSettings;
                console.log(`Pushover settings for user ${user.id}:`, {
                    hasAppToken: !!pushoverSettings.appToken,
                    hasUserKey: !!pushoverSettings.userKey
                });
                return !!pushoverSettings.appToken && !!pushoverSettings.userKey;
            }

            console.log(`No notification methods enabled for user ${user.id}`);
            return false;
        });

        // If no users have notifications enabled, return empty array
        if (enabledUsers.length === 0) {
            console.log('No users have notifications enabled');
            return [];
        }

        console.log('Users with notifications enabled:', enabledUsers.map((u: User) => ({ id: u.id, email: u.email })));
        return enabledUsers;
    } catch (error) {
        console.error('Error getting users with notifications enabled:', error);
        return [];
    }
} 