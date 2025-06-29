import { format, isToday, isTomorrow, isWithinInterval, addDays, differenceInMinutes } from 'date-fns';

/**
 * Format the next run time to show exact time instead of relative
 * This provides clearer expectations for users about when scraping will occur
 */
export function formatScheduledTime(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  
  try {
    // Parse the date, handling UTC timezone
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Format based on when the date is
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    } else if (isWithinInterval(date, { 
      start: new Date(), 
      end: addDays(new Date(), 7) 
    })) {
      // Within the next week
      return format(date, 'EEEE \'at\' h:mm a');
    } else {
      // More than a week away
      return format(date, 'MMM d \'at\' h:mm a');
    }
  } catch (error) {
    console.error('Error formatting scheduled time:', error);
    return 'Error formatting time';
  }
}

/**
 * Get a short status message for the schedule
 */
export function getScheduleStatusMessage(
  enabled: boolean,
  isRunning: boolean,
  consecutiveFailures: number,
  lastSuccess: boolean | null
): { message: string; color: string } {
  if (isRunning) {
    return { message: 'Running now', color: 'text-blue-600' };
  }
  
  if (!enabled) {
    return { message: 'Paused', color: 'text-gray-600' };
  }
  
  if (consecutiveFailures >= 5) {
    return { message: 'Failed - needs attention', color: 'text-red-600' };
  }
  
  if (consecutiveFailures >= 3) {
    return { message: 'Having issues', color: 'text-orange-600' };
  }
  
  if (lastSuccess === false) {
    return { message: 'Last run failed', color: 'text-yellow-600' };
  }
  
  return { message: 'Active', color: 'text-green-600' };
}

/**
 * Calculate time until next run for progress indicators
 */
export function getTimeUntilNextRun(nextRunString: string | null): {
  minutes: number;
  percentage: number;
  display: string;
} {
  if (!nextRunString) {
    return { minutes: 0, percentage: 0, display: 'Not scheduled' };
  }
  
  try {
    const now = new Date();
    const nextRun = new Date(nextRunString);
    const diffMs = nextRun.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return { minutes: 0, percentage: 100, display: 'Starting soon' };
    }
    
    const minutes = Math.floor(diffMs / 60000);
    const percentage = Math.max(0, Math.min(100, (60 - minutes) / 60 * 100));
    
    if (minutes < 1) {
      return { minutes: 0, percentage: 100, display: 'Starting now' };
    } else if (minutes === 1) {
      return { minutes: 1, percentage, display: '1 minute' };
    } else {
      return { minutes, percentage, display: `${minutes} minutes` };
    }
  } catch (error) {
    console.error('Error calculating time until next run:', error);
    return { minutes: 0, percentage: 0, display: 'Error' };
  }
}

/**
 * Get minutes until next sync for compact display
 */
export function getMinutesUntilSync(nextRunString: string | null): string {
  if (!nextRunString) {
    return '';
  }
  
  try {
    const minutes = differenceInMinutes(new Date(nextRunString), new Date());
    
    if (minutes < 0) {
      return 'Starting...';
    } else if (minutes === 0) {
      return 'Now';
    } else if (minutes === 1) {
      return '1 min';
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return hours === 1 ? '1 hr' : `${hours} hr`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  } catch (error) {
    console.error('Error calculating minutes until sync:', error);
    return '';
  }
}