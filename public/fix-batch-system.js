// Direct fix for Batch Visit Automation
(function() {
  // Set console styling
  const styles = {
    title: 'font-size: 14px; color: #0066cc; font-weight: bold;',
    step: 'color: #009900; font-weight: bold;',
    error: 'color: #cc0000; font-weight: bold;',
    success: 'color: #007700; font-weight: bold;',
    warning: 'color: #cc6600; font-weight: bold;',
    info: 'color: #0066ff;'
  };

  console.log('%c Batch Visit Automation System Fix Utility ', 'background: #eaeaea; color: #333; font-size: 16px; font-weight: bold; padding: 4px;');
  console.log('%cStarting repair process...', styles.title);

  // Step 1: Check and fix localStorage entries
  console.log('%cStep 1: Checking localStorage entries...', styles.step);
  
  // Get active user ID
  let activeUserId = localStorage.getItem('activeUserId');
  if (!activeUserId) {
    console.log('%cNo active user ID found! Setting default ID...', styles.error);
    activeUserId = '7bea3bdb7e8e303eacaba442bd824004';
    localStorage.setItem('activeUserId', activeUserId);
  }
  console.log(`%cActive User ID: ${activeUserId}`, styles.info);
  
  // Ensure batch jobs storage exists
  const batchJobsKey = `form_prep_batch_jobs_${activeUserId}`;
  if (!localStorage.getItem(batchJobsKey)) {
    console.log(`%cCreating empty batch jobs array...`, styles.warning);
    localStorage.setItem(batchJobsKey, JSON.stringify([]));
  }
  
  // Reset batch job ID if it exists
  const batchJobIdKey = `form_prep_batch_job_id_${activeUserId}`;
  if (localStorage.getItem(batchJobIdKey)) {
    console.log(`%cResetting batch job ID...`, styles.warning);
    localStorage.removeItem(batchJobIdKey);
  }
  
  // Reset selected visits
  const selectedVisitsKey = `form_prep_selected_visits_${activeUserId}`;
  localStorage.setItem(selectedVisitsKey, JSON.stringify([]));
  
  console.log('%cLocalStorage entries fixed!', styles.success);

  // Step 2: Reset dispenser store via API
  console.log('%cStep 2: Resetting dispenser store...', styles.step);
  
  fetch('/api/reset-dispenser-data', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    console.log(`%cDispenser store reset: ${data.message}`, styles.success);
    
    // Step 3: Sync dispenser store
    console.log('%cStep 3: Syncing dispenser store...', styles.step);
    return fetch('/api/sync-dispenser-store', {
      method: 'POST'
    });
  })
  .then(response => response.json())
  .then(data => {
    console.log(`%cDispenser store sync: ${data.message}`, styles.success);
    
    // Step 4: Create mock dispensers for API test
    console.log('%cStep 4: Testing dispenser endpoints...', styles.step);
    
    return Promise.all([
      fetch('/api/dispensers/workOrders'),
      fetch('/api/dispensers/metadata'),
      fetch('/api/dispensers/activeUser'),
      fetch('/api/dispensers/success')
    ]);
  })
  .then(responses => {
    // Check if all responses are OK
    const allOk = responses.every(r => r.ok);
    if (allOk) {
      console.log('%cAll dispenser endpoints responding correctly!', styles.success);
    } else {
      console.log('%cSome dispenser endpoints failed! Check network tab.', styles.error);
    }
    
    // Step 5: Force component refresh
    console.log('%cStep 5: Forcing component refresh...', styles.step);
    
    try {
      // Try to find the BatchVisitAutomation component
      const batchComponentInstances = Array.from(document.querySelectorAll('*')).filter(el => {
        return el._reactInternalInstance || 
               el._reactRootContainer || 
               el._reactInternals || 
               el.__reactFiber$;
      });
      
      if (batchComponentInstances.length > 0) {
        console.log(`%cFound ${batchComponentInstances.length} React component instances. Attempting refresh...`, styles.info);
      } else {
        console.log('%cNo React component instances found. Manual refresh may be needed.', styles.warning);
      }
    } catch (err) {
      console.log('%cError finding React components:', styles.error, err);
    }
    
    // Final step - suggest page reload
    console.log('%cFix process complete! Refreshing page in 5 seconds...', styles.success);
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  })
  .catch(error => {
    console.log('%cError during fix process:', styles.error, error);
    console.log('%cPlease try manually reloading the page.', styles.warning);
  });
})();
