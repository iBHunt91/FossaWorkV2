/**
 * Logs Page for FossaWork V2
 * Real-time logging dashboard with advanced filtering and monitoring
 */

import React, { useState, useEffect } from 'react';
import LogViewer from '../components/LogViewer';
import LogViewerDemo from '../components/LogViewerDemo';
import { loggingService, logger, LogStats } from '../services/loggingService';

const LogsPage: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState(loggingService.getConnectionStatus());
  const [stats, setStats] = useState<LogStats | null>(null);
  const [showBackendLogs, setShowBackendLogs] = useState(true);
  const [showFrontendLogs, setShowFrontendLogs] = useState(true);

  useEffect(() => {
    logger.componentLifecycle('LogsPage', 'mount');
    logger.userAction('View logs page');

    // Update stats periodically
    const updateStats = () => {
      setStats(loggingService.getStats());
      setConnectionStatus(loggingService.getConnectionStatus());
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => {
      clearInterval(interval);
      logger.componentLifecycle('LogsPage', 'unmount');
    };
  }, []);

  const handleTestLogs = () => {
    // Generate test logs to demonstrate functionality
    logger.debug('test.logs', '🐛 This is a test debug message');
    logger.info('test.logs', 'ℹ️ This is a test info message with data', { 
      testData: 'sample data',
      timestamp: new Date().toISOString()
    });
    logger.warn('test.logs', '⚠️ This is a test warning message');
    
    // Simulate an error
    try {
      throw new Error('This is a test error - not a real problem!');
    } catch (error) {
      logger.error('test.logs', '❌ Test error caught', { error: error.message });
    }

    logger.userAction('Generate test logs', { component: 'LogsPage' });
  };

  const handleClearLogs = () => {
    loggingService.clearLogs();
    logger.userAction('Clear all logs', { component: 'LogsPage' });
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
    
    logger.userAction('Export logs', { component: 'LogsPage' });
  };

  const getConnectionStatusBadge = () => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium";
    switch (connectionStatus) {
      case 'connected':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'connecting':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'disconnected':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
              <p className="text-gray-600 mt-1">
                Real-time logging dashboard for frontend and backend systems
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={getConnectionStatusBadge()}>
                Backend: {connectionStatus}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">{stats.totalLogs}</div>
                <div className="text-sm text-gray-600">Total Logs</div>
                <div className="text-xs text-gray-500 mt-1">
                  Session started: {new Date(stats.sessionStart).toLocaleTimeString()}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-red-600">{stats.errorCount}</div>
                <div className="text-sm text-gray-600">Errors</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.errorCount > 0 ? 'Requires attention' : 'All clear'}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-yellow-600">{stats.warningCount}</div>
                <div className="text-sm text-gray-600">Warnings</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.warningCount > 0 ? 'Review recommended' : 'No warnings'}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">
                  {connectionStatus === 'connected' ? '✓' : '✗'}
                </div>
                <div className="text-sm text-gray-600">Backend Connection</div>
                <div className="text-xs text-gray-500 mt-1">
                  Real-time streaming
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleTestLogs}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🧪 Generate Test Logs
            </button>
            <button
              onClick={handleClearLogs}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              🧹 Clear All Logs
            </button>
            <button
              onClick={handleExportLogs}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              📤 Export Logs
            </button>
            <div className="flex items-center space-x-4 ml-auto">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showBackendLogs}
                  onChange={(e) => setShowBackendLogs(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Backend Logs</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showFrontendLogs}
                  onChange={(e) => setShowFrontendLogs(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Frontend Logs</span>
              </label>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <LogViewerDemo />

        {/* Log Viewer */}
        <LogViewer
          height="calc(100vh - 420px)"
          showBackendLogs={showBackendLogs}
          showFrontendLogs={showFrontendLogs}
          autoScroll={true}
        />

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Frontend logging is fully operational. Backend logging will stream automatically when backend is available.
          </p>
          <p className="mt-1">
            {connectionStatus === 'connected' 
              ? '🟢 Real-time backend streaming active' 
              : '📱 Operating in frontend-only mode'
            }
          </p>
          <p className="mt-1">
            Logs clear when frontend refreshes. Export logs to preserve them permanently.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;