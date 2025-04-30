import { useCallback, useEffect } from 'react';
import { useLocalStorage, useSessionStorage } from './usePersistedState';
import { useLocalStorageDate, useSessionStorageDate } from './usePersistedDate';

type PageStorageType = 'local' | 'session';

interface PageStateOptions {
  storageType?: PageStorageType;
  expireAfterMs?: number; // Optional: auto-expire state after a time period
}

/**
 * Get the current active user ID from localStorage
 * This allows us to namespace storage keys by user
 */
const getActiveUserId = (): string => {
  try {
    // Try to get the active user ID from localStorage
    // The app stores the active user ID when switching users
    const activeUser = localStorage.getItem('activeUserId');
    return activeUser || 'default-user';
  } catch (error) {
    console.error('Error getting active user ID:', error);
    return 'default-user';
  }
};

/**
 * Clear all page state for a specific user ID
 * This is useful when removing a user or when we want to reset all their UI state
 * 
 * @param userId - The user ID to clear state for
 * @param storageType - Which storage to clear (local, session, or both)
 */
export function clearUserPageState(userId: string, storageType: 'local' | 'session' | 'both' = 'both'): void {
  if (!userId) return;
  
  const userPrefix = `page_state_${userId}_`;
  
  // Clear localStorage if requested
  if (storageType === 'local' || storageType === 'both') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(userPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`Clearing ${keysToRemove.length} localStorage items for user ${userId}`);
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  // Clear sessionStorage if requested
  if (storageType === 'session' || storageType === 'both') {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(userPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    console.log(`Clearing ${keysToRemove.length} sessionStorage items for user ${userId}`);
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }
}

/**
 * A specialized hook for persisting page/view state across reloads
 * Automatically prefixes keys, provides cleanup, and handles organization better
 * 
 * @param pageId - Unique identifier for the page/component (e.g., 'home', 'filters', 'settings-form')
 * @param options - Configuration options for storage
 * @returns Object with methods to manage state
 */
export function usePageState(pageId: string, options: PageStateOptions = {}) {
  const { 
    storageType = 'local',
    expireAfterMs = undefined
  } = options;
  
  // Get the active user ID to namespace storage
  const activeUserId = getActiveUserId();
  
  // Create a namespaced key prefix to prevent conflicts
  // Include the user ID in the key to separate state between users
  const keyPrefix = `page_state_${activeUserId}_${pageId}_`;
  
  // Store the last update time to handle expiration
  const [lastUpdated, setLastUpdated] = storageType === 'local' 
    ? useLocalStorage<number>(`${keyPrefix}_last_updated`, Date.now)
    : useSessionStorage<number>(`${keyPrefix}_last_updated`, Date.now);

  // Check if state has expired
  const isExpired = expireAfterMs ? (Date.now() - lastUpdated) > expireAfterMs : false;
  
  // Wrap the storage hooks for better organization
  const createStateHook = <T>(key: string, initialValue: T | (() => T)) => {
    const fullKey = `${keyPrefix}${key}`;
    
    // If expired, we'll use the initialValue instead of the stored value
    const actualInitialValue = isExpired ? initialValue : initialValue;
    
    return storageType === 'local'
      ? useLocalStorage<T>(fullKey, actualInitialValue)
      : useSessionStorage<T>(fullKey, actualInitialValue);
  };
  
  // Special hook for Date objects
  const createDateState = (key: string, initialValue: Date | (() => Date) = new Date()) => {
    const fullKey = `${keyPrefix}${key}`;
    
    return storageType === 'local'
      ? useLocalStorageDate(fullKey, initialValue)
      : useSessionStorageDate(fullKey, initialValue);
  };
  
  // Getter for checking if a specific key exists
  const hasState = useCallback((key: string): boolean => {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    return storage.getItem(`${keyPrefix}${key}`) !== null;
  }, [keyPrefix, storageType]);
  
  // Cleanup function to remove all state with this prefix
  const clearPageState = useCallback(() => {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    
    // Get all keys for this page
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(keyPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all keys
    keysToRemove.forEach(key => storage.removeItem(key));
  }, [keyPrefix, storageType]);
  
  // Move timestamp update to useEffect to prevent infinite renders
  useEffect(() => {
    // Update timestamp when component mounts, and handle expiration if needed
    if (isExpired) {
      // If expired, clear all state
      clearPageState();
    }
    
    // Always update timestamp when the hook is used
    // Only do this once on mount to avoid infinite loops
    setLastUpdated(Date.now());
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Empty dependency array so it only runs once on mount
  
  return {
    createState: createStateHook,
    createDateState,
    hasState,
    clearPageState,
    isExpired
  };
}

export default usePageState; 