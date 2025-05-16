import React, { useState, useEffect, useMemo } from 'react';
import { FiFilter, FiAlertCircle, FiCheckCircle, FiChevronRight } from 'react-icons/fi';
import { getWorkOrders } from '../services/scrapeService'; // To fetch work orders
import { useDispenserData } from '../context/DispenserContext'; // To get dispenser data
// We might need calculateFiltersForWorkOrder or parts of its logic later
// import { calculateFiltersForWorkOrder, FilterWarning, FilterNeed } from '../utils/filterCalculation';
import { WorkOrder } from '../types'; // Assuming a shared WorkOrder type
import { useToast } from '../context/ToastContext';

interface FilterSummaryCardProps {
  currentWeekDate: Date; // To scope the summary to the selected week on the dashboard
}

interface FilterSummary {
  totalPartsNeeded: number;
  totalQuantityNeeded: number;
  jobsWithWarnings: number;
  jobsRequiringFiltersThisWeek: number;
}

const FilterSummaryCard: React.FC<FilterSummaryCardProps> = ({ currentWeekDate }) => {
  const [summary, setSummary] = useState<FilterSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { addToast } = useToast();
  const { dispenserData, isLoaded: dispenserDataLoaded, loadDispenserData } = useDispenserData();

  useEffect(() => {
    // Ensure dispenser data is loaded first
    if (!dispenserDataLoaded) {
      loadDispenserData();
      return;
    }
    fetchFilterSummary();
  }, [currentWeekDate, dispenserDataLoaded, dispenserData]); // Re-fetch if date or dispenser data changes

  const fetchFilterSummary = async () => {
    setIsLoading(true);
    try {
      const workOrderData = await getWorkOrders();
      const allWorkOrders: WorkOrder[] = (workOrderData && Array.isArray(workOrderData.workOrders)) ? workOrderData.workOrders : [];
      
      // Placeholder for actual filter calculation logic based on allWorkOrders, currentWeekDate, and dispenserData
      // This will be complex and will need to adapt logic from Filters.tsx or filterCalculation.ts
      console.log('Simulating filter calculation for week of:', currentWeekDate, 'with', allWorkOrders.length, 'orders and dispenser data loaded:', dispenserDataLoaded);

      // --- Start Placeholder Logic ---
      // TODO: Replace with actual calculation
      let calculatedSummary: FilterSummary = {
        totalPartsNeeded: 0,
        totalQuantityNeeded: 0,
        jobsWithWarnings: 0,
        jobsRequiringFiltersThisWeek: 0,
      };
      // --- End Placeholder Logic ---

      setSummary(calculatedSummary);
    } catch (error) {
      console.error("Error fetching filter summary for dashboard:", error);
      addToast('error', 'Could not load filter summary.');
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center">
          <FiFilter className="mr-2" /> Filter Needs Summary (This Week)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading filter summary...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center">
          <FiFilter className="mr-2" /> Filter Needs Summary (This Week)
        </h3>
        <p className="text-sm text-red-500 dark:text-red-400">Could not load filter summary.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
        <FiFilter className="mr-2 text-cyan-500" /> Filter Needs (This Week)
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">Jobs Requiring Filters:</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white bg-cyan-100 dark:bg-cyan-700/50 px-2 py-0.5 rounded">
            {summary.jobsRequiringFiltersThisWeek}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">Distinct Filter Parts:</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white bg-cyan-100 dark:bg-cyan-700/50 px-2 py-0.5 rounded">
            {summary.totalPartsNeeded}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">Total Filter Quantity:</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white bg-cyan-100 dark:bg-cyan-700/50 px-2 py-0.5 rounded">
            {summary.totalQuantityNeeded}
          </span>
        </div>
        {summary.jobsWithWarnings > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
              <FiAlertCircle className="mr-1.5" /> Jobs with Warnings:
            </span>
            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-700/50 px-2 py-0.5 rounded">
              {summary.jobsWithWarnings}
            </span>
          </div>
        )}
      </div>
      <button 
        onClick={() => window.open('/filters', '_blank')} 
        className="mt-5 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
      >
        View Full Filter Details <FiChevronRight className="ml-1" />
      </button>
    </div>
  );
};

export default FilterSummaryCard; 