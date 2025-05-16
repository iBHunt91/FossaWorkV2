import React from 'react';
import { FiDownload } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

// Create a simple function to download logs
const downloadFormLogs = () => {
  try {
    // Get logs from localStorage
    const logs = localStorage.getItem('form_automation_logs');
    if (!logs) {
      throw new Error('No logs found');
    }
    
    // Parse and format logs
    const parsedLogs = JSON.parse(logs);
    const formattedLogs = JSON.stringify(parsedLogs, null, 2);
    
    // Create a blob and download
    const blob = new Blob([formattedLogs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-automation-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error downloading logs:', error);
    return false;
  }
};

// Button component
const DownloadLogsButton: React.FC = () => {
  const { addToast } = useToast();
  
  const handleClick = () => {
    const success = downloadFormLogs();
    if (success) {
      addToast('success', 'Logs downloaded successfully');
    } else {
      addToast('error', 'Could not download logs. No logs found or an error occurred.');
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md shadow-sm transition-colors"
    >
      <FiDownload className="h-3 w-3" />
      <span>Download Logs</span>
    </button>
  );
};

export default DownloadLogsButton; 