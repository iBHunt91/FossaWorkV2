import React, { useState } from 'react';
import WorkOrderCard from './WorkOrderCard';
import { FiSearch, FiFilter, FiList, FiGrid, FiCalendar } from 'react-icons/fi';
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
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      {/* Header with search and controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Sort Toggle */}
            <button
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                sortBy === 'date' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
              onClick={() => setSortBy('date')}
            >
              <FiCalendar className={`mr-1.5 ${sortBy === 'date' ? 'text-blue-500' : 'text-gray-400'}`} />
              Date
            </button>
            
            <button
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                sortBy === 'store' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
              onClick={() => setSortBy('store')}
            >
              <FiFilter className={`mr-1.5 ${sortBy === 'store' ? 'text-blue-500' : 'text-gray-400'}`} />
              Store
            </button>
            
            {/* View Mode Toggles */}
            <div className="border border-gray-300 dark:border-gray-600 rounded-md flex">
              <button
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <FiList className={viewMode === 'list' ? 'text-blue-500' : 'text-gray-400'} />
              </button>
              <button
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <FiGrid className={viewMode === 'grid' ? 'text-blue-500' : 'text-gray-400'} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Work Order List/Grid */}
      <div className="p-4">
        {sortedWorkOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No work orders found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedWorkOrders.map((workOrder) => (
              <WorkOrderCard
                key={workOrder.id}
                workOrder={workOrder}
                isSelected={selectedWorkOrder === workOrder.id}
                onClick={() => handleSelectWorkOrder(workOrder)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedWorkOrders.map((workOrder) => (
              <WorkOrderCard
                key={workOrder.id}
                workOrder={workOrder}
                isSelected={selectedWorkOrder === workOrder.id}
                onClick={() => handleSelectWorkOrder(workOrder)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Footer with pagination or count */}
      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">{sortedWorkOrders.length}</span> of <span className="font-medium">{workOrders.length}</span> work orders
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderList; 