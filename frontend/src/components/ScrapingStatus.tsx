import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertCircle, Pause, Calendar, Activity, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { getRelativeTime } from '../utils/dateFormat';

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
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      // Get schedules
      const schedulesResponse = await apiClient.get('/api/scraping-schedules/');
      const schedules = schedulesResponse.data;
      
      if (schedules && schedules.length > 0) {
        const schedule = schedules[0];
        
        // Get latest history
        let lastRun = null;
        try {
          const historyResponse = await apiClient.get(`/api/scraping-schedules/${schedule.id}/history?limit=1`);
          const history = historyResponse.data;
          lastRun = history && history.length > 0 ? history[0] : null;
        } catch (error) {
          console.error('Error fetching history:', error);
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
      }
    } catch (error) {
      console.error('Error fetching scraping status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    
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
      fetchStatus();
    };
    
    window.addEventListener('scraping-schedule-updated', handleScheduleUpdate as any);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('scraping-schedule-updated', handleScheduleUpdate as any);
    };
  }, []);

  const handleNavigate = () => {
    navigate('/schedules');
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
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
      <button
        onClick={handleNavigate}
        className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-lg p-2 transition-colors"
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