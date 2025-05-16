import React from 'react';
import { FiActivity, FiCalendar, FiClock } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { WorkOrder } from '../../types/WorkOrder';

interface OverviewPanelProps {
  loading: boolean;
  dateRanges: {
    currentWeekStart: Date;
    currentWeekEnd: Date;
    nextWeekStart: Date;
    nextWeekEnd: Date;
  };
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  categoryCounts: {
    total: number;
    thisWeek: number;
    nextWeek: number;
    future: number;
    unscheduled: number;
  };
  storeDistribution: {
    [key: string]: number;
  };
  dailyDistribution: {
    [key: string]: number[];
  };
  goToCurrentWeek: () => void;
  formatDateRange: (start: Date, end: Date) => string;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  loading,
  dateRanges,
  selectedDate,
  setSelectedDate,
  categoryCounts,
  storeDistribution,
  dailyDistribution,
  goToCurrentWeek,
  formatDateRange
}) => {
  const getStoreDisplayName = (storeType: string): string => {
    switch (storeType) {
      case '7-eleven': return '7-Eleven';
      case 'circle-k': return 'Circle K';
      case 'wawa': return 'Wawa';
      case 'other': return 'Other Stores';
      default: return storeType;
    }
  };

  const getStoreBadgeColor = (storeType: string): string => {
    switch (storeType) {
      case '7-eleven': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'circle-k': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'wawa': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Date Selector */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Date Selection</h3>
            <button 
              onClick={goToCurrentWeek}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
            >
              Reset to Current Week
            </button>
          </div>
          <div className="mt-2">
            <DatePicker
              selected={selectedDate}
              onChange={(date: Date) => setSelectedDate(date)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              wrapperClassName="w-full"
            />
          </div>
          <div className="mt-3 text-sm">
            <div className="flex items-center mb-1">
              <FiCalendar className="text-primary-600 dark:text-primary-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Current Week: {formatDateRange(dateRanges.currentWeekStart, dateRanges.currentWeekEnd)}</span>
            </div>
            <div className="flex items-center">
              <FiClock className="text-primary-600 dark:text-primary-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Next Week: {formatDateRange(dateRanges.nextWeekStart, dateRanges.nextWeekEnd)}</span>
            </div>
          </div>
        </div>

        {/* Job Count Summary */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Job Count Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300">Total Jobs:</span>
              <span className="font-medium text-gray-900 dark:text-white">{loading ? '...' : categoryCounts.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300">This Week:</span>
              <span className="font-medium text-gray-900 dark:text-white">{loading ? '...' : categoryCounts.thisWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300">Next Week:</span>
              <span className="font-medium text-gray-900 dark:text-white">{loading ? '...' : categoryCounts.nextWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300">Future:</span>
              <span className="font-medium text-gray-900 dark:text-white">{loading ? '...' : categoryCounts.future}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300">Unscheduled:</span>
              <span className="font-medium text-gray-900 dark:text-white">{loading ? '...' : categoryCounts.unscheduled}</span>
            </div>
          </div>
        </div>

        {/* Store Distribution */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Store Distribution</h3>
          <div className="space-y-2">
            {Object.entries(storeDistribution).map(([storeType, count]) => (
              <div key={storeType} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStoreBadgeColor(storeType)}`}>
                    {getStoreDisplayName(storeType)}
                  </span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Distribution Chart */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Daily Job Distribution</h3>
        <div className="h-48">
          {/* This is where a chart would be rendered */}
          {/* Since we're just refactoring, we'll implement a placeholder */}
          <div className="flex items-center justify-center h-full">
            <FiActivity className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">Daily job distribution chart will be rendered here</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPanel;
