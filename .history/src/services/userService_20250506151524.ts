import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getUserPushoverSettings } from '../../scripts/pushover/pushoverService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to user data file
const USER_DATA_FILE = path.join(__dirname, '..', '..', 'data/users.json');

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
        const userManagerFile = path.join(__dirname, '..', '..', 'data', 'users', 'users.json');
        if (fs.existsSync(userManagerFile)) {
            try {
                const userManagerData = await fs.promises.readFile(userManagerFile, 'utf8');
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
        if (!fs.existsSync(USER_DATA_FILE)) {
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

        const data = await fs.promises.readFile(USER_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

/**
 * Get all users - alias for loadUsers
 * @returns {Promise<User[]>} - Array of users
 */
export async function getUsers(): Promise<User[]> {
    return await loadUsers();
}

/**
 * Save users to file
 * @param {User[]} users - Array of users
 * @returns {Promise<void>}
 */
export async function saveUsers(users: User[]): Promise<void> {
    try {
        await fs.promises.writeFile(USER_DATA_FILE, JSON.stringify(users, null, 2));
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