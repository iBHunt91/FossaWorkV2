import React from 'react';
import { FiDownload } from 'react-icons/fi';

// Simple component with no TypeScript complexity
function FixedLogsButton() {
  const handleDownload = () => {
    try {
      // Get logs from localStorage
      const logs = localStorage.getItem('form_automation_logs');
      if (!logs) {
        alert('No logs found to download');
        return;
      }
      
      // Parse and format logs
      const parsedLogs = JSON.parse(logs);
      const formattedLogs = JSON.stringify(parsedLogs, null, 2);
      
      // Create a blob and download
      const blob = new Blob([formattedLogs], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Logs downloaded successfully');
    } catch (error) {
      console.error('Error downloading logs:', error);
      alert('Failed to download logs: ' + error.message);
    }
  };
  
  return (
    <button
      onClick={handleDownload}
      style={{
        fontSize: '0.75rem',
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        display: 'inline-flex',
        alignItems: 'center',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      <FiDownload style={{ height: '0.75rem', width: '0.75rem', marginRight: '0.25rem' }} />
      <span>Download Logs</span>
    </button>
  );
}

export default FixedLogsButton; 