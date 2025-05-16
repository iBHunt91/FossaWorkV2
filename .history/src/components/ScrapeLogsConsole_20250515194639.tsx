import React, { useState, useEffect, useRef } from 'react';
import { FiFilter, FiClock, FiSearch, FiRefreshCw, FiX } from 'react-icons/fi';
import { getScrapeLogs, LogEntry, getScrapeStatus, getDispenserScrapeStatus, ScrapeStatus } from '../services/scrapeService';

interface ScrapeLogsConsoleProps {
  type: 'workOrder' | 'dispenser' | 'server' | 'formPrep' | 'dev';
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
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState<boolean>(false);

  // Available log types for filtering
  const filterTypes = [
    { id: 'error', label: 'Errors', color: 'bg-red-500' },
    { id: 'warn', label: 'Warnings', color: 'bg-yellow-500' },
    { id: 'success', label: 'Success', color: 'bg-green-500' },
    { id: 'info', label: 'Info', color: 'bg-blue-500' },
    { id: 'network', label: 'Network', color: 'bg-purple-500' },
    { id: 'progress', label: 'Progress', color: 'bg-cyan-500' },
    { id: 'debug', label: 'Debug', color: 'bg-gray-500' }
  ];

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
  } else if (type === 'dev') {
    title = 'Developer Console Logs';
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
    setSearchQuery('');
    setActiveFilters([]);
  }, [type]);

  // Apply filters to logs
  useEffect(() => {
    let result = [...logs];
    
    // Apply text search if there's a query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(query) || 
        new Date(log.timestamp).toLocaleString().toLowerCase().includes(query)
      );
    }
    
    // Apply type filters if any are active
    if (activeFilters.length > 0) {
      result = result.filter(log => {
        const messageType = getMessageType(log.message);
        return activeFilters.includes(messageType);
      });
    }
    
    setFilteredLogs(result);
  }, [logs, searchQuery, activeFilters]);

  // Toggle a filter
  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter(f => f !== filter));
    } else {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchData();
    setLastRefresh(new Date());
  };

  // Fetch logs data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Special case for dev logs - don't try to fetch from server as it's not supported yet
      if (type === 'dev') {
        // Get in-memory logs for dev console
        import('../services/scrapeService').then(({ getDevLogs }) => {
          const devLogsData = getDevLogs();
          
          // Ensure logs are sorted by timestamp (oldest first) to make sure new messages appear at the bottom
          const sortedLogs = [...devLogsData].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB; // Ascending order (oldest first)
          });
          
          setLogs(sortedLogs);
          setStatus(null);
          setError(null);
          
          // Force scroll to bottom after logs are updated
          setTimeout(() => {
            if (autoScroll && !userHasScrolled) {
              scrollToBottom();
            }
          }, 100);
        });
      } else {
        // For all other log types, fetch from server
        const logsData = await getScrapeLogs(type);
        
        // Ensure logs are sorted by timestamp (oldest first) to make sure new messages appear at the bottom
        const sortedLogs = [...logsData].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB; // Ascending order (oldest first)
        });
        
        setLogs(sortedLogs);
        
        // Get the status (only for workOrder, dispenser, and formPrep types)
        if (type === 'workOrder') {
          const statusData = await getScrapeStatus();
          setStatus(statusData);
        } else if (type === 'dispenser') {
          const statusData = await getDispenserScrapeStatus();
          setStatus(statusData);
        } else {
          // For server logs and formPrep logs, we don't have status
          setStatus(null);
        }
        
        setError(null);
        
        // Force scroll to bottom after logs are updated
        setTimeout(() => {
          if (autoScroll && !userHasScrolled) {
            scrollToBottom();
          }
        }, 100);
      }
    } catch (err) {
      console.error(`Error fetching ${type} logs:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchData();
    
    // For non-dev log types, set up automatic refresh interval
    let refreshIntervalId: NodeJS.Timeout | null = null;
    
    if (type !== 'dev') {
      refreshIntervalId = setInterval(() => {
        fetchData();
      }, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (refreshIntervalId) clearInterval(refreshIntervalId);
    };
  }, [type]);

  // Add special effect for dev logs to subscribe to changes
  useEffect(() => {
    if (type === 'dev') {
      // Import the dev log event system and subscribe to changes
      import('../services/scrapeService').then(({ addDevLogListener }) => {
        // Create a function to fetch the latest logs when changes occur
        const handleDevLogsChange = () => {
          fetchData();
        };
        
        // Register the listener and get the cleanup function
        const removeListener = addDevLogListener(handleDevLogsChange);
        
        // Fetch logs immediately
        fetchData();
        
        // Clean up the listener when component unmounts
        return () => {
          removeListener();
        };
      });
    }
  }, [type]);

  // Initialize logs if empty for server, formPrep and dev
  useEffect(() => {
    if ((type === 'server' || type === 'formPrep' || type === 'dev') && logs.length === 0) {
      // Import systemLogs to create initial logs
      import('../services/scrapeService').then(({ systemLogs }) => {
        setTimeout(() => {
          if (logs.length === 0) {
            if (type === 'server') {
              systemLogs.server.info('Server initialized');
              systemLogs.server.success('Database connection established');
              systemLogs.server.info('API endpoints registered');
              systemLogs.server.debug('Server environment settings loaded', {
                version: '1.0',
                environment: process.env.NODE_ENV || 'production'
              });
              systemLogs.server.system('System monitoring active', {
                uptime: process.uptime ? process.uptime() : 'N/A'
              });
            } else if (type === 'formPrep') {
              systemLogs.formPrep.info('Form preparation module initialized');
              systemLogs.formPrep.success('Template loaded successfully');
              systemLogs.formPrep.info('Ready to process form data');
              systemLogs.formPrep.debug('Form template configuration loaded', {
                templateVersion: '1.2.0',
                fields: 12,
                requiredFields: 8
              });
              systemLogs.formPrep.system('Form automation processing active', {
                mode: 'automatic'
              });
            } else if (type === 'dev') {
              systemLogs.dev.info('Dev Console initialized');
              systemLogs.dev.success('Development environment ready');
              systemLogs.dev.debug('Application version', {
                version: process.env.REACT_APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
              });
              systemLogs.dev.system('System information', {
                platform: navigator.platform,
                userAgent: navigator.userAgent
              });
            }
          }
        }, 500);
      });
    }

    // The polling is now handled in separate useEffect hooks above
    // No need to set up additional interval here
    
    // Clean up function for initialization effect
    return () => {
      // No intervals to clean up here
    };
  }, [type, autoScroll]);

  // Scroll to bottom when logs change, respecting user's scroll position
  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  // Format the timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Get current date for comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Determine if this is from today, yesterday, or earlier
    const isToday = date >= today;
    const isYesterday = date >= yesterday && date < today;
    
    // Format time as HH:MM:SS
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (isToday) {
      return `Today ${time}`;
    } else if (isYesterday) {
      return `Yesterday ${time}`;
    } else {
      // Format date as MM/DD HH:MM:SS for older entries
      return date.toLocaleString([], { 
        month: 'numeric', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    }
  };

  // Determine message type for styling and icons
  const getMessageType = (message: string) => {
    // First check if the message already has an emoji prefix added by the server
    if (message.match(/^[\p{Emoji}\u200d]+\s+/u)) {
      // Extract the emoji
      const emojiMatch = message.match(/^([\p{Emoji}\u200d]+)\s+/u);
      if (emojiMatch && emojiMatch[1]) {
        const emoji = emojiMatch[1].trim();
        
        // Map known emojis to their message types
        switch(emoji) {
          case '❌':
            return 'error';
          case '⚠️':
            return 'warn';
          case '✅':
            return 'success';
          case 'ℹ️':
          case '🔧':
          case '🌐':
          case '⚙️':
            return 'info';
          case '⏳':
          case '🔄':
          case '🚀':
            return 'progress';
          default:
            return 'default';
        }
      }
    }
    
    // Check if message contains severity indicators in square brackets
    if (message.match(/^\[.*?\]/)) {
      const severityMatch = message.match(/^\[(.*?)\]/);
      if (severityMatch && severityMatch[1]) {
        const severity = severityMatch[1].trim().toUpperCase();
        
        switch(severity) {
          case 'ERROR':
            return 'error';
          case 'WARN':
          case 'WARNING':
            return 'warn';
          case 'SUCCESS':
            return 'success';
          case 'INFO':
          case 'SYSTEM':
            return 'info';
          case 'NETWORK':
            return 'network';
          case 'DEBUG':
            return 'debug';
          case 'PROGRESS':
          case 'STATUS':
            return 'progress';
          default:
            return 'default';
        }
      }
    }
    
    // Fall back to content-based detection if no emoji prefix or square brackets
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error')) return 'error';
    if (lowerMessage.includes('warn')) return 'warn';
    if (lowerMessage.includes('success') || lowerMessage.includes('completed')) return 'success';
    if (lowerMessage.includes('start') || lowerMessage.includes('initialize')) return 'info';
    if (lowerMessage.includes('progress') || lowerMessage.includes('processing')) return 'progress';
    return 'default';
  };

  // Get icon for log message type
  const getMessageIcon = (type: string) => {
    // If message already has an emoji, don't add another
    if (type.match(/^[\p{Emoji}\u200d]+\s+/u)) {
      return '';
    }
    
    switch (type) {
      case 'error':
        return '❌ ';
      case 'warn':
        return '⚠️ ';
      case 'success':
        return '✅ ';
      case 'info':
        return 'ℹ️ ';
      case 'network':
        return '🌐 ';
      case 'progress':
        return '⏳ ';
      case 'debug':
        return '🔍 ';
      default:
        return '';
    }
  };

  // Parse message to enhance displayed content
  const parseMessageContent = (message: string, messageType: string) => {
    // Check if the message contains JSON data in parentheses
    const dataMatch = message.match(/\((.*?)\)$/);
    if (dataMatch && dataMatch[1]) {
      // Try to extract key-value pairs
      const kvPairs = dataMatch[1].split(', ');
      const isStructured = kvPairs.some(pair => pair.includes(': '));
      
      if (isStructured) {
        // Remove the data portion from the main message
        const mainMessage = message.replace(/\s?\(.*?\)$/, '');
        
        return (
          <div>
            <div>{mainMessage}</div>
            <div className="mt-1 ml-2 text-xs grid grid-cols-1 gap-1">
              {kvPairs.map((pair, i) => {
                const [key, value] = pair.split(': ');
                if (!key || !value) return null;
                
                return (
                  <div key={i} className="flex">
                    <span className="font-semibold text-gray-400 mr-2">{key}:</span>
                    <span>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    }
    
    // Check for URLs in the message and make them clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(message)) {
      const parts = message.split(urlRegex);
      const elements = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // Regular text
          elements.push(<span key={i}>{parts[i]}</span>);
        } else {
          // URL
          elements.push(
            <a 
              key={i} 
              href={parts[i]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {parts[i]}
            </a>
          );
        }
      }
      
      return <>{elements}</>;
    }
    
    // Handle messages with severity indicators
    if (message.match(/^\[.*?\]/)) {
      const parts = message.split(/^\[(.*?)\]/);
      if (parts.length >= 2) {
        return (
          <>
            <span className={`font-semibold px-1.5 py-0.5 text-xs rounded ${
              messageType === 'error' ? 'bg-red-500/20 text-red-300' : 
              messageType === 'warn' ? 'bg-yellow-500/20 text-yellow-300' : 
              messageType === 'success' ? 'bg-green-500/20 text-green-300' :
              messageType === 'info' ? 'bg-blue-500/20 text-blue-300' :
              messageType === 'network' ? 'bg-purple-500/20 text-purple-300' :
              messageType === 'progress' ? 'bg-cyan-500/20 text-cyan-300' :
              messageType === 'debug' ? 'bg-gray-500/20 text-gray-300' :
              'bg-gray-500/20 text-gray-300'
            } mr-2`}>[{parts[1]}]</span>
            <span>{parts[2] || ''}</span>
          </>
        );
      }
    }
    
    // Default case, just return the message
    return message;
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
      {showHeader && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
              {loading && (
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                <FiClock className="inline-block mr-1" />
                <span>Updated: {lastRefresh.toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleRefresh}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Refresh logs"
              >
                <FiRefreshCw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 ${
                  showFilters || activeFilters.length > 0 
                    ? 'text-blue-500 dark:text-blue-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                title="Filter logs"
              >
                <FiFilter className="w-4 h-4" />
                {activeFilters.length > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full">
                    {activeFilters.length}
                  </span>
                )}
              </button>
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
          
          {/* Filter and search bar */}
          {showFilters && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex flex-col gap-2">
              <div className="flex items-center relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in logs..."
                  className="block w-full pl-10 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {searchQuery && (
                  <button 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                    onClick={() => setSearchQuery('')}
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Filter by:</span>
                {filterTypes.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id)}
                    className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${
                      activeFilters.includes(filter.id)
                        ? `${filter.color} text-white`
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {filter.label}
                    {activeFilters.includes(filter.id) && (
                      <span className="ml-1">✓</span>
                    )}
                  </button>
                ))}
                
                {(activeFilters.length > 0 || searchQuery) && (
                  <button
                    onClick={clearFilters}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500 ml-auto"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div 
        ref={logsContainerRef}
        className="text-xs font-mono overflow-auto p-0 bg-gray-900 text-gray-200 border border-gray-700" 
        style={{ height, maxHeight: height }}
        onScroll={handleScroll}
      >
        {loading && filteredLogs.length === 0 ? (
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
        ) : filteredLogs.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400">
              {searchQuery || activeFilters.length > 0 
                ? 'No logs match the current filters' 
                : 'No logs available'}
            </div>
          </div>
        ) : (
          <div className="p-3">
            {[...filteredLogs].map((log, index) => {
              const messageType = getMessageType(log.message);
              return (
                <div 
                  key={index} 
                  className={`mb-3 pl-5 relative border-l-2 ${
                    messageType === 'error' ? 'border-red-500' :
                    messageType === 'warn' ? 'border-yellow-500' :
                    messageType === 'success' ? 'border-green-500' :
                    messageType === 'info' ? 'border-blue-500' :
                    messageType === 'network' ? 'border-purple-500' :
                    messageType === 'progress' ? 'border-cyan-500' :
                    messageType === 'debug' ? 'border-gray-500' :
                    'border-gray-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-start">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono mr-2 whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className={`${
                        messageType === 'error' ? 'text-red-400' : 
                        messageType === 'warn' ? 'text-yellow-400' : 
                        messageType === 'success' ? 'text-green-400' :
                        messageType === 'info' ? 'text-blue-400' :
                        messageType === 'network' ? 'text-purple-400' :
                        messageType === 'progress' ? 'text-cyan-400' :
                        messageType === 'debug' ? 'text-gray-400' :
                        'text-gray-300'
                      } break-words flex-grow`}>
                        {/* If message doesn't start with an emoji, add one based on type */}
                        {!log.message.match(/^[\p{Emoji}\u200d]+\s+/u) && getMessageIcon(messageType)}
                        {parseMessageContent(log.message, messageType)}
                      </span>
                    </div>
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