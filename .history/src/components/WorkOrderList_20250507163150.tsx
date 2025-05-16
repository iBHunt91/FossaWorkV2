import React, { useState } from 'react';
import WorkOrderCard from './WorkOrderCard';
import { FiSearch, FiFilter, FiList, FiGrid, FiCalendar, FiInfo, FiTag } from 'react-icons/fi';
import { WorkOrder } from '../types/workOrder';

interface WorkOrderListProps {
  workOrders: WorkOrder[];
  onSelectWorkOrder?: (workOrder: WorkOrder) => void;
}

const WorkOrderList: React.FC<WorkOrderListProps> = ({
  workOrders,
  onSelectWorkOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'store'>('date');

  // Filter work orders based on search term
  const filteredWorkOrders = workOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchLower) ||
      order.customer.name.toLowerCase().includes(searchLower) ||
      order.customer.storeNumber.toLowerCase().includes(searchLower) ||
      order.customer.address.street.toLowerCase().includes(searchLower) ||
      order.customer.address.cityState.toLowerCase().includes(searchLower)
    );
  });

  // Sort work orders
  const sortedWorkOrders = [...filteredWorkOrders].sort((a, b) => {
    if (sortBy === 'date') {
      // Convert dates from MM/DD/YYYY format to Date objects for comparison
      const dateA = a.visits.nextVisit.date.split('/');
      const dateB = b.visits.nextVisit.date.split('/');
      
      const dateObjA = new Date(
        parseInt(dateA[2]), // Year
        parseInt(dateA[0]) - 1, // Month (0-indexed)
        parseInt(dateA[1]) // Day
      );
      
      const dateObjB = new Date(
        parseInt(dateB[2]), // Year
        parseInt(dateB[0]) - 1, // Month (0-indexed)
        parseInt(dateB[1]) // Day
      );
      
      return dateObjA.getTime() - dateObjB.getTime();
    } else {
      // Sort by store name
      return a.customer.name.localeCompare(b.customer.name);
    }
  });

  // Handle work order selection
  const handleSelectWorkOrder = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder.id);
    if (onSelectWorkOrder) {
      onSelectWorkOrder(workOrder);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 animate-fadeIn">
      {/* Header with search and controls */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-200"
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Sort Toggle Buttons with enhanced styling */}
            <button
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-all duration-200 ${
                sortBy === 'date' 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              onClick={() => setSortBy('date')}
            >
              <FiCalendar className={`mr-1.5 ${sortBy === 'date' ? 'text-primary-500' : 'text-gray-400'}`} />
              Date
            </button>
            
            <button
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-all duration-200 ${
                sortBy === 'store' 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              onClick={() => setSortBy('store')}
            >
              <FiTag className={`mr-1.5 ${sortBy === 'store' ? 'text-primary-500' : 'text-gray-400'}`} />
              Store
            </button>
            
            {/* View Mode Toggles with enhanced styling */}
            <div className="border border-gray-300 dark:border-gray-600 rounded-md flex overflow-hidden">
              <button
                className={`p-2 transition-colors duration-200 ${
                  viewMode === 'list' 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                  : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-400'
                }`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <FiList className="w-4 h-4" />
              </button>
              <button
                className={`p-2 transition-colors duration-200 ${
                  viewMode === 'grid' 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                  : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-400'
                }`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <FiGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Work Order List/Grid */}
      <div className="p-5">
        {sortedWorkOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <FiInfo className="h-10 w-10 mx-auto mb-2 opacity-40 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No work orders match your search</p>
            {searchTerm && (
              <button 
                className="mt-3 text-primary-500 hover:text-primary-600 text-sm font-medium"
                onClick={() => setSearchTerm('')}
              >
                Clear search
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedWorkOrders.map((workOrder, index) => (
              <div 
                key={workOrder.id} 
                className="transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  animationDelay: `${index * 50}ms`,
                  opacity: 0,
                  animation: 'fadeIn 0.3s ease-out forwards'
                }}
              >
                <WorkOrderCard
                  workOrder={workOrder}
                  isSelected={selectedWorkOrder === workOrder.id}
                  onClick={() => handleSelectWorkOrder(workOrder)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedWorkOrders.map((workOrder, index) => (
              <div 
                key={workOrder.id}
                className="transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  animationDelay: `${index * 50}ms`,
                  opacity: 0,
                  animation: 'fadeIn 0.3s ease-out forwards'
                }}
              >
                <WorkOrderCard
                  workOrder={workOrder}
                  isSelected={selectedWorkOrder === workOrder.id}
                  onClick={() => handleSelectWorkOrder(workOrder)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer with pagination or count - enhanced styling */}
      <div className="bg-gray-50 dark:bg-gray-700 px-5 py-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
            <span className="bg-gray-200 dark:bg-gray-600 rounded-md px-2 py-1 text-xs font-medium mr-2">
              {sortedWorkOrders.length}
            </span>
            <span>
              {sortedWorkOrders.length === 1 ? 'work order' : 'work orders'} {searchTerm && 'found'} 
              {filteredWorkOrders.length !== workOrders.length && (
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  (filtered from {workOrders.length})
                </span>
              )}
            </span>
          </div>
          
          {sortBy === 'date' && sortedWorkOrders.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <FiCalendar className="mr-1" size={12} />
              <span>Sorted by next visit date</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkOrderList; 