import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';

interface FuelGrade {
  octane?: number;
  ethanol?: number;
  cetane?: number;
  position: number;
}

interface Dispenser {
  dispenser_number: string;
  dispenser_type: string;
  fuel_grades: Record<string, FuelGrade>;
  status: string;
  progress_percentage: number;
  automation_completed: boolean;
}

interface WorkOrder {
  id: string;
  external_id: string;
  site_name: string;
  address: string;
  scheduled_date: string;
  status: string;
  dispensers?: Dispenser[];
}

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

interface DispenserAutomationProps {
  workOrder: WorkOrder;
  onComplete?: (jobId: string) => void;
  onError?: (error: string) => void;
}

const PHASE_DESCRIPTIONS = {
  'initializing': 'Setting up automation...',
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

export const DispenserAutomation: React.FC<DispenserAutomationProps> = ({
  workOrder,
  onComplete,
  onError
}) => {
  const [dispensers, setDispensers] = useState<Dispenser[]>(workOrder.dispensers || []);
  const [isRunning, setIsRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentDispenser, setCurrentDispenser] = useState<string | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showCredentials, setShowCredentials] = useState(false);

  // WebSocket connection for real-time progress
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/automation/ws/user123`; // TODO: Get actual user ID
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected for automation progress');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'form_automation_progress') {
          handleProgressUpdate(data.data);
        } else if (data.type === 'form_automation_complete') {
          handleAutomationComplete(data.data);
        } else if (data.type === 'form_automation_error') {
          handleAutomationError(data.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (isRunning) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    setWebsocket(ws);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && !websocket) {
      connectWebSocket();
    }
    
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [isRunning, connectWebSocket, websocket]);

  const handleProgressUpdate = (progress: AutomationProgress) => {
    setOverallProgress(progress.percentage);
    setCurrentPhase(progress.phase);
    setStatusMessage(progress.message);
    
    if (progress.dispenser_id) {
      setCurrentDispenser(progress.dispenser_id);
      
      // Update individual dispenser progress
      setDispensers(prev => prev.map(d => 
        d.dispenser_number === progress.dispenser_id
          ? { ...d, progress_percentage: progress.percentage }
          : d
      ));
    }
  };

  const handleAutomationComplete = (data: any) => {
    setIsRunning(false);
    setOverallProgress(100);
    setCurrentPhase('completion');
    setStatusMessage('Automation completed successfully!');
    setCurrentDispenser(null);
    
    // Mark all dispensers as completed
    setDispensers(prev => prev.map(d => ({
      ...d,
      automation_completed: true,
      progress_percentage: 100,
      status: 'completed'
    })));
    
    if (onComplete) {
      onComplete(data.job_id);
    }
  };

  const handleAutomationError = (data: any) => {
    setIsRunning(false);
    setCurrentPhase('error');
    setStatusMessage(`Error: ${data.error}`);
    setCurrentDispenser(null);
    
    if (onError) {
      onError(data.error);
    }
  };

  const startAutomation = async () => {
    if (!credentials.username || !credentials.password) {
      setShowCredentials(true);
      return;
    }

    try {
      setIsRunning(true);
      setOverallProgress(0);
      setCurrentPhase('initializing');
      setStatusMessage('Starting form automation...');
      
      const response = await fetch('/api/v1/automation/form/process-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'user123', // TODO: Get actual user ID
          visit_url: `https://app.workfossa.com/work-orders/${workOrder.id}`, // TODO: Get actual visit URL
          work_order_id: workOrder.id,
          dispensers: dispensers,
          credentials: credentials
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to start automation');
      }

      setStatusMessage('Automation started successfully');
      
    } catch (error) {
      console.error('Failed to start automation:', error);
      setIsRunning(false);
      setStatusMessage(`Failed to start automation: ${error}`);
      if (onError) {
        onError(String(error));
      }
    }
  };

  const stopAutomation = async () => {
    if (currentJobId) {
      try {
        await fetch(`/api/v1/automation/form/jobs/${currentJobId}/cancel`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to cancel job:', error);
      }
    }
    
    setIsRunning(false);
    setStatusMessage('Automation stopped by user');
  };

  const getPhaseDescription = (phase: string): string => {
    return PHASE_DESCRIPTIONS[phase] || phase;
  };

  const getDispenserStatusColor = (dispenser: Dispenser): string => {
    if (dispenser.automation_completed) return 'text-green-600';
    if (dispenser.dispenser_number === currentDispenser) return 'text-blue-600';
    return 'text-gray-600';
  };

  const formatFuelGrades = (fuelGrades: Record<string, FuelGrade>): string => {
    return Object.keys(fuelGrades)
      .sort((a, b) => fuelGrades[a].position - fuelGrades[b].position)
      .map(grade => grade.charAt(0).toUpperCase() + grade.slice(1))
      .join(', ');
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Dispenser Automation
            </h3>
            <p className="text-sm text-gray-600">
              {workOrder.site_name} - {workOrder.external_id}
            </p>
          </div>
          
          <div className="flex space-x-2">
            {!isRunning ? (
              <button
                onClick={startAutomation}
                disabled={dispensers.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Automation
              </button>
            ) : (
              <button
                onClick={stopAutomation}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Stop Automation
              </button>
            )}
            
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Credentials
            </button>
          </div>
        </div>

        {/* Credentials Section */}
        {showCredentials && (
          <Card className="p-4 bg-gray-50">
            <h4 className="font-semibold mb-3">WorkFossa Credentials</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username/Email
                </label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter WorkFossa username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter WorkFossa password"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Overall Progress */}
        {isRunning && (
          <Card className="p-4 bg-blue-50">
            <div className="flex items-center space-x-3">
              <LoadingSpinner size="small" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {getPhaseDescription(currentPhase)}
                  </span>
                  <span className="text-sm font-semibold text-blue-900">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-700 mt-1">{statusMessage}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Dispensers List */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Dispensers ({dispensers.length})
          </h4>
          
          {dispensers.length === 0 ? (
            <Card className="p-4 text-center text-gray-500">
              <p>No dispensers found for this work order.</p>
              <p className="text-sm mt-1">
                Try running "Scrape Work Orders" first to load dispenser data.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {dispensers.map((dispenser) => (
                <Card
                  key={dispenser.dispenser_number}
                  className={`p-4 transition-all duration-200 ${
                    dispenser.dispenser_number === currentDispenser
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">
                          Dispenser {dispenser.dispenser_number}
                        </span>
                        <span className="text-sm text-gray-600">
                          {dispenser.dispenser_type}
                        </span>
                        {dispenser.automation_completed && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            ✓ Completed
                          </span>
                        )}
                        {dispenser.dispenser_number === currentDispenser && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            ⚡ Processing
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          Fuel Grades: {formatFuelGrades(dispenser.fuel_grades)}
                        </p>
                      </div>
                      
                      {(isRunning || dispenser.automation_completed) && (
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600">Progress</span>
                            <span className="text-xs font-semibold">
                              {Math.round(dispenser.progress_percentage)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                dispenser.automation_completed
                                  ? 'bg-green-500'
                                  : dispenser.dispenser_number === currentDispenser
                                  ? 'bg-blue-500'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${dispenser.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className={`text-right ${getDispenserStatusColor(dispenser)}`}>
                      <p className="text-sm font-medium capitalize">{dispenser.status}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <Card className="p-4 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{dispensers.length}</p>
              <p className="text-sm text-gray-600">Total Dispensers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {dispensers.filter(d => d.automation_completed).length}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {dispensers.filter(d => !d.automation_completed).length}
              </p>
              <p className="text-sm text-gray-600">Remaining</p>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
};