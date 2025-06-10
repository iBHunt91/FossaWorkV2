import React, { useState, useEffect } from 'react';
import { 
  getQueueStatus, 
  listJobs, 
  cancelJob, 
  submitJob,
  startQueueProcessing,
  stopQueueProcessing,
  createQueueWebSocket,
  type QueueJob, 
  type QueueStatus 
} from '../services/api';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
import { 
  Play, 
  Pause, 
  X, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Activity
} from 'lucide-react';

interface QueueManagerProps {
  userId: string;
  onJobSubmitted?: (jobId: string) => void;
  onJobCompleted?: (jobId: string) => void;
}

const QueueManager: React.FC<QueueManagerProps> = ({ 
  userId, 
  onJobSubmitted, 
  onJobCompleted 
}) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    loadQueueData();
    
    if (autoRefresh) {
      const interval = setInterval(loadQueueData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [selectedStatus, autoRefresh]);

  useEffect(() => {
    // Set up WebSocket connection for real-time updates
    if (userId && autoRefresh) {
      const websocket = createQueueWebSocket(userId, handleWebSocketMessage);
      setWs(websocket);
      
      return () => {
        websocket.close();
      };
    }
  }, [userId, autoRefresh]);

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'queue_event') {
      console.log('Queue event received:', data);
      loadQueueData(); // Refresh data on queue events
      
      // Handle job completion callbacks
      if (data.data.event_type === 'job_completed' && onJobCompleted) {
        onJobCompleted(data.data.job_id);
      }
    }
  };

  const loadQueueData = async () => {
    try {
      setError(null);
      
      // Load queue status and jobs in parallel
      const [statusResponse, jobsResponse] = await Promise.all([
        getQueueStatus(),
        listJobs({ 
          user_id: userId, 
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          limit: 50 
        })
      ]);
      
      setQueueStatus(statusResponse);
      setJobs(jobsResponse.jobs);
      
    } catch (error) {
      console.error('Failed to load queue data:', error);
      setError(`Failed to load queue data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      loadQueueData(); // Refresh after cancellation
    } catch (error) {
      setError(`Failed to cancel job: ${error}`);
    }
  };

  const handleStartQueue = async () => {
    try {
      await startQueueProcessing();
      loadQueueData();
    } catch (error) {
      setError(`Failed to start queue: ${error}`);
    }
  };

  const handleStopQueue = async () => {
    try {
      await stopQueueProcessing();
      loadQueueData();
    } catch (error) {
      setError(`Failed to stop queue: ${error}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'queued':
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="small" />
          <span className="ml-2 text-gray-600">Loading queue status...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Status Overview */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Job Queue Status</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadQueueData}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Auto-refresh</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {queueStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">Total Jobs</p>
                  <p className="text-2xl font-bold text-blue-600">{queueStatus.metrics.total_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-900">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{queueStatus.metrics.pending_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">Running</p>
                  <p className="text-2xl font-bold text-blue-600">{queueStatus.metrics.running_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-900">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{queueStatus.metrics.completed_jobs}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Queue Processing: 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                queueStatus?.is_processing 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {queueStatus?.is_processing ? 'Active' : 'Stopped'}
              </span>
            </span>
            
            {queueStatus && queueStatus.metrics.average_execution_time > 0 && (
              <span className="text-sm text-gray-600">
                Avg Duration: {formatDuration(queueStatus.metrics.average_execution_time)}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {queueStatus?.is_processing ? (
              <button
                onClick={handleStopQueue}
                className="flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
              >
                <Pause className="w-4 h-4 mr-1" />
                Stop Queue
              </button>
            ) : (
              <button
                onClick={handleStartQueue}
                className="flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
              >
                <Play className="w-4 h-4 mr-1" />
                Start Queue
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Jobs List */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Jobs</h3>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedStatus === 'all' 
                ? 'No automation jobs have been submitted yet.'
                : `No jobs with status "${selectedStatus}".`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.job_id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  {getStatusIcon(job.status)}
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">
                        {job.job_type === 'single_visit' ? 'Single Visit' : 'Batch Processing'}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <div className="mt-1 text-sm text-gray-500">
                      {job.work_order_id && (
                        <span>Work Order: {job.work_order_id}</span>
                      )}
                      {job.batch_data && (
                        <span>Batch: {job.batch_data.visits?.length || 0} visits</span>
                      )}
                      
                      <span className="ml-4">
                        Created: {new Date(job.created_at).toLocaleString()}
                      </span>
                      
                      {job.execution_time_seconds > 0 && (
                        <span className="ml-4">
                          Duration: {formatDuration(job.execution_time_seconds)}
                        </span>
                      )}
                    </div>
                    
                    {job.error_message && (
                      <p className="mt-1 text-sm text-red-600">
                        Error: {job.error_message}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {job.retry_count > 0 && (
                    <span className="text-xs text-gray-500">
                      Retries: {job.retry_count}
                    </span>
                  )}
                  
                  {(job.status === 'pending' || job.status === 'queued' || job.status === 'running') && (
                    <button
                      onClick={() => handleCancelJob(job.job_id)}
                      className="p-2 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                      title="Cancel Job"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default QueueManager;