import React from 'react';
import { FiCalendar, FiInfo } from 'react-icons/fi';
import { GroupedWorkOrders, WorkOrder } from './ScheduleTypes';
import { groupOrdersByDate } from './ScheduleUtils';
import JobCard from './JobCard';
import Panel from './Panel';

interface WeeklyViewProps {
  grouped: GroupedWorkOrders;
  dispenserData?: any;
  expandedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  onOpenWorkFossa: (url: string) => void;
  onViewInstructions: (e: React.MouseEvent, order: WorkOrder) => void;
  onViewDispenserData: (e: React.MouseEvent, order: WorkOrder) => void;
  onOpenFilterModal: (order: WorkOrder) => void;
  onForceRescrape: (orderId: string, e: React.MouseEvent) => void;
  onClearData: (orderId: string, e: React.MouseEvent) => void;
  onToast: (type: string, message: string) => void;
  operationLoading?: Record<string, boolean>;
}

const WeeklyView: React.FC<WeeklyViewProps> = ({
  grouped,
  dispenserData,
  expandedSections,
  onToggleSection,
  ...actionProps
}) => {
  const sections = [
    { title: 'Current Week', orders: grouped.thisWeek, icon: <FiCalendar className="text-blue-500" />, id: 'current-week' },
    { title: 'Next Week', orders: grouped.nextWeek, icon: <FiCalendar className="text-green-500" />, id: 'next-week' },
    { title: 'Other Dates', orders: grouped.other, icon: <FiCalendar className="text-gray-500" />, id: 'other-dates' },
  ];

  return (
    <>
      {sections.map(section => {
        if (section.orders.length === 0 && section.id !== 'current-week') return null;
        
        const isExpanded = expandedSections[section.id] || false;
        const displayLimit = section.id === 'other-dates' ? 4 : (section.id === 'current-week' || section.id === 'next-week' ? 100 : Infinity);
        
        // Group orders by date
        const groupedByDate = groupOrdersByDate(section.orders);
        const visibleGroups = isExpanded ? groupedByDate : groupedByDate.slice(0, displayLimit);
        const hiddenCount = section.orders.length - visibleGroups.reduce((acc, [_, orders]) => acc + orders.length, 0);

        return (
          <div key={section.id} className="py-2">
            <Panel
              title={section.title}
              icon={section.icon}
              action={
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  section.orders.length > 0 
                    ? (section.id === 'current-week' 
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                        : section.id === 'next-week' 
                          ? 'bg-accent-green-100 dark:bg-accent-green-900/30 text-accent-green-700 dark:text-accent-green-300' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      ) 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {section.orders.length} Job{section.orders.length !== 1 ? 's' : ''}
                </span>
              }
            >
              {section.orders.length > 0 ? (
                <div className="p-2 sm:p-4 space-y-4">
                  {visibleGroups.map(([dateKey, ordersForDate]) => {
                    const dateDisplay = dateKey === 'unknown' 
                      ? 'Unknown Date' 
                      : new Date(dateKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    
                    return (
                      <div key={dateKey} className="rounded-md overflow-hidden">
                        {/* Date header */}
                        <div className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 flex items-center justify-between rounded-t-md">
                          <div className="flex items-center">
                            <FiCalendar className="mr-2" />
                            <span className="font-medium">{dateDisplay}</span>
                          </div>
                          <div className="flex items-center bg-white dark:bg-blue-800 text-blue-700 dark:text-white px-2 py-1 rounded-md">
                            <span className="text-xs font-bold">{ordersForDate.length}</span>
                            <span className="text-xs ml-1">job{ordersForDate.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        
                        {/* Jobs for this date */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 pt-3 pb-2 px-3 rounded-b-md">
                          {ordersForDate.map((order, index) => {
                            const isLast = index === ordersForDate.length - 1;
                            return (
                              <div key={order.id} className="relative">
                                <div className={`${!isLast ? 'mb-6' : 'mb-2'} relative`}>
                                  {/* Same day indicator - only on non-first items */}
                                  {index > 0 && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full z-10 whitespace-nowrap shadow-sm">
                                      Same Day
                                    </div>
                                  )}
                                  
                                  {/* Vertical connector line */}
                                  {!isLast && (
                                    <div className="absolute left-1/2 transform -translate-x-1/2 top-full h-6 w-0.5 bg-blue-300 dark:bg-blue-600 z-0"></div>
                                  )}
                                  
                                  <JobCard 
                                    order={order}
                                    dispenserData={dispenserData}
                                    {...actionProps}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show more/less buttons */}
                  {hiddenCount > 0 && (
                    <button 
                      onClick={() => onToggleSection(section.id)}
                      className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                    >
                      Show {hiddenCount} more job{hiddenCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {isExpanded && section.orders.length > displayLimit && (
                    <button 
                      onClick={() => onToggleSection(section.id)}
                      className="w-full mt-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
                    >
                      Show less
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <FiInfo className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No jobs scheduled for {section.title.toLowerCase()}.
                </div>
              )}
            </Panel>
          </div>
        );
      })}
    </>
  );
};

export default WeeklyView;