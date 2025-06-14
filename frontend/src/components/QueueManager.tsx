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
import { 
  Play, 
  Pause, 
  X, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Activity,
  ListChecks,
  BarChart
} from 'lucide-react';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { ProgressLoader, DotsLoader } from '@/components/ui/animated-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
        return <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />;
      case 'running':
        return <Activity className="w-4 h-4 text-primary animate-spin-slow" />;
      case 'queued':
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'secondary';
      case 'queued':
      case 'pending':
        return 'outline';
      default:
        return 'outline';
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
      <AnimatedCard animate="fade" hover="none" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <DotsLoader />
            <AnimatedText text="Loading queue status..." animationType="fade" className="text-muted-foreground" />
          </div>
        </CardContent>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Status Overview */}
      <AnimatedCard animate="slide" hover="lift" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              <ShimmerText text="Job Queue Status" />
            </h3>
            <div className="flex items-center space-x-2">
              <MagneticButton
                onClick={loadQueueData}
                variant="ghost"
                size="sm"
                title="Refresh"
                strength={0.1}
              >
                <RefreshCw className="w-4 h-4" />
              </MagneticButton>
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Auto-refresh</span>
              </label>
            </div>
          </div>

        {error && (
          <Alert variant="destructive" className="mb-4 alert-modern error animate-slide-in-from-right">
            <AlertDescription>{error}</AlertDescription>
            <AnimatedButton
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="absolute top-2 right-2"
              animation="pulse"
            >
              ×
            </AnimatedButton>
          </Alert>
        )}

        {queueStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <GlowCard className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-600/5 animate-scale-in" glowColor="rgba(59, 130, 246, 0.2)">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium">Total Jobs</p>
                  <p className="text-2xl font-bold">
                    <GradientText text={String(queueStatus.metrics.total_jobs)} gradient="from-blue-600 to-blue-700" />
                  </p>
                </div>
              </div>
            </GlowCard>
            
            <GlowCard className="p-4 bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 animate-scale-in" style={{animationDelay: '0.1s'}} glowColor="rgba(234, 179, 8, 0.2)">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold">
                    <GradientText text={String(queueStatus.metrics.pending_jobs)} gradient="from-yellow-600 to-yellow-700" />
                  </p>
                </div>
              </div>
            </GlowCard>
            
            <GlowCard className="p-4 bg-gradient-to-br from-primary/5 to-purple-600/5 animate-scale-in" style={{animationDelay: '0.2s'}} glowColor="rgba(147, 51, 234, 0.2)">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-primary" />
                <div className="ml-3">
                  <p className="text-sm font-medium">Running</p>
                  <p className="text-2xl font-bold">
                    <GradientText text={String(queueStatus.metrics.running_jobs)} gradient="from-blue-600 to-purple-600" />
                  </p>
                </div>
              </div>
            </GlowCard>
            
            <GlowCard className="p-4 bg-gradient-to-br from-green-500/5 to-green-600/5 animate-scale-in" style={{animationDelay: '0.3s'}} glowColor="rgba(34, 197, 94, 0.2)">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">
                    <GradientText text={String(queueStatus.metrics.completed_jobs)} gradient="from-green-600 to-green-700" />
                  </p>
                </div>
              </div>
            </GlowCard>
          </div>
        )}

        {/* Queue Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Queue Processing: 
              <Badge 
                variant={queueStatus?.is_processing ? 'default' : 'destructive'}
                className={`ml-2 ${queueStatus?.is_processing ? 'badge-gradient' : ''}`}
              >
                {queueStatus?.is_processing ? 'Active' : 'Stopped'}
              </Badge>
            </span>
            
            {queueStatus && queueStatus.metrics.average_execution_time > 0 && (
              <span className="text-sm text-muted-foreground">
                Avg Duration: <span className="font-medium">{formatDuration(queueStatus.metrics.average_execution_time)}</span>
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {queueStatus?.is_processing ? (
              <AnimatedButton
                onClick={handleStopQueue}
                variant="destructive"
                size="sm"
                animation="pulse"
              >
                <Pause className="w-4 h-4 mr-1" />
                Stop Queue
              </AnimatedButton>
            ) : (
              <AnimatedButton
                onClick={handleStartQueue}
                size="sm"
                animation="shimmer"
              >
                <Play className="w-4 h-4 mr-1" />
                Start Queue
              </AnimatedButton>
            )}
          </div>
        </div>
        </CardContent>
      </AnimatedCard>

      {/* Jobs List */}
      <AnimatedCard animate="slide" delay={0.2} hover="lift" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              <ShimmerText text="Recent Jobs" />
            </h3>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 input-modern"
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
            <BarChart className="mx-auto h-12 w-12 text-muted-foreground animate-bounce" />
            <h3 className="mt-2 text-sm font-medium">
              <AnimatedText text="No jobs found" animationType="reveal" />
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <AnimatedText 
                text={selectedStatus === 'all' 
                  ? 'No automation jobs have been submitted yet.'
                  : `No jobs with status "${selectedStatus}".`
                }
                animationType="fade"
                delay={0.2}
              />
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job, index) => (
              <AnimatedCard
                key={job.job_id}
                className="p-4 glass"
                animate="slide"
                delay={index * 0.05}
                hover="lift"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(job.status)}
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">
                          <AnimatedText 
                            text={job.job_type === 'single_visit' ? 'Single Visit' : 'Batch Processing'} 
                            animationType="fade" 
                          />
                        </h4>
                        <Badge 
                          variant={getStatusBadgeVariant(job.status)}
                          className={job.status === 'completed' ? 'badge-gradient' : ''}
                        >
                          {job.status}
                        </Badge>
                      </div>
                    
                      <div className="mt-1 text-sm text-muted-foreground">
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
                        <p className="mt-1 text-sm text-destructive">
                          Error: {job.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                
                  <div className="flex items-center space-x-2">
                    {job.retry_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Retries: {job.retry_count}
                      </span>
                    )}
                    
                    {(job.status === 'pending' || job.status === 'queued' || job.status === 'running') && (
                      <MagneticButton
                        onClick={() => handleCancelJob(job.job_id)}
                        variant="ghost"
                        size="sm"
                        title="Cancel Job"
                        strength={0.1}
                      >
                        <X className="w-4 h-4" />
                      </MagneticButton>
                    )}
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        )}
        </CardContent>
      </AnimatedCard>
    </div>
  );
};

export default QueueManager;