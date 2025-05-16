import React from 'react';
import { FiPieChart, FiActivity, FiTrendingUp, FiList, FiBarChart2 } from 'react-icons/fi';
import { ScheduleStats } from './ScheduleTypes';
import { getStoreStyles } from './ScheduleUtils';

interface ScheduleHeaderProps {
  stats: ScheduleStats;
  isLoading: boolean;
}

const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({ stats, isLoading }) => {
  if (isLoading) return null;

  const { currentWeekJobCount, nextWeekJobCount, storeDistributionForCurrentWeek, storeDistributionForNextWeek } = stats;
  
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
    <div className="mb-3 mx-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Overview Section */}
        <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex flex-col h-full">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
            <FiPieChart className="h-4 w-4 mr-1.5 text-primary-500" />
            Selected Week Overview
          </h3>
          <div className="flex flex-col space-y-1.5 flex-grow justify-around">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center text-gray-600 dark:text-gray-400">
                <FiActivity className="h-3.5 w-3.5 mr-1 text-blue-500" /> Current Week Jobs
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{currentWeekJobCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center text-gray-600 dark:text-gray-400">
                <FiTrendingUp className="h-3.5 w-3.5 mr-1 text-green-500" /> Next Week Jobs
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{nextWeekJobCount}</span>
            </div>
          </div>
        </div>

        {/* Store Distribution */}
        <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
            <FiBarChart2 className="h-4 w-4 mr-1.5 text-primary-500" />
            Store Distribution
          </h3>
          
          {/* Current Week Distribution */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 mb-0.5">Current Week:</h4>
            {currentWeekStoreDistributionArray.length > 0 ? (
              <div className="space-y-0.5">
                {currentWeekStoreDistributionArray.slice(0, 2).map(store => {
                  const styles = getStoreStyles(store.type);
                  return (
                    <div key={`current-${store.type}`} className="flex items-center justify-between text-xs">
                      <span className={`flex items-center font-medium ${styles.text}`}>
                        <span className={`h-2 w-2 rounded-full mr-1.5 ${styles.dot}`}></span>
                        {store.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>{store.count}</span>
                    </div>
                  );
                })}
                {currentWeekStoreDistributionArray.length > 2 && (
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">+ {currentWeekStoreDistributionArray.length - 2} more</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">No jobs this week.</p>
            )}
          </div>

          {/* Next Week Distribution */}
          <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Next Week:</h4>
            {nextWeekStoreDistributionArray.length > 0 ? (
              <div className="space-y-0.5">
                {nextWeekStoreDistributionArray.slice(0, 2).map(store => {
                  const styles = getStoreStyles(store.type);
                  return (
                    <div key={`next-${store.type}`} className="flex items-center justify-between text-xs">
                      <span className={`flex items-center font-medium ${styles.text}`}>
                        <span className={`h-2 w-2 rounded-full mr-1.5 ${styles.dot}`}></span>
                        {store.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>{store.count}</span>
                    </div>
                  );
                })}
                {nextWeekStoreDistributionArray.length > 2 && (
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">+ {nextWeekStoreDistributionArray.length - 2} more</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-0.5">No jobs next week.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;