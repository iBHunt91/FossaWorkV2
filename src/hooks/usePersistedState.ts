import { useState, useEffect, Dispatch, SetStateAction } from 'react';

type StorageType = 'localStorage' | 'sessionStorage';

/**
 * A hook that persists state to localStorage or sessionStorage and syncs it across
 * instances of the component across page reloads
 * 
 * @param key - The key to store the state under in storage
 * @param initialValue - The initial value to use if nothing exists in storage
 * @param storage - The storage type to use (localStorage or sessionStorage)
 * @returns A stateful value and a function to update it (same as useState)
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T | (() => T),
  storage: StorageType = 'localStorage'
): [T, Dispatch<SetStateAction<T>>] {
  // Get storage object
  const storageObject = window[storage];

  // Initialize state with value from storage or initial value
  const [state, setState] = useState<T>(() => {
    try {
      // Try to get value from storage
      const item = storageObject.getItem(key);
      
      // Parse stored json or return initialValue
      if (item) {
        return JSON.parse(item);
      }
      
      // If no value in storage, use initialValue
      return initialValue instanceof Function ? initialValue() : initialValue;
    } catch (error) {
      console.error(`Error reading persisted state from ${storage}:`, error);
      
      // On error, fall back to initialValue
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
  });

  // Update storage when state changes
  useEffect(() => {
    try {
      // Save state to storage
      storageObject.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving persisted state to ${storage}:`, error);
    }
  }, [key, state, storage]);

  return [state, setState];
}

/**
 * A hook that persists state to localStorage and syncs it across
 * instances of the component across page reloads
 */
export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  return usePersistedState<T>(key, initialValue, 'localStorage');
}

/**
 * A hook that persists state to sessionStorage and syncs it across
 * instances of the component across page reloads
 */
export function useSessionStorage<T>(key: string, initialValue: T | (() => T)) {
  return usePersistedState<T>(key, initialValue, 'sessionStorage');
}

export default usePersistedState; 