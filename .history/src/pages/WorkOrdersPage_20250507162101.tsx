import React, { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import WorkOrderList from '../components/WorkOrderList';
import { WorkOrder } from '../types/workOrder';
import { loadWorkOrders } from '../utils/dataLoader';

const WorkOrdersPage: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  // Function to load work orders
  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const orders = await loadWorkOrders();
      setWorkOrders(orders);
    } catch (err) {
      console.error('Error loading work orders:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load work orders on component mount
  useEffect(() => {
    fetchWorkOrders();
  }, []);

  // Handle work order selection
  const handleSelectWorkOrder = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Work Orders</h1>
        
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={fetchWorkOrders}
          disabled={loading}
        >
          <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading work orders</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : workOrders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No work orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <WorkOrderList 
              workOrders={workOrders} 
              onSelectWorkOrder={handleSelectWorkOrder}
            />
          </div>
          
          <div className="lg:col-span-1">
            {selectedWorkOrder ? (
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 sticky top-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Selected Work Order
                </h2>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    {selectedWorkOrder.customer.name} - {selectedWorkOrder.customer.storeNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {selectedWorkOrder.customer.address.street}, {selectedWorkOrder.customer.address.cityState}
                  </p>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md mb-4">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Services</h4>
                    <ul className="space-y-2">
                      {selectedWorkOrder.services.map((service, index) => (
                        <li key={index} className="text-sm">
                          <span className="font-medium">{service.quantity}x</span> {service.type}: {service.description}
                          <span className="text-gray-400 dark:text-gray-500 ml-1">({service.code})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Next Visit</h4>
                    <p className="text-sm font-medium">{selectedWorkOrder.visits.nextVisit.date} - {selectedWorkOrder.visits.nextVisit.time}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Instructions</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedWorkOrder.instructions}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">Select a work order to see details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersPage; 