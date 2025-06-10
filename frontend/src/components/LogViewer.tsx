/**
 * Real-time Log Viewer Component for FossaWork V2
 * Displays frontend and backend logs with filtering and real-time updates
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { loggingService, LogEntry, LogStats, logger } from '../services/loggingService';

interface LogViewerProps {
  height?: string;
  showBackendLogs?: boolean;
  showFrontendLogs?: boolean;
  autoScroll?: boolean;
}

const LogViewer: React.FC<LogViewerProps> = ({
  height = '400px',
  showBackendLogs = true,
  showFrontendLogs = true,
  autoScroll = true
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [filter, setFilter] = useState({
    level: '' as LogEntry['level'] | '',
    logger: '',
    search: ''
  });
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const [connectionStatus, setConnectionStatus] = useState(loggingService.getConnectionStatus());
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  // Load initial logs and stats
  useEffect(() => {
    const loadLogs = () => {
      const allLogs = loggingService.getLogs();
      const filteredLogs = allLogs.filter(log => {
        if (!showBackendLogs && log.logger.startsWith('backend.')) return false;
        if (!showFrontendLogs && log.logger.startsWith('frontend.')) return false;
        return true;
      });
      setLogs(filteredLogs);
      setStats(loggingService.getStats());
    };

    loadLogs();

    // Set up real-time log listener
    const logListener = (newLog: LogEntry) => {
      loadLogs(); // Reload all logs to maintain filtering
    };

    loggingService.addLogListener(logListener);

    // Update connection status periodically
    const statusInterval = setInterval(() => {
      setConnectionStatus(loggingService.getConnectionStatus());
    }, 1000);

    // Cleanup
    return () => {
      loggingService.removeLogListener(logListener);
      clearInterval(statusInterval);
    };
  }, [showBackendLogs, showFrontendLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScrollEnabled && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAutoScrollEnabled]);

  // Filter logs based on current filter settings
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filter.level && log.level !== filter.level) return false;
      if (filter.logger && !log.logger.toLowerCase().includes(filter.logger.toLowerCase())) return false;
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchTerm) ||
          log.logger.toLowerCase().includes(searchTerm) ||
          (log.data && JSON.stringify(log.data).toLowerCase().includes(searchTerm))
        );
      }
      return true;
    });
  }, [logs, filter]);

  const getLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      case 'debug': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getLevelIcon = (level: LogEntry['level']): string => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🐛';
      default: return '📝';
    }
  };

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = (): string => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '⚪';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const handleClearLogs = () => {
    loggingService.clearLogs();
    logger.userAction('Clear logs', { component: 'LogViewer' });
  };

  const handleExportLogs = () => {
    const exportData = loggingService.exportLogs();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fossawork-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.userAction('Export logs', { 
      component: 'LogViewer', 
      logCount: logs.length 
    });
  };

  const handleReconnect = () => {
    loggingService.reconnectToBackend();
    logger.userAction('Reconnect to backend logs', { component: 'LogViewer' });
  };

  const toggleAutoScroll = () => {
    setIsAutoScrollEnabled(!isAutoScrollEnabled);
    logger.userAction('Toggle auto-scroll', { 
      component: 'LogViewer', 
      enabled: !isAutoScrollEnabled 
    });
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Real-time Logs</h3>
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${getConnectionStatusColor()}`}>
              {getConnectionStatusIcon()} Backend: {connectionStatus}
            </span>
            {connectionStatus !== 'connected' && (
              <button
                onClick={handleReconnect}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.totalLogs}</div>
              <div className="text-gray-600">Total Logs</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-red-600">{stats.errorCount}</div>
              <div className="text-gray-600">Errors</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-yellow-600">{stats.warningCount}</div>
              <div className="text-gray-600">Warnings</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{filteredLogs.length}</div>
              <div className="text-gray-600">Filtered</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={filter.level}
            onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value as LogEntry['level'] | '' }))}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>

          <input
            type="text"
            placeholder="Filter by logger..."
            value={filter.logger}
            onChange={(e) => setFilter(prev => ({ ...prev, logger: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          />

          <input
            type="text"
            placeholder="Search messages..."
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          />

          <div className="flex space-x-2">
            <button
              onClick={toggleAutoScroll}
              className={`px-3 py-1 text-sm rounded ${
                isAutoScrollEnabled 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Auto-scroll
            </button>
            <button
              onClick={handleClearLogs}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
            <button
              onClick={handleExportLogs}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Log Container */}
      <div 
        ref={logContainerRef}
        className="overflow-y-auto font-mono text-xs"
        style={{ height }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No logs match the current filter criteria
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={`p-2 hover:bg-gray-50 cursor-pointer ${
                  selectedLogIndex === index ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => setSelectedLogIndex(selectedLogIndex === index ? null : index)}
              >
                <div className="flex items-start space-x-3">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                    {getLevelIcon(log.level)} {log.level.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-xs">{formatTimestamp(log.timestamp)}</span>
                  <span className="text-purple-600 text-xs font-medium">{log.logger}</span>
                  <div className="flex-1">
                    <div className="text-gray-900">{log.message}</div>
                    {selectedLogIndex === index && (
                      <div className="mt-2 space-y-1 text-gray-600">
                        {log.module && (
                          <div><strong>Module:</strong> {log.module}:{log.line}</div>
                        )}
                        {log.function && (
                          <div><strong>Function:</strong> {log.function}</div>
                        )}
                        {log.data && (
                          <div>
                            <strong>Data:</strong>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.exception && (
                          <div>
                            <strong>Exception:</strong>
                            <pre className="mt-1 p-2 bg-red-100 rounded text-xs overflow-x-auto text-red-800">
                              {log.exception}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;