import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Square, CheckCircle2, AlertCircle, Clock, Settings, ListChecks, Pause, RotateCcw } from 'lucide-react';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { ProgressLoader, DotsLoader, SkeletonLoader } from '@/components/ui/animated-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getWorkOrders, submitJob } from '../services/api';

interface WorkOrder {
  basic_info: {
    id: string;
    external_id: string;
    site_name: string;
    address: string;
    status: string;
  };
  scheduling: {
    scheduled_date: string;
    status: string;
  };
  dispensers: Array<{
    dispenser_number: string;
    dispenser_type: string;
    fuel_grades: Record<string, any>;
    status: string;
    progress_percentage: number;
    automation_completed: boolean;
  }>;
  visit_url?: string;
}

interface BatchJob {
  id: string;
  name: string;
  work_orders: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: {
    total_work_orders: number;
    completed_work_orders: number;
    total_dispensers: number;
    completed_dispensers: number;
    current_work_order?: string;
    current_dispenser?: string;
  };
  results?: {
    successful: number;
    failed: number;
    errors: string[];
  };
}

interface Props {
  userId: string;
  onBatchStarted?: (batchId: string) => void;
}

const BatchProcessor: React.FC<Props> = ({ userId, onBatchStarted }) => {
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<string[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [currentBatch, setCurrentBatch] = useState<BatchJob | null>(null);
  const [batchName, setBatchName] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [batchConfig, setBatchConfig] = useState({
    concurrent_jobs: 1,
    delay_between_jobs: 5000,
    retry_attempts: 3,
    auto_continue_on_error: false,
    notify_on_completion: true
  });

  const API_BASE = 'http://localhost:8000';

  // Load work orders
  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work-orders', userId],
    queryFn: () => getWorkOrders(userId),
  });

  // Auto-generate batch name
  useEffect(() => {
    if (selectedWorkOrders.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setBatchName(`Batch ${selectedWorkOrders.length} orders - ${timestamp}`);
    }
  }, [selectedWorkOrders]);

  // Filter work orders that are ready for automation
  const availableWorkOrders = workOrders?.filter((wo: WorkOrder) => 
    wo.scheduling?.status === 'pending' || wo.scheduling?.status === 'scheduled'
  ) || [];

  const handleWorkOrderSelection = (workOrderId: string, selected: boolean) => {
    if (selected) {
      setSelectedWorkOrders(prev => [...prev, workOrderId]);
    } else {
      setSelectedWorkOrders(prev => prev.filter(id => id !== workOrderId));
    }
  };

  const handleSelectAll = () => {
    if (selectedWorkOrders.length === availableWorkOrders.length) {
      setSelectedWorkOrders([]);
    } else {
      setSelectedWorkOrders(availableWorkOrders.map((wo: WorkOrder) => wo.basic_info.id));
    }
  };

  const createBatch = async () => {
    if (selectedWorkOrders.length === 0) {
      alert('Please select at least one work order');
      return;
    }

    try {
      // Prepare visits data for the job queue
      const visits = selectedWorkOrders.map(woId => {
        const workOrder = availableWorkOrders.find((wo: WorkOrder) => wo.basic_info.id === woId);
        return {
          work_order_id: woId,
          visit_url: workOrder?.visit_url || `https://app.workfossa.com/app/visits/work-order/${woId}`,
          dispensers: workOrder?.dispensers || []
        };
      });

      // Submit job to queue
      const response = await submitJob({
        user_id: userId,
        job_type: 'batch_processing',
        priority: 'normal',
        batch_data: {
          visits,
          options: {
            batch_config: batchConfig
          }
        }
      });

      if (response.success) {
        const newBatch: BatchJob = {
          id: response.job_id,
          name: batchName || `Batch ${selectedWorkOrders.length} orders`,
          work_orders: [...selectedWorkOrders],
          status: 'pending',
          created_at: new Date().toISOString(),
          progress: {
            total_work_orders: selectedWorkOrders.length,
            completed_work_orders: 0,
            total_dispensers: selectedWorkOrders.reduce((total, woId) => {
              const wo = availableWorkOrders.find((w: WorkOrder) => w.basic_info.id === woId);
              return total + (wo?.dispensers?.length || 0);
            }, 0),
            completed_dispensers: 0
          }
        };

        setBatchJobs(prev => [...prev, newBatch]);
        setSelectedWorkOrders([]);
        setBatchName('');
        
        onBatchStarted?.(response.job_id);
        
        alert(`Batch "${newBatch.name}" queued successfully!\nJob ID: ${response.job_id}\nVisits: ${visits.length}`);
      } else {
        throw new Error(response.message || 'Failed to queue batch');
      }
    } catch (error) {
      console.error('Failed to create batch:', error);
      alert(`Failed to create batch: ${error}`);
    }
  };

  const startBatch = async (batch: BatchJob) => {
    try {
      // Prepare batch data for API
      const visits = batch.work_orders.map(woId => {
        const workOrder = availableWorkOrders.find((wo: WorkOrder) => wo.basic_info.id === woId);
        return {
          work_order_id: woId,
          visit_url: workOrder?.visit_url || `https://app.workfossa.com/app/visits/work-order/${woId}`,
          dispensers: workOrder?.dispensers || []
        };
      });

      const response = await fetch(`${API_BASE}/api/v1/automation/form/process-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          visits: visits,
          batch_config: batchConfig
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update batch status
        setBatchJobs(prev => prev.map(b => 
          b.id === batch.id 
            ? { ...b, status: 'running', started_at: new Date().toISOString() }
            : b
        ));
        
        setCurrentBatch({ ...batch, status: 'running', started_at: new Date().toISOString() });
        onBatchStarted?.(batch.id);
        
        // Start progress monitoring
        monitorBatchProgress(batch.id);
        
      } else {
        const error = await response.json();
        alert(`Failed to start batch: ${error.detail}`);
      }
    } catch (error) {
      console.error('Batch start error:', error);
      alert('Network error while starting batch');
    }
  };

  const monitorBatchProgress = (batchId: string) => {
    // This would connect to WebSocket for real-time progress updates
    // For now, we'll simulate progress updates
    const interval = setInterval(() => {
      setBatchJobs(prev => prev.map(batch => {
        if (batch.id === batchId && batch.status === 'running') {
          const newCompleted = Math.min(
            batch.progress.completed_work_orders + 1,
            batch.progress.total_work_orders
          );
          
          const isComplete = newCompleted === batch.progress.total_work_orders;
          
          return {
            ...batch,
            status: isComplete ? 'completed' : 'running',
            completed_at: isComplete ? new Date().toISOString() : undefined,
            progress: {
              ...batch.progress,
              completed_work_orders: newCompleted,
              completed_dispensers: Math.min(
                batch.progress.completed_dispensers + 3,
                batch.progress.total_dispensers
              )
            },
            results: isComplete ? {
              successful: newCompleted,
              failed: 0,
              errors: []
            } : undefined
          };
        }
        return batch;
      }));
      
      // Stop monitoring when complete
      const batch = batchJobs.find(b => b.id === batchId);
      if (batch?.status === 'completed' || batch?.status === 'failed') {
        clearInterval(interval);
      }
    }, 3000);
  };

  const pauseBatch = (batchId: string) => {
    setBatchJobs(prev => prev.map(b => 
      b.id === batchId ? { ...b, status: 'paused' } : b
    ));
  };

  const cancelBatch = (batchId: string) => {
    setBatchJobs(prev => prev.map(b => 
      b.id === batchId ? { ...b, status: 'failed' } : b
    ));
  };

  const getBatchStatusIcon = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />;
      case 'running': return <Play className="w-4 h-4 text-primary animate-spin-slow" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />;
      case 'paused': return <Pause className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getProgressPercentage = (batch: BatchJob) => {
    if (batch.progress.total_work_orders === 0) return 0;
    return Math.round((batch.progress.completed_work_orders / batch.progress.total_work_orders) * 100);
  };

  if (isLoading) {
    return (
      <AnimatedCard animate="fade" hover="none" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <DotsLoader />
            <AnimatedText text="Loading work orders..." animationType="fade" className="text-muted-foreground" />
          </div>
        </CardContent>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Configuration */}
      <AnimatedCard animate="slide" hover="lift" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              <ShimmerText text="Batch Processing" />
            </h3>
            <MagneticButton
              onClick={() => setShowConfig(!showConfig)}
              variant="outline"
              size="sm"
              strength={0.1}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </MagneticButton>
          </div>

        {showConfig && (
          <GlowCard className="mb-6 p-4 bg-muted/50 animate-slide-in-from-top">
            <h4 className="font-medium mb-3">
              <AnimatedText text="Batch Configuration" animationType="reveal" />
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="concurrent-jobs">Concurrent Jobs</Label>
                <Input
                  id="concurrent-jobs"
                  type="number"
                  min="1"
                  max="5"
                  value={batchConfig.concurrent_jobs}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    concurrent_jobs: parseInt(e.target.value)
                  }))}
                  className="input-modern"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay-jobs">Delay Between Jobs (ms)</Label>
                <Input
                  id="delay-jobs"
                  type="number"
                  min="1000"
                  max="30000"
                  step="1000"
                  value={batchConfig.delay_between_jobs}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    delay_between_jobs: parseInt(e.target.value)
                  }))}
                  className="input-modern"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retry-attempts">Retry Attempts</Label>
                <Input
                  id="retry-attempts"
                  type="number"
                  min="0"
                  max="5"
                  value={batchConfig.retry_attempts}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    retry_attempts: parseInt(e.target.value)
                  }))}
                  className="input-modern"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchConfig.auto_continue_on_error}
                    onChange={(e) => setBatchConfig(prev => ({
                      ...prev,
                      auto_continue_on_error: e.target.checked
                    }))}
                    className="mr-2 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Continue on Error
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchConfig.notify_on_completion}
                    onChange={(e) => setBatchConfig(prev => ({
                      ...prev,
                      notify_on_completion: e.target.checked
                    }))}
                    className="mr-2 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Notify on Completion
                </label>
              </div>
            </div>
          </GlowCard>
        )}

        {/* Work Order Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              <AnimatedText text="Select Work Orders" animationType="fade" />
            </h4>
            <AnimatedButton
              onClick={handleSelectAll}
              variant="ghost"
              size="sm"
              animation="pulse"
            >
              {selectedWorkOrders.length === availableWorkOrders.length ? 'Deselect All' : 'Select All'}
            </AnimatedButton>
          </div>
          
          <div className="max-h-64 overflow-y-auto border border-border rounded-lg glass">
            {availableWorkOrders.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <AnimatedText text="No work orders available for automation" animationType="reveal" />
              </div>
            ) : (
              availableWorkOrders.map((workOrder: WorkOrder, index: number) => (
                <div
                  key={workOrder.basic_info.id}
                  className="flex items-center p-3 border-b border-border/50 last:border-b-0 hover:bg-accent/50 transition-colors animate-fade-in"
                  style={{animationDelay: `${index * 0.05}s`}}
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkOrders.includes(workOrder.basic_info.id)}
                    onChange={(e) => handleWorkOrderSelection(workOrder.basic_info.id, e.target.checked)}
                    className="mr-3 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{workOrder.basic_info.external_id}</div>
                    <div className="text-sm text-muted-foreground">{workOrder.basic_info.site_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {workOrder.dispensers?.length || 0} dispensers
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">
                      {workOrder.scheduling?.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {workOrder.scheduling?.scheduled_date && 
                        new Date(workOrder.scheduling.scheduled_date).toLocaleDateString()
                      }
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Batch Creation */}
        {selectedWorkOrders.length > 0 && (
          <div className="space-y-3 animate-slide-in-from-bottom" style={{animationDelay: '0.3s'}}>
            <div className="space-y-2">
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Enter batch name..."
                className="input-modern"
              />
            </div>
            <RippleButton
              onClick={createBatch}
              className="w-full"
              size="lg"
            >
              Queue Batch ({selectedWorkOrders.length} work orders)
            </RippleButton>
          </div>
        )}
        </CardContent>
      </AnimatedCard>

      {/* Active/Recent Batches */}
      <AnimatedCard animate="slide" delay={0.2} hover="lift" className="glass-dark">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            <ShimmerText text="Batch Jobs" />
          </h3>
        
        {batchJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListChecks className="w-12 h-12 mx-auto mb-3 animate-bounce" />
            <AnimatedText text="No batch jobs created yet" animationType="reveal" />
          </div>
        ) : (
          <div className="space-y-4">
            {batchJobs.map((batch, index) => (
              <AnimatedCard
                key={batch.id}
                className="p-4 glass"
                animate="slide"
                delay={index * 0.1}
                hover="lift"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getBatchStatusIcon(batch.status)}
                    <div>
                      <h4 className="font-medium">
                        <AnimatedText text={batch.name} animationType="fade" />
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {batch.work_orders.length} work orders, {batch.progress.total_dispensers} dispensers
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {batch.status === 'pending' && (
                      <AnimatedButton
                        onClick={() => startBatch(batch)}
                        size="sm"
                        animation="shimmer"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </AnimatedButton>
                    )}
                    
                    {batch.status === 'running' && (
                      <>
                        <AnimatedButton
                          onClick={() => pauseBatch(batch.id)}
                          size="sm"
                          variant="secondary"
                          animation="pulse"
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </AnimatedButton>
                        <AnimatedButton
                          onClick={() => cancelBatch(batch.id)}
                          size="sm"
                          variant="destructive"
                          animation="pulse"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Cancel
                        </AnimatedButton>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span className="font-semibold">{getProgressPercentage(batch)}%</span>
                  </div>
                  <ProgressLoader progress={getProgressPercentage(batch)} showPercentage={false} />
                </div>

                {/* Progress Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="animate-fade-in" style={{animationDelay: '0.1s'}}>
                    <span className="text-muted-foreground">Work Orders:</span>
                    <div className="font-medium">
                      <span className="number-display">{batch.progress.completed_work_orders}</span>
                      <span className="text-muted-foreground"> / {batch.progress.total_work_orders}</span>
                    </div>
                  </div>
                  <div className="animate-fade-in" style={{animationDelay: '0.2s'}}>
                    <span className="text-muted-foreground">Dispensers:</span>
                    <div className="font-medium">
                      <span className="number-display">{batch.progress.completed_dispensers}</span>
                      <span className="text-muted-foreground"> / {batch.progress.total_dispensers}</span>
                    </div>
                  </div>
                  <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
                    <span className="text-muted-foreground">Started:</span>
                    <div className="font-medium">
                      {batch.started_at ? new Date(batch.started_at).toLocaleTimeString() : 'Not started'}
                    </div>
                  </div>
                  <div className="animate-fade-in" style={{animationDelay: '0.4s'}}>
                    <span className="text-muted-foreground">Duration:</span>
                    <div className="font-medium">
                      {batch.started_at ? 
                        Math.round((new Date().getTime() - new Date(batch.started_at).getTime()) / 1000 / 60) + 'm'
                        : '-'
                      }
                    </div>
                  </div>
                </div>

                {/* Results */}
                {batch.results && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex gap-4 text-sm">
                      <Badge variant="default" className="badge-gradient">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {batch.results.successful} successful
                      </Badge>
                      {batch.results.failed > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {batch.results.failed} failed
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </AnimatedCard>
            ))}
          </div>
        )}
        </CardContent>
      </AnimatedCard>
    </div>
  );
};

export default BatchProcessor;