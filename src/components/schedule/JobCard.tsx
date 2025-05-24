import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiFileText, FiExternalLink, FiFilter, FiEdit3, FiEye, FiRefreshCw, FiTrash2, FiMoreHorizontal } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { MdRepeat } from 'react-icons/md';
import { WorkOrder, Dispenser } from './ScheduleTypes';
import { extractVisitNumber, getStoreStyles, getStoreTypeForFiltering, processInstructions, simplifyStoreName, extractMultiDayInfo, ProcessedInstructions } from './ScheduleUtils';

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
  const storeType = getStoreTypeForFiltering(order);
  const styles = getStoreStyles(storeType);
  const visitNumber = extractVisitNumber(order);
  const multiDayInfo = extractMultiDayInfo(order);
  
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
  const processedInstructions: ProcessedInstructions = processInstructions(order.instructions || '', order);
  
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
      <div className={`mb-4 rounded-md shadow-md border ${styles.cardBorder} ${styles.cardBg} hover:shadow-lg transition-all duration-300 overflow-hidden`}>
        {/* Header Section */}
        <div className={`${styles.headerBg} px-4 py-3`}>
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Store info */}
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate mb-1">
                {simplifyStoreName(order.customer.name)}
              </h4>
              <div className="flex items-center gap-3 text-sm">
                {/* Store and Visit Info */}
                <div className="flex items-center gap-2">
                  {order.customer.storeNumber && (
                    <>
                      <span className="text-gray-500 dark:text-gray-400">Store</span>
                      <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                        #{order.customer.storeNumber.replace(/^#+/, '')}
                      </span>
                    </>
                  )}
                  {order.customer.storeNumber && <span className="text-gray-400 dark:text-gray-500">•</span>}
                  <span className="text-gray-500 dark:text-gray-400">Visit</span>
                  <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                    #{visitNumber}
                  </span>
                </div>
                {/* Multi-day badge inline */}
                {multiDayInfo.isMultiDay && (
                  <>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                      <MdRepeat className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {multiDayInfo.currentDay && multiDayInfo.totalDays 
                          ? `Day ${multiDayInfo.currentDay}/${multiDayInfo.totalDays}`
                          : multiDayInfo.currentDay === 1 
                            ? 'Start Day'
                            : 'Multi-Day'
                        }
                      </span>
                    </div>
                  </>
                )}
                {/* Specific dispensers badge */}
                {processedInstructions.specificDispensers && processedInstructions.specificDispensers.length > 0 && (
                  <>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                      <GiGasPump className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        #{processedInstructions.specificDispensers.join(', #')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Right side - Fixed width for consistent alignment */}
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1.5 mb-1">
                <FiCalendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formattedJobDate}
                </span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {dispenserCount} {dispenserCount === 1 ? 'dispenser' : 'dispensers'}
                </span>
                <GiGasPump className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Instructions */}
        <div className="p-3">
          {order.instructions ? (
            processedInstructions.isSpecial ? (
              // Special instructions with amber styling
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md">
                <div className="flex items-start gap-2">
                  <FiFileText className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Special Instructions</p>
                    <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed break-words">
                      {processedInstructions.text}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Standard instructions with gray styling
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-md">
                <div className="flex items-start gap-2">
                  <FiFileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Standard Instructions</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                      {processedInstructions.text}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <FiFileText className="h-4 w-4" />
              <p className="text-sm italic">No instructions</p>
            </div>
          )}
        </div>
        
        {/* Action Buttons Footer */}
        <div className="p-1.5 border-t border-gray-700/50 flex items-center justify-end relative group">
          <div className="flex items-center">
            <div className="inline-flex gap-1 opacity-0 invisible translate-x-8 group-hover:opacity-100 group-hover:visible group-hover:translate-x-0 transition-all duration-300 ease-out mr-1">
              {/* WorkFossa Button */}
              <button
                onClick={handleOpenWorkFossa}
                className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-sm transition-colors"
                title="Open in WorkFossa"
              >
                <FiExternalLink className="h-4 w-4" />
              </button>
              
              {/* Filters Button */}
              <button
                onClick={handleOpenFilterModal}
                className="p-1 bg-teal-500 hover:bg-teal-600 text-white rounded shadow-sm transition-colors"
                title="View Filter Needs"
              >
                <FiFilter className="h-4 w-4" />
              </button>
              
              {/* Form Prep */}
              <button
                onClick={() => navigate(`/app/form-prep?workOrderId=${order.id}&visitId=${visitNumber}`)}
                className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-sm transition-colors"
                title="Go to Form Prep"
              >
                <FiEdit3 className="h-4 w-4" />
              </button>
              
              {/* View Instructions */}
              <button
                onClick={(e) => onViewInstructions(e, order)}
                className="p-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-sm transition-colors"
                title="View Full Instructions"
              >
                <FiEye className="h-4 w-4" />
              </button>
              
              {/* View Dispenser Data */}
              <button
                onClick={(e) => onViewDispenserData(e, order)}
                className="p-1 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded shadow-sm transition-colors"
                title="View Dispenser Data"
              >
                <GiGasPump className="h-4 w-4" />
              </button>
              
              {/* Rescrape Button */}
              <button 
                onClick={(e) => onForceRescrape(order.id, e)}
                className="p-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded shadow-sm transition-colors"
                title="Force Rescrape Dispenser Data"
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>
              
              {/* Clear Button */}
              <button 
                onClick={(e) => onClearData(order.id, e)}
                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded shadow-sm transition-colors"
                title="Clear Dispenser Data (Local)"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
            
            {/* Menu indicator */}
            <div className="h-5 w-5 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center cursor-pointer">
              <FiMoreHorizontal className="h-3.5 w-3.5 text-gray-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;