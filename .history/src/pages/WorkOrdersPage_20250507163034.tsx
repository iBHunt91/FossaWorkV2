import React, { useEffect, useState } from 'react';
import { FiRefreshCw, FiMapPin, FiTool, FiFileText, FiCalendar, FiClock, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';
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

  // Function to get status badge style
  const getStatusBadge = (date: string) => {
    const parts = date.split('/');
    const formattedDate = new Date(
      parseInt(parts[2]), // Year
      parseInt(parts[0]) - 1, // Month (0-indexed)
      parseInt(parts[1]) // Day
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeek = new Date(today);
    oneWeek.setDate(today.getDate() + 7);
    
    if (formattedDate <= today) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-red-100 dark:bg-accent-red-900/30 text-accent-red-700 dark:text-accent-red-300">
          <FiAlertCircle className="w-3 h-3 mr-1" />
          Due Now
        </span>
      );
    }
    
    if (formattedDate <= oneWeek) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-amber-100 dark:bg-accent-amber-900/30 text-accent-amber-700 dark:text-accent-amber-300">
          <FiClock className="w-3 h-3 mr-1" />
          Due Soon
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-green-100 dark:bg-accent-green-900/30 text-accent-green-700 dark:text-accent-green-300">
        <FiCheckCircle className="w-3 h-3 mr-1" />
        Scheduled
      </span>
    );
  };

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      {/* Page Header - Updated Styling */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 overflow-hidden border border-gray-700 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between p-4 gap-3">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <FiFileText className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Work Orders</h1>
              <p className="text-sm text-gray-300">View and manage all work orders</p>
            </div>
          </div>
          
          <button
            className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
            onClick={fetchWorkOrders}
            disabled={loading}
          >
            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>
      
      {/* Error Alert - Enhanced Styling */}
      {error && (
        <div className="bg-accent-red-50 dark:bg-accent-red-900/20 border border-accent-red-200 dark:border-accent-red-900/50 rounded-lg p-4 mb-6 shadow-md animate-fadeIn">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-accent-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-accent-red-800 dark:text-accent-red-200">Error loading work orders</h3>
              <div className="mt-2 text-sm text-accent-red-700 dark:text-accent-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading State - Improved Design */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading work orders...</p>
          </div>
        </div>
      ) : workOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <FiInfo className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-lg font-medium">No work orders found</p>
          <p className="text-sm mt-2">Try refreshing or check back later</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Work Order List Section */}
          <div className="lg:col-span-2">
            <WorkOrderList 
              workOrders={workOrders} 
              onSelectWorkOrder={handleSelectWorkOrder}
            />
          </div>
          
          {/* Work Order Detail Panel - Enhanced Styling */}
          <div className="lg:col-span-1">
            {selectedWorkOrder ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-6">
                {/* Header */}
                <div className="bg-gray-50 dark:bg-gray-700 p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Work Order Details
                    </h2>
                    {getStatusBadge(selectedWorkOrder.visits.nextVisit.date)}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-5">
                  {/* Store & Location Section */}
                  <div className="mb-5">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                      {selectedWorkOrder.customer.name}
                    </h3>
                    <div className="flex items-center mt-1">
                      <span className="text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md">
                        {selectedWorkOrder.customer.storeNumber}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        ID: {selectedWorkOrder.id}
                      </span>
                    </div>
                    
                    <div className="mt-3 flex items-start">
                      <FiMapPin className="text-gray-500 mt-1 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{selectedWorkOrder.customer.address.street}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {selectedWorkOrder.customer.address.cityState} • {selectedWorkOrder.customer.address.county}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Appointment Section */}
                  <div className="mb-5 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800/20">
                    <div className="flex items-center mb-2">
                      <FiCalendar className="text-primary-500 dark:text-primary-400 mr-2" />
                      <h4 className="text-sm font-medium text-primary-700 dark:text-primary-300">Scheduled Visit</h4>
                    </div>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedWorkOrder.visits.nextVisit.date}
                      <span className="text-gray-600 dark:text-gray-400 ml-2">{selectedWorkOrder.visits.nextVisit.time}</span>
                    </p>
                  </div>
                  
                  {/* Services Section - Enhanced Styling */}
                  <div className="mb-5">
                    <div className="flex items-center mb-3">
                      <FiTool className="text-gray-600 dark:text-gray-400 mr-2" />
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">Services Required</h4>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      {selectedWorkOrder.services.map((service, index) => (
                        <div key={index} className="flex items-start mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-gray-200 dark:border-gray-700">
                          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-800 dark:text-gray-200 mr-2 mt-0.5">
                            {service.quantity}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{service.type}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{service.description}</p>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded mt-1 inline-block">
                              {service.code}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Instructions Section */}
                  <div>
                    <div className="flex items-center mb-3">
                      <FiFileText className="text-gray-600 dark:text-gray-400 mr-2" />
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">Instructions</h4>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedWorkOrder.instructions}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center border border-gray-200 dark:border-gray-700 h-64 flex items-center justify-center">
                <div className="max-w-xs mx-auto">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 mx-auto flex items-center justify-center mb-4">
                    <FiFileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Select a work order</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click on any work order to view its details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersPage; 