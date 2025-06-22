import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertCircle, Pause, Calendar, Activity, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useScrapingStatus } from '../contexts/ScrapingStatusContext';

interface ScrapingStatusData {
  enabled: boolean;
  next_run: string | null;
  last_run: string | null;
  last_success: boolean | null;
  items_processed: number | null;
  is_running: boolean;
}

interface ScrapingStatusProps {
  compact?: boolean;
  showDetails?: boolean;
}

const ScrapingStatus: React.FC<ScrapingStatusProps> = ({ 
  compact = false, 
  showDetails = true 
}) => {
  const [status, setStatus] = useState<ScrapingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const { subscribe } = useScrapingStatus();

  const fetchStatus = async () => {
    try {
      // Get schedules with a shorter timeout for better UX
      const schedulesResponse = await apiClient.get('/api/scraping-schedules/', {
        timeout: 10000 // 10 seconds instead of 30
      });
      const schedules = schedulesResponse.data;
      
      if (schedules && schedules.length > 0) {
        const schedule = schedules[0];
        
        // Get latest history
        const historyResponse = await apiClient.get('/api/scraping-schedules/history/work_orders?limit=1', {
          timeout: 10000 // 10 seconds instead of 30
        });
        const history = historyResponse.data;
        
        const lastRun = history && history.length > 0 ? history[0] : null;
        
        setStatus({
          enabled: schedule.enabled,
          next_run: schedule.next_run,
          last_run: lastRun?.started_at || null,
          last_success: lastRun?.success || null,
          items_processed: lastRun?.items_processed || null,
          is_running: schedule.pending || false
        });
      } else {
        setStatus(null);
      }
    } catch (error) {
      console.error('Failed to fetch scraping status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribe(() => {
      // Fetch immediately when notified of a change
      fetchStatus();
    });
    
    // Also keep polling as a fallback (but less frequently)
    const interval = setInterval(fetchStatus, 60000); // Reduced to 60 seconds
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [subscribe]);

  const getTimeUntilNext = () => {
    if (!status?.next_run) return 'Not scheduled';
    
    try {
      const nextRunDate = new Date(status.next_run);
      
      // Check if date is valid
      if (isNaN(nextRunDate.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffMs = nextRunDate.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMs < 0) return 'Any moment...';
      if (diffMins < 1) return 'Less than a minute';
      if (diffMins < 60) return `${diffMins} min`;
      
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours < 24) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      
      return formatDistanceToNow(nextRunDate, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting next run date:', error);
      return 'Error';
    }
  };

  const getTimeSinceLast = () => {
    if (!status?.last_run) return 'Never';
    
    try {
      // Parse the date - backend sends UTC timestamps
      let lastRunDate: Date;
      
      // Handle both timezone-aware (with Z or +00:00) and naive timestamps
      if (status.last_run.includes('Z') || status.last_run.includes('+')) {
        // Already has timezone info
        lastRunDate = new Date(status.last_run);
      } else {
        // Naive datetime - assume it's UTC
        lastRunDate = new Date(status.last_run + 'Z');
      }
      
      // Check if date is valid
      if (isNaN(lastRunDate.getTime())) {
        return 'Invalid date';
      }
      
      // Debug logging
      const now = new Date();
      const timeDiff = now.getTime() - lastRunDate.getTime();
      
      if (timeDiff < 0) {
        console.warn('Date parsing issue detected:', {
          original: status.last_run,
          parsed: lastRunDate.toISOString(),
          now: now.toISOString(),
          diffMs: timeDiff,
          diffMins: timeDiff / 60000
        });
      }
      
      return formatDistanceToNow(lastRunDate, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting last run date:', error, { lastRun: status?.last_run });
      return 'Error';
    }
  };

  const getStatusIcon = () => {
    if (status?.is_running) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (!status?.enabled) {
      return <Pause className="w-4 h-4 text-muted-foreground" />;
    }
    
    if (status?.last_success === false) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (status?.is_running) return 'Scraping...';
    if (!status?.enabled) return 'Paused';
    if (status?.last_success === false) return 'Last run failed';
    return 'Active';
  };

  const getGlowClass = () => {
    if (status?.is_running) {
      return 'border-blue-500/30 shadow-lg shadow-blue-500/10';
    }
    if (!status?.enabled) {
      return 'border-border/60 opacity-75';
    }
    if (status?.last_success === false) {
      return 'border-red-500/30 shadow-sm shadow-red-500/10';
    }
    return 'border-green-500/20 shadow-sm shadow-green-500/5';
  };

  if (loading) {
    return (
      <div className="relative p-3 rounded-lg bg-card border border-border animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-20"></div>
        </div>
        <div className="h-3 bg-muted rounded w-32"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div 
        className="relative group"
        onClick={() => navigate('/settings?tab=scraping&section=scraping-schedule')}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative p-3.5 rounded-lg bg-card/80 backdrop-blur-sm border border-dashed border-muted-foreground/20 hover:border-primary/30 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/30 group-hover:bg-primary/10 transition-all duration-300">
                <RefreshCw className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Enable Auto-Sync</p>
                <p className="text-xs text-muted-foreground">Keep work orders up-to-date</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="relative group">
        {/* Glow effect on hover */}
        {status?.is_running && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg blur-xl animate-pulse"></div>
        )}
        
        <div 
          className={cn(
            "relative p-3.5 rounded-lg border transition-all duration-300 cursor-pointer",
            "hover:shadow-lg hover:border-muted-foreground/40",
            "bg-gradient-to-br from-card/80 to-card",
            getGlowClass()
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300",
                status?.is_running 
                  ? "bg-blue-500/20 shadow-lg shadow-blue-500/20" 
                  : status?.enabled 
                    ? "bg-green-500/10 hover:bg-green-500/20" 
                    : "bg-muted/50"
              )}>
                {getStatusIcon()}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Work Order Sync</span>
                  {status?.is_running && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500 font-medium animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {status?.is_running ? (
                      <span className="text-blue-500 font-medium">Syncing now...</span>
                    ) : (
                      <>Next: <span className="font-medium text-foreground">{getTimeUntilNext()}</span></>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status?.last_success !== null && !status?.is_running && (
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  status.last_success ? "bg-green-500" : "bg-red-500"
                )} />
              )}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground/70 transition-transform" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground/70 transition-transform" />
              )}
            </div>
          </div>
          
          {isExpanded && (
            <div className="mt-3.5 pt-3.5 border-t border-border/40 space-y-3">
              {/* Schedule Information */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Next Sync</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {status.next_run ? (() => {
                      try {
                        const date = new Date(status.next_run);
                        if (isNaN(date.getTime())) {
                          return 'Invalid';
                        }
                        return format(date, 'h:mm a');
                      } catch {
                        return 'Error';
                      }
                    })() : 'Not set'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Last Sync</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {getTimeSinceLast()}
                    </span>
                    {status.last_success !== null && (
                      <span className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full",
                        status.last_success ? "bg-green-500" : "bg-red-500"
                      )} />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Stats */}
              {status.items_processed !== null && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-background/60">
                      <Activity className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">Last run processed</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {status.items_processed}
                    <span className="text-xs font-normal text-muted-foreground ml-1">orders</span>
                  </span>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/work-orders');
                  }}
                  className="flex-1 text-xs py-1.5 px-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-all"
                >
                  View Orders
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/settings?tab=scraping&section=scraping-schedule');
                  }}
                  className="flex-1 text-xs py-1.5 px-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-all"
                >
                  Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border transition-all duration-300 ${getGlowClass()}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-2">
          {getStatusIcon()}
          Work Order Scraping
        </h3>
        <span className="text-sm text-gray-500">{getStatusText()}</span>
      </div>
      
      {showDetails && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Next run:</span>
            <span className="font-medium">
              {status.next_run ? (
                <>
                  {getTimeUntilNext()}
                  <span className="text-xs text-gray-500 ml-1">
                    {(() => {
                      try {
                        const date = new Date(status.next_run);
                        if (isNaN(date.getTime())) {
                          return '';
                        }
                        return `(${format(date, 'h:mm a')})`;
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </>
              ) : (
                'Not scheduled'
              )}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Last run:</span>
            <span className="font-medium">
              {status.last_run ? (
                <>
                  {getTimeSinceLast()}
                  {status.last_success !== null && (
                    <span className={`ml-1 ${status.last_success ? 'text-green-600' : 'text-red-600'}`}>
                      {status.last_success ? '✓' : '✗'}
                    </span>
                  )}
                </>
              ) : (
                'Never'
              )}
            </span>
          </div>
          
          {status.items_processed !== null && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Items processed:</span>
              <span className="font-medium">{status.items_processed} work orders</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScrapingStatus;