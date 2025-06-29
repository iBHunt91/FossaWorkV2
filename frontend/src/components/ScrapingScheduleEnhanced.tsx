import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertCircle, Timer, AlertTriangle } from 'lucide-react';
import { apiClient } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatScheduledTime, getScheduleStatusMessage, getTimeUntilNextRun } from '../utils/schedulerTimeFormat';
import { logger } from '../services/fileLoggingService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { GlowCard } from '@/components/ui/animated-card';
import { AnimatedText, GradientText } from '@/components/ui/animated-text';
import { useWorkOrderSyncProgress } from '../hooks/useProgressPolling';

interface ScrapingScheduleData {
  id?: number;
  enabled: boolean;
  next_run: string | null;
  last_run: string | null;
  last_success: boolean | null;
  items_processed: number | null;
  is_running: boolean;
  consecutive_failures: number;
  interval_hours: number;
}

interface ScrapingScheduleEnhancedProps {
  onSettingsClick?: () => void;
}

const ScrapingScheduleEnhanced: React.FC<ScrapingScheduleEnhancedProps> = ({ 
  onSettingsClick 
}) => {
  const [schedule, setSchedule] = useState<ScrapingScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState({ minutes: 0, percentage: 0, display: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Progress tracking hook
  const { data: syncProgress, isPolling } = useWorkOrderSyncProgress(
    schedule?.id || null,
    isSyncing
  );

  const fetchScheduleStatus = async () => {
    try {
      setError(null);
      
      const response = await apiClient.get('/api/scraping-schedules/', {
        timeout: 10000
      });
      
      const schedules = response.data;
      if (schedules && schedules.length > 0) {
        const scheduleData = schedules[0];
        
        // Get latest history
        let lastRun = null;
        try {
          const historyResponse = await apiClient.get(
            `/api/scraping-schedules/${scheduleData.id}/history?limit=1`,
            { timeout: 5000 }
          );
          const history = historyResponse.data;
          lastRun = history && history.length > 0 ? history[0] : null;
        } catch (err) {
          // History is optional
        }
        
        const isRunning = lastRun && 
          !lastRun.completed_at && 
          new Date(lastRun.started_at).getTime() > Date.now() - 5 * 60 * 1000;
        
        setSchedule({
          id: scheduleData.id,
          enabled: scheduleData.enabled,
          next_run: scheduleData.next_run,
          last_run: scheduleData.last_run,
          last_success: lastRun?.success || null,
          items_processed: lastRun?.items_processed || null,
          is_running: isRunning || false,
          consecutive_failures: scheduleData.consecutive_failures || 0,
          interval_hours: scheduleData.interval_hours || 1
        });
      }
    } catch (err: any) {
      logger.error('ScrapingScheduleEnhanced', 'Error fetching schedule', err);
      setError('Unable to load schedule status');
    } finally {
      setLoading(false);
    }
  };

  // Update time until next run
  useEffect(() => {
    if (schedule?.next_run && schedule.enabled) {
      const updateTimer = () => {
        const timeInfo = getTimeUntilNextRun(schedule.next_run);
        setTimeUntilNext(timeInfo);
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 10000); // Update every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [schedule?.next_run, schedule?.enabled]);

  // Fetch status on mount and periodically
  useEffect(() => {
    fetchScheduleStatus();
    
    const interval = setInterval(fetchScheduleStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Check for existing sync session when schedule is loaded
  useEffect(() => {
    if (schedule?.id) {
      logger.info('ScrapingScheduleEnhanced', 'Checking for existing sync session', { scheduleId: schedule.id });
      apiClient.get(`/api/scraping-schedules/${schedule.id}/sync-progress`)
        .then(response => {
          logger.info('ScrapingScheduleEnhanced', 'Sync progress check response', response.data);
          if (response.data && response.data.status === 'in_progress') {
            logger.info('ScrapingScheduleEnhanced', 'Found existing sync in progress');
            setIsSyncing(true);
          }
        })
        .catch((error) => {
          logger.error('ScrapingScheduleEnhanced', 'Error checking sync progress', error);
        });
    }
  }, [schedule?.id]);

  // Check sync progress and update sync status
  useEffect(() => {
    if (syncProgress) {
      logger.info('ScrapingScheduleEnhanced', 'Sync progress update', { 
        status: syncProgress.status, 
        percentage: syncProgress.percentage,
        message: syncProgress.message 
      });
      
      if (syncProgress.status === 'in_progress') {
        setIsSyncing(true);
      } else if (syncProgress.status === 'completed' || syncProgress.status === 'failed' || syncProgress.status === 'not_found') {
        logger.info('ScrapingScheduleEnhanced', 'Sync ended, clearing sync state', { status: syncProgress.status });
        setIsSyncing(false);
        // Refresh schedule status after sync completes
        if (syncProgress.status === 'completed' || syncProgress.status === 'failed') {
          setTimeout(() => {
            fetchScheduleStatus();
          }, 2000);
        }
      }
    } else {
      // No sync progress means no sync active
      setIsSyncing(false);
    }
  }, [syncProgress]);


  const handleRunNow = async () => {
    try {
      if (!schedule?.id) {
        logger.error('ScrapingScheduleEnhanced', 'No schedule ID found');
        return;
      }
      
      // Start tracking sync progress
      setIsSyncing(true);
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('work-order-sync-started'));
      
      // Trigger the schedule to run immediately using the correct endpoint
      await apiClient.post(`/api/scraping-schedules/${schedule.id}/run`);
      
      // Refresh the schedule status after triggering
      await fetchScheduleStatus();
      
      // Show success notification (assuming you have a toast/notification system)
      logger.info('ScrapingScheduleEnhanced', 'Manual sync triggered successfully');
    } catch (err) {
      logger.error('ScrapingScheduleEnhanced', 'Error triggering scrape', err);
      setIsSyncing(false);
      
      // If the error is about missing credentials, navigate to settings
      if (err.response?.data?.detail?.includes('credentials')) {
        window.location.href = '/settings?tab=credentials';
      }
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
        </CardContent>
      </Card>
    );
  }

  if (error || !schedule) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'No schedule configured'}
        </AlertDescription>
      </Alert>
    );
  }

  const statusInfo = getScheduleStatusMessage(
    schedule.enabled,
    schedule.is_running,
    schedule.consecutive_failures,
    schedule.last_success
  );

  const getStatusIcon = () => {
    if (schedule.is_running) {
      return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />;
    }
    if (!schedule.enabled) {
      return <Clock className="w-5 h-5 text-gray-400" />;
    }
    if (schedule.consecutive_failures >= 3) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (schedule.last_success === false) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  // Show progress GlowCard when syncing
  if (isSyncing && syncProgress && syncProgress.status === 'in_progress') {
    return (
      <GlowCard 
        glowColor="rgba(59, 130, 246, 0.3)" 
        className="w-full border-blue-500/20 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
              <div className="relative p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full shadow-lg">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
              </div>
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg mb-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Syncing Work Orders
              </CardTitle>
              <CardDescription className="text-sm">
                <AnimatedText 
                  text={syncProgress.message || 'Synchronizing work orders...'}
                  animationType="fade"
                  className="text-muted-foreground"
                />
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-100/50 to-indigo-100/50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 animate-pulse"></div>
            
            <div className="relative space-y-4">
              {/* Circular Progress */}
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-blue-200/30 dark:text-blue-800/30"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - (Number(syncProgress.percentage || 0) / 100))}`}
                      className="text-blue-600 dark:text-blue-400 transition-all duration-500 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GradientText 
                      text={`${Math.round(Number(syncProgress.percentage || 0))}%`}
                      gradient="from-blue-600 to-indigo-600"
                      className="text-2xl font-black"
                    />
                  </div>
                </div>
              </div>
              
              {/* Status Info */}
              <div className="text-center space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Phase</div>
                  <div className="font-semibold text-sm capitalize">
                    {syncProgress.phase || 'Initializing'}
                  </div>
                </div>
                
                {syncProgress.work_orders_found !== undefined && syncProgress.work_orders_found > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {syncProgress.work_orders_found} work orders found
                  </Badge>
                )}
              </div>
              
              {/* Linear Progress */}
              <Progress 
                value={Number(syncProgress.percentage || 0)} 
                className="h-2 bg-gray-200 dark:bg-gray-700"
              />
            </div>
          </div>
          
          {/* Additional Actions */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/work-orders'}
            >
              View Work Orders
            </Button>
          </div>
        </CardContent>
      </GlowCard>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className="text-lg font-semibold">Work Order Sync</h3>
                <p className={cn("text-sm", statusInfo.color)}>
                  {statusInfo.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onSettingsClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSettingsClick}
                >
                  Settings
                </Button>
              )}
            </div>
          </div>

          {/* Next Run Info */}
          {schedule.enabled && schedule.next_run && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Next sync</span>
                </div>
                <span className="text-sm font-semibold">
                  {formatScheduledTime(schedule.next_run)}
                </span>
              </div>
              
              {/* Progress to next run */}
              <div className="space-y-1">
                <Progress value={timeUntilNext.percentage} className="h-2" />
                <p className="text-xs text-gray-500 text-right">
                  {timeUntilNext.display} until next sync
                </p>
              </div>
            </div>
          )}

          {/* Last Run Info */}
          {schedule.last_run && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Last sync</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(schedule.last_run), { addSuffix: true })}
                </p>
              </div>
              
              {schedule.items_processed !== null && (
                <div>
                  <p className="text-gray-500">Items processed</p>
                  <p className="font-medium">{schedule.items_processed}</p>
                </div>
              )}
            </div>
          )}

          {/* Error Warning */}
          {schedule.consecutive_failures > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {schedule.consecutive_failures} consecutive sync failures. 
                Please check your WorkFossa credentials.
              </AlertDescription>
            </Alert>
          )}

          {/* Manual Sync Button */}
          <Button
            variant="default"
            className="w-full"
            onClick={handleRunNow}
            disabled={schedule.is_running || isSyncing}
          >
            <RefreshCw className={cn(
              "w-4 h-4 mr-2",
              (schedule.is_running || isSyncing) && "animate-spin"
            )} />
            {schedule.is_running || isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScrapingScheduleEnhanced;