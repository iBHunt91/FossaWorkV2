import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getLatestScrapeFile, getPreviousScrapeFile, getScheduleChangesPath, getChangesArchivePath } from './dataManager.js';
import { resolveUserFilePath } from '../../server/utils/userManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to store completed jobs tracking file
const COMPLETED_JOBS_FILE = path.join(__dirname, '..', '..', 'data/completed_jobs.json');

// Function to compare two jobs
function compareJobs(currentJob, previousJob, userPreferences = null) {
    const changes = {
        details: []
    };

    // Check if job should be filtered based on user preferences
    if (userPreferences && !shouldIncludeJob(currentJob || previousJob, userPreferences)) {
        return changes;
    }

    // Check for removed job
    if (!currentJob) {
        changes.details.push({
            type: 'removed',
            jobId: previousJob.id,
            store: previousJob.customer.storeNumber,
            date: previousJob.visits.nextVisit.date
        });
        return changes;
    }

    // Check for new job
    if (!previousJob) {
        changes.details.push({
            type: 'added',
            jobId: currentJob.id,
            store: currentJob.customer.storeNumber,
            date: currentJob.visits.nextVisit.date
        });
        return changes;
    }

    // Compare visit dates
    if (currentJob.visits.nextVisit.date !== previousJob.visits.nextVisit.date) {
        changes.details.push({
            type: 'date_changed',
            jobId: currentJob.id,
            store: currentJob.customer.storeNumber,
            oldDate: previousJob.visits.nextVisit.date,
            newDate: currentJob.visits.nextVisit.date
        });
    }

    return changes;
}

/**
 * Check if a job should be included based on user preferences
 * @param {Object} job - Job to check
 * @param {Object} preferences - User preferences
 * @returns {boolean} - Whether the job should be included
 */
function shouldIncludeJob(job, preferences) {
    if (!preferences || !preferences.notifications) {
        return true; // Include all jobs if no preferences
    }

    const { filters } = preferences.notifications;

    // Check store number filter
    if (filters.stores && filters.stores.length > 0) {
        const storeNumber = job.customer.storeNumber;
        if (!filters.stores.includes(storeNumber)) {
            return false;
        }
    }

    // Check location filter
    if (filters.locations && filters.locations.length > 0) {
        const location = job.customer.address ? 
            `${job.customer.address.cityState.split(' ')[0]}, ${job.customer.address.cityState.split(' ')[1]}` : 
            'Unknown';
        if (!filters.locations.includes(location)) {
            return false;
        }
    }

    return true;
}

// Function to compare schedules
export function compareSchedules(currentSchedule, previousSchedule, userPreferences = null, userId = null) {
    console.log('Starting schedule comparison...');
    console.log(`Current schedule has ${currentSchedule.workOrders.length} jobs`);
    console.log(`Previous schedule has ${previousSchedule.workOrders.length} jobs`);
    
    const changes = {
        allChanges: [], // All changes are now in a single array
        summary: {
            removed: 0,
            added: 0,
            modified: 0,
            swapped: 0
        }
    };

    // Create maps for easy lookup
    const currentJobs = new Map(currentSchedule.workOrders.map(job => [job.id, job]));
    const previousJobs = new Map(previousSchedule.workOrders.map(job => [job.id, job]));

    // Track jobs by date
    const currentJobsByDate = new Map();
    const previousJobsByDate = new Map();

    // Organize current jobs by date
    for (const job of currentSchedule.workOrders) {
        const date = job.visits.nextVisit.date;
        if (!currentJobsByDate.has(date)) {
            currentJobsByDate.set(date, []);
        }
        currentJobsByDate.get(date).push(job);
    }

    // Organize previous jobs by date
    for (const job of previousSchedule.workOrders) {
        const date = job.visits.nextVisit.date;
        if (!previousJobsByDate.has(date)) {
            previousJobsByDate.set(date, []);
        }
        previousJobsByDate.get(date).push(job);
    }

    // Track processed jobs to avoid duplicates
    const processedJobs = new Set();
    
    // Array to track date changes for swap detection
    const dateChanges = [];

    // First, identify brand new jobs (ones in current but not in previous schedule)
    for (const [jobId, currentJob] of currentJobs) {
        // If job doesn't exist in previous schedule, it's a new addition
        if (!previousJobs.has(jobId) && !processedJobs.has(jobId)) {
            // Check if job should be included based on user preferences
            if (userPreferences && !shouldIncludeJob(currentJob, userPreferences)) {
                console.log(`Skipping new job ${jobId} due to user preferences`);
                continue;
            }
            
            const date = currentJob.visits.nextVisit.date;
            const dispensers = getDispenserCount(currentJob);
            
            // Check if it's being added to a date that already had jobs
            const today = new Date();
            const jobDate = new Date(date);
            const isCurrentDay = jobDate.toDateString() === today.toDateString();
            
            console.log(`New job detected: ${jobId} on ${date}`);
            
            // Add this as a newly added job
            changes.allChanges.push({
                type: 'added',
                jobId: currentJob.id,
                visitId: currentJob.visits?.nextVisit?.visitId,
                store: currentJob.customer.storeNumber,
                storeName: currentJob.customer.name,
                dispensers: dispensers,
                location: currentJob.customer.address ? 
                    `${currentJob.customer.address.cityState.split(' ')[0]}, ${currentJob.customer.address.cityState.split(' ')[1]}` : 
                    'Unknown',
                address: currentJob.customer.address || null,
                date: date
            });
            
            processedJobs.add(jobId);
            changes.summary.added++;
        }
    }

    // Then, process jobs that exist in both schedules to check for date changes
    for (const [jobId, currentJob] of currentJobs) {
        if (processedJobs.has(jobId)) continue;
        
        const previousJob = previousJobs.get(jobId);
        // If this job exists in both schedules, check for date changes
        if (previousJob) {
            const currentDate = currentJob.visits.nextVisit.date;
            const previousDate = previousJob.visits.nextVisit.date;
            
            if (currentDate !== previousDate) {
                // Check if job should be included based on user preferences
                if (userPreferences && !shouldIncludeJob(currentJob, userPreferences)) {
                    console.log(`Skipping date change for job ${jobId} due to user preferences`);
                    continue;
                }

                console.log(`Date change detected for job ${jobId}: ${previousDate} -> ${currentDate}`);

                // Store this date change for later swap analysis
                dateChanges.push({
                    jobId: jobId,
                    oldDate: previousDate,
                    newDate: currentDate,
                    job: currentJob,
                    previousJob: previousJob
                });
                processedJobs.add(jobId);
            } else {
                // Same job, no changes to date
                processedJobs.add(jobId);
            }
        }
    }

    // Now, identify removed jobs and potential replacements
    for (const [date, previousJobsOnDate] of previousJobsByDate) {
        const currentJobsOnDate = currentJobsByDate.get(date) || [];
        
        // For each previous job on this date
        for (const previousJob of previousJobsOnDate) {
            if (processedJobs.has(previousJob.id)) continue;

            // If this job is not in current jobs, it's either removed or replaced
            if (!currentJobs.has(previousJob.id)) {
                // First check if this is a completed job - if so, we don't need to alert
                if (userId && isJobCompleted(previousJob.id, userId)) {
                    console.log(`Job ${previousJob.id} was removed but is completed - no need to alert`);
                    // Mark as processed but don't add to changes
                    processedJobs.add(previousJob.id);
                    continue;
                }
                
                // Look for a new job on the same date that hasn't been processed yet
                // (new jobs from our first loop would already be processed)
                const replacementJobs = currentJobsOnDate.filter(job => 
                    !previousJobs.has(job.id) && !processedJobs.has(job.id));
                
                if (replacementJobs.length > 0) {
                    // For now just use the first unprocessed job as replacement
                    const newJob = replacementJobs[0];
                    
                    // Check if either job should be included based on user preferences
                    if (userPreferences && 
                        !shouldIncludeJob(previousJob, userPreferences) && 
                        !shouldIncludeJob(newJob, userPreferences)) {
                        console.log(`Skipping replacement for job ${previousJob.id} due to user preferences`);
                        continue;
                    }

                    console.log(`Job replacement detected: ${previousJob.id} -> ${newJob.id} on ${date}`);

                    // Found a replacement
                    // Get dispenser count from service quantities
                    const removedDispensers = getDispenserCount(previousJob);
                    const addedDispensers = getDispenserCount(newJob);
                    
                    changes.allChanges.push({
                        type: 'replaced',
                        oldJobId: previousJob.id, 
                        newJobId: newJob.id,
                        oldStore: previousJob.customer.storeNumber,
                        newStore: newJob.customer.storeNumber,
                        oldStoreName: previousJob.customer.name,
                        newStoreName: newJob.customer.name,
                        oldDispensers: removedDispensers,
                        newDispensers: addedDispensers,
                        oldLocation: previousJob.customer.address ? 
                            `${previousJob.customer.address.cityState.split(' ')[0]}, ${previousJob.customer.address.cityState.split(' ')[1]}` : 
                            'Unknown',
                        newLocation: newJob.customer.address ? 
                            `${newJob.customer.address.cityState.split(' ')[0]}, ${newJob.customer.address.cityState.split(' ')[1]}` : 
                            'Unknown',
                        oldAddress: previousJob.customer.address || null,
                        newAddress: newJob.customer.address || null,
                        date: date
                    });
                    
                    processedJobs.add(previousJob.id);
                    processedJobs.add(newJob.id);
                    
                    changes.summary.removed++;
                    changes.summary.added++;
                } else {
                    // Check if job should be included based on user preferences
                    if (userPreferences && !shouldIncludeJob(previousJob, userPreferences)) {
                        console.log(`Skipping removed job ${previousJob.id} due to user preferences`);
                        continue;
                    }

                    console.log(`Job ${previousJob.id} was removed from the schedule`);
                    
                    // No replacement found, this is a removed job
                    // Get dispenser count from service quantities
                    const dispensers = getDispenserCount(previousJob);
                    
                    changes.allChanges.push({
                        type: 'removed',
                        jobId: previousJob.id,
                        store: previousJob.customer.storeNumber,
                        storeName: previousJob.customer.name,
                        location: previousJob.customer.address?.city || 'Unknown',
                        address: previousJob.customer.address || null,
                        date: date,
                        dispensers: dispensers
                    });
                    
                    processedJobs.add(previousJob.id);
                    changes.summary.removed++;
                }
            }
        }
    }

    // Analyze date changes for potential swaps
    for (const change of dateChanges) {
        const { jobId, oldDate, newDate, job } = change;
        
        // Look for another job that moved from newDate to oldDate
        const potentialSwap = dateChanges.find(otherChange => 
            otherChange.jobId !== jobId && 
            otherChange.oldDate === newDate && 
            otherChange.newDate === oldDate
        );
        
        if (potentialSwap) {
            console.log(`Job swap detected: ${jobId} <-> ${potentialSwap.jobId}`);
            
            changes.allChanges.push({
                type: 'swap',
                job1Id: jobId,
                job2Id: potentialSwap.jobId,
                job1Store: job.customer.storeNumber,
                job2Store: potentialSwap.job.customer.storeNumber,
                job1StoreName: job.customer.name,
                job2StoreName: potentialSwap.job.customer.name,
                job1Location: job.customer.address?.city || 'Unknown',
                job2Location: potentialSwap.job.customer.address?.city || 'Unknown',
                job1Address: job.customer.address || null,
                job2Address: potentialSwap.job.customer.address || null,
                job1Dispensers: getDispenserCount(job),
                job2Dispensers: getDispenserCount(potentialSwap.job),
                oldDate1: oldDate,
                newDate1: newDate,
                oldDate2: potentialSwap.oldDate,
                newDate2: potentialSwap.newDate
            });
            
            changes.summary.swapped++;
        } else {
            // This is just a date change
            changes.allChanges.push({
                type: 'date_changed',
                jobId: jobId,
                store: job.customer.storeNumber,
                storeName: job.customer.name,
                location: job.customer.address?.city || 'Unknown',
                address: job.customer.address || null,
                oldDate: oldDate,
                newDate: newDate,
                dispensers: getDispenserCount(job)
            });
            
            changes.summary.modified++;
        }
    }

    console.log('Schedule comparison completed');
    console.log('Changes summary:', changes.summary);
    console.log(`Total changes: ${changes.allChanges.length}`);
    
    // Remove cleanup call - keep completed jobs until next scrape
    // if (userId) {
    //    cleanupCompletedJobsData(userId);
    // }

    return changes;
}

// Function to generate a human-readable summary of changes
function generateChangeReport(changes) {
    let report = [];
    
    // Summarize changes
    if (changes.summary.removed > 0 || changes.summary.added > 0 || changes.summary.modified > 0 || changes.summary.swapped > 0) {
        let summaryParts = [];
        
        if (changes.summary.removed > 0) {
            summaryParts.push(`${changes.summary.removed} job${changes.summary.removed !== 1 ? 's' : ''} removed`);
        }
        
        if (changes.summary.added > 0) {
            summaryParts.push(`${changes.summary.added} job${changes.summary.added !== 1 ? 's' : ''} added`);
        }
        
        if (changes.summary.modified > 0) {
            summaryParts.push(`${changes.summary.modified} job${changes.summary.modified !== 1 ? 's' : ''} modified`);
        }
        
        if (changes.summary.swapped > 0) {
            summaryParts.push(`${changes.summary.swapped} job${changes.summary.swapped !== 1 ? 's' : ''} swapped`);
        }
        
        report.push(`Summary: ${summaryParts.join(', ')}`);
    }

    // Add all changes
    report.push('All Changes:');
    report.push('----------------');
    
    // All changes are now in a single array
    for (const change of changes.allChanges) {
        report.push(formatChange(change));
    }
    
    return report.join('\n');
}

// Helper function to format individual changes
function formatChange(change) {
    switch (change.type) {
        case 'replaced':
            return `- Visit #${change.oldJobId} (Store ${change.oldStore.replace('##', '#')}, ${change.oldDispensers} dispensers) was removed and replaced with Visit #${change.newJobId} (Store ${change.newStore.replace('##', '#')}, ${change.newDispensers} dispensers) on ${change.date}\n`;
        case 'removed':
            return `- Visit #${change.jobId} (Store ${change.store.replace('##', '#')}, ${change.dispensers} dispensers) was removed on ${change.date}\n`;
        case 'added':
            return `- Visit #${change.jobId} (Store ${change.store.replace('##', '#')}, ${change.dispensers} dispensers) was added on ${change.date}\n`;
        case 'date_changed':
            return `- Date changed for Visit #${change.jobId} at store ${change.store.replace('##', '#')}: ${change.oldDate} -> ${change.newDate}\n`;
        case 'swap':
            return `- Jobs swapped: Visit #${change.job1Id} (Store ${change.job1Store.replace('##', '#')}, ${change.job1Dispensers} dispensers) and Visit #${change.job2Id} (Store ${change.job2Store.replace('##', '#')}, ${change.job2Dispensers} dispensers) exchanged dates between ${change.oldDate1} and ${change.newDate1}\n`;
        default:
            return `- Unknown change type for Visit #${change.jobId} at store ${change.store.replace('##', '#')}\n`;
    }
}

// Track completed jobs to avoid false "removal" alerts
function trackCompletedJob(jobId, date, store, storeName, dispensers, location) {
    let completedJobs = [];
    
    // Load existing completed jobs if available
    if (fs.existsSync(COMPLETED_JOBS_FILE)) {
        try {
            completedJobs = JSON.parse(fs.readFileSync(COMPLETED_JOBS_FILE, 'utf8'));
        } catch (error) {
            console.warn('Error reading completed jobs file, starting with empty list', error);
        }
    }
    
    // Add the job to the completed list with timestamp
    completedJobs.push({
        jobId,
        date,
        store,
        storeName,
        dispensers,
        location,
        completedTimestamp: new Date().toISOString()
    });
    
    // Limit the size of completed jobs list (keep last 100)
    if (completedJobs.length > 100) {
        completedJobs = completedJobs.slice(-100);
    }
    
    // Save the updated list
    try {
        fs.writeFileSync(COMPLETED_JOBS_FILE, JSON.stringify(completedJobs, null, 2));
    } catch (error) {
        console.error('Error saving completed jobs file', error);
    }
}

/**
 * Checks if a job is in the completed jobs list
 * @param {string} jobId - The job ID to check
 * @param {string} userId - User ID to check against user-specific completed jobs
 * @returns {boolean} - True if job is in completed jobs list, false otherwise
 */
function isJobCompleted(jobId, userId) {
    if (!jobId || !userId) {
        return false;
    }
    
    try {
        // Get the user-specific completed jobs file
        const completedJobsFilePath = resolveUserFilePath('completed_jobs.json', userId);
        
        if (!fs.existsSync(completedJobsFilePath)) {
            console.log(`No completed jobs file found for user ${userId}`);
            return false;
        }
        
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsFilePath, 'utf8'));
        
        if (!completedJobsData || !Array.isArray(completedJobsData.completedJobs)) {
            console.log(`Invalid completed jobs data structure for user ${userId}`);
            return false;
        }
        
        return completedJobsData.completedJobs.includes(jobId);
    } catch (error) {
        console.error(`Error checking completed jobs: ${error.message}`);
        return false;
    }
}

// Get completed job info
function getCompletedJobInfo(jobId) {
    if (!fs.existsSync(COMPLETED_JOBS_FILE)) {
        return null;
    }
    
    try {
        const completedJobs = JSON.parse(fs.readFileSync(COMPLETED_JOBS_FILE, 'utf8'));
        return completedJobs.find(job => job.jobId === jobId) || null;
    } catch (error) {
        console.warn('Error getting completed job info', error);
        return null;
    }
}

/**
 * Analyze schedule changes between the latest and previous scrape
 * @param {Object} userPreferences - User preferences for filtering changes
 * @param {string} userId - User ID
 * @returns {Object} - Object containing detected changes
 */
export function analyzeScheduleChanges(userPreferences = null, userId = 'Bruce') {
    try {
        // Get the latest and previous scrape files
        const currentFile = getLatestScrapeFile(userId);
        const previousFile = getPreviousScrapeFile(userId);

        if (!currentFile || !previousFile) {
            console.log('No previous scrape file found for comparison');
            return null;
        }

        // Read the files
        const currentSchedule = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
        const previousSchedule = JSON.parse(fs.readFileSync(previousFile, 'utf8'));

        // Compare the schedules
        const changes = compareSchedules(currentSchedule, previousSchedule, userPreferences, userId);

        // Generate a report of the changes
        const report = generateChangeReport(changes);

        // Save the report to user-specific location
        const reportPath = getScheduleChangesPath(userId);
        fs.writeFileSync(reportPath, report);

        // Archive the changes to a single history file if there are any significant changes
        if (changes.allChanges.length > 0) {
            updateChangeHistory(changes, userId);
            
            // Also keep individual archive for backward compatibility
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archiveDir = getChangesArchivePath(userId);
            
            // Create archive directory if it doesn't exist
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }
            
            // Save with timestamp for future reference
            const archivePath = path.join(archiveDir, `schedule_changes_${timestamp}.txt`);
            fs.writeFileSync(archivePath, report);
            
            console.log(`Schedule changes archived to: ${archivePath}`);
        }

        return changes;
    } catch (error) {
        console.error('Error analyzing schedule changes:', error);
        return null;
    }
}

/**
 * Update the change history file with new changes
 * @param {Object} changes - The changes to add to history
 * @param {string} userId - User ID
 */
function updateChangeHistory(changes, userId) {
    try {
        const userDir = getChangesArchivePath(userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        const historyFilePath = path.join(userDir, 'change_history.json');
        
        // Create history object with timestamp
        const newEntry = {
            timestamp: new Date().toISOString(),
            changes: changes
        };
        
        // Read existing history or create new array
        let history = [];
        if (fs.existsSync(historyFilePath)) {
            try {
                const historyContent = fs.readFileSync(historyFilePath, 'utf8');
                history = JSON.parse(historyContent);
                
                // Ensure history is an array
                if (!Array.isArray(history)) {
                    console.log('History file exists but is not an array, creating new history');
                    history = [];
                }
            } catch (readError) {
                console.error('Error reading history file, creating new one:', readError);
                history = [];
            }
        }
        
        // Add new entry to beginning of array (newest first)
        history.unshift(newEntry);
        
        // Limit history to last 100 changes to prevent file from growing too large
        if (history.length > 100) {
            history = history.slice(0, 100);
        }
        
        // Write updated history back to file
        fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
        console.log(`Updated change history in ${historyFilePath}`);
    } catch (error) {
        console.error('Error updating change history:', error);
    }
}

// Export the completed job tracking functions for external use
export { trackCompletedJob, isJobCompleted, getCompletedJobInfo };

// Helper function to get dispenser count from a job
function getDispenserCount(job) {
    // Look for meter calibration services with quantity set
    for (const service of job.services) {
        if (service.type === 'Meter Calibration' || service.type.toLowerCase().includes('dispenser')) {
            return service.quantity;
        }
    }
    
    // If we can't find a specific meter calibration service, look for any service with a quantity
    if (job.services && job.services.length > 0) {
        return job.services[0].quantity;
    }
    
    // Default to 0 if no dispensers can be determined
    return 0;
}

/**
 * Cleans up completed jobs data after it's been used
 * @param {string} userId - User ID whose completed jobs to clean up
 */
function cleanupCompletedJobsData(userId) {
    if (!userId) {
        console.log('No user ID provided for cleanup');
        return;
    }
    
    try {
        const completedJobsFilePath = resolveUserFilePath('completed_jobs.json', userId);
        
        if (!fs.existsSync(completedJobsFilePath)) {
            console.log(`No completed jobs file found for user ${userId}`);
            return;
        }
        
        // Read current data
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsFilePath, 'utf8'));
        
        // Keep metadata but remove the jobs list
        const cleanedData = {
            completedJobs: [],
            metadata: {
                ...completedJobsData.metadata,
                lastCleanupTimestamp: new Date().toISOString()
            }
        };
        
        // Write cleaned data back to file
        fs.writeFileSync(completedJobsFilePath, JSON.stringify(cleanedData, null, 2));
        console.log(`Cleaned up completed jobs data for user ${userId}`);
    } catch (error) {
        console.error(`Error cleaning up completed jobs data: ${error.message}`);
    }
} 