import React, { useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, AlertTriangle, CheckCircle, Activity, Settings, RefreshCw, Store, TrendingUp, CalendarDays, Building2, MapPin, Filter, Package, Sparkles } from 'lucide-react'
import { fetchHealthCheck, fetchWorkOrders, getUserPreferences, apiClient as api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '../components/LoadingSpinner'
// Removed animated component imports for simplified UI
import { cleanSiteName, getBrandStyle } from '@/utils/storeColors'
import { FilterCalculationResult, FilterSummary } from '../types/filters'
import { cn } from '@/lib/utils'
import { useWeekendMode } from '../hooks/useWeekendMode'
import { getWeekRange, filterWorkOrdersByDateRange, getDateRangeDisplay, WeekRange } from '../utils/dateUtils'

const Dashboard: React.FC = () => {
  const { token, user } = useAuth()
  const currentUserId = user?.id || 'authenticated-user'
  const queryClient = useQueryClient()

  // Component initialization (removed excessive logging)

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealthCheck,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Fetch user preferences including work week settings
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
    enabled: !!token,
  })

  const { data: workOrders, isLoading: workOrdersLoading, error: workOrdersError, refetch: refetchWorkOrders } = useQuery({
    queryKey: ['work-orders', currentUserId],
    queryFn: () => fetchWorkOrders(currentUserId),
    refetchInterval: 60000,
    enabled: !!token,
  })

  // Force refresh filter calculations when work orders change or component mounts
  useEffect(() => {
    if (workOrders && workOrders.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['filters'] })
    }
  }, [workOrders, queryClient])

  // Calculate current and next week date ranges based on user preferences
  const workDays = preferences?.work_week?.days || [1, 2, 3, 4, 5]
  const currentWeek = getWeekRange(0, workDays)
  const nextWeek = getWeekRange(1, workDays)
  
  // Initialize weekend mode hook
  const {
    isWeekendMode,
    weekendModeEnabled,
    setWeekendModeEnabled,
    setWeekendModeDismissed
  } = useWeekendMode({
    workDays,
    filteredWorkOrders: workOrders || [],
    showAllJobs: false // Dashboard doesn't have a show all jobs toggle
  })

  // Auto-enable weekend mode when conditions are met
  useEffect(() => {
    if (isWeekendMode && !weekendModeEnabled && workOrders) {
      // Check if current week has no work but next week does
      const currentWeekOrders = filterWorkOrdersByDateRange(workOrders, currentWeek.start, currentWeek.end)
      const nextWeekOrders = filterWorkOrdersByDateRange(workOrders, nextWeek.start, nextWeek.end)
      
      if (currentWeekOrders.length === 0 && nextWeekOrders.length > 0) {
        setWeekendModeEnabled(true)
      }
    }
  }, [isWeekendMode, weekendModeEnabled, workOrders, currentWeek, nextWeek, setWeekendModeEnabled])

  // Helper function to calculate filters for work orders
  const calculateFilters = async (workOrders: any[]) => {
    
    if (!workOrders || workOrders.length === 0) {
      return null
    }
    
    // Log sample work order data
    
    // Map work orders for API - using FIXED transformation logic
    const mappedWorkOrders = workOrders.map(wo => ({
      ...wo,
      jobId: wo.external_id || wo.id,
      storeNumber: wo.store_number ? wo.store_number.replace('#', '') : '', // Remove # prefix if present
      customerName: wo.customer_name || wo.site_name || '', // Use customer_name if available, fallback to site_name
      serviceCode: wo.service_code || '',
      serviceName: wo.service_name || '',
      scheduledDate: wo.scheduled_date || '',
      address: wo.address || ''
    }))
    
    
    // Extract dispensers from work orders (same as Filters page does)
    const allDispensers: any[] = []
    let workOrdersWithServiceItems = 0
    let workOrdersWithDispensers = 0
    
    workOrders.forEach(wo => {
      // Check if work order has service_items indicating dispensers
      if (wo.service_items) {
        const items = Array.isArray(wo.service_items) ? wo.service_items : [wo.service_items]
        for (const item of items) {
          if (item && item.toString().match(/\d+\s*x\s*(All\s*)?Dispenser/i)) {
            workOrdersWithServiceItems++
            break
          }
        }
      }
      
      // Check if work order has actual dispenser data
      if (wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0) {
        workOrdersWithDispensers++
        wo.dispensers.forEach(d => {
          // Convert dispenser data to match expected format
          const dispenser = {
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
            storeNumber: wo.store_number ? wo.store_number.replace('#', '') : '' // Use cleaned store number
          }
          allDispensers.push(dispenser)
        })
      }
    })
    
    // Transform dispensers to match backend expected format
    const transformedDispensers = allDispensers.map(d => {
      // Convert fuel_grades object to array format expected by backend
      let fuelGradesArray: any[] = []
      
      if (d.fuel_grades && typeof d.fuel_grades === 'object' && !Array.isArray(d.fuel_grades)) {
        // Convert object format {1: {grade: "Regular 87"}, 2: {grade: "Plus 89"}} to array
        fuelGradesArray = Object.entries(d.fuel_grades).map(([position, gradeInfo]: [string, any]) => ({
          position: parseInt(position),
          grade: gradeInfo.grade || gradeInfo.name || gradeInfo
        }))
      } else if (Array.isArray(d.fuel_grades)) {
        fuelGradesArray = d.fuel_grades
      }
      
      return {
        ...d,
        fuelGrades: fuelGradesArray,
        dispenserNumber: d.dispenser_number,
        dispenserType: d.dispenser_type,
        meterType: d.meter_type || 'Electronic'
      }
    })
    
    
    const requestData = {
      workOrders: mappedWorkOrders,
      dispensers: transformedDispensers,
      overrides: {}
    }
    
    try {
      const response = await api.post(`/api/v1/filters/calculate`, requestData)
      
      
      const result = response.data as FilterCalculationResult
      
      if (result) {
        // Filter calculation result received successfully
        
        // Log summary details
        if (result.summary && result.summary.length > 0) {
          // Summary data available
        }
        
        // Log warnings
        if (result.warnings && result.warnings.length > 0) {
          // Warnings data available
        }
      }
      
      return result
    } catch (error) {
      // Error occurred during filter calculation
      return null
    }
  }

  // Fetch filter calculations for current week
  const { data: currentWeekFilters, isLoading: currentWeekFiltersLoading, error: currentWeekFiltersError } = useQuery({
    queryKey: ['filters', 'current', currentUserId, currentWeek.start, currentWeek.end],
    queryFn: async () => {
      // Getting current week date range
      
      const weekOrders = workOrders?.filter(order => {
        if (!order.scheduled_date) {
          return false
        }
        const scheduledDate = new Date(order.scheduled_date)
        const inRange = scheduledDate >= currentWeek.start && scheduledDate <= currentWeek.end
        
        if (!inRange) {
          // Order not in current week range
        }
        
        return inRange
      }) || []
      
      // Orders filtered for current week
      
      const result = await calculateFilters(weekOrders)
      
      return result
    },
    enabled: !!token && !!workOrders && workOrders.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch filter calculations for next week
  const { data: nextWeekFilters, isLoading: nextWeekFiltersLoading, error: nextWeekFiltersError } = useQuery({
    queryKey: ['filters', 'next', currentUserId, nextWeek.start, nextWeek.end],
    queryFn: async () => {
      // Getting next week date range
      
      const weekOrders = workOrders?.filter(order => {
        if (!order.scheduled_date) {
          return false
        }
        const scheduledDate = new Date(order.scheduled_date)
        const inRange = scheduledDate >= nextWeek.start && scheduledDate <= nextWeek.end
        
        if (!inRange) {
          // Order not in next week range
        }
        
        return inRange
      }) || []
      
      // Orders filtered for next week
      
      const result = await calculateFilters(weekOrders)
      
      return result
    },
    enabled: !!token && !!workOrders && workOrders.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Track React Query state changes
  useEffect(() => {
  }, [workOrdersLoading, workOrdersError, workOrders])

  useEffect(() => {
    if (currentWeekFilters) {
      // Current week filters loaded
    }
  }, [currentWeekFiltersLoading, currentWeekFiltersError, currentWeekFilters])

  useEffect(() => {
    if (nextWeekFilters) {
      // Next week filters loaded
    }
  }, [nextWeekFiltersLoading, nextWeekFiltersError, nextWeekFilters])

  // Analyze work orders by store and week
  const storeAnalysis = useMemo(() => {
    if (!workOrders || workOrders.length === 0) {
      return {
        currentWeek: new Map(),
        nextWeek: new Map(),
        totalStores: 0,
        uniqueStores: new Set()
      }
    }

    const currentWeekStores = new Map<string, number>()
    const nextWeekStores = new Map<string, number>()
    const uniqueStores = new Set<string>()

    workOrders.forEach(order => {
      if (!order.scheduled_date) return

      const scheduledDate = new Date(order.scheduled_date)
      const storeName = cleanSiteName(order.site_name || 'Unknown Store')
      
      uniqueStores.add(storeName)

      // Check if the order falls within current week
      if (scheduledDate >= currentWeek.start && scheduledDate <= currentWeek.end) {
        currentWeekStores.set(storeName, (currentWeekStores.get(storeName) || 0) + 1)
      }
      
      // Check if the order falls within next week
      if (scheduledDate >= nextWeek.start && scheduledDate <= nextWeek.end) {
        nextWeekStores.set(storeName, (nextWeekStores.get(storeName) || 0) + 1)
      }
    })

    return {
      currentWeek: currentWeekStores,
      nextWeek: nextWeekStores,
      totalStores: uniqueStores.size,
      uniqueStores
    }
  }, [workOrders, currentWeek, nextWeek])

  // Calculate visit totals for each week
  const currentWeekTotal = Array.from(storeAnalysis.currentWeek.values()).reduce((a, b) => a + b, 0)
  const nextWeekTotal = Array.from(storeAnalysis.nextWeek.values()).reduce((a, b) => a + b, 0)
  const totalWorkOrders = workOrders?.length || 0

  // Calculate dispenser statistics
  const dispenserStats = useMemo(() => {
    if (!workOrders || workOrders.length === 0) {
      return {
        totalWithDispensers: 0,
        totalDispensers: 0,
        completionPercentage: 0
      }
    }

    const ordersWithDispensers = workOrders.filter(order => 
      order.dispensers && Array.isArray(order.dispensers) && order.dispensers.length > 0
    )

    const totalDispensers = workOrders.reduce((total, order) => {
      if (order.dispensers && Array.isArray(order.dispensers)) {
        return total + order.dispensers.length
      }
      return total
    }, 0)

    const completionPercentage = totalWorkOrders > 0 
      ? Math.round((ordersWithDispensers.length / totalWorkOrders) * 100)
      : 0

    return {
      totalWithDispensers: ordersWithDispensers.length,
      totalDispensers,
      completionPercentage
    }
  }, [workOrders, totalWorkOrders])

  // Calculate store chain breakdown
  const storeChainStats = useMemo(() => {
    if (!workOrders || workOrders.length === 0) {
      return new Map<string, number>()
    }

    const chainCounts = new Map<string, number>()
    
    workOrders.forEach(order => {
      const cleanedName = cleanSiteName(order.site_name || order.customer_name)
      const currentCount = chainCounts.get(cleanedName) || 0
      chainCounts.set(cleanedName, currentCount + 1)
    })

    // Sort by count (descending) and return as Map
    return new Map([...chainCounts.entries()].sort((a, b) => b[1] - a[1]))
  }, [workOrders])

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to view the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = '/login'}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (workOrdersLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Page Header with Work Week Info */}
        <header className="mb-8">
          <div className="flex flex-col items-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-blue-600">
              Fossa Monitor Dashboard
            </h1>
            <div className="flex items-center gap-4">
              {preferences?.work_week && (
                <Badge variant="outline" className="text-xs">
                  Work Week: {(() => {
                    const days = preferences.work_week.days || []
                    const dayMap: { [key: number]: string } = {
                      0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
                    }
                    const selectedDays = days.map((d: number) => dayMap[d]).filter(Boolean)
                    
                    // Check for common patterns
                    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) return 'Mon-Fri'
                    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Mon-Sat'
                    if (JSON.stringify(days) === JSON.stringify([0, 1, 2, 3, 4, 5])) return 'Sun-Fri'
                    if (JSON.stringify(days) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'Sun-Sat'
                    
                    // For custom selections, show individual days
                    return selectedDays.join(', ')
                  })()}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchWorkOrders()
                  queryClient.invalidateQueries({ queryKey: ['filters'] })
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Data
              </Button>
            </div>
          </div>
        </header>

        {/* System Status Alert */}
        <Alert 
          variant={health?.status === 'healthy' ? 'default' : 'destructive'}
          className={`alert-modern ${health?.status === 'healthy' ? 'success' : 'error'} animate-slide-in-from-top`}
        >
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">
              {health?.status === 'healthy' ? 'All systems operational' : 'System issues detected'}
            </span>
            {health?.database && (
              <span className="ml-2 text-sm">Database: {health.database}</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Weekend Mode Banner */}
        {weekendModeEnabled && (
          <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
                  <Sparkles className="h-5 w-5 text-blue-500 absolute inset-0 animate-ping opacity-50" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400">Weekend Mode Active</h3>
                  <p className="text-sm text-muted-foreground">
                    Previewing upcoming work for better planning
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Content */}
        <div className="space-y-6">
          {/* Total Work Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
              <Store className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-3xl font-bold text-purple-600">{totalWorkOrders}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                All work orders in system
              </p>
              
              {/* Dispenser Statistics */}
              {totalWorkOrders > 0 && (
                <div className="mt-3 pt-3 border-t border-muted/50">
                  {dispenserStats.totalWithDispensers > 0 ? (
                    <div className="space-y-2">
                      {/* Progress Bar for Data Completion */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Dispenser Data</span>
                          <span className="text-purple-600 font-semibold">{dispenserStats.completionPercentage}%</span>
                        </div>
                        <Progress 
                          value={dispenserStats.completionPercentage} 
                          className="h-1.5 bg-muted"
                        />
                      </div>
                      
                      {/* Statistics Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col items-center p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
                          <span className="text-muted-foreground">With Data</span>
                          <span className="font-bold text-purple-600 text-sm">{dispenserStats.totalWithDispensers}</span>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
                          <span className="text-muted-foreground">Dispensers</span>
                          <span className="font-bold text-purple-600 text-sm">{dispenserStats.totalDispensers}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        No dispenser data available
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Scrape dispensers to see details
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Store Chain Breakdown */}
              {storeChainStats.size > 0 && (
                <div className="mt-3 pt-3 border-t border-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Store Chains</span>
                    <span className="text-xs text-muted-foreground">{storeChainStats.size} brands</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {Array.from(storeChainStats.entries()).slice(0, 4).map(([chainName, count]) => {
                      const brandStyle = getBrandStyle(chainName)
                      return (
                        <div key={chainName} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                brandStyle.color
                              )}
                            />
                            <span className="text-xs font-medium truncate">{chainName}</span>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs font-semibold flex-shrink-0",
                              brandStyle.bgColor,
                              brandStyle.textColor,
                              brandStyle.borderColor,
                              "border"
                            )}
                          >
                            {count}
                          </Badge>
                        </div>
                      )
                    })}
                    
                    {storeChainStats.size > 4 && (
                      <div className="text-xs text-muted-foreground text-center pt-1">
                        +{storeChainStats.size - 4} more chains
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Store Breakdown with Integrated Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Week Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {weekendModeEnabled ? 'Last Work Week' : 'Current Week'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {currentWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {currentWeek.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      <span className="text-3xl font-bold text-blue-600">{currentWeekTotal}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      visits
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Store List */}
                {storeAnalysis.currentWeek.size > 0 ? (
                  <div className="space-y-2">
                    {Array.from(storeAnalysis.currentWeek.entries())
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([store, count]) => (
                        <div key={store} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            <span className="text-sm truncate">{store}</span>
                          </div>
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-xs flex-shrink-0">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    {storeAnalysis.currentWeek.size > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{storeAnalysis.currentWeek.size - 3} more
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No stores scheduled</p>
                  </div>
                )}

                {/* Divider */}
                {storeAnalysis.currentWeek.size > 0 && currentWeekFilters && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs bg-background px-2">
                      <span className="text-muted-foreground">Filter Requirements</span>
                    </div>
                  </div>
                )}

                {/* Filter Summary */}
                {(() => {
                  return null
                })()}
                {currentWeekFiltersLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : currentWeekFilters && currentWeekFilters.totalFilters > 0 ? (
                  <div className="space-y-3">
                    {/* Filter Requirements */}
                    {currentWeekFilters.summary && currentWeekFilters.summary.length > 0 && (
                      <div className="space-y-2">
                        {currentWeekFilters.summary.map((filter, index) => (
                          <div 
                            key={filter.partNumber}
                            className={cn(
                              "group flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:shadow-sm border border-transparent",
                              filter.filterType === 'gas' 
                                ? "bg-gradient-to-r from-blue-500/5 to-blue-500/10 hover:from-blue-500/10 hover:to-blue-500/20 hover:border-blue-500/20"
                                : filter.filterType === 'diesel'
                                ? "bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 hover:from-emerald-500/10 hover:to-emerald-500/20 hover:border-emerald-500/20"
                                : "bg-gradient-to-r from-gray-500/5 to-gray-500/10 hover:from-gray-500/10 hover:to-gray-500/20 hover:border-gray-500/20"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-mono font-bold text-sm transition-colors",
                                filter.filterType === 'gas' 
                                  ? "group-hover:text-blue-600"
                                  : filter.filterType === 'diesel'
                                  ? "group-hover:text-emerald-600"
                                  : "group-hover:text-gray-600"
                              )}>
                                {filter.partNumber}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  'text-xs font-semibold',
                                  filter.filterType === 'gas' 
                                    ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                    : filter.filterType === 'diesel'
                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-500 text-gray-600 bg-gray-50 dark:bg-gray-900/20'
                                )}
                              >
                                {filter.filterType?.toUpperCase() || 'FILTER'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className={cn(
                                  "text-lg font-bold",
                                  filter.filterType === 'gas' 
                                    ? "text-blue-600"
                                    : filter.filterType === 'diesel'
                                    ? "text-emerald-600"
                                    : "text-gray-600"
                                )}>
                                  {filter.quantity}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {filter.boxes} box{filter.boxes !== 1 ? 'es' : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {currentWeekFilters.warnings && currentWeekFilters.warnings.filter(w => w.severity >= 7).length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-600 dark:text-amber-500">
                          {currentWeekFilters.warnings.filter(w => w.severity >= 7).length} high-severity warning{currentWeekFilters.warnings.filter(w => w.severity >= 7).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ) : storeAnalysis.currentWeek.size > 0 ? (
                  <div className="text-center py-3">
                    <p className="text-sm text-muted-foreground">No filters needed</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Next Week Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {weekendModeEnabled ? (
                        <>
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          Preview Week
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4" />
                          Next Week
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {nextWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {nextWeek.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {weekendModeEnabled && <span className="text-blue-500 ml-1">(Weekend Mode)</span>}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      <span className="text-3xl font-bold text-green-600">{nextWeekTotal}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      visits
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Store List */}
                {storeAnalysis.nextWeek.size > 0 ? (
                  <div className="space-y-2">
                    {Array.from(storeAnalysis.nextWeek.entries())
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([store, count]) => (
                        <div key={store} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-3 w-3 text-green-500 flex-shrink-0" />
                            <span className="text-sm truncate">{store}</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs flex-shrink-0">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    {storeAnalysis.nextWeek.size > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{storeAnalysis.nextWeek.size - 3} more
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No stores scheduled</p>
                  </div>
                )}

                {/* Divider */}
                {storeAnalysis.nextWeek.size > 0 && nextWeekFilters && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs bg-background px-2">
                      <span className="text-muted-foreground">Filter Requirements</span>
                    </div>
                  </div>
                )}

                {/* Filter Summary */}
                {(() => {
                  return null
                })()}
                {nextWeekFiltersLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : nextWeekFilters && nextWeekFilters.totalFilters > 0 ? (
                  <div className="space-y-3">
                    {/* Filter Requirements */}
                    {nextWeekFilters.summary && nextWeekFilters.summary.length > 0 && (
                      <div className="space-y-2">
                        {nextWeekFilters.summary.map((filter, index) => (
                          <div 
                            key={filter.partNumber}
                            className={cn(
                              "group flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:shadow-sm border border-transparent",
                              filter.filterType === 'gas' 
                                ? "bg-gradient-to-r from-blue-500/5 to-blue-500/10 hover:from-blue-500/10 hover:to-blue-500/20 hover:border-blue-500/20"
                                : filter.filterType === 'diesel'
                                ? "bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 hover:from-emerald-500/10 hover:to-emerald-500/20 hover:border-emerald-500/20"
                                : "bg-gradient-to-r from-gray-500/5 to-gray-500/10 hover:from-gray-500/10 hover:to-gray-500/20 hover:border-gray-500/20"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-mono font-bold text-sm transition-colors",
                                filter.filterType === 'gas' 
                                  ? "group-hover:text-blue-600"
                                  : filter.filterType === 'diesel'
                                  ? "group-hover:text-emerald-600"
                                  : "group-hover:text-gray-600"
                              )}>
                                {filter.partNumber}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  'text-xs font-semibold',
                                  filter.filterType === 'gas' 
                                    ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                    : filter.filterType === 'diesel'
                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-500 text-gray-600 bg-gray-50 dark:bg-gray-900/20'
                                )}
                              >
                                {filter.filterType?.toUpperCase() || 'FILTER'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className={cn(
                                  "text-lg font-bold",
                                  filter.filterType === 'gas' 
                                    ? "text-blue-600"
                                    : filter.filterType === 'diesel'
                                    ? "text-emerald-600"
                                    : "text-gray-600"
                                )}>
                                  {filter.quantity}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {filter.boxes} box{filter.boxes !== 1 ? 'es' : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {nextWeekFilters.warnings && nextWeekFilters.warnings.filter(w => w.severity >= 7).length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-600 dark:text-amber-500">
                          {nextWeekFilters.warnings.filter(w => w.severity >= 7).length} high-severity warning{nextWeekFilters.warnings.filter(w => w.severity >= 7).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ) : storeAnalysis.nextWeek.size > 0 ? (
                  <div className="text-center py-3">
                    <p className="text-sm text-muted-foreground">No filters needed</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard