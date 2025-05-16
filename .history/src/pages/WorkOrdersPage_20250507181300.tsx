import React, { useEffect, useState, useMemo } from 'react';
import { FiRefreshCw, FiMapPin, FiTool, FiFileText, FiCalendar, FiClock, FiAlertCircle, FiCheckCircle, FiInfo, FiBarChart2, FiTag, FiGlobe, FiLink, FiExternalLink, FiFilter, FiUser, FiArchive } from 'react-icons/fi';
import WorkOrderList from '../components/WorkOrderList';
import { WorkOrder } from '../types/workOrder';
import { loadWorkOrders } from '../utils/dataLoader';

const WorkOrdersPage: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [viewTab, setViewTab] = useState<'details' | 'services' | 'visit'>('details');

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
    setViewTab('details');
  };

  // Calculate statistics about the work orders
  const stats = useMemo(() => {
    if (!workOrders.length) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeek = new Date(today);
    oneWeek.setDate(today.getDate() + 7);

    // Parse dates and categorize work orders
    const categorized = workOrders.reduce((acc, order) => {
      const parts = order.visits.nextVisit.date.split('/');
      const visitDate = new Date(
        parseInt(parts[2]), // Year
        parseInt(parts[0]) - 1, // Month (0-indexed)
        parseInt(parts[1]) // Day
      );
      
      if (visitDate <= today) {
        acc.dueNow++;
      } else if (visitDate <= oneWeek) {
        acc.dueSoon++;
      } else {
        acc.scheduled++;
      }
      
      // Count service types
      order.services.forEach(service => {
        const type = service.type.toLowerCase();
        acc.serviceTypes[type] = (acc.serviceTypes[type] || 0) + service.quantity;
        acc.totalServices += service.quantity;
      });
      
      // Count by store
      const storeName = order.customer.name;
      acc.stores[storeName] = (acc.stores[storeName] || 0) + 1;
      
      return acc;
    }, {
      dueNow: 0,
      dueSoon: 0,
      scheduled: 0,
      totalServices: 0,
      serviceTypes: {} as Record<string, number>,
      stores: {} as Record<string, number>
    });
    
    // Get all stores sorted by count (descending)
    const allStores = Object.entries(categorized.stores)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    return {
      ...categorized,
      allStores
    };
  }, [workOrders]);

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
      
      {/* Stats Overview - Improved Section */}
      {stats && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fadeIn">
          {/* Service Types Card - New replacement card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <FiTool className="mr-2 text-primary-500" />
                Service Types
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Service Items</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalServices}</p>
                </div>
                <div className="h-16 w-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                  <FiTool className="text-primary-500 h-8 w-8" />
                </div>
              </div>
              
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {Object.entries(stats.serviceTypes)
                  .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                  .map(([type, count], index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-primary-500 opacity-80"></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {type}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded">
                          {count as number}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          
          {/* Stores Card - Keep the updated version */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <FiGlobe className="mr-2 text-teal-500" />
                Store Locations
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Store Distribution
                </p>
                <div className="flex items-center bg-teal-100 dark:bg-teal-900/30 px-2 py-1 rounded-md">
                  <FiArchive className="text-teal-600 dark:text-teal-400 w-3 h-3 mr-1" />
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                    {workOrders.length} Total Work Orders
                  </span>
                </div>
              </div>
              
              <div className="max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                <div className="space-y-1.5">
                  {stats.allStores.map((store, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center space-x-2 truncate max-w-[80%]">
                        <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                          <FiUser className="text-teal-600 dark:text-teal-400 w-3 h-3" />
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {store.name}
                        </span>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 min-w-[24px] text-center">
                        {store.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <span className="font-mono text-sm bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300 mr-2">
                        {selectedWorkOrder.id}
                      </span>
                      Work Order
                    </h2>
                    {getStatusBadge(selectedWorkOrder.visits.nextVisit.date)}
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex -mb-px">
                    <button
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                        viewTab === 'details'
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => setViewTab('details')}
                    >
                      Details
                    </button>
                    <button
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                        viewTab === 'services'
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => setViewTab('services')}
                    >
                      Services
                    </button>
                    <button
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                        viewTab === 'visit'
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => setViewTab('visit')}
                    >
                      Visit Info
                    </button>
                  </nav>
                </div>
                
                {/* Content based on selected tab */}
                <div className="p-5 animate-fadeIn">
                  {/* Details Tab */}
                  {viewTab === 'details' && (
                    <div>
                      {/* Store Section */}
                      <div className="mb-5">
                        <div className="flex justify-between mb-2">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                            {selectedWorkOrder.customer.name}
                          </h3>
                          <span className="text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md">
                            {selectedWorkOrder.customer.storeNumber}
                          </span>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <div className="flex items-start mb-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-2">
                              <FiMapPin className="text-gray-600 dark:text-gray-300" size={14} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{selectedWorkOrder.customer.address.street}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {selectedWorkOrder.customer.address.cityState} • {selectedWorkOrder.customer.address.county}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-2">
                              <FiExternalLink className="text-gray-600 dark:text-gray-300" size={14} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Store URL:</p>
                              <a 
                                href={selectedWorkOrder.customer.storeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate block"
                              >
                                {selectedWorkOrder.customer.storeUrl}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Appointment Section */}
                      <div className="mb-5">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                          <FiCalendar className="text-gray-500 dark:text-gray-400 mr-2" />
                          Visit Information
                        </h4>
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800/20">
                          <div className="flex items-center mb-2">
                            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                              {selectedWorkOrder.visits.nextVisit.date} @ {selectedWorkOrder.visits.nextVisit.time}
                            </span>
                            {getStatusBadge(selectedWorkOrder.visits.nextVisit.date)}
                          </div>
                          <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                            <FiTag className="mr-1" />
                            <span>Visit ID: {selectedWorkOrder.visits.nextVisit.visitId}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Instructions Section */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                          <FiFileText className="text-gray-500 dark:text-gray-400 mr-2" />
                          Instructions
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {selectedWorkOrder.instructions || "No specific instructions provided."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Services Tab */}
                  {viewTab === 'services' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                          <FiTool className="text-gray-500 dark:text-gray-400 mr-2" />
                          Services Required
                        </h4>
                        <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-md">
                          {selectedWorkOrder.services.reduce((total, service) => total + service.quantity, 0)} Total
                        </span>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedWorkOrder.services.map((service, index) => (
                          <div key={index} className="p-4 first:pt-4 last:pb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-800 dark:text-purple-200 mr-2">
                                  {service.quantity}
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{service.type}</span>
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                                {service.code}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 pl-8">
                              {service.description}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Service Summary */}
                      <div className="mt-5 bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Summary</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Services</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {selectedWorkOrder.services.reduce((total, service) => total + service.quantity, 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Service Types</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {selectedWorkOrder.services.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Visit Tab */}
                  {viewTab === 'visit' && (
                    <div>
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                            <FiCalendar className="text-gray-500 dark:text-gray-400 mr-2" />
                            Visit Details
                          </h4>
                          {getStatusBadge(selectedWorkOrder.visits.nextVisit.date)}
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-2">
                              <FiCalendar className="text-gray-600 dark:text-gray-300" size={14} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Date & Time</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {selectedWorkOrder.visits.nextVisit.date} at {selectedWorkOrder.visits.nextVisit.time}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-2">
                              <FiMapPin className="text-gray-600 dark:text-gray-300" size={14} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {selectedWorkOrder.customer.name} ({selectedWorkOrder.customer.storeNumber})
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {selectedWorkOrder.customer.address.street}, {selectedWorkOrder.customer.address.cityState}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-2">
                              <FiTag className="text-gray-600 dark:text-gray-300" size={14} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Visit ID</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {selectedWorkOrder.visits.nextVisit.visitId}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                          <FiLink className="text-gray-500 dark:text-gray-400 mr-2" />
                          Resources
                        </h4>
                        
                        <div className="flex flex-col space-y-2">
                          <a 
                            href={selectedWorkOrder.visits.nextVisit.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <span className="text-gray-700 dark:text-gray-300">Visit Details</span>
                            <FiExternalLink className="text-primary-500" />
                          </a>
                          
                          <a 
                            href={selectedWorkOrder.customer.storeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <span className="text-gray-700 dark:text-gray-300">Store Information</span>
                            <FiExternalLink className="text-primary-500" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
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