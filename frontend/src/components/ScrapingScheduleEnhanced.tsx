import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Play, Pause, RefreshCw, Calendar, AlertCircle, CheckCircle,
  Activity, Zap, Info, Settings, History, TrendingUp, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Timer, CalendarClock,
  PowerOff, Power, Cpu, Database, WifiOff, Wifi, Eye, EyeOff,
  Copy, ClipboardCopy, ChevronDown, ChevronRight
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { formatUTCToLocal, formatDuration, getRelativeTime } from '../utils/dateFormat';

interface Schedule {
  id: number;
  user_id: string;
  schedule_type: string;
  interval_hours: number;
  active_hours: { start: number; end: number } | null;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
  status: string; // "active", "paused", "failed"
}

interface ScrapingHistoryItem {
  id: number;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  items_processed: number;
  error_message: string | null;
  duration_seconds: number | null;
  trigger_type?: string;
  has_error_log?: boolean;
}

interface DaemonStatus {
  daemon_status: string;
  scheduler_running: boolean;
  last_execution: string | null;
  total_schedules: number;
  active_schedules: number;
  message: string;
  jobs?: Array<{
    id: string;
    name: string;
    next_run_time: string;
    trigger: string;
  }>;
}

const ScrapingScheduleEnhanced: React.FC = () => {
  const { isAuthenticated, token, user } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [history, setHistory] = useState<ScrapingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [intervalHours, setIntervalHours] = useState(1);
  const [activeHoursStart, setActiveHoursStart] = useState(6);
  const [activeHoursEnd, setActiveHoursEnd] = useState(22);
  const [useActiveHours, setUseActiveHours] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserSettingsLoading, setBrowserSettingsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(() => {
    const saved = localStorage.getItem('scrapingHistoryCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    
    fetchData();
    
    // Dynamic polling interval based on sync status
    const pollInterval = syncProgress?.status === 'in_progress' ? 1000 : 10000;
    
    const interval = setInterval(() => {
      fetchData();
      
      // Also fetch progress if a sync is running or we have progress
      if (syncProgress || isRunning) {
        fetchSyncProgress();
      }
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, token, syncProgress?.status, isRunning]);

  // Update countdown timer
  useEffect(() => {
    if (!schedule?.next_run || !schedule?.enabled) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const nextRun = new Date(schedule.next_run!);
      const diff = nextRun.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown('Running now...');
        setIsRunning(true);
        return;
      }
      
      setIsRunning(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, [schedule?.next_run, schedule?.enabled]);

  // Update isRunning based on sync progress
  useEffect(() => {
    if (syncProgress?.status === 'in_progress') {
      setIsRunning(true);
    } else if (syncProgress?.status === 'completed' || syncProgress?.status === 'failed') {
      setIsRunning(false);
    }
  }, [syncProgress?.status]);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const fetchData = async () => {
    // Don't fetch history during active sync to prevent premature entries
    const promises = [
      fetchSchedule(),
      fetchDaemonStatus(),
      fetchBrowserSettings(),
      fetchSyncProgress()
    ];
    
    // Only fetch history if not actively syncing
    if (!syncProgress || syncProgress.status !== 'in_progress') {
      promises.push(fetchHistory());
    }
    
    await Promise.all(promises);
  };

  const fetchSchedule = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/', {
        timeout: 30000 // Increase timeout to 30 seconds for this endpoint
      });
      
      if (response.data && response.data.length > 0) {
        const scheduleData = response.data[0];
        setSchedule(scheduleData);
        
        setIntervalHours(scheduleData.interval_hours || 1);
        
        if (scheduleData.active_hours) {
          setUseActiveHours(true);
          setActiveHoursStart(scheduleData.active_hours.start || 6);
          setActiveHoursEnd(scheduleData.active_hours.end || 22);
        } else {
          setUseActiveHours(false);
        }
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      setErrorMessage('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!schedule) return;
    
    try {
      const response = await apiClient.get(`/api/scraping-schedules/${schedule.id}/history`, {
        timeout: 30000 // Increase timeout to 30 seconds
      });
      setHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchDaemonStatus = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/status/daemon', {
        timeout: 10000 // 10 seconds for daemon status
      });
      setDaemonStatus(response.data);
    } catch (error) {
      console.error('Error fetching daemon status:', error);
    }
  };

  const fetchBrowserSettings = async () => {
    if (!isAuthenticated || !token || !user) return;
    
    try {
      const response = await apiClient.get(`/api/settings/browser/${user.id}`, {
        timeout: 10000 // 10 seconds for browser settings
      });
      if (response.data?.settings) {
        // Check for show_browser_during_sync flag first, then fallback to inverse of headless
        if ('show_browser_during_sync' in response.data.settings) {
          setBrowserVisible(response.data.settings.show_browser_during_sync);
        } else {
          setBrowserVisible(!response.data.settings.headless);
        }
      }
    } catch (error) {
      console.error('Error fetching browser settings:', error);
    }
  };

  const fetchSyncProgress = async () => {
    if (!isAuthenticated || !token || !user) return;
    
    try {
      const response = await apiClient.get(`/api/v1/work-orders/scrape/progress/${user.id}`, {
        timeout: 5000 // 5 seconds for progress check
      });
      const progress = response.data;
      
      setSyncProgress(progress);
      
      // If sync is completed or failed, wait a bit then refresh history
      if (progress.status === 'completed' || progress.status === 'failed') {
        // Clear the progress polling interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        // Keep showing progress for a moment before clearing
        setTimeout(() => {
          setSyncProgress(null);
          fetchHistory();
          fetchSchedule();
        }, 1500);
        
        // Show appropriate message
        if (progress.status === 'completed') {
          setStatusMessage(`Sync completed successfully. ${progress.work_orders_found || 0} work orders processed.`);
        } else if (progress.status === 'failed' && progress.error) {
          setErrorMessage(`Sync failed: ${progress.error}`);
        }
      }
    } catch (error) {
      // Progress endpoint returns 404 when no sync is running, which is normal
      if (error.response?.status === 404) {
        // If we were tracking progress and now it's 404, sync might have completed
        if (syncProgress) {
          setSyncProgress(null);
          fetchHistory();
        }
      } else if (error.response?.status !== 404) {
        console.error('Error fetching sync progress:', error);
      }
    }
  };

  const updateBrowserVisibility = async (visible: boolean) => {
    if (!isAuthenticated || !token || !user) return;
    
    setBrowserSettingsLoading(true);
    try {
      // First get current browser settings
      const currentSettings = await apiClient.get(`/api/settings/browser/${user.id}`);
      const settings = currentSettings.data?.settings || {};
      
      // Update both headless and show_browser_during_sync settings
      settings.headless = !visible;
      settings.show_browser_during_sync = visible;
      
      // Save updated settings
      await apiClient.post(`/api/settings/browser/${user.id}`, settings);
      
      setBrowserVisible(visible);
      setStatusMessage(`Browser will ${visible ? 'be visible' : 'run in background'} for future syncs`);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to update browser settings');
    } finally {
      setBrowserSettingsLoading(false);
    }
  };

  const createSchedule = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const data = {
        schedule_type: 'work_orders',
        interval_hours: intervalHours,
        active_hours: useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null,
        enabled: true
      };
      
      const response = await apiClient.post('/api/scraping-schedules/', data);
      setSchedule(response.data);
      setStatusMessage('Schedule created successfully');
      
      await fetchHistory();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (enabled: boolean) => {
    if (!schedule) return;
    
    try {
      setIsSaving(true);
      setErrorMessage(null);
      
      const data = {
        interval_hours: intervalHours,
        active_hours: useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null,
        enabled: enabled
      };
      
      const response = await apiClient.put(`/api/scraping-schedules/${schedule.id}`, data);
      setSchedule(response.data);
      setStatusMessage(enabled ? 'Schedule enabled' : 'Schedule paused');
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('scraping-schedule-updated', {
        detail: { schedule: response.data }
      }));
      
      // Force refresh to get latest data
      await fetchSchedule();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to update schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerManualRun = async () => {
    if (!schedule) return;
    
    try {
      setIsTriggering(true);
      setErrorMessage(null);
      setStatusMessage(null);
      
      // Set initial progress state for immediate feedback
      setSyncProgress({
        status: 'in_progress',
        phase: 'Initializing sync...',
        percentage: 0,
        message: 'Starting work order sync...',
        work_orders_found: 0,
        work_orders_processed: 0
      });
      
      const response = await apiClient.post(`/api/scraping-schedules/${schedule.id}/run`, {}, {
        timeout: 30000 // 30 seconds for manual run trigger
      });
      
      // Clear any existing progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // Start polling progress immediately
      fetchSyncProgress();
      
      // Start more frequent progress polling
      progressIntervalRef.current = setInterval(() => {
        fetchSyncProgress();
      }, 1000);
      
      // Clear interval after max time (5 minutes)
      setTimeout(() => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }, 300000);
      
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to trigger manual run');
      setSyncProgress(null);
    } finally {
      setIsTriggering(false);
    }
  };

  const deleteSchedule = async () => {
    if (!schedule) return;
    
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      setLoading(true);
      await apiClient.delete(`/api/scraping-schedules/${schedule.id}`);
      setSchedule(null);
      setHistory([]);
      setStatusMessage('Schedule deleted successfully');
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const copyErrorLog = async (historyItem: ScrapingHistoryItem) => {
    if (!schedule || !historyItem.has_error_log) return;
    
    try {
      const response = await apiClient.get(
        `/api/scraping-schedules/${schedule.id}/history/${historyItem.id}/error-log`
      );
      
      if (response.data?.error_log) {
        const errorLog = response.data.error_log;
        const formattedLog = `Error Log - ${formatUTCToLocal(historyItem.started_at)}
=====================================
Error Type: ${errorLog.error_type}
Error Message: ${errorLog.error_message}
Timestamp: ${errorLog.timestamp}
User ID: ${errorLog.user_id}

Stack Trace:
${errorLog.traceback}`;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(formattedLog);
        setStatusMessage('Error log copied to clipboard');
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to retrieve error log');
    }
  };

  const getSystemHealth = () => {
    if (!daemonStatus) return 'unknown';
    if (daemonStatus.scheduler_running && daemonStatus.active_schedules > 0) return 'healthy';
    if (daemonStatus.scheduler_running) return 'idle';
    return 'offline';
  };

  const getScheduleHealth = () => {
    if (!schedule) return 'none';
    if (!schedule.enabled) return 'paused';
    if (schedule.consecutive_failures >= 3) return 'failing';
    if (schedule.consecutive_failures > 0) return 'warning';
    if (isRunning) return 'running';
    return 'healthy';
  };

  const formatDate = formatUTCToLocal;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'failing':
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'idle':
        return <Timer className="w-5 h-5 text-gray-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSuccessRate = () => {
    if (history.length === 0) return null;
    const successful = history.filter(h => h.success).length;
    return Math.round((successful / history.length) * 100);
  };

  const toggleHistoryCollapse = () => {
    const newState = !isHistoryCollapsed;
    setIsHistoryCollapsed(newState);
    localStorage.setItem('scrapingHistoryCollapsed', JSON.stringify(newState));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading schedule data...
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to manage scraping schedules.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const systemHealth = getSystemHealth();
  const scheduleHealth = getScheduleHealth();

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {statusMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{statusMessage}</AlertDescription>
        </Alert>
      )}
      
      {errorMessage && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* System Status Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Scheduler Health */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Scheduler</p>
                <p className="text-xl font-semibold flex items-center gap-2">
                  {getHealthIcon(systemHealth)}
                  {systemHealth === 'healthy' ? 'Running' : 
                   systemHealth === 'idle' ? 'Idle' :
                   systemHealth === 'offline' ? 'Offline' : 'Unknown'}
                </p>
              </div>
              <Cpu className={cn(
                "w-8 h-8",
                systemHealth === 'healthy' ? "text-green-500" :
                systemHealth === 'idle' ? "text-gray-500" :
                "text-red-500"
              )} />
            </div>

            {/* Schedule Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                <p className="text-xl font-semibold flex items-center gap-2">
                  {getHealthIcon(scheduleHealth)}
                  {scheduleHealth === 'healthy' ? 'Active' :
                   scheduleHealth === 'running' ? 'Running' :
                   scheduleHealth === 'paused' ? 'Paused' :
                   scheduleHealth === 'warning' ? 'Warning' :
                   scheduleHealth === 'failing' ? 'Failing' : 'Not Set'}
                </p>
              </div>
              {schedule?.enabled ? (
                <Power className="w-8 h-8 text-green-500" />
              ) : (
                <PowerOff className="w-8 h-8 text-gray-500" />
              )}
            </div>

            {/* Success Rate */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-xl font-semibold">
                  {getSuccessRate() !== null ? `${getSuccessRate()}%` : 'N/A'}
                </p>
                {getSuccessRate() !== null && (
                  <Progress value={getSuccessRate()} className="h-2 mt-2" />
                )}
              </div>
              <TrendingUp className={cn(
                "w-8 h-8",
                getSuccessRate() === null ? "text-gray-400" :
                getSuccessRate() >= 90 ? "text-green-500" :
                getSuccessRate() >= 70 ? "text-yellow-500" :
                "text-red-500"
              )} />
            </div>
          </div>

          {/* Next Run Countdown */}
          {schedule?.enabled && schedule?.next_run && (
            <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Next Scheduled Run
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {formatDate(schedule.next_run)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {countdown}
                  </p>
                  {isRunning && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                      Sync in progress...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Work Order Sync Configuration
            </span>
            {schedule && getStatusBadge(schedule.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Interval Configuration */}
            <div className="space-y-2">
              <Label htmlFor="interval" className="text-base font-medium">
                Sync Interval
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="interval"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">hours</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How often to check for new work orders</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Browser Visibility Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="browserVisible"
                  checked={browserVisible}
                  onChange={(e) => updateBrowserVisibility(e.target.checked)}
                  disabled={browserSettingsLoading}
                  className="rounded"
                />
                <Label htmlFor="browserVisible" className="text-base font-medium cursor-pointer">
                  Show browser during sync
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {browserVisible ? (
                        <Eye className="w-4 h-4 text-blue-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>When enabled, you'll see the browser window during sync operations</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {browserSettingsLoading && (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                )}
              </div>
            </div>

            {/* Active Hours Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useActiveHours"
                  checked={useActiveHours}
                  onChange={(e) => setUseActiveHours(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useActiveHours" className="text-base font-medium cursor-pointer">
                  Limit sync to specific hours
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Only sync during business hours to reduce server load</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {useActiveHours && (
                <div className="ml-6 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="startHour" className="text-sm">From:</Label>
                      <Input
                        id="startHour"
                        type="number"
                        min="0"
                        max="23"
                        value={activeHoursStart}
                        onChange={(e) => setActiveHoursStart(parseInt(e.target.value))}
                        className="w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="endHour" className="text-sm">To:</Label>
                      <Input
                        id="endHour"
                        type="number"
                        min="0"
                        max="23"
                        value={activeHoursEnd}
                        onChange={(e) => setActiveHoursEnd(parseInt(e.target.value))}
                        className="w-20"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({activeHoursStart}:00 - {activeHoursEnd}:00 local time)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Schedule Info */}
            {schedule && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium flex items-center gap-2">
                      {schedule.enabled ? (
                        <>
                          <Wifi className="w-4 h-4 text-green-500" />
                          Active
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4 text-gray-500" />
                          Paused
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Run:</span>
                    <span className="font-medium">
                      {schedule.last_run ? getRelativeTime(schedule.last_run) : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(schedule.created_at)}</span>
                  </div>
                  {schedule.consecutive_failures > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Consecutive Failures:</span>
                      <span className="font-medium">{schedule.consecutive_failures}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              {!schedule ? (
                <Button onClick={createSchedule} disabled={loading} size="lg">
                  <Zap className="w-4 h-4 mr-2" />
                  Create Schedule
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => updateSchedule(!schedule.enabled)}
                    disabled={loading || isSaving}
                    variant={schedule.enabled ? 'outline' : 'default'}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : schedule.enabled ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Schedule
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Enable Schedule
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => updateSchedule(schedule.enabled)}
                    disabled={loading || isSaving}
                    variant="outline"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                  
                  <Button
                    onClick={triggerManualRun}
                    disabled={loading || isTriggering}
                    variant="outline"
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", isTriggering && "animate-spin")} />
                    Sync Now
                  </Button>
                  
                  <Button
                    onClick={deleteSchedule}
                    disabled={loading}
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete Schedule
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution History - Always visible and collapsible */}
      {!loading && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={toggleHistoryCollapse}>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Sync History
                {history.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {history.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {syncProgress?.status === 'in_progress' && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
                {isHistoryCollapsed ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {!isHistoryCollapsed && (
            <CardContent>
              {!schedule ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No sync schedule configured</p>
                  <p className="text-sm mt-1">Create a schedule to start syncing work orders</p>
                </div>
              ) : (
                <>
                  {/* Progress Display */}
                  {syncProgress && syncProgress.status === 'in_progress' && (
                <div className="mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {syncProgress.phase || 'Processing...'}
                    </span>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {syncProgress.percentage || 0}%
                    </span>
                  </div>
                  <Progress value={syncProgress.percentage || 0} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                    <span>{syncProgress.message || 'Syncing work orders...'}</span>
                    {syncProgress.work_orders_processed !== undefined && syncProgress.work_orders_found !== undefined && (
                      <span>
                        Processing work order {syncProgress.work_orders_processed} of {syncProgress.work_orders_found}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* History Items */}
              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3 rounded-lg border transition-colors",
                        item.success 
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" 
                          : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {item.success ? 'Successful Sync' : 'Failed Sync'}
                              {item.trigger_type === 'manual' && (
                                <Badge className="text-xs" variant="outline">Manual</Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getRelativeTime(item.started_at)} • {formatDate(item.started_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{item.items_processed} orders</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDuration(item.duration_seconds)}
                          </p>
                        </div>
                      </div>
                      {item.error_message && (
                        <div className="mt-2">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {item.error_message.length > 100 
                              ? `${item.error_message.substring(0, 100)}...` 
                              : item.error_message}
                          </p>
                          {item.has_error_log && (
                            <Button
                              onClick={() => copyErrorLog(item)}
                              variant="ghost"
                              size="sm"
                              className="mt-1 text-xs"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              View Details
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No sync history yet</p>
                  <p className="text-sm mt-1">History will appear after your first sync</p>
                </div>
              )}
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Help Information */}
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Sync Schedule:</strong> Automatically fetches new work orders from WorkFossa at the specified interval. 
          Sync runs only during active hours if configured. Manual sync can be triggered anytime.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ScrapingScheduleEnhanced;