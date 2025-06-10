import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';

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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
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
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Automation Progress Tracker
          </h3>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600 capitalize">
                {connectionStatus}
              </span>
            </div>
            
            {/* Last Update */}
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Active Jobs */}
        {activeJobsArray.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active automations</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start an automation job to see real-time progress here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobsArray.map((job) => {
              const latestProgress = getLatestProgress(job);
              
              return (
                <Card key={job.job_id} className="p-4 bg-gray-50">
                  <div className="space-y-3">
                    {/* Job Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Job {job.job_id.substring(0, 8)}...
                        </h4>
                        <p className="text-sm text-gray-600">
                          Started: {formatTimestamp(job.started_at || job.created_at)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <span className={`font-medium capitalize ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.completed_at && (
                          <p className="text-xs text-gray-500">
                            Completed: {formatTimestamp(job.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Current Progress */}
                    {latestProgress && job.status === 'running' && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            {getPhaseDescription(latestProgress.phase)}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {Math.round(latestProgress.percentage)}%
                          </span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${latestProgress.percentage}%` }}
                          />
                        </div>
                        
                        <p className="text-xs text-gray-600">{latestProgress.message}</p>
                        
                        {latestProgress.dispenser_id && (
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              Current: Dispenser {latestProgress.dispenser_id}
                            </span>
                            {latestProgress.fuel_grades.length > 0 && (
                              <span className="text-gray-600">
                                Grades: {latestProgress.fuel_grades.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error Message */}
                    {job.error_message && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-700">{job.error_message}</p>
                      </div>
                    )}

                    {/* Running Indicator */}
                    {job.status === 'running' && (
                      <div className="flex items-center space-x-2 text-blue-600">
                        <LoadingSpinner size="small" />
                        <span className="text-sm">Automation in progress...</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Connection Lost Warning */}
        {connectionStatus === 'disconnected' && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">
                  Connection Lost
                </h4>
                <p className="text-sm text-yellow-700">
                  Real-time updates are temporarily unavailable. Attempting to reconnect...
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
};