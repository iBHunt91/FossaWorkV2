import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RefreshCw, Calendar, AlertCircle, CheckCircle, LogIn, Trash2 } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useScrapingStatus } from '../contexts/ScrapingStatusContext';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  trigger_type?: string; // "manual" or "scheduled"
}

const ScrapingSchedule: React.FC = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { refreshStatus } = useScrapingStatus();
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
  const [authError, setAuthError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    
    fetchSchedule();
    fetchHistory();
  }, [isAuthenticated, token]);

  const fetchSchedule = async () => {
    try {
      console.log('=== FRONTEND FETCHING SCHEDULE ===');
      console.log('Auth status:', { isAuthenticated, token: !!token, user: user?.email });
      
      const response = await apiClient.get('/api/scraping-schedules/');
      console.log('API Response:', JSON.stringify(response.data, null, 2));
      
      setAuthError(false); // Clear auth error if request succeeds
      
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
    } catch (error: any) {
      console.error('Failed to fetch schedule:', error);
      
      // Check for authentication errors
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else if (error.code === 'ERR_NETWORK') {
        setErrorMessage('Network error. Please check your connection and backend server.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to fetch schedule');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get('/api/scraping-schedules/history/work_orders');
      setHistory(response.data);
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      
      // Check for authentication errors
      if (error.response?.status === 401) {
        setAuthError(true);
      }
      // Don't show history errors as prominently since it's secondary data
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
        setStatusMessage('✅ Hourly scraping schedule created successfully');
        setTimeout(() => setStatusMessage(null), 3000);
        await fetchSchedule();
        // Refresh the scraping status to update the navbar indicator
        await refreshStatus();
      }
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to create schedule');
      }
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (enabled?: boolean) => {
    if (!schedule) return;
    
    try {
      setLoading(true);
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
        setStatusMessage('✅ Schedule updated successfully');
        setTimeout(() => setStatusMessage(null), 3000);
        await fetchSchedule();
        // Refresh the scraping status to update the navbar indicator
        await refreshStatus();
      }
    } catch (error: any) {
      console.error('Failed to update schedule:', error);
      
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to update schedule');
      }
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
      console.error('Failed to trigger manual scrape:', error);
      
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to trigger scraping');
      }
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

  const handleDeleteClick = (historyId: number) => {
    setItemToDelete(historyId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteAllClick = () => {
    setDeleteAllConfirmOpen(true);
  };

  const deleteHistoryItem = async () => {
    if (!itemToDelete) return;
    
    try {
      const response = await apiClient.delete(`/api/scraping-schedules/history/${itemToDelete}`);
      
      if (response.data.success) {
        setStatusMessage('✅ History record deleted successfully');
        setTimeout(() => setStatusMessage(null), 3000);
        // Refresh history list
        await fetchHistory();
      }
    } catch (error: any) {
      console.error('Failed to delete history record:', error);
      
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to delete history record');
      }
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const deleteAllHistory = async () => {
    try {
      const response = await apiClient.delete('/api/scraping-schedules/history');
      
      if (response.data.success) {
        setStatusMessage(`✅ ${response.data.message}`);
        setTimeout(() => setStatusMessage(null), 3000);
        // Clear the history list
        setHistory([]);
      }
    } catch (error: any) {
      console.error('Failed to delete all history records:', error);
      
      if (error.response?.status === 401) {
        setAuthError(true);
        setErrorMessage('Authentication required. Please log in again.');
      } else {
        setErrorMessage(error.response?.data?.detail || 'Failed to delete history records');
      }
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setDeleteAllConfirmOpen(false);
    }
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

  // Show authentication error if not authenticated
  if (authError || !isAuthenticated) {
    return (
      <div className="space-y-6">
        <Alert className="border-red-500 bg-red-500/10">
          <LogIn className="h-4 w-4 text-red-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>Authentication required to access scraping schedules.</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/login'}
              className="ml-4"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </Button>
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
            <div className="text-center">
              <LogIn className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please log in to view and manage scraping schedules</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <Button
                  onClick={handleDeleteAllClick}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </Button>
              )}
              <Button
                onClick={fetchHistory}
                variant="ghost"
                size="icon"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Started
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Items
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No scraping history yet
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-3 whitespace-nowrap text-sm">
                      {formatDate(item.started_at)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <Badge variant="secondary" className="capitalize">
                        {item.trigger_type || 'scheduled'}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm">
                      {formatDuration(item.duration_seconds)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-center">
                      {item.items_processed}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
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
                    <td className="px-2 py-3 whitespace-nowrap text-right">
                      <Button
                        onClick={() => handleDeleteClick(item.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete this history record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete History Record"
        description="Are you sure you want to delete this scraping history record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteHistoryItem}
        variant="destructive"
      />

      <ConfirmationDialog
        open={deleteAllConfirmOpen}
        onOpenChange={setDeleteAllConfirmOpen}
        title="Delete All History"
        description="Are you sure you want to delete all scraping history? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onConfirm={deleteAllHistory}
        variant="destructive"
      />
    </div>
  );
};

export default ScrapingSchedule;