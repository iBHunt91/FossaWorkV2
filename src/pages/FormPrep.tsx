import React, { useState, useEffect } from 'react';
import { workOrderService } from '../services/workOrderService';
import SingleVisitAutomation from '../components/SingleVisitAutomation';
import BatchVisitAutomation from '../components/BatchVisitAutomation';
import { useToast } from '../hooks/useToast';

const FormPrep: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    const userId = localStorage.getItem('activeUserId') || '';
    setActiveUserId(userId);
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      console.log('FormPrep: Starting to load data...');
      setIsLoading(true);
      setError(null);
      
      const userId = localStorage.getItem('activeUserId');
      console.log('FormPrep: Active User ID:', userId);
      
      const orders = await workOrderService.getWorkOrders();
      console.log('FormPrep: Received orders:', orders);
      
      // Transform the orders to match what BatchVisitAutomation expects
      const transformedOrders = orders.map(order => ({
        ...order,
        // Remove duplicate "#" from store number if present
        customer: {
          ...order.customer,
          storeNumber: order.customer?.storeNumber?.replace(/^#+/, '#') || order.customer?.storeNumber
        },
        // Convert visits object to array format
        visits: order.visits?.nextVisit ? [{
          id: order.visits.nextVisit.visitId || `VISIT-${order.id}`,
          visitNumber: order.visits.nextVisit.visitId, // Make sure visit number is available
          date: order.visits.nextVisit.date,
          status: 'Pending',
          url: order.visits.nextVisit.url ? 
            (order.visits.nextVisit.url.startsWith('http') ? 
              order.visits.nextVisit.url : 
              `https://app.workfossa.com${order.visits.nextVisit.url}`) : ''
        }] : []
      }));
      
      setWorkOrders(transformedOrders);
      setDebugInfo({
        userId,
        orderCount: transformedOrders.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('FormPrep: Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const addDebugLog = (type: string, message: string, data?: any) => {
    console.log(`[${type}] ${message}`, data || '');
  };
  
  const handleJobStatusChange = (status: any) => {
    console.log('Job status changed:', status);
  };
  
  const handleJobComplete = () => {
    console.log('Job completed');
    addToast('success', 'Job completed successfully');
  };
  
  const handleJobError = (error: any) => {
    console.error('Job error:', error);
    addToast('error', error instanceof Error ? error.message : 'An unknown error occurred');
  };

  return (
    <div className="container mx-auto bg-gray-100 dark:bg-gray-800 p-4 h-full">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Form Automation</h1>
      
      {/* Optional: Keep debug info for now */}
      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
        <p>Active User ID: {activeUserId || 'None'}</p>
        <p>Work Orders Count: {workOrders.length}</p>
        <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading work orders for active user...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      ) : workOrders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            No work orders found for the active user. This could be because:
          </p>
          <ul className="text-gray-600 dark:text-gray-400 list-disc list-inside mb-6 text-left max-w-lg mx-auto">
            <li>You haven't scraped any work orders yet</li>
            <li>The work order data file is empty or corrupted</li>
            <li>The server is still initializing</li>
            <li>There are no work orders assigned to you</li>
          </ul>
          <div className="flex flex-col space-y-4">
            <button 
              onClick={loadData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Retry Loading Work Orders
            </button>
            
            {/* Add components even without work orders */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Form Automation Tools</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                The automation tools are still available even without work orders. You can use the Single Visit Automation to process a specific URL.
              </p>
              
              {/* Single Visit Automation Component */}
              <SingleVisitAutomation
                activeUserId={activeUserId}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Show different components based on selection */}
          {selectedVisits.length === 0 ? (
            // No selection - show manual URL input and selection list
            <>
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Select one visit from the list below to auto-populate the URL, or enter a URL manually.
                </p>
              </div>
              <SingleVisitAutomation
                key="single-no-selection"
                activeUserId={activeUserId}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
                prefilledUrl="" // Explicitly clear URL when no selection
              />
              <BatchVisitAutomation
                key={`batch-selection-${selectedVisits.length}`}
                activeUserId={activeUserId}
                workOrders={workOrders}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
                preselectedVisits={selectedVisits}
                onSelectionChange={setSelectedVisits}
                selectionOnly={true}
              />
            </>
          ) : selectedVisits.length === 1 ? (
            // Single selection - show single visit automation with pre-filled URL and selection list
            <>
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  Single visit selected. URL has been auto-populated.
                </p>
              </div>
              <SingleVisitAutomation
                key={`single-${selectedVisits[0]}`}
                activeUserId={activeUserId}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
                prefilledUrl={(() => {
                  // Find the visit URL from the selected visit
                  const selectedVisitId = selectedVisits[0];
                  for (const order of workOrders) {
                    const visit = order.visits?.find((v: any) => v.id === selectedVisitId);
                    if (visit?.url) {
                      return visit.url;
                    }
                  }
                  return '';
                })()}
              />
              <BatchVisitAutomation
                key={`batch-single-${selectedVisits.join(',')}`}
                activeUserId={activeUserId}
                workOrders={workOrders}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
                preselectedVisits={selectedVisits}
                onSelectionChange={setSelectedVisits}
                selectionOnly={true}
              />
            </>
          ) : (
            // Multiple selection - show batch automation only
            <>
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  {selectedVisits.length} visits selected for batch processing.
                </p>
              </div>
              <BatchVisitAutomation
                key={`batch-multiple-${selectedVisits.join(',')}`}
                activeUserId={activeUserId}
                workOrders={workOrders}
                addDebugLog={addDebugLog}
                onJobStatusChange={handleJobStatusChange}
                onJobComplete={handleJobComplete}
                onJobError={handleJobError}
                preselectedVisits={selectedVisits}
                onSelectionChange={setSelectedVisits}
                selectionOnly={false}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FormPrep;