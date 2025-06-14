import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Zap, AlertTriangle, AlertCircle } from 'lucide-react';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedText, ShimmerText } from '@/components/ui/animated-text';
import { DotsLoader, ProgressLoader } from '@/components/ui/animated-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AutomationProgress {
  job_id: string;
  phase: string;
  percentage: number;
  message: string;
  dispenser_id?: string;
  dispenser_title?: string;
  fuel_grades: string[];
  timestamp: string;
}

interface AutomationJob {
  job_id: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  progress: AutomationProgress[];
  dispensers: any[];
}

interface AutomationProgressTrackerProps {
  userId: string;
  onProgressUpdate?: (progress: AutomationProgress) => void;
  onJobComplete?: (jobId: string) => void;
  onJobError?: (jobId: string, error: string) => void;
}

export const AutomationProgressTracker: React.FC<AutomationProgressTrackerProps> = ({
  userId,
  onProgressUpdate,
  onJobComplete,
  onJobError
}) => {
  const [activeJobs, setActiveJobs] = useState<Map<string, AutomationJob>>(new Map());
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (websocket) {
      websocket.close();
    }

    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/automation/ws/${userId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Progress tracker WebSocket connected');
      setConnectionStatus('connected');
      setLastUpdate(new Date());
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastUpdate(new Date());
        
        switch (data.type) {
          case 'form_automation_progress':
            handleProgressUpdate(data.data);
            break;
          case 'form_automation_complete':
            handleJobComplete(data.data);
            break;
          case 'form_automation_error':
            handleJobError(data.data);
            break;
          case 'batch_automation_progress':
            handleBatchProgress(data.data);
            break;
          case 'batch_automation_complete':
            handleBatchComplete(data.data);
            break;
          case 'batch_automation_error':
            handleBatchError(data.data);
            break;
          case 'ping_response':
            // Connection keepalive
            break;
          default:
            console.log('Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('Progress tracker WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
    
    ws.onclose = (event) => {
      console.log('Progress tracker WebSocket closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after 3 seconds if not intentionally closed
      if (event.code !== 1000) {
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };
    
    setWebsocket(ws);
  }, [userId, websocket]);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  // Send periodic ping to keep connection alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [websocket]);

  const handleProgressUpdate = (progress: AutomationProgress) => {
    setActiveJobs(prev => {
      const updated = new Map(prev);
      const existingJob = updated.get(progress.job_id);
      
      if (existingJob) {
        // Update existing job
        existingJob.progress.push(progress);
        updated.set(progress.job_id, existingJob);
      } else {
        // Create new job entry
        const newJob: AutomationJob = {
          job_id: progress.job_id,
          status: 'running',
          created_at: progress.timestamp,
          started_at: progress.timestamp,
          progress: [progress],
          dispensers: []
        };
        updated.set(progress.job_id, newJob);
      }
      
      return updated;
    });

    if (onProgressUpdate) {
      onProgressUpdate(progress);
    }
  };

  const handleJobComplete = (data: any) => {
    setActiveJobs(prev => {
      const updated = new Map(prev);
      const job = updated.get(data.job_id);
      
      if (job) {
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        updated.set(data.job_id, job);
      }
      
      return updated;
    });

    if (onJobComplete) {
      onJobComplete(data.job_id);
    }
  };

  const handleJobError = (data: any) => {
    setActiveJobs(prev => {
      const updated = new Map(prev);
      const job = updated.get(data.job_id);
      
      if (job) {
        job.status = 'failed';
        job.error_message = data.error;
        job.completed_at = new Date().toISOString();
        updated.set(data.job_id, job);
      }
      
      return updated;
    });

    if (onJobError) {
      onJobError(data.job_id, data.error);
    }
  };

  const handleBatchProgress = (progress: any) => {
    // Handle batch automation progress
    console.log('Batch progress:', progress);
  };

  const handleBatchComplete = (data: any) => {
    console.log('Batch completed:', data);
  };

  const handleBatchError = (data: any) => {
    console.log('Batch error:', data);
  };

  const getLatestProgress = (job: AutomationJob): AutomationProgress | null => {
    return job.progress.length > 0 ? job.progress[job.progress.length - 1] : null;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'running': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getPhaseDescription = (phase: string): string => {
    const phases = {
      'initializing': 'Initializing automation...',
      'login_phase': 'Logging into WorkFossa...',
      'navigation_phase': 'Navigating to visit page...',
      'form_detection': 'Detecting AccuMeasure forms...',
      'form_preparation': 'Preparing form automation...',
      'form_filling': 'Filling dispenser forms...',
      'dispenser_automation': 'Automating dispenser testing...',
      'validation': 'Validating form data...',
      'completion': 'Finalizing automation...',
      'error': 'Error occurred'
    };
    return phases[phase] || phase;
  };

  const activeJobsArray = Array.from(activeJobs.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <AnimatedCard animate="slide" hover="lift" className="glass-dark">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <ShimmerText text="Automation Progress Tracker" />
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <Badge 
              variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'connecting' ? 'secondary' : 'destructive'}
              className={`flex items-center gap-2 ${
                connectionStatus === 'connected' ? 'badge-gradient' : ''
              }`}
            >
              {connectionStatus === 'connected' ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="capitalize">{connectionStatus}</span>
            </Badge>
            
            {/* Last Update */}
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">

        {/* Active Jobs */}
        {activeJobsArray.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="mx-auto h-12 w-12 text-muted-foreground animate-bounce" />
            <h3 className="mt-2 text-sm font-medium">
              <AnimatedText text="No active automations" animationType="reveal" />
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <AnimatedText text="Start an automation job to see real-time progress here." animationType="fade" delay={0.2} />
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
            {activeJobsArray.map((job, index) => {
              const latestProgress = getLatestProgress(job);
              
              return (
                <GlowCard 
                  key={job.job_id} 
                  className="p-4 glass animate-slide-in-from-right mb-4"
                  style={{animationDelay: `${index * 0.1}s`}}
                  glowColor={job.status === 'running' ? 'rgba(59, 130, 246, 0.3)' : undefined}
                >
                  <div className="space-y-4">
                    {/* Job Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate">
                          <AnimatedText text={`Job ${job.job_id.substring(0, 8)}...`} animationType="fade" />
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Started: {formatTimestamp(job.started_at || job.created_at)}
                        </p>
                      </div>
                      
                      <div className="text-right ml-4 flex-shrink-0">
                        <Badge 
                          variant={getStatusBadgeVariant(job.status)}
                          className={job.status === 'completed' ? 'badge-gradient' : ''}
                        >
                          {job.status}
                        </Badge>
                        {job.completed_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed: {formatTimestamp(job.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Current Progress */}
                    {latestProgress && job.status === 'running' && (
                      <div className="space-y-3 border-t border-border/50 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium leading-tight">
                            {getPhaseDescription(latestProgress.phase)}
                          </span>
                          <span className="text-sm font-semibold">
                            {Math.round(latestProgress.percentage)}%
                          </span>
                        </div>
                        
                        <ProgressLoader progress={latestProgress.percentage} showPercentage={false} />
                        
                        <div className="bg-muted/30 rounded-md p-3">
                          <p className="text-xs text-muted-foreground break-words">
                            <AnimatedText text={latestProgress.message} animationType="fade" />
                          </p>
                        </div>
                        
                        {latestProgress.dispenser_id && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="chip chip-primary">
                              Current: Dispenser {latestProgress.dispenser_id}
                            </Badge>
                            {latestProgress.fuel_grades.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Grades: {latestProgress.fuel_grades.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error Message */}
                    {job.error_message && (
                      <Alert variant="destructive" className="alert-modern error mt-3">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="break-words">{job.error_message}</AlertDescription>
                      </Alert>
                    )}

                    {/* Running Indicator */}
                    {job.status === 'running' && (
                      <div className="flex items-center space-x-2 pt-2 border-t border-border/50">
                        <DotsLoader size="sm" />
                        <span className="text-sm text-primary">
                          <AnimatedText text="Automation in progress..." animationType="fade" />
                        </span>
                      </div>
                    )}
                  </div>
                </GlowCard>
              );
            })}
          </div>
        )}

        {/* Connection Lost Warning */}
        {connectionStatus === 'disconnected' && (
          <Alert className="alert-modern warning animate-slide-in-from-bottom">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <span className="font-medium">Connection Lost</span>
              <br />
              Real-time updates are temporarily unavailable. Attempting to reconnect...
            </AlertDescription>
          </Alert>
        )}
        </div>
      </CardContent>
    </AnimatedCard>
  );
};