export const formatDate = (dateString: string, options: Intl.DateTimeFormatOptions = {}): string => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  // Check if date is valid
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  // Default options
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  };
  
  return date.toLocaleString('en-US', { ...defaultOptions, ...options });
};

export const formatTimeFromNow = (dateString: string): string => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  // Check if date is valid
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const isPast = diffMs < 0;
  
  // Format based on time difference
  if (diffSec < 60) {
    return isPast ? 'a few seconds ago' : 'a few seconds';
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    const remainingSecs = diffSec % 60;
    
    if (mins < 5 && remainingSecs > 0) {
      // For times less than 5 minutes, show minutes and seconds
      return isPast 
        ? `${mins}m ${remainingSecs}s ago` 
        : `${mins}m ${remainingSecs}s`;
    }
    
    return isPast ? `${mins}m ago` : `${mins}m`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    
    if (mins > 0) {
      return isPast 
        ? `${hours}h ${mins}m ago` 
        : `${hours}h ${mins}m`;
    }
    
    return isPast ? `${hours}h ago` : `${hours}h`;
  } else {
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    
    if (days < 2 && hours > 0) {
      return isPast 
        ? `${days}d ${hours}h ago` 
        : `${days}d ${hours}h`;
    }
    
    return isPast ? `${days}d ago` : `${days}d`;
  }
}; 