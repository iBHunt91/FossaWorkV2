/**
 * Format Service - Centralized notification formatting
 * 
 * This module provides standardized formatting functions for notifications
 * across different channels (email, Pushover, etc.) to ensure consistency.
 */

/**
 * Format a date using the standard format for the application
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
    if (!date) return '';
    
    // Ensure we have a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Use a standard format across the application
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format time using the standard format for the application
 * @param {string|Date} date - Date to format time from
 * @returns {string} - Formatted time string
 */
export function formatTime(date) {
    if (!date) return '';
    
    // Ensure we have a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Use a standard format across the application
    return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Extract visit ID from job ID
 * @param {string} jobId - Full job ID
 * @returns {string} - Extracted visit ID
 */
export function getVisitId(jobId) {
    if (!jobId) return 'Unknown';
    
    // If jobId is in format "W-123456" extract just the numeric part
    if (jobId.startsWith('W-')) {
        return jobId.substring(2);
    }
    return jobId;
}

/**
 * Get style color for a specific change type
 * @param {string} changeType - Type of change
 * @param {string} format - Output format ('hex' or 'name')
 * @returns {string} - Color code or name
 */
export function getChangeTypeColor(changeType, format = 'hex') {
    const colors = {
        added: { hex: '#2ecc71', name: 'green' },
        removed: { hex: '#e74c3c', name: 'red' },
        date_changed: { hex: '#f39c12', name: 'orange' },
        swap: { hex: '#3498db', name: 'blue' },
        critical: { hex: '#FF3B30', name: 'red' },
        high: { hex: '#FF9500', name: 'orange' }
    };
    
    return colors[changeType]?.[format] || (format === 'hex' ? '#333333' : 'gray');
}

/**
 * Generate HTML for a store info card
 * @param {string} storeName - Name of the store
 * @param {string} storeNumber - Store number
 * @returns {string} - HTML for store info
 */
export function renderStoreInfoCard(storeName, storeNumber) {
    if (!storeName && !storeNumber) return '';
    
    return `
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background-color: #f8f9fa; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                <span style="font-size: 20px;">🏪</span>
            </div>
            <div>
                ${storeName ? `<div style="font-weight: bold; font-size: 16px;">${storeName}</div>` : ''}
                ${storeNumber ? `<div style="color: #6c757d; font-size: 14px;">Store #${storeNumber}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Generate standard HTML for a change item (used in emails and Pushover)
 * @param {Object} change - Change object
 * @param {string} changeType - Type of change
 * @param {Object} displayPreferences - Display preferences
 * @returns {string} - HTML for change item
 */
export function renderChangeItemHtml(change, changeType, displayPreferences = {}) {
    // Default display preferences
    const prefs = {
        showJobId: true,
        showStoreNumber: true,
        showStoreName: true,
        showLocation: true,
        showDate: true,
        showDispensers: true,
        ...displayPreferences
    };
    
    const color = getChangeTypeColor(changeType);
    let itemHtml = `<div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${color}; background-color: #f9f9f9;">`;
    
    if (changeType === 'added') {
        itemHtml += `<b>Added Job</b><br>`;
        if (prefs.showJobId && change.jobId) itemHtml += `• Job ID: ${change.jobId}<br>`;
        if (prefs.showStoreNumber || prefs.showStoreName) {
            itemHtml += '• Store: ';
            if (prefs.showStoreNumber && change.store) itemHtml += `${change.store}`;
            if (prefs.showStoreNumber && prefs.showStoreName && change.store && change.storeName) itemHtml += ' - ';
            if (prefs.showStoreName && change.storeName) itemHtml += `${change.storeName}`;
            itemHtml += '<br>';
        }
        if (prefs.showLocation && change.location) itemHtml += `• Location: ${change.location}<br>`;
        if (prefs.showDate && change.date) itemHtml += `• Date: ${formatDate(change.date)}<br>`;
        if (prefs.showDispensers && change.dispensers !== undefined) itemHtml += `• Dispensers: ${change.dispensers}<br>`;
    }
    else if (changeType === 'removed') {
        itemHtml += `<b>Removed Job</b><br>`;
        if (prefs.showJobId && change.jobId) itemHtml += `• Job ID: ${change.jobId}<br>`;
        if (prefs.showStoreNumber || prefs.showStoreName) {
            itemHtml += '• Store: ';
            if (prefs.showStoreNumber && change.store) itemHtml += `${change.store}`;
            if (prefs.showStoreNumber && prefs.showStoreName && change.store && change.storeName) itemHtml += ' - ';
            if (prefs.showStoreName && change.storeName) itemHtml += `${change.storeName}`;
            itemHtml += '<br>';
        }
        if (prefs.showLocation && change.location) itemHtml += `• Location: ${change.location}<br>`;
        if (prefs.showDate && change.date) itemHtml += `• Date: ${formatDate(change.date)}<br>`;
        if (prefs.showDispensers && change.dispensers !== undefined) itemHtml += `• Dispensers: ${change.dispensers}<br>`;
    }
    else if (changeType === 'date_changed') {
        itemHtml += `<b>Date Changed</b><br>`;
        if (prefs.showJobId && change.jobId) itemHtml += `• Job ID: ${change.jobId}<br>`;
        if (prefs.showStoreNumber || prefs.showStoreName) {
            itemHtml += '• Store: ';
            if (prefs.showStoreNumber && change.store) itemHtml += `${change.store}`;
            if (prefs.showStoreNumber && prefs.showStoreName && change.store && change.storeName) itemHtml += ' - ';
            if (prefs.showStoreName && change.storeName) itemHtml += `${change.storeName}`;
            itemHtml += '<br>';
        }
        if (prefs.showLocation && change.location) itemHtml += `• Location: ${change.location}<br>`;
        if (prefs.showDispensers && change.dispensers !== undefined) itemHtml += `• Dispensers: ${change.dispensers}<br>`;
        if (prefs.showDate) {
            if (change.oldDate) itemHtml += `• From: ${formatDate(change.oldDate)}<br>`;
            if (change.newDate) itemHtml += `• To: ${formatDate(change.newDate)}<br>`;
        }
    }
    else if (changeType === 'swap') {
        itemHtml += `<b>Jobs Swapped</b><br><br>`;
        
        // Job 1
        if (prefs.showJobId && change.job1Id) itemHtml += `• Job 1: ${change.job1Id}<br>`;
        if (prefs.showStoreNumber || prefs.showStoreName) {
            itemHtml += '• Store 1: ';
            if (prefs.showStoreNumber && change.job1Store) itemHtml += `${change.job1Store}`;
            if (prefs.showStoreNumber && prefs.showStoreName && change.job1Store && change.job1StoreName) itemHtml += ' - ';
            if (prefs.showStoreName && change.job1StoreName) itemHtml += `${change.job1StoreName}`;
            itemHtml += '<br>';
        }
        if (prefs.showLocation && change.job1Location) itemHtml += `• Location 1: ${change.job1Location}<br>`;
        if (prefs.showDispensers && change.job1Dispensers !== undefined) itemHtml += `• Dispensers 1: ${change.job1Dispensers}<br>`;
        if (prefs.showDate && change.oldDate1 && change.newDate1) {
            itemHtml += `• From: ${formatDate(change.oldDate1)} → To: ${formatDate(change.newDate1)}<br>`;
        }
        
        itemHtml += '<br>';
        
        // Job 2
        if (prefs.showJobId && change.job2Id) itemHtml += `• Job 2: ${change.job2Id}<br>`;
        if (prefs.showStoreNumber || prefs.showStoreName) {
            itemHtml += '• Store 2: ';
            if (prefs.showStoreNumber && change.job2Store) itemHtml += `${change.job2Store}`;
            if (prefs.showStoreNumber && prefs.showStoreName && change.job2Store && change.job2StoreName) itemHtml += ' - ';
            if (prefs.showStoreName && change.job2StoreName) itemHtml += `${change.job2StoreName}`;
            itemHtml += '<br>';
        }
        if (prefs.showLocation && change.job2Location) itemHtml += `• Location 2: ${change.job2Location}<br>`;
        if (prefs.showDispensers && change.job2Dispensers !== undefined) itemHtml += `• Dispensers 2: ${change.job2Dispensers}<br>`;
        if (prefs.showDate && change.oldDate2 && change.newDate2) {
            itemHtml += `• From: ${formatDate(change.oldDate2)} → To: ${formatDate(change.newDate2)}<br>`;
        }
    }
    
    itemHtml += `</div>`;
    return itemHtml;
}

/**
 * Generate a complete HTML email body for schedule changes
 * @param {Object} changes - Changes object
 * @param {Date} date - Current date
 * @param {Object} user - User object
 * @param {Object} displayPreferences - Display preferences
 * @returns {string} - Complete HTML email body
 */
export function generateScheduleChangesHtml(changes, date, user, displayPreferences = {}) {
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(date);
    const userName = user?.name || user?.firstName || '';

    let html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Schedule Changes Alert
                </h2>
                
                <p style="color: #34495e; font-size: 16px; margin-bottom: 25px;">
                    ${userName ? `Hello ${userName},<br>` : ''}
                    The following changes have been detected in your work schedule:
                </p>

                <div style="margin-bottom: 30px;">
                    <div style="list-style-type: none; padding: 0;">
    `;

    // Add critical changes section
    if (changes.critical && changes.critical.length > 0) {
        html += `<div style="margin-bottom: 20px;">
            <span style="color: ${getChangeTypeColor('critical')}; font-weight: bold; font-size: 16px;">
                ⚠️ CRITICAL CHANGES (${changes.critical.length})
            </span>
            <div style="margin-top: 10px;">`;
        
        for (const change of changes.critical) {
            html += renderChangeItemHtml(change, change.type, displayPreferences);
        }
        
        html += `</div></div>`;
    }

    // Add high priority changes section
    if (changes.high && changes.high.length > 0) {
        html += `<div style="margin-bottom: 20px;">
            <span style="color: ${getChangeTypeColor('high')}; font-weight: bold; font-size: 16px;">
                ⚠️ HIGH PRIORITY CHANGES (${changes.high.length})
            </span>
            <div style="margin-top: 10px;">`;
        
        for (const change of changes.high) {
            html += renderChangeItemHtml(change, change.type, displayPreferences);
        }
        
        html += `</div></div>`;
    }

    // Add summary section
    const criticalCount = changes.critical?.length || 0;
    const highCount = changes.high?.length || 0;
    const totalChanges = criticalCount + highCount;
    
    html += `
                    </div>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #2c3e50; margin-top: 0;">📊 Summary</h3>
                    <div style="color: #34495e;">
                        <div>• Total changes: ${totalChanges}</div>
                        <div>• Critical: ${criticalCount}</div>
                        <div>• High priority: ${highCount}</div>
                    </div>
                </div>

                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h3 style="color: #2c3e50; margin-top: 0;">🛠️ Actions Required</h3>
                    <div style="color: #34495e;">
                        ${criticalCount > 0 ? 
                            `<div style="color: ${getChangeTypeColor('critical')}; font-weight: bold;">• IMMEDIATE ACTION REQUIRED</div>` : ''}
                        <div>• Review schedule changes</div>
                        <div>• Update team calendar</div>
                        <div>• Confirm resource availability</div>
                    </div>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                    <p style="color: #7f8c8d; font-size: 12px;">
                        This is an automated notification from Fossa Monitor.<br>
                        Generated on ${formattedDate} at ${formattedTime}.<br>
                        Please do not reply to this email.
                    </p>
                </div>
            </div>
        </div>
    `;

    return html;
} 