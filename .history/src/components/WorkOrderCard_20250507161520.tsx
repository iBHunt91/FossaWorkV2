import React from 'react';
import { 
  FiMapPin, 
  FiCalendar, 
  FiTool, 
  FiFileText, 
  FiClock, 
  FiAlertCircle, 
  FiCheckCircle 
} from 'react-icons/fi';

// Define the WorkOrder interface based on the JSON structure
interface WorkOrder {
  id: string;
  customer: {
    name: string;
    storeNumber: string;
    address: {
      street: string;
      intersection: string;
      cityState: string;
      county: string;
    };
    storeUrl: string;
  };
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string;
  }>;
  visits: {
    nextVisit: {
      date: string;
      time: string;
      url: string;
      visitId: string;
    };
  };
  instructions: string;
}

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
    return 'text-red-500';
  }
  
  // Check if due date is within the next 7 days
  const oneWeek = new Date(today);
  oneWeek.setDate(today.getDate() + 7);
  
  if (formattedDate <= oneWeek) {
    return 'text-orange-500';
  }
  
  return 'text-green-500';
};

const getStoreStyle = (name: string): string => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('7-eleven') || lowerName.includes('speedway')) {
    return 'border-green-500';
  } else if (lowerName.includes('wawa')) {
    return 'border-yellow-500';
  } else if (lowerName.includes('circle k')) {
    return 'border-red-500';
  }
  
  return 'border-blue-500';
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
  
  // Get the store style
  const storeStyle = getStoreStyle(workOrder.customer.name);

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden 
                 border-l-4 ${storeStyle} 
                 ${isSelected ? 'ring-2 ring-blue-500' : ''}
                 transition-all hover:shadow-lg cursor-pointer`}
      onClick={onClick}
    >
      {/* Header with work order ID and customer name */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
              {workOrder.id}
            </span>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {workOrder.customer.name}
            </h3>
          </div>
          <span className="text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
            {workOrder.customer.storeNumber}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Address & Location */}
        <div className="flex items-start mb-3">
          <FiMapPin className="text-gray-500 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{workOrder.customer.address.street}</p>
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
          <FiTool className="text-gray-500 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Services:</p>
            <div className="space-y-1">
              {workOrder.services.map((service, index) => (
                <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{service.quantity}x</span> {service.type}: {service.description} 
                  <span className="text-gray-400 dark:text-gray-500 ml-1">({service.code})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Visit Information */}
        <div className="flex items-start mb-3">
          <FiCalendar className="text-gray-500 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Next Visit:</p>
            <p className="text-sm font-medium">{workOrder.visits.nextVisit.date}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {workOrder.visits.nextVisit.time}
            </p>
          </div>
        </div>
        
        {/* Instructions (truncated) */}
        <div className="flex items-start mb-2">
          <FiFileText className="text-gray-500 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions:</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {workOrder.instructions}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with status info */}
      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <div className="flex items-center">
          <FiClock className="text-gray-400 mr-1.5" size={14} />
          <span className={`text-xs font-medium ${statusColor}`}>
            Due: {workOrder.visits.nextVisit.date}
          </span>
        </div>
        
        <div className="flex items-center text-xs">
          <span className="flex items-center text-gray-500 dark:text-gray-400">
            <FiTool className="mr-1.5" size={14} />{totalDispensers} Dispensers
          </span>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderCard; 