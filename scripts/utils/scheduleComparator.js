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
                    // No replacement found, this is a removal
                    if (userPreferences && !shouldIncludeJob(previousJob, userPreferences)) {
                        console.log(`Skipping removal of job ${previousJob.id} due to user preferences`);
                        continue;
                    }

                    // Check if this job was completed (only if userId is provided)
                    console.log(`\n********** REMOVAL DETECTION **********`);
                    console.log(`Checking if job ${previousJob.id} was completed or truly removed`);
                    const isCompleted = userId ? isJobCompleted(previousJob.id, userId) : false;

                    if (isCompleted) {
                        console.log(`Job ${previousJob.id} is in the completed jobs list, not treating as removed`);
                        processedJobs.add(previousJob.id);
                        console.log(`********** END REMOVAL DETECTION **********\n`);
                        continue; // Skip this job since it's completed
                    } else {
                        console.log(`Job ${previousJob.id} was NOT found in completed jobs, will report as removed`);
                        console.log(`********** END REMOVAL DETECTION **********\n`);
                        
                        console.log(`Job removal detected: ${previousJob.id} on ${date}`);

                        changes.allChanges.push({
                            type: 'removed',
                            jobId: previousJob.id,
                            store: previousJob.customer.storeNumber,
                            storeName: previousJob.customer.name,
                            dispensers: getDispenserCount(previousJob),
                            location: previousJob.customer.address ? 
                                `${previousJob.customer.address.cityState.split(' ')[0]}, ${previousJob.customer.address.cityState.split(' ')[1]}` : 
                                'Unknown',
                            address: previousJob.customer.address || null,
                            date: date
                        });
                        
                        processedJobs.add(previousJob.id);
                        changes.summary.removed++;
                    }
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

// Check if a job has been completed
function isJobCompleted(jobId, userId) {
    console.log(`\n=====================================================`);
    console.log(`DETAILED CHECK: Is job ${jobId} completed for user ${userId}?`);
    try {
        // Path to completed jobs file for this user
        const completedJobsFilePath = resolveUserFilePath('completed_jobs.json', userId);
        console.log(`Looking for completed jobs at: ${completedJobsFilePath}`);
        
        // Check if the file exists
        if (!fs.existsSync(completedJobsFilePath)) {
            console.log(`Completed jobs file not found at ${completedJobsFilePath}`);
            console.log(`=====================================================\n`);
            return false;
        }
        
        // Read and parse the file
        const completedJobsData = JSON.parse(fs.readFileSync(completedJobsFilePath, 'utf8'));
        console.log(`Found ${completedJobsData.completedJobs.length} completed jobs: ${JSON.stringify(completedJobsData.completedJobs)}`);
        
        // First, try exact match
        const isExactMatch = completedJobsData.completedJobs.includes(jobId);
        console.log(`EXACT COMPARISON: Checking if "${jobId}" exists in the list: ${isExactMatch}`);
        
        if (isExactMatch) {
            console.log(`Result: Job ${jobId} is IN the completed jobs list (exact match)`);
            console.log(`=====================================================\n`);
            return true;
        }
        
        // If exact match fails, try more flexible matching
        // Normalize job IDs by removing prefix and whitespace
        const normalizedJobId = jobId.replace(/^W-|\s+/g, '').trim();
        
        // Find any jobs that match after normalization
        const matches = completedJobsData.completedJobs.some(completedId => {
            const normalizedCompletedId = completedId.replace(/^W-|\s+/g, '').trim();
            const isMatch = normalizedJobId === normalizedCompletedId;
            if (isMatch) {
                console.log(`NORMALIZED MATCH: "${jobId}" (normalized: "${normalizedJobId}") matches "${completedId}" (normalized: "${normalizedCompletedId}")`);
            }
            return isMatch;
        });
        
        if (matches) {
            console.log(`Result: Job ${jobId} is IN the completed jobs list (normalized match)`);
            console.log(`=====================================================\n`);
            return true;
        }
        
        // Also check for partial matches for debugging purposes
        const partialMatches = completedJobsData.completedJobs.filter(id => 
            id.includes(normalizedJobId) || 
            normalizedJobId.includes(id.replace(/^W-|\s+/g, '').trim())
        );
        
        if (partialMatches.length > 0) {
            console.log(`PARTIAL MATCHES found but not used for detection: ${JSON.stringify(partialMatches)}`);
            console.log(`This indicates potential format differences between stored completed jobs and job IDs`);
        }
        
        console.log(`Result: Job ${jobId} is NOT IN the completed jobs list (no matches)`);
        console.log(`=====================================================\n`);
        return false;
    } catch (error) {
        console.error(`Error checking if job ${jobId} is completed:`, error);
        console.log(`=====================================================\n`);
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