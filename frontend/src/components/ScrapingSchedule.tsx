import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RefreshCw, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
}

const ScrapingSchedule: React.FC = () => {
  const { isAuthenticated, token } = useAuth();
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
  const [daemonStatus, setDaemonStatus] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    
    fetchSchedule();
    fetchHistory();
    fetchDaemonStatus();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchSchedule();
      fetchHistory();
      fetchDaemonStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);

  const fetchSchedule = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/');
      
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
      const response = await apiClient.get(`/api/scraping-schedules/${schedule.id}/history`);
      setHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchDaemonStatus = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/status/daemon');
      setDaemonStatus(response.data);
    } catch (error) {
      console.error('Error fetching daemon status:', error);
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
      setLoading(true);
      setErrorMessage(null);
      
      const data = {
        interval_hours: intervalHours,
        active_hours: useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null,
        enabled: enabled
      };
      
      console.log('=== FRONTEND SCHEDULE UPDATE ===');
      console.log('Schedule ID:', schedule.id);
      console.log('Request Data:', JSON.stringify(data, null, 2));
      console.log('Current time (local):', new Date().toLocaleString());
      console.log('Current time (UTC):', new Date().toUTCString());
      
      const response = await apiClient.put(`/api/scraping-schedules/${schedule.id}`, data);
      setSchedule(response.data);
      setStatusMessage(enabled ? 'Schedule enabled' : 'Schedule paused');
      
      console.log('=== UPDATE RESPONSE ===');
      console.log('Next Run:', response.data.next_run);
      console.log('Enabled:', response.data.enabled);
      console.log('Interval:', response.data.interval_hours, 'hours');
      
      // Calculate time difference for verification
      if (response.data.next_run) {
        const nextRunDate = new Date(response.data.next_run);
        const now = new Date();
        const diffHours = (nextRunDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        console.log('Time until next run:', diffHours.toFixed(2), 'hours');
        console.log('Expected interval:', response.data.interval_hours, 'hours');
        
        if (Math.abs(diffHours - response.data.interval_hours) > 0.1) {
          console.warn('WARNING: Next run time does not match expected interval!');
        } else {
          console.log('✓ Next run time matches expected interval');
        }
      }
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('scraping-schedule-updated', {
        detail: { schedule: response.data }
      }));
      
      // Force refresh to get latest data
      await fetchSchedule();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to update schedule');
      console.error('Schedule update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualRun = async () => {
    if (!schedule) return;
    
    try {
      setIsTriggering(true);
      setErrorMessage(null);
      
      const response = await apiClient.post(`/api/scraping-schedules/${schedule.id}/run`);
      setStatusMessage(response.data.message || 'Manual run triggered');
      
      // Refresh history after a delay
      setTimeout(() => {
        fetchHistory();
        fetchSchedule();
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to trigger manual run');
    } finally {
      setIsTriggering(false);
    }
  };

  const deleteSchedule = async () => {
    if (!schedule) return;
    
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

  // Use imported formatter from utils/dateFormat.ts
  const formatDate = formatUTCToLocal;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

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

  if (loading) {
    return <Card><CardContent className="p-6">Loading schedule data...</CardContent></Card>;
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

      {/* Daemon Status */}
      {daemonStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Scheduler Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Daemon Status:</span>
                <span className="ml-2 font-medium">
                  {daemonStatus.daemon_status === 'running' ? (
                    <span className="text-green-600">Running</span>
                  ) : (
                    <span className="text-gray-500">Unknown</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Last Execution:</span>
                <span className="ml-2">{formatDate(daemonStatus.last_execution)}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Schedules:</span>
                <span className="ml-2 font-medium">{daemonStatus.total_schedules}</span>
              </div>
              <div>
                <span className="text-gray-600">Active Schedules:</span>
                <span className="ml-2 font-medium">{daemonStatus.active_schedules}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">{daemonStatus.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Work Order Scraping Schedule
            </span>
            {schedule && getStatusBadge(schedule.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Interval Configuration */}
            <div>
              <Label htmlFor="interval">Scraping Interval (hours)</Label>
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
            </div>

            {/* Active Hours Configuration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useActiveHours"
                  checked={useActiveHours}
                  onChange={(e) => setUseActiveHours(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useActiveHours">Limit to specific hours</Label>
              </div>
              
              {useActiveHours && (
                <div className="flex items-center gap-4 ml-6">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="startHour" className="text-sm">Start:</Label>
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
                    <Label htmlFor="endHour" className="text-sm">End:</Label>
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
                  <span className="text-sm text-gray-600">
                    ({activeHoursStart}:00 - {activeHoursEnd}:00)
                  </span>
                </div>
              )}
            </div>

            {/* Schedule Info */}
            {schedule && (
              <div className="border-t pt-4 space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Last Run:</span>
                  <span className="ml-2">{formatDate(schedule.last_run)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Next Run:</span>
                  <span className="ml-2">{formatDate(schedule.next_run)}</span>
                </div>
                {schedule.consecutive_failures > 0 && (
                  <div className="text-red-600">
                    <span>Consecutive Failures:</span>
                    <span className="ml-2 font-medium">{schedule.consecutive_failures}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {!schedule ? (
                <Button onClick={createSchedule} disabled={loading}>
                  <Play className="w-4 h-4 mr-2" />
                  Create Schedule
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => updateSchedule(!schedule.enabled)}
                    disabled={loading}
                    variant={schedule.enabled ? 'outline' : 'default'}
                  >
                    {schedule.enabled ? (
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
                    disabled={loading}
                    variant="outline"
                    className="mr-2"
                  >
                    Save Settings
                  </Button>
                  
                  <Button
                    onClick={triggerManualRun}
                    disabled={loading || isTriggering}
                    variant="outline"
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", isTriggering && "animate-spin")} />
                    Run Now
                  </Button>
                  
                  <Button
                    onClick={deleteSchedule}
                    disabled={loading}
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete Schedule
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution History */}
      {schedule && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Execution History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    item.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">
                          {item.success ? 'Success' : 'Failed'}
                          {item.trigger_type === 'manual' && (
                            <Badge className="ml-2 text-xs" variant="outline">Manual</Badge>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(item.started_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>{item.items_processed} items</p>
                      <p className="text-gray-600">{formatDuration(item.duration_seconds)}</p>
                    </div>
                  </div>
                  {item.error_message && (
                    <p className="mt-2 text-sm text-red-600">{item.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScrapingSchedule;