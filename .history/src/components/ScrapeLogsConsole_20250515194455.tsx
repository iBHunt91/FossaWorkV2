import React, { useState, useEffect, useRef } from 'react';
import { getScrapeLogs, LogEntry, getScrapeStatus, getDispenserScrapeStatus, ScrapeStatus } from '../services/scrapeService';

interface ScrapeLogsConsoleProps {
  type: 'workOrder' | 'dispenser' | 'server' | 'formPrep';
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
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState<boolean>(false);

  // Set the title based on the type
  let title = 'Logs';
  if (type === 'workOrder') {
    title = 'Service Appointment Updates';
  } else if (type === 'dispenser') {
    title = 'Equipment Data Updates';
  } else if (type === 'server') {
    title = 'Server Logs';
  } else if (type === 'formPrep') {
    title = 'Form Prep Automation Logs';
  }

  const scrollToBottom = () => {
    // Only scroll to bottom if autoScroll is enabled and user hasn't manually scrolled up
    if (autoScroll && logsEndRef.current && !userHasScrolled) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle scroll events to detect if user has manually scrolled up
  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      // Check if we're near the bottom (within 20px)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
      
      // Update user scroll state based on scroll position
      setUserHasScrolled(!isAtBottom);
    }
  };

  // Reset the userHasScrolled state when switching log types
  useEffect(() => {
    setUserHasScrolled(false);
  }, [type]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Fetch both the logs and the status
    const fetchData = async () => {
      try {
        setLoading(true);
        // Get the logs
        const logsData = await getScrapeLogs(type);
        setLogs(logsData);
        
        // Get the status (only for workOrder and dispenser types, as formPrep status is handled differently)
        if (type === 'workOrder') {
          const statusData = await getScrapeStatus();
          setStatus(statusData);
        } else if (type === 'dispenser') {
          const statusData = await getDispenserScrapeStatus();
          setStatus(statusData);
        } else {
          // For server and formPrep logs, we don't have the same kind of status
          setStatus(null);
        }
        
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

  // Scroll to bottom when logs change, respecting user's scroll position
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Determine message type for styling and icons
  const getMessageType = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error')) return 'error';
    if (lowerMessage.includes('warn')) return 'warn';
    if (lowerMessage.includes('success') || lowerMessage.includes('completed')) return 'success';
    if (lowerMessage.includes('start') || lowerMessage.includes('initialize')) return 'info';
    return 'default';
  };

  // Get icon for log message type
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      default:
        return '▪️';
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
      {showHeader && (
        <div className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
            {loading && (
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {userHasScrolled && (
              <button
                onClick={() => {
                  setUserHasScrolled(false);
                  scrollToBottom();
                }}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
              >
                Jump to Latest
              </button>
            )}
            {status && (
              <div className="flex items-center">
                <span 
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    status.status === 'running' 
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300' 
                      : status.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300'
                      : status.status === 'error'
                      ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-900/60 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {status.status.toUpperCase()}
                </span>
                <div className="ml-2 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 w-20">
                  <div 
                    className={`h-1.5 rounded-full ${
                      status.status === 'running' ? 'bg-blue-500' : 
                      status.status === 'completed' ? 'bg-green-500' : 
                      status.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                    }`} 
                    style={{ width: `${status.progress}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                  {status.progress}% {status.message}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div 
        ref={logsContainerRef}
        className="text-xs font-mono overflow-auto p-0 bg-gray-900 text-gray-200 border border-gray-700" 
        style={{ height, maxHeight: height }}
        onScroll={handleScroll}
      >
        {loading && logs.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              <div className="w-4 h-4 mr-2 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></div>
              Loading logs...
            </div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-red-500 dark:text-red-400 flex items-center">
              <span className="mr-2">❌</span>
              Error: {error}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400">No logs available</div>
          </div>
        ) : (
          <div className="p-3">
            {[...logs].reverse().map((log, index) => {
              const messageType = getMessageType(log.message);
              return (
                <div key={index} className={`mb-1.5 pl-5 relative border-l-2 ${
                  messageType === 'error' ? 'border-red-500' :
                  messageType === 'warn' ? 'border-yellow-500' :
                  messageType === 'success' ? 'border-green-500' :
                  messageType === 'info' ? 'border-blue-500' :
                  'border-gray-700'
                }`}>
                  <div className="flex items-start">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono mr-2">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className={`${
                      messageType === 'error' ? 'text-red-400' : 
                      messageType === 'warn' ? 'text-yellow-400' : 
                      messageType === 'success' ? 'text-green-400' :
                      messageType === 'info' ? 'text-blue-400' :
                      'text-gray-300'
                    } break-words`}>
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ScrapeLogsConsole; 