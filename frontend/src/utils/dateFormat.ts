/**
 * Date formatting utilities
 */

/**
 * Format a UTC datetime string to local time
 * Backend sends UTC times, frontend displays in user's local timezone
 * Enhanced with UTC validation and timezone debugging
 */
export const formatUTCToLocal = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  
  try {
    // Ensure proper UTC interpretation
    const utcDateString = ensureUTCFormat(dateString);
    
    // Add debug logging for timezone verification
    if (process.env.NODE_ENV === 'development' && utcDateString !== dateString) {
      console.debug(`[formatUTCToLocal] Fixed timezone: "${dateString}" → "${utcDateString}"`);
    }
    
    // Parse the UTC date string
    const date = new Date(utcDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error(`[formatUTCToLocal] Invalid date: "${dateString}"`);
      return 'Invalid date';
    }
    
    // Format to local time with clear timezone indication
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  } catch (error) {
    console.error('[formatUTCToLocal] Error formatting date:', error, 'Input:', dateString);
    return 'Invalid date';
  }
};

/**
 * Format duration in seconds to human readable format
 */
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

/**
 * Ensure date string is interpreted as UTC by adding 'Z' suffix if missing
 */
const ensureUTCFormat = (dateString: string): string => {
  // If already has timezone info (Z, +XX:XX, -XX:XX), return as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // If it looks like an ISO string without timezone, add 'Z' to force UTC interpretation
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(dateString)) {
    return dateString + 'Z';
  }
  
  return dateString;
};

/**
 * Get relative time string (e.g., "in 5 minutes", "2 hours ago")
 * Enhanced with UTC validation and timezone debugging
 */
export const getRelativeTime = (dateString: string | null): string | null => {
  if (!dateString) return null;
  
  try {
    // Ensure proper UTC interpretation
    const utcDateString = ensureUTCFormat(dateString);
    
    // Add debug logging for timezone verification
    if (process.env.NODE_ENV === 'development' && utcDateString !== dateString) {
      console.debug(`[dateFormat] Fixed timezone: "${dateString}" → "${utcDateString}"`);
    }
    
    const date = new Date(utcDateString);
    
    // Validate date
    if (isNaN(date.getTime())) {
      console.error(`[dateFormat] Invalid date: "${dateString}"`);
      return null;
    }
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMinutes = Math.abs(diffMs) / (1000 * 60);
    
    // Debug logging for timezone verification
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[dateFormat] Time calculation:`, {
        input: dateString,
        processed: utcDateString,
        parsed: date.toISOString(),
        now: now.toISOString(),
        diffMs,
        diffMinutes
      });
    }
    
    if (diffMs < 0) {
      // Past
      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${Math.floor(diffMinutes)} minutes ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
      return `${Math.floor(diffMinutes / 1440)} days ago`;
    } else {
      // Future
      if (diffMinutes < 1) return 'due now';
      if (diffMinutes < 60) return `in ${Math.floor(diffMinutes)} minutes`;
      if (diffMinutes < 1440) return `in about ${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) === 1 ? '' : 's'}`;
      return `in ${Math.floor(diffMinutes / 1440)} days`;
    }
  } catch (error) {
    console.error('[dateFormat] Error calculating relative time:', error, 'Input:', dateString);
    return null;
  }
};

/**
 * Validate and warn about potential timezone issues
 * Returns true if the date string appears to be properly formatted for UTC
 */
export const validateTimezoneFormat = (dateString: string | null): boolean => {
  if (!dateString) return true; // null/empty is fine
  
  try {
    // Check if it has timezone information
    const hasTimezone = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString);
    
    // Check if it looks like an ISO string
    const isISOFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?/.test(dateString);
    
    if (isISOFormat && !hasTimezone) {
      console.warn(`[dateFormat] ISO date string without timezone detected: "${dateString}". This may cause timezone interpretation issues. Consider adding 'Z' suffix for UTC.`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[dateFormat] Error validating timezone format:', error);
    return false;
  }
};

/**
 * Debug function to test timezone handling
 * Only available in development mode
 */
export const debugTimezoneHandling = (dateString: string): void => {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.group(`[dateFormat] Timezone Debug: "${dateString}"`);
  console.log('Original:', dateString);
  console.log('Processed:', ensureUTCFormat(dateString));
  console.log('Parsed Date:', new Date(ensureUTCFormat(dateString)).toISOString());
  console.log('Local Time:', formatUTCToLocal(dateString));
  console.log('Relative Time:', getRelativeTime(dateString));
  console.log('Timezone Valid:', validateTimezoneFormat(dateString));
  console.groupEnd();
};