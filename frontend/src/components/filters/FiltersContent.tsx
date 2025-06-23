import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient as api, WorkOrder, Dispenser } from '../../services/api';
import DateSelector from './DateSelector';
import FilterSummaryPanel from './FilterSummaryPanel';
import FilterWarningsPanel from './FilterWarningsPanel';
import FilterDetailsPanel from './FilterDetailsPanel';
import LoadingSpinner from '../LoadingSpinner';
import { Card } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import NoDispensersState from './NoDispensersState';
import FiltersSkeleton from './FiltersSkeleton';
import { FilterCalculationResult, FilterWarning, FilterWorkOrder, FilterDispenser } from '../../types/filters';

interface FiltersContentProps {
  selectedWeek: Date;
  onWeekChange: (date: Date) => void;
  onExport: () => void;
  isRefreshing: boolean;
}

export default function FiltersContent({
  selectedWeek,
  onWeekChange,
  onExport,
  isRefreshing
}: FiltersContentProps) {
  const { user } = useAuth();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [warningSeverityFilter, setWarningSeverityFilter] = useState<string>('all');
  const [hasSetInitialWeek, setHasSetInitialWeek] = useState(false);

  // Get week boundaries
  const weekStart = selectedWeek ? startOfWeek(selectedWeek, { weekStartsOn: 1 }) : startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = selectedWeek ? endOfWeek(selectedWeek, { weekStartsOn: 1 }) : endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday
  

  // Fetch work orders for the selected week
  const { data: allWorkOrders, isLoading: loadingWorkOrders, error: workOrdersError } = useQuery({
    queryKey: ['workOrders', user?.id],
    queryFn: async () => {
      const response = await api.get(`/api/v1/work-orders`, {
        params: {
          user_id: user?.id
        }
      });
      return response.data as WorkOrder[];
    },
    enabled: !!user?.id,
    refetchInterval: isRefreshing ? 5000 : false,
    retry: 2
  });

  // Smart week detection - find best week with work orders (like Work Orders page)
  useEffect(() => {
    if (!hasSetInitialWeek && allWorkOrders && allWorkOrders.length > 0) {
      const findBestWeek = () => {
        const today = new Date();
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
        
        // Step 1: Check if current week has work orders
        const currentWeekOrders = allWorkOrders.filter(wo => {
          if (!wo.scheduled_date) return false;
          const date = new Date(wo.scheduled_date);
          return date >= currentWeekStart && date <= currentWeekEnd;
        });
        
        if (currentWeekOrders.length > 0) {
          return today;
        }
        
        // Step 2: If current week is empty, find nearest week with work orders
        const scheduledWorkOrders = allWorkOrders.filter(wo => wo.scheduled_date);
        
        if (scheduledWorkOrders.length === 0) {
          return today;
        }
        
        // Step 3: Find closest week to today that has work orders
        const sortedOrders = scheduledWorkOrders.sort((a, b) => 
          new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime()
        );
        
        let bestWeek = new Date(sortedOrders[0].scheduled_date!);
        let minDistance = Math.abs(new Date(sortedOrders[0].scheduled_date!).getTime() - today.getTime());
        
        for (const order of sortedOrders) {
          const orderDate = new Date(order.scheduled_date!);
          const distance = Math.abs(orderDate.getTime() - today.getTime());
          
          if (distance < minDistance) {
            minDistance = distance;
            bestWeek = orderDate;
          }
        }
        
        return bestWeek;
      };
      
      const bestWeek = findBestWeek();
      onWeekChange(bestWeek);
      setHasSetInitialWeek(true);
    }
  }, [allWorkOrders, hasSetInitialWeek, onWeekChange]);

  // Filter work orders by selected week
  const workOrders = useMemo(() => {
    if (!allWorkOrders) return [];
    
    const filtered = allWorkOrders.filter(wo => {
      const scheduledDate = wo.scheduled_date ? new Date(wo.scheduled_date) : null;
      if (!scheduledDate) return false;
      
      // Create dates with time normalized for accurate comparison
      const orderDate = new Date(scheduledDate);
      orderDate.setHours(0, 0, 0, 0);
      
      const weekStartCompare = new Date(weekStart);
      weekStartCompare.setHours(0, 0, 0, 0);
      
      const weekEndCompare = new Date(weekEnd);
      weekEndCompare.setHours(23, 59, 59, 999);
      
      const inRange = orderDate >= weekStartCompare && orderDate <= weekEndCompare;
      
      // Removed individual logging to improve performance
      
      return inRange;
    });
    
    
    return filtered;
  }, [allWorkOrders, weekStart, weekEnd]);

  // Fetch dispensers for work orders
  const { data: dispensers, isLoading: loadingDispensers, error: dispensersError } = useQuery({
    queryKey: ['dispensers', user?.id, workOrders?.map(wo => wo.id)],
    queryFn: async () => {
      if (!workOrders || workOrders.length === 0) return [];
      
      // Extract dispensers from work orders
      const allDispensers: Dispenser[] = [];
      let workOrdersWithServiceItems = 0;
      let workOrdersWithDispensers = 0;
      
      workOrders.forEach(wo => {
        // Check if work order has service_items indicating dispensers
        if (wo.service_items) {
          const items = Array.isArray(wo.service_items) ? wo.service_items : [wo.service_items];
          for (const item of items) {
            if (item && item.toString().match(/\d+\s*x\s*(All\s*)?Dispenser/i)) {
              workOrdersWithServiceItems++;
              break;
            }
          }
        }
        
        // Check if work order has actual dispenser data
        if (wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0) {
          workOrdersWithDispensers++;
          wo.dispensers.forEach(d => {
            // Convert dispenser data to match expected format
            const dispenser: Dispenser = {
              id: d.id || `${wo.id}-${d.dispenser_number}`,
              dispenser_number: d.dispenser_number || d.dispenserNumber || '',
              dispenser_type: d.dispenser_type || d.dispenserType || '',
              fuel_grades: d.fuel_grades || d.fuelGrades || d.fuel_grades_list || [],
              status: d.status || 'pending',
              progress_percentage: d.progress_percentage || 0,
              automation_completed: d.automation_completed || false,
              make: d.make || '',
              model: d.model || '',
              serial_number: d.serial_number || '',
              meter_type: d.meter_type || d.meterType || 'Electronic',
              number_of_nozzles: d.number_of_nozzles || '',
              workOrderId: wo.id,
              storeNumber: wo.storeNumber || wo.store_number || wo.site_name?.match(/#(\d+)/)?.[1] || ''
            };
            allDispensers.push(dispenser);
          });
        }
      });
      
      
      return allDispensers;
    },
    enabled: !!user?.id && !!workOrders && workOrders.length > 0,
    retry: 2
  });

  // Calculate filters
  const { data: filterResults, isLoading: calculatingFilters, error: calculationError } = useQuery({
    queryKey: ['filterCalculation', user?.id, workOrders, dispensers, editedValues],
    queryFn: async () => {
      if (!workOrders || workOrders.length === 0) {
        return null;
      }
      
      
      // All jobs require dispensers for filter calculation
      if (!dispensers || dispensers.length === 0) {
        return null;
      }
      
      // Transform work orders to include filter-specific fields
      const transformedWorkOrders = workOrders.map(wo => {
        // Extract store number and customer name from site_name
        const storeMatch = wo.site_name?.match(/#(\d+)/);
        const storeNumber = storeMatch?.[1] || wo.store_number || '';
        const customerName = wo.site_name?.split('#')[0]?.trim() || wo.site_name || '';
        
        return {
          ...wo,
          jobId: wo.external_id || wo.id,
          storeNumber: storeNumber,
          storeName: wo.site_name,
          customerName: customerName,
          serviceCode: wo.service_code || '',
          serviceName: wo.service_name || '',
          scheduledDate: wo.scheduled_date || '',
          address: wo.address || ''
        };
      });
      
      
      // Transform dispensers to match backend expected format (empty array if no dispensers)
      const transformedDispensers = (dispensers || []).map(d => {
        // Convert fuel_grades object to array format expected by backend
        let fuelGradesArray: any[] = [];
        
        if (d.fuel_grades && typeof d.fuel_grades === 'object' && !Array.isArray(d.fuel_grades)) {
          // Convert object format {1: {grade: "Regular 87"}, 2: {grade: "Plus 89"}} to array
          fuelGradesArray = Object.entries(d.fuel_grades).map(([position, gradeInfo]: [string, any]) => ({
            position: parseInt(position),
            grade: gradeInfo.grade || gradeInfo.name || gradeInfo
          }));
        } else if (Array.isArray(d.fuel_grades)) {
          fuelGradesArray = d.fuel_grades;
        }
        
        return {
          ...d,
          fuelGrades: fuelGradesArray,
          dispenserNumber: d.dispenser_number,
          dispenserType: d.dispenser_type,
          meterType: d.meter_type || 'Electronic'
        };
      });
      
      // Use backend endpoint for complex calculations
      
      const response = await api.post(`/filters/calculate`, {
        workOrders: transformedWorkOrders,
        dispensers: transformedDispensers,
        overrides: editedValues
      });
      
      console.log('Filter calculation response:', response.data);
      return response.data as FilterCalculationResult;
    },
    enabled: !!user?.id && !!workOrders && workOrders.length > 0,
    retry: 1
  });

  // Find nearest week with work orders (like Work Orders page)
  const findNearestWeekWithWork = () => {
    if (!allWorkOrders || allWorkOrders.length === 0) return null;
    
    const scheduledWorkOrders = allWorkOrders.filter(wo => wo.scheduled_date);
    if (scheduledWorkOrders.length === 0) return null;
    
    const today = new Date();
    const sortedOrders = scheduledWorkOrders.sort((a, b) => 
      new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime()
    );
    
    let bestWeek = new Date(sortedOrders[0].scheduled_date!);
    let minDistance = Math.abs(new Date(sortedOrders[0].scheduled_date!).getTime() - today.getTime());
    
    for (const order of sortedOrders) {
      const orderDate = new Date(order.scheduled_date!);
      const distance = Math.abs(orderDate.getTime() - today.getTime());
      
      if (distance < minDistance) {
        minDistance = distance;
        bestWeek = orderDate;
      }
    }
    
    return bestWeek;
  };

  // Derived states
  const isLoading = loadingWorkOrders || loadingDispensers || calculatingFilters;
  const hasError = workOrdersError || dispensersError || calculationError;
  const hasWorkOrders = workOrders && workOrders.length > 0;
  const hasDispensers = dispensers && dispensers.length > 0;
  const totalWorkOrdersCount = allWorkOrders?.length || 0;
  const nearestWeekWithWork = findNearestWeekWithWork();

  // Filter warnings based on severity
  const filteredWarnings = useMemo(() => {
    if (!filterResults?.warnings) return [];
    
    return filterResults.warnings.filter(warning => {
      if (warningSeverityFilter === 'all') return true;
      if (warningSeverityFilter === 'high') return warning.severity >= 7;
      if (warningSeverityFilter === 'medium') return warning.severity >= 4 && warning.severity < 7;
      if (warningSeverityFilter === 'low') return warning.severity < 4;
      return true;
    });
  }, [filterResults, warningSeverityFilter]);

  // Filter summary based on filter type
  const filteredSummary = useMemo(() => {
    if (!filterResults?.summary) return [];
    
    return filterResults.summary.filter(item => {
      if (filterType === 'all') return true;
      return item.filterType === filterType;
    });
  }, [filterResults, filterType]);

  // Show error state if there's a critical error loading work orders
  if (workOrdersError && !isLoading) {
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={0}
          totalFilters={0}
        />
        <ErrorState 
          error={workOrdersError}
          onRetry={() => {
            // Force refetch all queries
            window.location.reload();
          }}
        />
      </>
    );
  }

  // Show loading state only during initial load
  if (loadingWorkOrders && !allWorkOrders) {
    return <FiltersSkeleton />;
  }
  
  // Show skeleton while calculating filters (better UX for slow loading)
  if (hasWorkOrders && hasDispensers && calculatingFilters && !filterResults) {
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={workOrders.length}
          totalFilters={0}
        />
        <FiltersSkeleton />
      </>
    );
  }

  // Don't render anything until we have determined if there are work orders
  if (!allWorkOrders) {
    return null;
  }

  // Case 1: No work orders at all
  if (!allWorkOrders || totalWorkOrdersCount === 0) {
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={0}
          totalFilters={0}
        />
        
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 mb-6">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle>No Work Orders Found</AlertTitle>
          <AlertDescription>
            You don't have any work orders in the system. Please scrape work orders from WorkFossa first.
          </AlertDescription>
        </Alert>
        
        <EmptyState
          selectedWeek={selectedWeek}
          onRefresh={() => {
            window.location.reload();
          }}
          onWeekChange={onWeekChange}
          nearestWeekWithWork={nearestWeekWithWork}
        />
      </>
    );
  }

  // Case 2: Have work orders but none in selected week
  if (!hasWorkOrders) {
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={0}
          totalFilters={0}
        />
        
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 mb-6">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle>No Work Orders This Week</AlertTitle>
          <AlertDescription>
            You have {totalWorkOrdersCount} total work order{totalWorkOrdersCount !== 1 ? 's' : ''} in the system, but none are scheduled for this week. Try selecting a different week.
          </AlertDescription>
        </Alert>
        
        <EmptyState
          selectedWeek={selectedWeek}
          onRefresh={() => {
            window.location.reload();
          }}
          onWeekChange={onWeekChange}
          nearestWeekWithWork={nearestWeekWithWork}
        />
      </>
    );
  }

  // Case 3: Have work orders but no dispensers (and not calculating)
  if (hasWorkOrders && !hasDispensers && !loadingDispensers) {
    // Show the no dispensers state
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={workOrders.length}
          totalFilters={0}
        />
        
        <NoDispensersState
          workOrderCount={workOrders.length}
          selectedWeek={selectedWeek}
          onRefresh={() => {
            window.location.reload();
          }}
        />
      </>
    );
  }

  // Case 4: Have filter results but no actual filters (mixed service codes)
  if (hasWorkOrders && filterResults && filterResults.totalFilters === 0 && !calculatingFilters) {
    // This happens when we have a mix of jobs including Open Neck Prover
    // The UI should still show with the warnings
    // Continue to main render
  }
  
  // Case 5: Have data but calculation failed
  if (hasWorkOrders && hasDispensers && calculationError && !calculatingFilters) {
    return (
      <>
        <DateSelector
          selectedWeek={selectedWeek}
          onWeekChange={onWeekChange}
          workOrderCount={workOrders.length}
          totalFilters={0}
        />
        
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 mb-6">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle>Filter Calculation Error</AlertTitle>
          <AlertDescription>
            Failed to calculate filter requirements. This might be due to missing service codes or invalid dispenser data.
            Error: {calculationError.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Work Order Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{workOrders.length}</div>
              <div className="text-sm text-muted-foreground">Work Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{dispensers.length}</div>
              <div className="text-sm text-muted-foreground">Dispensers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{new Set(workOrders.map(wo => wo.site_name)).size}</div>
              <div className="text-sm text-muted-foreground">Unique Stores</div>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <DateSelector
        selectedWeek={selectedWeek}
        onWeekChange={onWeekChange}
        workOrderCount={workOrders?.length || 0}
        totalFilters={filterResults?.totalFilters || 0}
      />

      {/* Summary Statistics - Enhanced Styling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            Total Jobs
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {workOrders?.length || 0}
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            Total Filters
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {filterResults?.totalFilters || 0}
          </div>
        </div>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            Active Warnings
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            {filterResults?.warnings?.length || 0}
          </div>
        </div>
      </div>

      {/* Main Content - Stacked Layout for Better Width Utilization */}
      <div className="space-y-6">
        {/* Filter Summary - Full Width */}
        <FilterSummaryPanel
          filterSummary={filteredSummary}
          onFilterTypeChange={setFilterType}
          selectedFilterType={filterType}
        />
        
        {/* Filter Warnings - Full Width - Only show if warnings exist */}
        {filteredWarnings && filteredWarnings.length > 0 && (
          <FilterWarningsPanel
            warnings={filteredWarnings}
            onWarningClick={(warning) => {
              // Handle warning click - could navigate to specific work order
            }}
          />
        )}
        
        {/* Filter Details - Full Width */}
        <FilterDetailsPanel
          filterDetails={filterResults?.details || []}
          editedValues={editedValues}
          onEdit={(jobId, filterType, value) => {
            setEditedValues(prev => ({
              ...prev,
              [`${jobId}-${filterType}`]: value
            }));
          }}
          onRevert={(jobId, filterType) => {
            setEditedValues(prev => {
              const newValues = { ...prev };
              delete newValues[`${jobId}-${filterType}`];
              return newValues;
            });
          }}
        />
      </div>

      {/* Export Data (hidden, used by parent) */}
      {filterResults && (
        <div className="hidden" data-export-data={JSON.stringify(filterResults)} />
      )}
    </div>
  );
}