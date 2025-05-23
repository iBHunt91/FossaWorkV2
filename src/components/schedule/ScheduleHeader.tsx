import React from 'react';
import { FiPieChart, FiActivity, FiTrendingUp, FiList, FiBarChart2, FiCalendar, FiClock, FiAlertCircle } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';
import { MdRepeat } from 'react-icons/md';
import { ScheduleStats } from './ScheduleTypes';
import { getStoreStyles } from './ScheduleUtils';

interface ScheduleHeaderProps {
  stats: ScheduleStats;
  isLoading: boolean;
  workOrders?: any[]; // Optional prop to calculate additional stats
}

const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({ stats, isLoading, workOrders = [] }) => {
  if (isLoading) return null;

  const { currentWeekJobCount, nextWeekJobCount, storeDistributionForCurrentWeek, storeDistributionForNextWeek } = stats;
  
  // Calculate additional stats for better overview
  const calculateAdditionalStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let todayJobs = 0;
    let tomorrowJobs = 0;
    let totalDispensers = 0;
    let multiDayJobs = 0;
    
    workOrders.forEach(order => {
      const orderDateStr = order?.visits?.nextVisit?.date || order?.nextVisitDate || order?.visitDate || order?.date;
      if (!orderDateStr) return;
      
      const orderDate = new Date(orderDateStr);
      orderDate.setHours(0, 0, 0, 0);
      
      // Count dispensers
      if (order.dispensers) {
        totalDispensers += order.dispensers.length;
      }
      
      // Check for multi-day jobs
      if (order.instructions && (
        order.instructions.match(/Day \d+ of \d+/i) ||
        order.instructions.match(/Start Day/i) ||
        order.instructions.match(/Finish Day/i)
      )) {
        multiDayJobs++;
      }
      
      // Count today and tomorrow jobs
      if (orderDate.getTime() === today.getTime()) {
        todayJobs++;
      } else if (orderDate.getTime() === tomorrow.getTime()) {
        tomorrowJobs++;
      }
    });
    
    return { todayJobs, tomorrowJobs, totalDispensers, multiDayJobs };
  };
  
  const additionalStats = calculateAdditionalStats();
  
  const currentWeekStoreDistributionArray = Object.entries(storeDistributionForCurrentWeek)
    .map(([type, count]) => ({
      type,
      name: type === '7-eleven' ? '7-Eleven' : type.charAt(0).toUpperCase() + type.slice(1).replace('-k', ' K'),
      count
    }))
    .sort((a,b) => b.count - a.count);

  const nextWeekStoreDistributionArray = Object.entries(storeDistributionForNextWeek)
    .map(([type, count]) => ({
      type,
      name: type === '7-eleven' ? '7-Eleven' : type.charAt(0).toUpperCase() + type.slice(1).replace('-k', ' K'),
      count
    }))
    .sort((a,b) => b.count - a.count);

  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Overview Section */}
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex flex-col h-full">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <FiPieChart className="h-5 w-5 mr-2 text-blue-500" />
            Selected Week Overview
          </h3>
          <div className="flex flex-col space-y-2.5 flex-grow">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiActivity className="h-4 w-4 mr-1.5 text-blue-500" /> Current Week
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{currentWeekJobCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiTrendingUp className="h-4 w-4 mr-1.5 text-green-500" /> Next Week
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{nextWeekJobCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiCalendar className="h-4 w-4 mr-1.5 text-orange-500" /> Today
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{additionalStats.todayJobs}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiClock className="h-4 w-4 mr-1.5 text-purple-500" /> Tomorrow
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{additionalStats.tomorrowJobs}</span>
              </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <GiGasPump className="h-4 w-4 mr-1.5 text-indigo-500" /> Total Dispensers
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{additionalStats.totalDispensers}</span>
              </div>
              {additionalStats.multiDayJobs > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center text-gray-600 dark:text-gray-400">
                    <MdRepeat className="h-4 w-4 mr-1.5 text-pink-500" /> Multi-Day Jobs
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{additionalStats.multiDayJobs}</span>
                </div>
              )}
            </div>
            
            {(currentWeekJobCount === 0 && nextWeekJobCount === 0) && (
              <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                <FiAlertCircle className="h-4 w-4 mr-1.5" />
                No scheduled jobs
              </div>
            )}
          </div>
        </div>

        {/* Store Distribution */}
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            <FiBarChart2 className="h-5 w-5 mr-2 text-blue-500" />
            Store Distribution
          </h3>
          
          {/* Current Week Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1 mb-1">Current Week:</h4>
            {currentWeekStoreDistributionArray.length > 0 ? (
              <div className="space-y-1">
                {currentWeekStoreDistributionArray.slice(0, 2).map(store => {
                  const styles = getStoreStyles(store.type);
                  return (
                    <div key={`current-${store.type}`} className="flex items-center justify-between text-sm">
                      <span className={`flex items-center font-medium ${styles.text}`}>
                        <span className={`h-2.5 w-2.5 rounded-full mr-2 ${styles.dot}`}></span>
                        {store.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${styles.badge}`}>{store.count}</span>
                    </div>
                  );
                })}
                {currentWeekStoreDistributionArray.length > 2 && (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">+ {currentWeekStoreDistributionArray.length - 2} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">No jobs this week.</p>
            )}
          </div>

          {/* Next Week Distribution */}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Next Week:</h4>
            {nextWeekStoreDistributionArray.length > 0 ? (
              <div className="space-y-1">
                {nextWeekStoreDistributionArray.slice(0, 2).map(store => {
                  const styles = getStoreStyles(store.type);
                  return (
                    <div key={`next-${store.type}`} className="flex items-center justify-between text-sm">
                      <span className={`flex items-center font-medium ${styles.text}`}>
                        <span className={`h-2.5 w-2.5 rounded-full mr-2 ${styles.dot}`}></span>
                        {store.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${styles.badge}`}>{store.count}</span>
                    </div>
                  );
                })}
                {nextWeekStoreDistributionArray.length > 2 && (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">+ {nextWeekStoreDistributionArray.length - 2} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-1">No jobs next week.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;