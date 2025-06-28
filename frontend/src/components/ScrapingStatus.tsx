import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertCircle, Pause, Calendar, Activity, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { getRelativeTime } from '../utils/dateFormat';
import { logger } from '../services/fileLoggingService';

interface ScrapingStatusData {
  enabled: boolean;
  next_run: string | null;
  last_run: string | null;
  last_success: boolean | null;
  items_processed: number | null;
  is_running: boolean;
  consecutive_failures: number;
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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    const startTime = Date.now();
    logger.info('components.ScrapingStatus', 'Fetching scraping status...', { retryCount });
    
    try {
      setError(null);
      
      // Get schedules with a shorter timeout for quick status checks
      const schedulesResponse = await apiClient.get('/api/scraping-schedules/', {
        timeout: 10000 // 10 second timeout for status checks
      });
      const schedules = schedulesResponse.data;
      
      logger.info('components.ScrapingStatus', 'Schedules fetched successfully', { 
        scheduleCount: schedules?.length || 0,
        duration: Date.now() - startTime
      });
      
      if (schedules && schedules.length > 0) {
        const schedule = schedules[0];
        
        // Get latest history with error handling
        let lastRun = null;
        try {
          const historyResponse = await apiClient.get(`/api/scraping-schedules/${schedule.id}/history?limit=1`, {
            timeout: 5000 // 5 second timeout for history
          });
          const history = historyResponse.data;
          lastRun = history && history.length > 0 ? history[0] : null;
        } catch (historyError: any) {
          console.warn('Could not fetch history (non-critical):', historyError.message);
          // Continue without history data - it's not critical for basic status
        }
        
        // Check if currently running (started within last 5 minutes without completion)
        const isRunning = lastRun && 
          !lastRun.completed_at && 
          new Date(lastRun.started_at).getTime() > Date.now() - 5 * 60 * 1000;
        
        setStatus({
          enabled: schedule.enabled,
          next_run: schedule.next_run,
          last_run: schedule.last_run,
          last_success: lastRun?.success || null,
          items_processed: lastRun?.items_processed || null,
          is_running: isRunning || false,
          consecutive_failures: schedule.consecutive_failures || 0
        });
        
        // Reset retry count on success
        setRetryCount(0);
      } else {
        setStatus(null); // No schedules configured
      }
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        duration: Date.now() - startTime,
        retryCount
      };
      
      logger.error('components.ScrapingStatus', 'Error fetching scraping status', errorDetails);
      
      // Set user-friendly error message
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setError('Unable to fetch status (timeout). The server might be busy.');
        logger.warn('components.ScrapingStatus', 'Request timeout after 10 seconds', errorDetails);
      } else if (error.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (error.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else if (!navigator.onLine) {
        setError('No internet connection.');
      } else {
        setError('Unable to fetch scraping status.');
      }
      
      // Increment retry count for exponential backoff
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Dynamic refresh interval with exponential backoff on errors
    const baseInterval = 30000; // 30 seconds
    const maxInterval = 300000; // 5 minutes
    const currentInterval = Math.min(baseInterval * Math.pow(2, retryCount), maxInterval);
    
    const interval = setInterval(fetchStatus, currentInterval);
    
    // Listen for schedule updates
    const handleScheduleUpdate = (event: CustomEvent) => {
      console.log('=== SCRAPING STATUS: Schedule Update Event Received ===');
      console.log('Event detail:', event.detail);
      if (event.detail && event.detail.schedule) {
        const schedule = event.detail.schedule;
        console.log('Updated schedule:', {
          enabled: schedule.enabled,
          next_run: schedule.next_run,
          interval_hours: schedule.interval_hours
        });
      }
      console.log('Refreshing status display...');
      setRetryCount(0); // Reset retry count on manual update
      fetchStatus();
    };
    
    window.addEventListener('scraping-schedule-updated', handleScheduleUpdate as any);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('scraping-schedule-updated', handleScheduleUpdate as any);
    };
  }, [retryCount]);

  const handleNavigate = () => {
    navigate('/settings?tab=scraping&section=scraping-schedule');
  };

  if (loading && !error) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-600">{error}</span>
        </div>
        {!compact && (
          <button
            onClick={() => {
              setRetryCount(0);
              setLoading(true);
              fetchStatus();
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-sm text-gray-500">
        No schedule configured
      </div>
    );
  }

  const getStatusIcon = () => {
    if (status.is_running) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (!status.enabled) {
      return <Pause className="w-4 h-4 text-gray-400" />;
    }
    if (status.consecutive_failures >= 3) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (status.last_success === false) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (status.is_running) return 'Running';
    if (!status.enabled) return 'Paused';
    if (status.consecutive_failures >= 5) return 'Failed';
    if (status.consecutive_failures >= 3) return 'Having Issues';
    if (status.last_success === false) return 'Last Run Failed';
    return 'Active';
  };

  const getStatusColor = () => {
    if (status.is_running) return 'text-blue-600';
    if (!status.enabled) return 'text-gray-600';
    if (status.consecutive_failures >= 3) return 'text-red-600';
    if (status.last_success === false) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatNextRun = () => {
    if (!status.next_run || !status.enabled) return null;
    return getRelativeTime(status.next_run);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleNavigate}
          className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors flex-1"
        >
          {getStatusIcon()}
          <span className={cn("font-medium", getStatusColor())}>
            {getStatusText()}
          </span>
          {status.enabled && status.next_run && (
            <span className="text-gray-500">
              • {formatNextRun()}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRetryCount(0);
            setLoading(true);
            fetchStatus();
          }}
          className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
          title="Refresh status"
        >
          <RefreshCw className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div 
        className={cn(
          "flex items-center justify-between cursor-pointer",
          showDetails && "hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
        )}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className={cn("font-medium", getStatusColor())}>
              {getStatusText()}
            </div>
            {status.enabled && status.next_run && (
              <div className="text-sm text-gray-500">
                Next run {formatNextRun()}
              </div>
            )}
          </div>
        </div>
        {showDetails && (
          <button className="p-1">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {showDetails && isExpanded && (
        <div className="space-y-2 pl-7 text-sm">
          {status.last_run && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-3 h-3" />
              <span>
                Last run {formatDistanceToNow(new Date(status.last_run), { addSuffix: true })}
              </span>
            </div>
          )}
          
          {status.items_processed !== null && (
            <div className="flex items-center gap-2 text-gray-600">
              <Activity className="w-3 h-3" />
              <span>{status.items_processed} items processed</span>
            </div>
          )}
          
          {status.consecutive_failures > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span>{status.consecutive_failures} consecutive failures</span>
            </div>
          )}
          
          <button
            onClick={handleNavigate}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage Schedule →
          </button>
        </div>
      )}
    </div>
  );
};

export default ScrapingStatus;