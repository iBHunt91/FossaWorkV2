import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Square, CheckCircle2, AlertCircle, Clock, Settings } from 'lucide-react';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';
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
      case 'pending': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'running': return <Play className="w-4 h-4 text-blue-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'paused': return <Square className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProgressPercentage = (batch: BatchJob) => {
    if (batch.progress.total_work_orders === 0) return 0;
    return Math.round((batch.progress.completed_work_orders / batch.progress.total_work_orders) * 100);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="medium" />
          <span className="ml-2">Loading work orders...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Batch Processing</h3>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {showConfig && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Batch Configuration</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concurrent Jobs
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={batchConfig.concurrent_jobs}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    concurrent_jobs: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay Between Jobs (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="30000"
                  step="1000"
                  value={batchConfig.delay_between_jobs}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    delay_between_jobs: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retry Attempts
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={batchConfig.retry_attempts}
                  onChange={(e) => setBatchConfig(prev => ({
                    ...prev,
                    retry_attempts: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={batchConfig.auto_continue_on_error}
                    onChange={(e) => setBatchConfig(prev => ({
                      ...prev,
                      auto_continue_on_error: e.target.checked
                    }))}
                    className="mr-2"
                  />
                  Continue on Error
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={batchConfig.notify_on_completion}
                    onChange={(e) => setBatchConfig(prev => ({
                      ...prev,
                      notify_on_completion: e.target.checked
                    }))}
                    className="mr-2"
                  />
                  Notify on Completion
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Work Order Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Select Work Orders</h4>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedWorkOrders.length === availableWorkOrders.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {availableWorkOrders.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No work orders available for automation
              </div>
            ) : (
              availableWorkOrders.map((workOrder: WorkOrder) => (
                <div
                  key={workOrder.basic_info.id}
                  className="flex items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkOrders.includes(workOrder.basic_info.id)}
                    onChange={(e) => handleWorkOrderSelection(workOrder.basic_info.id, e.target.checked)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{workOrder.basic_info.external_id}</div>
                    <div className="text-sm text-gray-600">{workOrder.basic_info.site_name}</div>
                    <div className="text-xs text-gray-500">
                      {workOrder.dispensers?.length || 0} dispensers
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {workOrder.scheduling?.status}
                    </div>
                    <div className="text-xs text-gray-500">
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
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Name
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Enter batch name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={createBatch}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Queue Batch ({selectedWorkOrders.length} work orders)
            </button>
          </div>
        )}
      </Card>

      {/* Active/Recent Batches */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Batch Jobs</h3>
        
        {batchJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No batch jobs created yet
          </div>
        ) : (
          <div className="space-y-4">
            {batchJobs.map((batch) => (
              <div
                key={batch.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getBatchStatusIcon(batch.status)}
                    <div>
                      <h4 className="font-medium">{batch.name}</h4>
                      <p className="text-sm text-gray-600">
                        {batch.work_orders.length} work orders, {batch.progress.total_dispensers} dispensers
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {batch.status === 'pending' && (
                      <button
                        onClick={() => startBatch(batch)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Start
                      </button>
                    )}
                    
                    {batch.status === 'running' && (
                      <>
                        <button
                          onClick={() => pauseBatch(batch.id)}
                          className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                          Pause
                        </button>
                        <button
                          onClick={() => cancelBatch(batch.id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{getProgressPercentage(batch)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(batch)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Progress Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Work Orders:</span>
                    <div className="font-medium">
                      {batch.progress.completed_work_orders} / {batch.progress.total_work_orders}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Dispensers:</span>
                    <div className="font-medium">
                      {batch.progress.completed_dispensers} / {batch.progress.total_dispensers}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <div className="font-medium">
                      {batch.started_at ? new Date(batch.started_at).toLocaleTimeString() : 'Not started'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
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
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">
                        ✓ {batch.results.successful} successful
                      </span>
                      {batch.results.failed > 0 && (
                        <span className="text-red-600">
                          ✗ {batch.results.failed} failed
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BatchProcessor;