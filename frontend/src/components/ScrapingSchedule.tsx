import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RefreshCw, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../services/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Schedule {
  job_id: string;
  user_id: string;
  type: string;
  enabled: boolean;
  next_run: string | null;
  pending: boolean;
}

interface ScrapingHistoryItem {
  id: number;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  items_processed: number;
  error_message: string | null;
  duration_seconds: number | null;
}

const ScrapingSchedule: React.FC = () => {
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

  useEffect(() => {
    fetchSchedule();
    fetchHistory();
  }, []);

  const fetchSchedule = async () => {
    try {
      console.log('=== FRONTEND FETCHING SCHEDULE ===');
      const response = await apiClient.get('/api/scraping-schedules/');
      console.log('API Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.length > 0) {
        const schedule = response.data[0];
        console.log('Using schedule:', JSON.stringify(schedule, null, 2));
        setSchedule(schedule);
        
        // Set interval hours
        setIntervalHours(schedule.interval_hours || 1);
        console.log('Set interval hours to:', schedule.interval_hours || 1);
        
        // Set active hours
        if (schedule.active_hours && typeof schedule.active_hours === 'object' && 
            'start' in schedule.active_hours && 'end' in schedule.active_hours) {
          console.log('Schedule has active hours:', schedule.active_hours);
          setUseActiveHours(true);
          setActiveHoursStart(schedule.active_hours.start);
          setActiveHoursEnd(schedule.active_hours.end);
        } else {
          console.log('Schedule has NO active hours, active_hours:', schedule.active_hours);
          setUseActiveHours(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/history/work_orders');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const createSchedule = async () => {
    try {
      setLoading(true);
      const activeHours = useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null;
      
      const response = await apiClient.post('/api/scraping-schedules/', {
        schedule_type: 'work_orders',
        interval_hours: intervalHours,
        active_hours: activeHours,
        enabled: true
      });
      
      if (response.data.success) {
        // Dispatch custom event to refresh ScrapingStatus component immediately
        window.dispatchEvent(new Event('scraping-schedule-updated'));
        
        setStatusMessage('✅ Hourly scraping schedule created successfully');
        setTimeout(() => setStatusMessage(null), 3000);
        await fetchSchedule();
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to create schedule');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (enabled?: boolean) => {
    if (!schedule) return;
    
    try {
      setLoading(true);
      
      // Update local state immediately for instant UI feedback
      if (enabled !== undefined) {
        console.log('Updating local schedule state immediately');
        setSchedule(prev => prev ? { ...prev, enabled } : null);
      }
      
      // Dispatch event immediately for instant UI feedback with updated data
      console.log('Dispatching immediate event for UI update');
      const updatedSchedule = enabled !== undefined ? { ...schedule, enabled } : schedule;
      window.dispatchEvent(new CustomEvent('scraping-schedule-updated', { 
        detail: { schedule: updatedSchedule }
      }));
      
      const activeHours = useActiveHours ? { start: activeHoursStart, end: activeHoursEnd } : null;
      
      const requestData = {
        interval_hours: intervalHours,
        active_hours: activeHours,
        enabled: enabled !== undefined ? enabled : schedule.enabled
      };
      
      console.log('=== FRONTEND SENDING UPDATE ===');
      console.log('URL:', `/api/scraping-schedules/${schedule.job_id}`);
      console.log('Request data:', JSON.stringify(requestData, null, 2));
      console.log('useActiveHours:', useActiveHours);
      console.log('activeHours:', activeHours);
      
      const response = await apiClient.put(`/api/scraping-schedules/${schedule.job_id}`, requestData);
      
      if (response.data.success) {
        // Dispatch custom event to refresh ScrapingStatus component immediately
        window.dispatchEvent(new Event('scraping-schedule-updated'));
        
        setStatusMessage('✅ Schedule updated successfully');
        setTimeout(() => setStatusMessage(null), 3000);
        await fetchSchedule();
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to update schedule');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualScrape = async () => {
    try {
      setIsTriggering(true);
      setStatusMessage('🚀 Triggering manual scrape...');
      
      // Get user ID from auth context
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id;
      
      const response = await apiClient.post('/api/scraping-schedules/trigger', {
        schedule_type: 'work_orders',
        ignore_schedule: true
      });
      
      if (response.data.success) {
        // Set localStorage to trigger progress polling on Work Orders page
        if (userId) {
          localStorage.setItem(`wo_scraping_${userId}`, JSON.stringify({
            status: 'scraping',
            startedAt: new Date().toISOString()
          }));
        }
        
        setStatusMessage('✅ Manual scraping triggered successfully! Navigate to the Work Orders page to see the glowing progress card with live updates.');
        setTimeout(() => {
          setStatusMessage(null);
          fetchHistory();
        }, 7000);
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to trigger scraping');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsTriggering(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const formatDate = (dateString: string) => {
    // The backend now sends UTC times with 'Z' suffix
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getRelativeTime = (dateString: string) => {
    // Backend now sends proper UTC timestamps with 'Z'
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) {
      return 'overdue';
    } else if (diffMins < 60) {
      return `in ${diffMins} minutes`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `in ${hours}h ${mins}m`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `in ${days} days`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {statusMessage && (
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      )}
      {errorMessage && (
        <Alert className="border-red-500 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Hourly Work Order Scraping
            </CardTitle>
            {schedule && (
              <Badge variant={schedule.enabled ? "default" : "secondary"}>
                {schedule.enabled ? 'Active' : 'Paused'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Schedule Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">Schedule Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="interval">
                Scraping Interval (hours)
              </Label>
              <Input
                id="interval"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={intervalHours}
                onChange={(e) => setIntervalHours(parseFloat(e.target.value))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active-hours"
                checked={useActiveHours}
                onChange={(e) => setUseActiveHours(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="active-hours" className="cursor-pointer">
                Restrict to active hours
              </Label>
            </div>

            {useActiveHours && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-hour">
                    Start Hour
                  </Label>
                  <select
                    id="start-hour"
                    value={activeHoursStart}
                    onChange={(e) => setActiveHoursStart(parseInt(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-hour">
                    End Hour
                  </Label>
                  <select
                    id="end-hour"
                    value={activeHoursEnd}
                    onChange={(e) => setActiveHoursEnd(parseInt(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Info & Actions */}
          <div className="space-y-4">
            <h3 className="font-medium">Schedule Information</h3>
            
            {schedule && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Next Run:</span>
                  <span className="font-medium">
                    {schedule.next_run ? (
                      <>
                        {formatDate(schedule.next_run)}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({getRelativeTime(schedule.next_run)})
                        </span>
                      </>
                    ) : 'Not scheduled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={schedule.pending ? "default" : "secondary"}>
                    {schedule.pending ? 'Running' : 'Idle'}
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {!schedule ? (
                <Button
                  onClick={createSchedule}
                  disabled={loading}
                  className="flex-1"
                >
                  Create Schedule
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => updateSchedule()}
                    disabled={loading}
                    className="flex-1"
                  >
                    Update
                  </Button>
                  {schedule.enabled ? (
                    <Button
                      onClick={() => updateSchedule(false)}
                      disabled={loading}
                      variant="secondary"
                      size="icon"
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => updateSchedule(true)}
                      disabled={loading}
                      variant="secondary"
                      size="icon"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={triggerManualScrape}
                disabled={loading || !schedule || isTriggering}
                variant="outline"
                title="Manually trigger the scheduled scrape immediately for testing"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isTriggering && "animate-spin")} />
                {isTriggering ? "Triggering..." : "Test Now"}
              </Button>
            </div>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Scraping History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Scraping History
            </CardTitle>
            <Button
              onClick={fetchHistory}
              variant="ghost"
              size="icon"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No scraping history yet
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatDate(item.started_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatDuration(item.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {item.items_processed}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.success ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScrapingSchedule;