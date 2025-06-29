// TEMPORARY FIX: Paste this in browser console to override the Pushover test behavior

// Find and override the Pushover test button click handler
document.addEventListener('click', async (e) => {
  // Check if this is a Pushover test button click
  const button = e.target.closest('button');
  if (!button) return;
  
  const buttonText = button.textContent || '';
  if (buttonText.includes('Pushover') && !buttonText.includes('Email')) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔧 Intercepted Pushover test click - using override handler');
    
    // Disable button
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span>Testing...</span>';
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:8000/api/notifications/test/pushover', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('Pushover test response:', data);
      
      // Find the alert div and update it
      const alertDiv = document.querySelector('[role="alert"]');
      if (alertDiv) {
        const isSuccess = data.success === true || 
                         (data.results && data.results.pushover === true);
        
        if (isSuccess) {
          alertDiv.className = alertDiv.className.replace('border-red-500', 'border-green-500');
          alertDiv.className = alertDiv.className.replace('bg-red-50', 'bg-green-50');
          alertDiv.querySelector('div').textContent = '✅ Pushover test sent successfully!';
        } else {
          alertDiv.querySelector('div').textContent = `❌ Test failed: ${data.message || 'Check console for details'}`;
        }
        
        // Hide after 3 seconds
        setTimeout(() => {
          alertDiv.style.display = 'none';
        }, 3000);
      }
      
    } catch (error) {
      console.error('Test error:', error);
      const alertDiv = document.querySelector('[role="alert"]');
      if (alertDiv) {
        alertDiv.querySelector('div').textContent = `❌ Test failed: ${error.message}`;
      }
    } finally {
      // Re-enable button
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  }
}, true);

console.log('✅ Pushover test override installed - try clicking the test button now');