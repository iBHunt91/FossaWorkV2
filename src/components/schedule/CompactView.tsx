import React from 'react';
import { FiCalendar, FiInfo, FiEye, FiFilter } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { WorkOrder, WorkWeekDates, GroupedWorkOrders } from './ScheduleTypes';
import { extractVisitNumber, getStoreStyles } from './ScheduleUtils';

interface CompactViewProps {
  groupedWorkOrders: GroupedWorkOrders;
  workWeekDates: WorkWeekDates | null;
  dispenserData?: any;
  expandedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  onViewInstructions: (e: React.MouseEvent, order: WorkOrder) => void;
  onViewDispenserData: (e: React.MouseEvent, order: WorkOrder) => void;
  onOpenFilterModal: (order: WorkOrder) => void;
  onNavigate: (date: Date) => void;
  onGoToCurrentWeek: () => void;
}

const CompactView: React.FC<CompactViewProps> = ({
  groupedWorkOrders,
  workWeekDates,
  dispenserData,
  expandedSections,
  onToggleSection,
  onViewInstructions,
  onViewDispenserData,
  onOpenFilterModal,
  onNavigate,
  onGoToCurrentWeek
}) => {
  const { thisWeek: thisWeekJobs, nextWeek: nextWeekJobs } = groupedWorkOrders;

  if (!workWeekDates) {
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Calculating week dates...</div>;
  }

  const renderCompactJobItem = (order: WorkOrder, index: number, total: number) => {
    const storeType = order.customer?.name?.toLowerCase() || 'other';
    const styles = getStoreStyles(storeType);
    const visitNumber = extractVisitNumber(order);
    const isFirst = index === 0;
    const isLast = index === total - 1;
    
    // Get dispenser data from context or order
    const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
    const hasInstructions = order.instructions && order.instructions.trim().length > 0;
    const currentDispensers = (order.dispensers && order.dispensers.length > 0) 
        ? order.dispensers 
        : (contextDispensers && contextDispensers.length > 0 ? contextDispensers : []);
    const dispenserCount = currentDispensers.length;

    return (
      <div className="relative" key={order.id}>
        {/* Same day indicator - Only show for non-first items */}
        {!isFirst && (
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full z-10 whitespace-nowrap shadow-sm">
            Same Day
          </div>
        )}
        
        {/* Vertical connector line - For everything except the last item */}
        {!isLast && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-2 w-0.5 bg-blue-300 dark:bg-blue-600 z-0"></div>
        )}
        
        <div 
          className={`p-2 rounded-lg border ${styles.cardBorder} ${styles.cardBg} hover:shadow-sm transition-all duration-200 ${!isFirst ? 'mt-3' : ''} ${!isLast ? 'mb-3' : ''}`}
        >
          {/* Store name and visit number */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
              {order.customer?.name || 'Unknown Store'}
            </div>
            <div className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${styles.badge}`}>
              #{visitNumber}
            </div>
          </div>
          
          {/* Dispenser count */}
          <div className="flex items-center text-[10px] text-gray-600 dark:text-gray-400 mb-1">
            <div className="flex items-center">
              <GiGasPump className="h-3 w-3 mr-1" />
              <span>{dispenserCount} dispenser{dispenserCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-200 dark:border-gray-700">
            {/* View Instructions */}
            {hasInstructions && (
              <button
                onClick={(e) => onViewInstructions(e, order)}
                className="p-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-sm transition-colors"
                title="View Instructions"
              >
                <FiEye className="h-3 w-3" />
              </button>
            )}
            
            {/* View Dispenser Data */}
            <button
              onClick={(e) => onViewDispenserData(e, order)}
              className="p-1 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded shadow-sm transition-colors"
              title="View Dispenser Data"
            >
              <GiGasPump className="h-3 w-3" />
            </button>
            
            {/* Filter Needs */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!order.dispensers?.length && contextDispensers?.length) {
                  const orderWithDispensers = {
                    ...order,
                    dispensers: contextDispensers
                  };
                  onOpenFilterModal(orderWithDispensers);
                } else {
                  onOpenFilterModal(order);
                }
              }}
              className="p-1 bg-teal-500 hover:bg-teal-600 text-white rounded shadow-sm transition-colors"
              title="View Filter Needs"
            >
              <FiFilter className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDayColumn = (date: Date, jobsForDay: WorkOrder[], sectionKeyPrefix: string, isCurrentWeek: boolean) => {
    const isToday = date.toDateString() === new Date().toDateString() && isCurrentWeek;
    const sectionKey = `${sectionKeyPrefix}-day-${date.getDay()}`;
    const isExpanded = expandedSections[sectionKey] || false;
    
    // For next week, initially show 3 jobs unless expanded. For current week, show all.
    const initialDisplayLimit = isCurrentWeek ? jobsForDay.length : 3;
    const visibleJobs = isExpanded || isCurrentWeek ? jobsForDay : jobsForDay.slice(0, initialDisplayLimit);
    const hiddenJobCount = jobsForDay.length - visibleJobs.length;

    return (
      <div key={date.toISOString()} className={`flex flex-col ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
        {/* Date header */}
        <div className={`p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${isToday ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-500 dark:bg-gray-600'}`}>
          <div className="flex flex-col">
            <span className="text-xs text-white font-medium">
              {date.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span className="font-semibold text-white">
              {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {jobsForDay.length > 0 && (
            <div className="flex items-center bg-white dark:bg-gray-800 text-blue-700 dark:text-white px-2 py-1 rounded-md">
              <span className="text-xs font-bold">{jobsForDay.length}</span>
              <span className="text-xs ml-1">job{jobsForDay.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        
        {/* Job cards */}
        <div className="flex-1 p-2 sm:p-3 overflow-y-auto min-h-[100px]">
          {visibleJobs.length > 0 ? visibleJobs.map((job, index) => (
            renderCompactJobItem(job, index, visibleJobs.length)
          )) : (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4">No jobs</div>
          )}
          {hiddenJobCount > 0 && !isCurrentWeek && (
            <button 
              onClick={() => onToggleSection(sectionKey)}
              className="w-full mt-1 py-1 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 rounded-md text-center transition-colors"
            >
              +{hiddenJobCount} more job{hiddenJobCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mx-1 sm:mx-2 my-2">
      {/* Header with navigation */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
            <FiCalendar className="mr-1.5 sm:mr-2 text-primary-500 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-base sm:text-lg">
              Week of {workWeekDates.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() - 7); onNavigate(newStart); }} 
            title="Previous Week"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={onGoToCurrentWeek}
            className="px-2 sm:px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs sm:text-sm font-medium transition-colors hover:bg-primary-200 dark:hover:bg-primary-800/50"
          >
            Today
          </button>
          <button 
            className="p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            onClick={() => { const newStart = new Date(workWeekDates.currentWeekStart); newStart.setDate(newStart.getDate() + 7); onNavigate(newStart); }} 
            title="Next Week"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      
      {/* Current Week Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700 gap-px">
        {Array.from({ length: 5 }).map((_, dayIndex) => {
          const currentDate = new Date(workWeekDates.currentWeekStart);
          currentDate.setDate(currentDate.getDate() + dayIndex);
          const jobsForDay = thisWeekJobs.filter(job => {
            const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.scheduledDate || job.date;
            if (!jobDate) return false;
            return new Date(jobDate).toDateString() === currentDate.toDateString();
          });
          return renderDayColumn(currentDate, jobsForDay, 'current-week', true);
        })}
      </div>
      
      {/* Next Week Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-px">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center text-sm sm:text-base">
            <FiCalendar className="mr-1.5 sm:mr-2 text-primary-500 h-4 w-4 sm:h-5 sm:w-5" />
            <span>Next Week ({workWeekDates.nextWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {workWeekDates.nextWeekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})</span>
            <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
              {nextWeekJobs.length}
            </span>
          </h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700 gap-px">
          {Array.from({ length: 5 }).map((_, dayIndex) => {
            const currentDate = new Date(workWeekDates.nextWeekStart);
            currentDate.setDate(currentDate.getDate() + dayIndex);
            const jobsForDay = nextWeekJobs.filter(job => {
              const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.scheduledDate || job.date;
              if (!jobDate) return false;
              return new Date(jobDate).toDateString() === currentDate.toDateString();
            });
            return renderDayColumn(currentDate, jobsForDay, 'next-week', false);
          })}
        </div>
      </div>

      {/* Other scheduled jobs section */}
      {groupedWorkOrders.other.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 flex items-center text-sm sm:text-base">
              <FiCalendar className="mr-1.5 sm:mr-2 text-primary-500 h-4 w-4 sm:h-5 sm:w-5" />
              <span>Other Scheduled Jobs</span>
              <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                {groupedWorkOrders.other.length}
              </span>
            </h4>
            <button 
              onClick={() => onToggleSection('view-all-jobs')}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded text-xs sm:text-sm font-medium transition-colors"
            >
              {expandedSections['view-all-jobs'] ? 'Hide' : 'Show'} Jobs
            </button>
          </div>
          
          {expandedSections['view-all-jobs'] && (
            <div>
              {(() => {
                // Group other jobs by date
                const jobsByDate = groupedWorkOrders.other.reduce((acc, job) => {
                  const jobDate = job.visits?.nextVisit?.date || job.nextVisitDate || job.visitDate || job.scheduledDate || job.date;
                  if (!jobDate) return acc;
                  
                  const dateKey = new Date(jobDate).toISOString().split('T')[0];
                  if (!acc[dateKey]) {
                    acc[dateKey] = [];
                  }
                  acc[dateKey].push(job);
                  return acc;
                }, {} as Record<string, WorkOrder[]>);
                
                // Sort dates
                const sortedDates = Object.keys(jobsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-h-[180px] divide-x divide-gray-200 dark:divide-gray-700 gap-px">
                    {sortedDates.map(dateKey => {
                      const date = new Date(dateKey);
                      const jobsForDay = jobsByDate[dateKey];
                      return renderDayColumn(date, jobsForDay, `other-day-${dateKey}`, false);
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      
      {(thisWeekJobs.length === 0 && nextWeekJobs.length === 0 && groupedWorkOrders.other.length === 0) && (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <FiInfo className="mx-auto h-10 w-10 mb-2 opacity-60" />
          No jobs to display in compact view for the current filter or selected weeks.
        </div>
      )}
    </div>
  );
};

export default CompactView;