import fs from 'fs';
import path from 'path';

/**
 * Formats a message indicating how many schedule changes were detected
 * @param {Object} changes - The changes object with summary info
 * @returns {string} - Formatted message with just the number of changes
 */
export function formatScheduleChangesText(changes) {
  if (!changes || !changes.summary) {
    console.log('No changes object or summary found');
    return '0';
  }

  // Count individual changes instead of just summarizing by category
  let totalChanges = 0;
  
  // If allChanges array exists, use its length as that's the actual number of individual changes
  if (changes.allChanges && Array.isArray(changes.allChanges)) {
    totalChanges = changes.allChanges.length;
    console.log(`Found ${totalChanges} changes in allChanges array:`, 
      changes.allChanges.map(c => c.type).join(', '));
  } else {
    // Fall back to summary counts if allChanges array isn't available
    totalChanges = (changes.summary.removed || 0) + 
                  (changes.summary.added || 0) + 
                  (changes.summary.modified || 0) + 
                  (changes.summary.swapped || 0) +
                  (changes.summary.replaced || 0);
    console.log(`No allChanges array found, using summary counts: ${totalChanges} changes`);
  }
  
  // Just return the number as a string
  return `${totalChanges}`;
}

/**
 * Generates detailed text breakdown of changes
 * @param {Object} changes - The changes object with summary info
 * @returns {string} - Detailed breakdown of changes
 */
export function formatDetailedChangesText(changes) {
  if (!changes || !changes.summary) {
    return 'No changes detected';
  }

  const parts = [];
  if (changes.summary.removed > 0) {
    parts.push(`${changes.summary.removed} removed`);
  }
  if (changes.summary.added > 0) {
    parts.push(`${changes.summary.added} added`);
  }
  if (changes.summary.modified > 0) {
    parts.push(`${changes.summary.modified} modified`);
  }
  if (changes.summary.swapped > 0) {
    parts.push(`${changes.summary.swapped} swapped`);
  }
  if (changes.summary.replaced > 0) {
    parts.push(`${changes.summary.replaced} replaced`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes detected';
}

/**
 * Saves change notification text to a file for UI display
 * @param {Object} changes - The changes object with summary info
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export async function saveScheduleChangesTextForUI(changes, userId) {
  try {
    const notificationText = formatScheduleChangesText(changes);
    const detailedText = formatDetailedChangesText(changes);
    const timestamp = new Date().toLocaleString();

    const notificationData = {
      text: notificationText,
      detailedText: detailedText,
      timestamp: timestamp,
      generated: new Date().toISOString()
    };

    // Create path for user-specific notification file
    const userDir = path.resolve(process.cwd(), 'data', 'users', userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    const filePath = path.join(userDir, 'schedule_changes.txt');
    fs.writeFileSync(filePath, JSON.stringify(notificationData, null, 2), 'utf8');
    
    console.log(`Saved schedule changes text to ${filePath}: ${notificationText}`);
  } catch (error) {
    console.error('Error saving schedule changes text:', error);
  }
} 