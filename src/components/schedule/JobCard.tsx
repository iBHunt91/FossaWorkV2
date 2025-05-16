import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiFileText, FiExternalLink, FiFilter, FiEdit3, FiEye, FiRefreshCw, FiTrash2, FiMoreHorizontal } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { WorkOrder, Dispenser } from './ScheduleTypes';
import { extractVisitNumber, getStoreStyles, processInstructions } from './ScheduleUtils';

interface JobCardProps {
  order: WorkOrder;
  dispenserData?: any;
  onOpenWorkFossa: (url: string) => void;
  onViewInstructions: (e: React.MouseEvent, order: WorkOrder) => void;
  onViewDispenserData: (e: React.MouseEvent, order: WorkOrder) => void;
  onOpenFilterModal: (order: WorkOrder) => void;
  onForceRescrape: (orderId: string, e: React.MouseEvent) => void;
  onClearData: (orderId: string, e: React.MouseEvent) => void;
  onToast: (type: string, message: string) => void;
  operationLoading?: Record<string, boolean>;
}

const JobCard: React.FC<JobCardProps> = ({
  order,
  dispenserData,
  onOpenWorkFossa,
  onViewInstructions,
  onViewDispenserData,
  onOpenFilterModal,
  onForceRescrape,
  onClearData,
  onToast,
  operationLoading = {}
}) => {
  const navigate = useNavigate();
  const storeType = order.customer?.name?.toLowerCase() || 'other';
  const styles = getStoreStyles(storeType);
  const visitNumber = extractVisitNumber(order);
  
  // Format date
  const jobDateStr = order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.scheduledDate || order.date;
  const formattedJobDate = jobDateStr ? new Date(jobDateStr).toLocaleDateString() : 'Unknown Date';
  
  // Get dispenser data
  const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
  const currentDispensers = (order.dispensers && order.dispensers.length > 0) 
    ? order.dispensers 
    : (contextDispensers && contextDispensers.length > 0 ? contextDispensers : []);
  const dispenserCount = currentDispensers.length;
  const hasDispenserData = dispenserCount > 0;
  
  // Process instructions
  const filteredInstructionsOnCard = processInstructions(order.instructions, order);
  
  // Colors and styling
  const isDarkMode = document.documentElement.classList.contains('dark');
  const textColor = isDarkMode ? 'text-gray-100' : 'text-gray-700';
  const subTextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const iconColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  
  const handleOpenWorkFossa = (e: React.MouseEvent) => {
    e.stopPropagation();
    const visitData = order.visits?.nextVisit;
    const relativeUrl = visitData?.url;
    if (relativeUrl) {
      const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://app.workfossa.com${relativeUrl.startsWith('/') ? relativeUrl : '/' + relativeUrl}`;
      onOpenWorkFossa(fullUrl);
    } else {
      onToast('error', 'Visit URL not found for this order.');
    }
  };

  const handleOpenFilterModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
    if (!order.dispensers?.length && contextDispensers?.length) {
      const orderWithDispensers = {
        ...order,
        dispensers: contextDispensers
      };
      onOpenFilterModal(orderWithDispensers);
    } else {
      onOpenFilterModal(order);
    }
  };

  return (
    <div className="group">
      <div className={`mb-3 rounded-lg shadow-md border ${styles.cardBorder} ${styles.cardBg} hover:shadow-lg transition-all duration-300 overflow-hidden`}>
        {/* Header Section */}
        <div className={`${styles.headerBg} px-3 pt-2.5 pb-2`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-grow pr-2">
              <GiGasPump className={`h-5 w-5 flex-shrink-0 mt-0.5 text-primary-500`} />
              <div className="flex-grow">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                  {order.customer.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {order.customer.storeNumber && (
                    <>Store #{order.customer.storeNumber.replace(/^#+/, '')} • </>
                  )}
                  Visit {visitNumber}
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded ${styles.badge}`}>
              {order.customer.territory || 'Unknown'}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-3">
          <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-start">
            {/* Visit Date */}
            <div className="flex items-start col-span-4">
              <FiCalendar className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs ${subTextColor} leading-tight`}>Visit Date</p>
                <p className={`text-xs font-medium ${textColor} leading-tight`}>{formattedJobDate}</p>
              </div>
            </div>

            {/* Dispensers */}
            <div className="flex items-start col-span-3">
              <GiGasPump className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs ${subTextColor} leading-tight`}>Dispensers</p>
                <p className={`text-xs font-medium ${textColor} leading-tight`}>
                  {dispenserCount}
                </p>
              </div>
            </div>
            
            {/* Custom Instructions */}
            <div className="flex items-start col-span-5">
              <FiFileText className={`h-3.5 w-3.5 mr-1.5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div className='flex-grow'>
                <p className={`text-xs ${subTextColor} leading-tight`}>Instructions</p>
                {order.instructions ? (
                  <p className={`text-xs font-medium ${textColor} leading-tight line-clamp-1 hover:line-clamp-2 transition-all`}>
                    {filteredInstructionsOnCard || "None"}
                  </p>
                ) : (
                  <p className={`text-xs font-medium ${textColor} leading-tight`}>None</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons Footer */}
        <div className="p-2 border-t border-gray-700/50 flex items-center justify-end relative group">
          <div className="flex items-center">
            <div className="inline-flex gap-1 opacity-0 invisible translate-x-8 group-hover:opacity-100 group-hover:visible group-hover:translate-x-0 transition-all duration-300 ease-out mr-1">
              {/* WorkFossa Button */}
              <button
                onClick={handleOpenWorkFossa}
                className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-sm transition-colors"
                title="Open in WorkFossa"
              >
                <FiExternalLink className="h-4 w-4" />
              </button>
              
              {/* Filters Button */}
              <button
                onClick={handleOpenFilterModal}
                className="p-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded shadow-sm transition-colors"
                title="View Filter Needs"
              >
                <FiFilter className="h-4 w-4" />
              </button>
              
              {/* Form Prep */}
              <button
                onClick={() => navigate(`/app/form-prep?workOrderId=${order.id}&visitId=${visitNumber}`)}
                className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-sm transition-colors"
                title="Go to Form Prep"
              >
                <FiEdit3 className="h-4 w-4" />
              </button>
              
              {/* View Instructions */}
              <button
                onClick={(e) => onViewInstructions(e, order)}
                className="p-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-sm transition-colors"
                title="View Full Instructions"
              >
                <FiEye className="h-4 w-4" />
              </button>
              
              {/* View Dispenser Data */}
              <button
                onClick={(e) => onViewDispenserData(e, order)}
                className="p-1.5 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded shadow-sm transition-colors"
                title="View Dispenser Data"
              >
                <GiGasPump className="h-4 w-4" />
              </button>
              
              {/* Rescrape Button */}
              <button 
                onClick={(e) => onForceRescrape(order.id, e)}
                className="p-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded shadow-sm transition-colors"
                title="Force Rescrape Dispenser Data"
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>
              
              {/* Clear Button */}
              <button 
                onClick={(e) => onClearData(order.id, e)}
                className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded shadow-sm transition-colors"
                title="Clear Dispenser Data (Local)"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
            
            {/* Menu indicator */}
            <div className="h-6 w-6 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center cursor-pointer">
              <FiMoreHorizontal className="h-3.5 w-3.5 text-gray-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;