import React, { useState, useEffect, useRef } from 'react';
import { getScrapeLogs, LogEntry, getScrapeStatus, getDispenserScrapeStatus, ScrapeStatus } from '../services/scrapeService';

interface ScrapeLogsConsoleProps {
  type: 'workOrder' | 'dispenser';
  showHeader?: boolean;
  height?: string;
  autoScroll?: boolean;
}

const ScrapeLogsConsole: React.FC<ScrapeLogsConsoleProps> = ({
  type,
  showHeader = true,
  height = '400px',
  autoScroll = true
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const title = type === 'workOrder' ? 'Service Appointment Updates' : 'Equipment Data Updates';

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Fetch both the logs and the status
    const fetchData = async () => {
      try {
        setLoading(true);
        // Get the logs
        const logsData = await getScrapeLogs(type);
        setLogs(logsData);
        
        // Get the status
        const statusData = type === 'workOrder' 
          ? await getScrapeStatus()
          : await getDispenserScrapeStatus();
        setStatus(statusData);
        
        setError(null);
      } catch (err) {
        console.error(`Error fetching ${type} logs:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchData();

    // Set up polling
    intervalId = setInterval(fetchData, 2000);
    
    // Clean up function: clear interval when component unmounts OR when type changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [type, autoScroll]); // Add autoScroll to dependencies if it affects behavior tied to updates

  // Scroll to bottom when logs change
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
      {showHeader && (
        <div className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
          {status && (
            <div className="flex items-center">
              <span 
                className={`text-xs px-2 py-1 rounded-md mr-2 ${
                  status.status === 'running' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                    : status.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : status.status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                }`}
              >
                {status.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {status.progress}% {status.message}
              </span>
            </div>
          )}
        </div>
      )}
      
      <div 
        className="text-xs font-mono overflow-auto p-3 bg-black text-green-400" 
        style={{ height, maxHeight: height }}
      >
        {loading && logs.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">Loading logs...</div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400">Error: {error}</div>
        ) : logs.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">No logs available.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              <span className="text-blue-400 mr-2">[{formatTimestamp(log.timestamp)}]</span>
              <span className={log.message.toLowerCase().includes('error') ? 'text-red-400' : ''}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default ScrapeLogsConsole; 