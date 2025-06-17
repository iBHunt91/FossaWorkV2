import React, { useState, useEffect, useCallback } from 'react';
import { Play, StopCircle, Eye, EyeOff, CheckCircle, Clock, Activity, Fuel, Zap, Settings2, Settings } from 'lucide-react';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button';
import { Button } from '@/components/ui/button';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { ProgressLoader, DotsLoader } from '@/components/ui/animated-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cleanSiteName } from '@/utils/storeColors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { DispenserInfoModal } from './DispenserInfoModal';

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
  const { user } = useAuth();
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
  const [selectedDispenser, setSelectedDispenser] = useState<Dispenser | null>(null);
  const [showDispenserModal, setShowDispenserModal] = useState(false);

  // WebSocket connection for real-time progress
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/automation/ws/${user?.id || 'demo-user'}`;
    
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
          user_id: user?.id || 'demo-user',
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

  const handleDispenserInfoClick = (dispenser: Dispenser) => {
    setSelectedDispenser(dispenser);
    setShowDispenserModal(true);
  };

  return (
    <AnimatedCard animate="fade" hover="lift" className="glass-dark">
      <CardContent className="p-6">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">
              <ShimmerText text="Dispenser Automation" />
            </h3>
            <p className="text-sm text-muted-foreground">
              <AnimatedText text={`${cleanSiteName(workOrder.site_name)} - ${workOrder.external_id}`} animationType="fade" delay={0.2} />
            </p>
          </div>
          
          <div className="flex space-x-2">
            {!isRunning ? (
              <AnimatedButton
                onClick={startAutomation}
                disabled={dispensers.length === 0}
                animation="shimmer"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Automation
              </AnimatedButton>
            ) : (
              <AnimatedButton
                onClick={stopAutomation}
                variant="destructive"
                animation="pulse"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Stop Automation
              </AnimatedButton>
            )}
            
            <MagneticButton
              onClick={() => setShowCredentials(!showCredentials)}
              variant="outline"
              strength={0.1}
            >
              {showCredentials ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              Credentials
            </MagneticButton>
          </div>
        </div>

        {/* Credentials Section */}
        {showCredentials && (
          <GlowCard className="p-4 bg-muted/50 animate-slide-in-from-top">
            <h4 className="font-semibold mb-3">
              <AnimatedText text="WorkFossa Credentials" animationType="reveal" />
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <Input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="input-modern"
                  placeholder="Enter WorkFossa username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="input-modern"
                  placeholder="Enter WorkFossa password"
                />
              </div>
            </div>
          </GlowCard>
        )}

        {/* Overall Progress */}
        {isRunning && (
          <GlowCard className="p-4 bg-primary/5 animate-pulse-glow" glowColor="rgba(59, 130, 246, 0.3)">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <DotsLoader />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium leading-tight">
                      <AnimatedText text={getPhaseDescription(currentPhase)} animationType="fade" />
                    </span>
                    <span className="text-sm font-semibold">
                      {Math.round(overallProgress)}%
                    </span>
                  </div>
                  <ProgressLoader progress={overallProgress} showPercentage={false} />
                </div>
              </div>
              
              {statusMessage && (
                <div className="bg-muted/20 rounded-md p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground break-words leading-relaxed">
                    <AnimatedText text={statusMessage} animationType="fade" />
                  </p>
                </div>
              )}
              
              {currentDispenser && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                  <Badge variant="secondary" className="animate-pulse">
                    <Activity className="w-3 h-3 mr-1" />
                    Processing Dispenser {currentDispenser}
                  </Badge>
                </div>
              )}
            </div>
          </GlowCard>
        )}

        {/* Dispensers List */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-primary" />
            <ShimmerText text={`Dispensers (${dispensers.length})`} />
          </h4>
          
          {dispensers.length === 0 ? (
            <AnimatedCard className="p-4 text-center" animate="bounce" hover="glow">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-2 animate-pulse" />
              <p className="text-muted-foreground">
                <AnimatedText text="No dispensers found for this work order." animationType="reveal" />
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <AnimatedText text='Try running "Scrape Work Orders" first to load dispenser data.' animationType="fade" delay={0.2} />
              </p>
              <Button
                onClick={() => {
                  setSelectedDispenser(null);
                  setShowDispenserModal(true);
                }}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                <Settings className="w-4 h-4 mr-2" />
                View Dispenser Info
              </Button>
            </AnimatedCard>
          ) : (
            <div className="space-y-3">
              {dispensers.map((dispenser, index) => (
                <AnimatedCard
                  key={dispenser.dispenser_number}
                  className={`p-4 transition-all duration-200 ${
                    dispenser.dispenser_number === currentDispenser
                      ? 'ring-2 ring-primary bg-primary/5 glass'
                      : 'glass-dark'
                  }`}
                  hover="lift"
                  animate="slide"
                  delay={index * 0.1}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">
                          <AnimatedText text={`Dispenser ${dispenser.dispenser_number}`} animationType="fade" />
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {dispenser.dispenser_type}
                        </span>
                        {dispenser.automation_completed && (
                          <Badge variant="default" className="badge-gradient">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {dispenser.dispenser_number === currentDispenser && (
                          <Badge variant="secondary" className="animate-pulse">
                            <Zap className="w-3 h-3 mr-1 animate-spin-slow" />
                            Processing
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">
                          Fuel Grades: {formatFuelGrades(dispenser.fuel_grades)}
                        </p>
                      </div>
                      
                      {(isRunning || dispenser.automation_completed) && (
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted-foreground">Progress</span>
                            <span className="text-xs font-semibold">
                              {Math.round(dispenser.progress_percentage)}%
                            </span>
                          </div>
                          <ProgressLoader progress={dispenser.progress_percentage} showPercentage={false} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          dispenser.automation_completed ? 'default' :
                          dispenser.dispenser_number === currentDispenser ? 'secondary' :
                          'outline'
                        }
                        className={dispenser.automation_completed ? 'badge-gradient' : ''}
                      >
                        {dispenser.status}
                      </Badge>
                      <Button
                        onClick={() => handleDispenserInfoClick(dispenser)}
                        variant="outline"
                        size="sm"
                        className="p-2 hover:bg-primary/10 transition-colors"
                        title="View Dispenser Details"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <GlowCard className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5 animate-slide-in-from-bottom" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="animate-scale-in" style={{animationDelay: '0.6s'}}>
              <p className="text-2xl font-bold">
                <GradientText text={String(dispensers.length)} gradient="from-blue-600 to-purple-600" />
              </p>
              <p className="text-sm text-muted-foreground">Total Dispensers</p>
            </div>
            <div className="animate-scale-in" style={{animationDelay: '0.7s'}}>
              <p className="text-2xl font-bold">
                <GradientText text={String(dispensers.filter(d => d.automation_completed).length)} gradient="from-green-600 to-emerald-600" />
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="animate-scale-in" style={{animationDelay: '0.8s'}}>
              <p className="text-2xl font-bold">
                <GradientText text={String(dispensers.filter(d => !d.automation_completed).length)} gradient="from-orange-600 to-red-600" />
              </p>
              <p className="text-sm text-muted-foreground">Remaining</p>
            </div>
          </div>
        </GlowCard>
      </div>
      </CardContent>
      
      {/* Dispenser Info Modal */}
      <DispenserInfoModal
        isOpen={showDispenserModal}
        onClose={() => {
          setShowDispenserModal(false);
          setSelectedDispenser(null);
        }}
        dispenserData={selectedDispenser ? {
          workOrder: workOrder,
          dispensers: [selectedDispenser]
        } : null}
      />
    </AnimatedCard>
  );
};