/**
 * Logs Page for FossaWork V2
 * Real-time logging dashboard with advanced filtering and monitoring
 */

import React, { useState, useEffect } from 'react';
import { TestTube, Trash2, Download, Activity, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import LogViewer from '../components/LogViewer';
import LogViewerDemo from '../components/LogViewerDemo';
import { loggingService, logger, LogStats } from '../services/loggingService';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton } from '@/components/ui/animated-button';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

  const getConnectionStatusBadgeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (connectionStatus) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-slide-in-from-top">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold">
                <GradientText text="System Logs" gradient="from-blue-600 via-purple-600 to-pink-600" />
              </h1>
              <p className="text-muted-foreground mt-1">
                <AnimatedText text="Real-time logging dashboard for frontend and backend systems" animationType="split" delay={0.2} />
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge 
                variant={getConnectionStatusBadgeVariant()}
                className={connectionStatus === 'connected' ? 'badge-gradient' : ''}
              >
                Backend: {connectionStatus}
              </Badge>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <GlowCard className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-600/5 animate-scale-in" glowColor="rgba(59, 130, 246, 0.2)">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      <GradientText text={String(stats.totalLogs)} gradient="from-blue-600 to-blue-700" />
                    </div>
                    <div className="text-sm">Total Logs</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Session: {new Date(stats.sessionStart).toLocaleTimeString()}
                    </div>
                  </div>
                  <FileText className="w-8 h-8 text-blue-500 opacity-20" />
                </div>
              </GlowCard>
              <GlowCard className="p-4 bg-gradient-to-br from-red-500/5 to-red-600/5 animate-scale-in" style={{animationDelay: '0.1s'}} glowColor="rgba(239, 68, 68, 0.2)">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      <GradientText text={String(stats.errorCount)} gradient="from-red-600 to-red-700" />
                    </div>
                    <div className="text-sm">Errors</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {stats.errorCount > 0 ? 'Requires attention' : 'All clear'}
                    </div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
                </div>
              </GlowCard>
              <GlowCard className="p-4 bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 animate-scale-in" style={{animationDelay: '0.2s'}} glowColor="rgba(234, 179, 8, 0.2)">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      <GradientText text={String(stats.warningCount)} gradient="from-yellow-600 to-yellow-700" />
                    </div>
                    <div className="text-sm">Warnings</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {stats.warningCount > 0 ? 'Review recommended' : 'No warnings'}
                    </div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-20" />
                </div>
              </GlowCard>
              <GlowCard className="p-4 bg-gradient-to-br from-green-500/5 to-green-600/5 animate-scale-in" style={{animationDelay: '0.3s'}} glowColor="rgba(34, 197, 94, 0.2)">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {connectionStatus === 'connected' ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <Activity className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-sm">Backend Connection</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Real-time streaming
                    </div>
                  </div>
                </div>
              </GlowCard>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6 animate-slide-in-from-left" style={{animationDelay: '0.4s'}}>
            <AnimatedButton
              onClick={handleTestLogs}
              animation="shimmer"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Generate Test Logs
            </AnimatedButton>
            <AnimatedButton
              onClick={handleClearLogs}
              variant="destructive"
              animation="pulse"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Logs
            </AnimatedButton>
            <RippleButton
              onClick={handleExportLogs}
              variant="secondary"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Logs
            </RippleButton>
            <div className="flex items-center space-x-4 ml-auto">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBackendLogs}
                  onChange={(e) => setShowBackendLogs(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Backend Logs</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFrontendLogs}
                  onChange={(e) => setShowFrontendLogs(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Frontend Logs</span>
              </label>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <div className="animate-slide-in-from-right" style={{animationDelay: '0.5s'}}>
          <LogViewerDemo />
        </div>

        {/* Log Viewer */}
        <AnimatedCard animate="fade" delay={0.6} hover="none" className="glass-dark">
          <CardContent className="p-0">
            <LogViewer
              height="calc(100vh - 420px)"
              showBackendLogs={showBackendLogs}
              showFrontendLogs={showFrontendLogs}
              autoScroll={true}
            />
          </CardContent>
        </AnimatedCard>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-muted-foreground animate-fade-in" style={{animationDelay: '0.7s'}}>
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