import React, { useState, useEffect } from 'react';
import { DispenserAutomation } from '../components/DispenserAutomation';
import BatchProcessor from '../components/BatchProcessor';
import QueueManager from '../components/QueueManager';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { Settings, Play, Users, Activity } from 'lucide-react';

interface WorkOrder {
  id: string;
  external_id: string;
  site_name: string;
  address: string;
  scheduled_date: string;
  status: string;
  dispensers?: any[];
}

export const Automation: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'queue'>('single');
  
  // TODO: Get from auth context
  const currentUserId = 'demo-user';

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/v1/work-orders/user123'); // TODO: Get actual user ID
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setWorkOrders(data.work_orders || []);
        
        // Auto-select first work order if available
        if (data.work_orders && data.work_orders.length > 0) {
          setSelectedWorkOrder(data.work_orders[0]);
        }
      } else {
        throw new Error(data.message || 'Failed to load work orders');
      }
      
    } catch (error) {
      console.error('Failed to load work orders:', error);
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAutomationComplete = (jobId: string) => {
    console.log('Automation completed for job:', jobId);
    // Optionally refresh work orders to get updated status
    loadWorkOrders();
  };

  const handleAutomationError = (error: string) => {
    console.error('Automation error:', error);
    setError(`Automation failed: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading work orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
Form Automation & Job Management
          </h1>
          <p className="mt-2 text-gray-600">
            Automate AccuMeasure form filling for fuel dispenser testing workflows
          </p>
          
          {/* Tab Navigation */}
          <div className="mt-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('single')}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'single'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Play className="w-4 h-4 inline mr-2" />
                Single Work Order
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'batch'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Batch Processing
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'queue'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Job Queue
              </button>
            </nav>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 p-4 bg-red-50 border-red-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </Card>
        )}

        {/* Tab Content */}
        {activeTab === 'single' ? (
          /* Single Work Order Automation */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Work Orders Selection */}
            <div className="lg:col-span-1">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Work Orders
                  </h2>
                  <button
                    onClick={loadWorkOrders}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Refresh
                  </button>
                </div>
                
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No work orders</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Run the scraping automation first to load work orders.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workOrders.map((workOrder) => (
                      <div
                        key={workOrder.id}
                        onClick={() => setSelectedWorkOrder(workOrder)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedWorkOrder?.id === workOrder.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900 text-sm">
                              {workOrder.external_id}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {workOrder.site_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {workOrder.address}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            workOrder.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : workOrder.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {workOrder.status}
                          </span>
                        </div>
                        
                        {workOrder.dispensers && workOrder.dispensers.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              {workOrder.dispensers.length} dispenser{workOrder.dispensers.length !== 1 ? 's' : ''}
                              {workOrder.dispensers.filter(d => d.automation_completed).length > 0 && (
                                <span className="ml-2 text-green-600">
                                  ({workOrder.dispensers.filter(d => d.automation_completed).length} automated)
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Single Automation Interface */}
            <div className="lg:col-span-2">
              {selectedWorkOrder ? (
                <DispenserAutomation
                  workOrder={selectedWorkOrder}
                  onComplete={handleAutomationComplete}
                  onError={handleAutomationError}
                />
              ) : (
                <Card className="p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Select a work order</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose a work order from the list to start form automation.
                  </p>
                </Card>
              )}
            </div>
          </div>
        ) : activeTab === 'batch' ? (
          /* Batch Processing Interface */
          <BatchProcessor 
            userId={currentUserId}
            onBatchStarted={(batchId) => {
              console.log('Batch started:', batchId);
              // Optionally refresh work orders or show notification
            }}
          />
        ) : (
          /* Job Queue Management Interface */
          <QueueManager 
            userId={currentUserId}
            onJobSubmitted={(jobId) => {
              console.log('Job submitted:', jobId);
              // Optionally show notification
            }}
            onJobCompleted={(jobId) => {
              console.log('Job completed:', jobId);
              // Optionally refresh work orders or show notification
            }}
          />
        )}

        {/* Info Panel */}
        <Card className="mt-8 p-6 bg-blue-50">
          <h3 className="text-lg font-medium text-blue-900 mb-4">
            {activeTab === 'single' 
              ? 'How Single Work Order Automation Works'
              : activeTab === 'batch'
              ? 'How Batch Processing Works'
              : 'How Job Queue Management Works'
            }
          </h3>
          {activeTab === 'single' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">1. Setup</h4>
                <p className="text-blue-700">
                  Provide your WorkFossa credentials and select a work order with dispensers to automate.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">2. Automation</h4>
                <p className="text-blue-700">
                  The system will log into WorkFossa, navigate to the visit page, and automatically fill AccuMeasure forms for each dispenser.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">3. Tracking</h4>
                <p className="text-blue-700">
                  Monitor real-time progress with live updates for each automation phase and individual dispenser progress.
                </p>
              </div>
            </div>
          ) : activeTab === 'batch' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">1. Selection</h4>
                <p className="text-blue-700">
                  Select multiple work orders to process simultaneously. Configure batch settings like concurrency and retry attempts.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">2. Processing</h4>
                <p className="text-blue-700">
                  The system processes work orders in parallel with intelligent error handling and automatic retries for failed jobs.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">3. Management</h4>
                <p className="text-blue-700">
                  Track batch progress, pause/resume jobs, and get detailed reports on successful and failed automation attempts.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">1. Queue Management</h4>
                <p className="text-blue-700">
                  View all automation jobs in a priority-based queue with real-time status updates and resource utilization monitoring.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">2. Job Control</h4>
                <p className="text-blue-700">
                  Start, stop, pause, and cancel individual jobs or the entire queue. Configure priority levels and retry policies.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">3. Monitoring</h4>
                <p className="text-blue-700">
                  Monitor job execution metrics, success rates, and performance statistics with detailed logging and error tracking.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};