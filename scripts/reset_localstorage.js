// localStorage reset script
console.log('Running localStorage reset script');

// Get the active user ID
const activeUserId = '7bea3bdb7e8e303eacaba442bd824004';

// Set the active user ID in localStorage
localStorage.setItem('activeUserId', activeUserId);

// Clear any existing selected visits
localStorage.removeItem(`form_prep_selected_visits_${activeUserId}`);

// Create empty batch jobs array
localStorage.setItem(`form_prep_batch_jobs_${activeUserId}`, JSON.stringify([]));

// Clear any batch job ID
localStorage.removeItem(`form_prep_batch_job_id_${activeUserId}`);

// Clear any last failed batch
localStorage.removeItem(`form_prep_last_failed_batch_${activeUserId}`);

// Clear paused state
localStorage.setItem(`form_prep_is_paused_${activeUserId}`, 'false');
localStorage.setItem(`form_prep_pause_reason_${activeUserId}`, '');

console.log('localStorage reset complete');
