import { useState, useEffect, Dispatch, SetStateAction } from 'react';

type StorageType = 'localStorage' | 'sessionStorage';

/**
 * A specialized hook for persisting Date objects to localStorage or sessionStorage.
 * Handles proper serialization/deserialization of Date objects.
 * 
 * @param key - The key to store the date under in storage
 * @param initialValue - The initial date to use if nothing exists in storage
 * @param storage - The storage type to use (localStorage or sessionStorage)
 * @returns A Date object and a function to update it
 */
export function usePersistedDate(
  key: string,
  initialValue: Date | (() => Date) = new Date(),
  storage: StorageType = 'localStorage'
): [Date, Dispatch<SetStateAction<Date>>] {
  // Get storage object
  const storageObject = window[storage];

  // Initialize state with value from storage or initial value
  const [date, setDate] = useState<Date>(() => {
    try {
      // Try to get value from storage
      const item = storageObject.getItem(key);
      
      // Parse stored date string or return initialValue
      if (item) {
        const parsedDate = new Date(item);
        // Check if the parsed date is valid
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
      
      // If no value in storage, use initialValue
      return initialValue instanceof Function ? initialValue() : initialValue;
    } catch (error) {
      console.error(`Error reading persisted date from ${storage}:`, error);
      
      // On error, fall back to initialValue
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
  });

  // Update storage when date changes
  useEffect(() => {
    try {
      // Only save valid dates to storage
      if (date instanceof Date && !isNaN(date.getTime())) {
        // Save date to storage as ISO string
        storageObject.setItem(key, date.toISOString());
      } else {
        console.warn(`Attempted to save invalid date to ${storage}. Using default value instead.`);
        // If invalid date, remove the key from storage
        storageObject.removeItem(key);
      }
    } catch (error) {
      console.error(`Error saving persisted date to ${storage}:`, error);
    }
  }, [key, date, storage, storageObject]);

  return [date, setDate];
}

/**
 * A hook that persists a Date object to localStorage
 */
export function useLocalStorageDate(key: string, initialValue: Date | (() => Date) = new Date()) {
  return usePersistedDate(key, initialValue, 'localStorage');
}

/**
 * A hook that persists a Date object to sessionStorage
 */
export function useSessionStorageDate(key: string, initialValue: Date | (() => Date) = new Date()) {
  return usePersistedDate(key, initialValue, 'sessionStorage');
}

export default usePersistedDate; 