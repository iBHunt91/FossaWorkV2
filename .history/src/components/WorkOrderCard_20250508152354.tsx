import React from 'react';
import { 
  FiMapPin, 
  FiCalendar, 
  FiTool, 
  FiFileText, 
  FiClock, 
  FiAlertCircle, 
  FiCheckCircle,
  FiTag,
  FiTrendingUp
} from 'react-icons/fi';
import { WorkOrder } from '../types/workOrder';

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onClick?: () => void;
  isSelected?: boolean;
}

const getStatusColor = (date: string): string => {
  const dueDate = new Date(date);
  const today = new Date();
  
  // Compare dates (ignoring time)
  today.setHours(0, 0, 0, 0);
  
  // Convert MM/DD/YYYY to Date object
  const parts = date.split('/');
  const formattedDate = new Date(
    parseInt(parts[2]), // Year
    parseInt(parts[0]) - 1, // Month (0-indexed)
    parseInt(parts[1]) // Day
  );
  formattedDate.setHours(0, 0, 0, 0);
  
  // Check if due date is today or in the past
  if (formattedDate <= today) {
    return 'text-accent-red-500 dark:text-accent-red-400';
  }
  
  // Check if due date is within the next 7 days
  const oneWeek = new Date(today);
  oneWeek.setDate(today.getDate() + 7);
  
  if (formattedDate <= oneWeek) {
    return 'text-accent-amber-500 dark:text-accent-amber-400';
  }
  
  return 'text-accent-green-500 dark:text-accent-green-400';
};

const getStatusIcon = (date: string): JSX.Element => {
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
    return <FiAlertCircle className="text-accent-red-500 dark:text-accent-red-400 mr-1.5" size={14} />;
  }
  
  if (formattedDate <= oneWeek) {
    return <FiClock className="text-accent-amber-500 dark:text-accent-amber-400 mr-1.5" size={14} />;
  }
  
  return <FiCheckCircle className="text-accent-green-500 dark:text-accent-green-400 mr-1.5" size={14} />;
};

const getStatusText = (date: string): string => {
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
    return "Due now";
  }
  
  if (formattedDate <= oneWeek) {
    return "Due soon";
  }
  
  return "Scheduled";
};

const getStoreStyle = (name: string): { border: string; bg: string } => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('7-eleven') || lowerName.includes('speedway')) {
    return { 
      border: 'border-accent-green-500 dark:border-accent-green-600',
      bg: 'from-accent-green-500/10 to-accent-green-600/5'
    };
  } else if (lowerName.includes('wawa')) {
    return { 
      border: 'border-accent-amber-500 dark:border-accent-amber-600',
      bg: 'from-accent-amber-500/10 to-accent-amber-600/5'
    };
  } else if (lowerName.includes('circle k')) {
    return { 
      border: 'border-accent-red-500 dark:border-accent-red-600',
      bg: 'from-accent-red-500/10 to-accent-red-600/5'
    };
  }
  
  return { 
    border: 'border-primary-500 dark:border-primary-600',
    bg: 'from-primary-500/10 to-primary-600/5'
  };
};

const WorkOrderCard: React.FC<WorkOrderCardProps> = ({ 
  workOrder, 
  onClick,
  isSelected = false
}) => {
  // Calculate total dispensers from services
  const totalDispensers = workOrder.services.reduce((total, service) => {
    if (service.type === 'Meter Calibration') {
      return total + service.quantity;
    }
    return total;
  }, 0);

  // Format the next visit date
  const nextVisitDate = workOrder.visits.nextVisit.date;
  const statusColor = getStatusColor(nextVisitDate);
  const statusIcon = getStatusIcon(nextVisitDate);
  const statusText = getStatusText(nextVisitDate);
  
  // Get the store style
  const storeStyle = getStoreStyle(workOrder.customer.name);

  // Calculate total services
  const totalServices = workOrder.services.reduce((total, service) => total + service.quantity, 0);

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden 
                 border-l-4 ${storeStyle.border} 
                 ${isSelected ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''}
                 transition-all duration-200 cursor-pointer hover:shadow-lg relative`}
      onClick={onClick}
    >
      {/* Decorative gradient background */}
      <div className={`absolute top-0 right-0 w-32 h-32 -mt-10 -mr-10 bg-gradient-to-br ${storeStyle.bg} rounded-full blur-xl opacity-50 pointer-events-none`}></div>
      
      {/* Header with work order ID and customer name */}
      <div className="relative p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 border-b border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="font-mono text-sm bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300">
                {workOrder.id}
              </span>
              <span className="text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 px-2 py-0.5 rounded-md">
                {workOrder.customer.storeNumber}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
              {workOrder.customer.name}
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            {statusIcon}
            <div className={`${statusColor} text-xs font-medium`}>
              <span>{statusText}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 relative z-10">
        {/* Top area with visual metrics - New feature to use empty space */}
        <div className="flex items-center justify-between mb-4 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          <div className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${statusColor} bg-opacity-10 mr-2`}>
              <FiCalendar size={16} className={statusColor} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Next Visit</p>
              <p className={`text-sm font-medium ${statusColor}`}>{workOrder.visits.nextVisit.date}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{workOrder.visits.nextVisit.time}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mr-2">
              <FiTrendingUp size={16} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Services</p>
              <p className="text-sm font-medium text-primary-600 dark:text-primary-400">{totalServices}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 mr-2">
              <FiTag size={16} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dispensers</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{totalDispensers}</p>
            </div>
          </div>
        </div>
        
        {/* Address & Location */}
        <div className="flex items-start mb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3">
            <FiMapPin className="text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{workOrder.customer.address.street}</p>
            {workOrder.customer.address.intersection && 
              <p className="text-xs text-gray-500 dark:text-gray-400">{workOrder.customer.address.intersection}</p>
            }
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {workOrder.customer.address.cityState} • {workOrder.customer.address.county}
            </p>
          </div>
        </div>
        
        {/* Services */}
        <div className="flex items-start mb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3">
            <FiTool className="text-gray-600 dark:text-gray-300" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Services:</p>
            <div className="flex flex-wrap gap-2">
              {workOrder.services.map((service, index) => (
                <div 
                  key={index} 
                  className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md flex items-center"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-300 mr-1">{service.quantity}x</span>
                  <span className="text-gray-600 dark:text-gray-400">{service.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Instructions (truncated) */}
        <div className="flex items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3">
            <FiFileText className="text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions:</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {workOrder.instructions}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with priority info */}
      <div className="bg-gray-50 dark:bg-gray-700/80 px-4 py-2.5 border-t border-gray-200 dark:border-gray-600 flex items-center justify-end relative z-10">
        <span className={`flex items-center text-xs font-medium ${statusColor} bg-white dark:bg-gray-600 px-2.5 py-1 rounded-full shadow-sm`}>
          {statusIcon}
          <span className="ml-1">{statusText}</span>
        </span>
      </div>
    </div>
  );
};

export default WorkOrderCard; 