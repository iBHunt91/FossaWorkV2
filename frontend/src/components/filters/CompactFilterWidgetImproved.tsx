import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient as api, WorkOrder, getUserPreferences } from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FilterCalculationResult, FilterSummary } from '../../types/filters';
import { Filter, AlertTriangle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WeekData {
  week: Date;
  label: string;
  isLoading: boolean;
  error: Error | null;
  totalFilters: number;
  totalBoxes: number;
  topFilters: FilterSummary[];
  warningCount: number;
  highSeverityWarnings: number;
  refetch: () => void;
}

export default function CompactFilterWidgetImproved() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'current' | 'next'>('current');
  
  // Fetch user preferences for work week settings
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: () => getUserPreferences(user?.id || ''),
    enabled: !!user?.id,
  });

  // Calculate week boundaries based on user preferences
  const getWeekBoundaries = (weekOffset: number = 0) => {
    const today = new Date();
    const workDays = preferences?.work_week?.days || [1, 2, 3, 4, 5];
    const weekStartDay = preferences?.work_week?.start_day || 1; // Default Monday
    
    const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    
    return { weekStart, weekEnd, workDays };
  };

  const currentWeekBounds = useMemo(() => getWeekBoundaries(0), [preferences]);
  const nextWeekBounds = useMemo(() => getWeekBoundaries(1), [preferences]);

  // Optimized query to fetch only work orders for specific week
  const fetchWeekWorkOrders = async (weekStart: Date, weekEnd: Date) => {
    try {
      const response = await api.get(`/api/v1/work-orders`, {
        params: { 
          user_id: user?.id,
          start_date: weekStart.toISOString(),
          end_date: weekEnd.toISOString()
        }
      });
      return response.data as WorkOrder[];
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
      throw error;
    }
  };

  // Calculate filters for a specific week
  const calculateWeekFilters = async (workOrders: WorkOrder[]) => {
    if (!workOrders || workOrders.length === 0) return null;
    
    try {
      const response = await api.post(`/api/v1/filters/calculate`, {
        workOrders: workOrders.map(wo => ({
          ...wo,
          jobId: wo.external_id || wo.id,
          storeNumber: wo.site_name?.match(/#(\d+)/)?.[1] || '',
          customerName: wo.site_name?.split('#')[0]?.trim() || wo.site_name || '',
          serviceCode: wo.service_code || '',
          serviceName: wo.service_name || '',
          scheduledDate: wo.scheduled_date || '',
          address: wo.address || ''
        })),
        dispensers: [],
        overrides: {}
      });
      
      return response.data as FilterCalculationResult;
    } catch (error) {
      console.error('Failed to calculate filters:', error);
      throw error;
    }
  };

  // Combined query for current week
  const currentWeekQuery = useQuery({
    queryKey: ['filterWidget', 'current', user?.id, currentWeekBounds.weekStart, currentWeekBounds.weekEnd],
    queryFn: async () => {
      const workOrders = await fetchWeekWorkOrders(currentWeekBounds.weekStart, currentWeekBounds.weekEnd);
      return calculateWeekFilters(workOrders);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Combined query for next week
  const nextWeekQuery = useQuery({
    queryKey: ['filterWidget', 'next', user?.id, nextWeekBounds.weekStart, nextWeekBounds.weekEnd],
    queryFn: async () => {
      const workOrders = await fetchWeekWorkOrders(nextWeekBounds.weekStart, nextWeekBounds.weekEnd);
      return calculateWeekFilters(workOrders);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Prepare week data
  const weeks: Record<'current' | 'next', WeekData> = {
    current: {
      week: currentWeekBounds.weekStart,
      label: 'Current Week',
      isLoading: currentWeekQuery.isLoading,
      error: currentWeekQuery.error as Error | null,
      totalFilters: currentWeekQuery.data?.totalFilters || 0,
      totalBoxes: currentWeekQuery.data?.totalBoxes || 0,
      topFilters: currentWeekQuery.data?.summary?.slice(0, 3) || [],
      warningCount: currentWeekQuery.data?.warnings?.length || 0,
      highSeverityWarnings: currentWeekQuery.data?.warnings?.filter(w => w.severity >= 7).length || 0,
      refetch: currentWeekQuery.refetch,
    },
    next: {
      week: nextWeekBounds.weekStart,
      label: 'Next Week',
      isLoading: nextWeekQuery.isLoading,
      error: nextWeekQuery.error as Error | null,
      totalFilters: nextWeekQuery.data?.totalFilters || 0,
      totalBoxes: nextWeekQuery.data?.totalBoxes || 0,
      topFilters: nextWeekQuery.data?.summary?.slice(0, 3) || [],
      warningCount: nextWeekQuery.data?.warnings?.length || 0,
      highSeverityWarnings: nextWeekQuery.data?.warnings?.filter(w => w.severity >= 7).length || 0,
      refetch: nextWeekQuery.refetch,
    }
  };

  const activeWeek = weeks[activeTab];

  // Refresh all data
  const refreshAll = () => {
    queryClient.invalidateQueries(['filterWidget']);
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Filter Requirements</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {activeWeek.highSeverityWarnings > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">{activeWeek.highSeverityWarnings}</span>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refreshAll}
              disabled={currentWeekQuery.isLoading || nextWeekQuery.isLoading}
              aria-label="Refresh filter data"
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                (currentWeekQuery.isLoading || nextWeekQuery.isLoading) && "animate-spin"
              )} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        {/* Week Tabs */}
        <div 
          className="flex gap-1 mb-4 bg-muted/50 p-1 rounded-lg"
          role="tablist"
          aria-label="Filter week selection"
        >
          {(['current', 'next'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`filter-${tab}-panel`}
            >
              {weeks[tab].label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div 
          id={`filter-${activeTab}-panel`}
          role="tabpanel"
          aria-labelledby={`filter-${activeTab}-tab`}
        >
          {activeWeek.isLoading ? (
            <div className="flex items-center justify-center py-8" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading filter data...</span>
            </div>
          ) : activeWeek.error ? (
            <div className="text-center py-4">
              <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Unable to load filter data
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeWeek.error.message || 'Please try again later'}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => activeWeek.refetch()}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Try Again
              </Button>
            </div>
          ) : activeWeek.totalFilters === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No filters needed</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(activeWeek.week, 'MMM d')} - {format(endOfWeek(activeWeek.week, { weekStartsOn: 1 }), 'MMM d')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl sm:text-2xl font-semibold">{activeWeek.totalFilters}</p>
                  <p className="text-xs text-muted-foreground">Total Filters</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xl sm:text-2xl font-semibold">{activeWeek.totalBoxes}</p>
                  <p className="text-xs text-muted-foreground">Total Boxes</p>
                </div>
              </div>

              {/* Top Filters */}
              {activeWeek.topFilters.length > 0 && (
                <div className="space-y-2 max-w-full">
                  <p className="text-xs font-medium text-muted-foreground">Top Filters</p>
                  {activeWeek.topFilters.map((filter) => (
                    <div 
                      key={filter.partNumber} 
                      className="flex items-center justify-between text-sm gap-2 min-w-0"
                    >
                      <span 
                        className="text-muted-foreground truncate flex-1 min-w-0" 
                        title={filter.description}
                      >
                        {filter.description}
                      </span>
                      <span className="font-medium tabular-nums flex-shrink-0">
                        {filter.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {activeWeek.warningCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{activeWeek.warningCount} warning{activeWeek.warningCount !== 1 ? 's' : ''} found</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <Link 
          to="/filters" 
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        >
          View all filters
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}