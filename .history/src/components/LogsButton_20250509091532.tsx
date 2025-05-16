import React from 'react';
import { FiDownload } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

// Button component for downloading logs
const LogsButton: React.FC = () => {
  const { addToast } = useToast();
  
  const handleDownload = () => {
    try {
      // Get logs from localStorage
      const logs = localStorage.getItem('form_automation_logs');
      if (!logs) {
        addToast('warning', 'No logs found to download');
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
      
      addToast('success', 'Logs downloaded successfully');
    } catch (error) {
      console.error('Error downloading logs:', error);
      addToast('error', 'Failed to download logs');
    }
  };
  
  return (
    <button
      onClick={handleDownload}
      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded inline-flex items-center"
    >
      <FiDownload className="h-3 w-3 mr-1" />
      <span>Logs</span>
    </button>
  );
};

export default LogsButton; 