// Form Prep Diagnostic Tool
// Run this in the browser console to diagnose issues

(function() {
  console.clear();
  console.log('Running Form Prep Diagnostic...');
  
  // Check localStorage
  const activeUserId = localStorage.getItem('activeUserId');
  console.log(`Active User ID: ${activeUserId || 'NOT FOUND'}`);
  
  const selectedVisitsKey = activeUserId ? `form_prep_selected_visits_${activeUserId}` : null;
  const selectedVisits = selectedVisitsKey ? localStorage.getItem(selectedVisitsKey) : null;
  console.log(`Selected Visits: ${selectedVisits || 'NONE'}`);
  
  const batchJobsKey = activeUserId ? `form_prep_batch_jobs_${activeUserId}` : null;
  const batchJobs = batchJobsKey ? localStorage.getItem(batchJobsKey) : null;
  console.log(`Batch Jobs: ${batchJobs ? 'FOUND' : 'NONE'}`);
  
  // Check API endpoints
  console.log('\nTesting API endpoints...');
  
  Promise.all([
    fetch('/api/dispensers/workOrders'),
    fetch('/api/dispensers/metadata'),
    fetch('/api/dispensers/activeUser'),
    fetch('/api/dispensers/success')
  ])
  .then(responses => {
    console.log('API Endpoints Status:');
    responses.forEach((r, i) => {
      const endpoint = [
        'workOrders', 'metadata', 'activeUser', 'success'
      ][i];
      console.log(`- /api/dispensers/${endpoint}: ${r.ok ? '✅ OK' : '❌ Failed'} (${r.status})`);
    });
    
    // Check if all endpoints return 200 OK
    const allOk = responses.every(r => r.ok);
    if (allOk) {
      console.log('✅ All API endpoints are responding correctly');
    } else {
      console.log('❌ Some API endpoints are not responding correctly');
    }
    
    // Process workOrders response
    return responses[0].json();
  })
  .then(workOrdersData => {
    console.log('\nWork Orders Data:', workOrdersData);
    
    // Check dispenser_store.json
    return fetch('/data/users/' + activeUserId + '/dispenser_store.json');
  })
  .then(r => r.json())
  .then(dispenserStore => {
    console.log('\nDispenser Store Data:', dispenserStore);
    
    const dispenserCount = Object.keys(dispenserStore.dispenserData || {}).length;
    console.log(`Dispenser Store contains data for ${dispenserCount} work orders`);
    
    if (dispenserCount === 0) {
      console.log('❌ No dispenser data found in dispenser_store.json');
    } else {
      console.log('✅ Dispenser data found in dispenser_store.json');
    }
    
    // Check DOM for relevant components
    console.log('\nChecking DOM for components...');
    
    const batchComponent = document.querySelector('[data-component="batchVisitAutomation"]');
    console.log(`Batch Visit Automation Component: ${batchComponent ? '✅ Found' : '❌ Not Found'}`);
    
    const weekGroups = document.querySelectorAll('[data-week-group]');
    console.log(`Week Groups: ${weekGroups.length} found`);
    
    const tableRows = document.querySelectorAll('tbody tr');
    console.log(`Table Rows: ${tableRows.length} found`);
    
    if (tableRows.length === 0) {
      console.log('❌ No table rows found - UI might not be rendering work orders');
    } else {
      console.log('✅ Table rows found - UI is rendering work orders');
    }
    
    // Final diagnosis
    console.log('\n======= DIAGNOSIS =======');
    
    if (!activeUserId) {
      console.log('❌ CRITICAL: No active user ID found in localStorage');
    }
    
    if (dispenserCount === 0) {
      console.log('❌ CRITICAL: No dispenser data in dispenser_store.json');
    }
    
    if (tableRows.length === 0 && weekGroups.length > 0) {
      console.log('❌ CRITICAL: Week groups exist but no table rows - likely a rendering issue');
    }
    
    console.log('\n==== RECOMMENDED FIXES ====');
    console.log('1. Clear localStorage and reload the page');
    console.log('2. Run the fix-batch-system.bat script');
    console.log('3. Check the console for any JavaScript errors');
    
    console.log('\nDiagnostic complete!');
  })
  .catch(error => {
    console.error('Error during diagnostic:', error);
  });
})();
