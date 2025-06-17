import React, { useState, useMemo, useEffect } from 'react'
import { Calendar, CalendarDays, MapPin, Clock, Fuel, Wrench, AlertCircle, CheckCircle, XCircle, ExternalLink, Eye, Hash, Sparkles } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays, isSameDay, isWithinInterval, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedButton, RippleButton } from '@/components/ui/animated-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getBrandStyle, getBrandCardStyle, getBrandBadgeStyle, cleanSiteName } from '@/utils/storeColors'

interface WorkOrder {
  id: string
  external_id: string
  site_name: string
  address: string
  scheduled_date: string | null
  status: string
  store_number?: string
  service_code?: string
  service_description?: string
  service_name?: string
  service_items?: string | string[]
  visit_id?: string
  visit_url?: string
  dispenser_count?: number
  dispensers?: any[]
  county?: string
  city_state?: string
}

interface WorkOrderWeeklyViewProps {
  workOrders: WorkOrder[]
  workDays: string[]
  selectedWeek?: Date
  onWeekChange?: (date: Date) => void
  highlightedWorkOrderId?: string | null
  onWorkOrderClick?: (workOrder: WorkOrder) => void
  onViewDispensers?: (workOrder: WorkOrder) => void
  onOpenVisit?: (workOrder: WorkOrder) => void
  showAllJobs?: boolean
}

const WorkOrderWeeklyView: React.FC<WorkOrderWeeklyViewProps> = ({
  workOrders,
  workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  selectedWeek,
  onWeekChange,
  highlightedWorkOrderId,
  onWorkOrderClick,
  onViewDispensers,
  onOpenVisit,
  showAllJobs = false
}) => {
  const [currentWeek, setCurrentWeek] = useState(selectedWeek || new Date())
  const [localHighlightedId, setLocalHighlightedId] = useState<string | null>(highlightedWorkOrderId || null)
  
  
  // Update currentWeek when selectedWeek prop changes
  useEffect(() => {
    if (selectedWeek) {
      setCurrentWeek(selectedWeek)
    }
  }, [selectedWeek])
  
  // Update local highlight when prop changes
  useEffect(() => {
    setLocalHighlightedId(highlightedWorkOrderId || null)
  }, [highlightedWorkOrderId])
  
  // Clear highlight after 3 seconds
  useEffect(() => {
    if (localHighlightedId) {
      const timer = setTimeout(() => {
        setLocalHighlightedId(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [localHighlightedId])
  
  // Get start and end of current week (Monday-based)
  const weekStart = useMemo(() => 
    startOfWeek(currentWeek, { weekStartsOn: 1 }), // 1 = Monday
    [currentWeek]
  )
  
  const weekEnd = useMemo(() => 
    endOfWeek(currentWeek, { weekStartsOn: 1 }),
    [currentWeek]
  )
  
  // Map day names to day indices (0 = Sunday, 1 = Monday, etc.)
  const dayNameToIndex: { [key: string]: number } = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
  }
  
  // Get the days to display based on work week preferences
  const displayDays = useMemo(() => {
    // Always show current week days structure
    return workDays.map(dayName => {
      const dayIndex = dayNameToIndex[dayName]
      // Calculate the date for this day in the current week
      // If Monday is day 1, and weekStart is Monday, then:
      // Monday = weekStart + 0, Tuesday = weekStart + 1, etc.
      const daysSinceMonday = dayIndex === 0 ? 6 : dayIndex - 1 // Sunday is 6 days after Monday
      return {
        name: dayName,
        date: addDays(weekStart, daysSinceMonday),
        index: dayIndex
      }
    }).sort((a, b) => {
      // Sort by day index, but put Sunday at the end if it exists
      if (a.index === 0) return 1
      if (b.index === 0) return -1
      return a.index - b.index
    })
  }, [weekStart, workDays])
  
  // Group work orders by day
  const workOrdersByDay = useMemo(() => {
    const grouped: { [key: string]: WorkOrder[] } = {}
    
    // Initialize all days for current week
    displayDays.forEach(day => {
      grouped[format(day.date, 'yyyy-MM-dd')] = []
    })
    
    // Filter and group work orders
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return
      
      const scheduledDate = new Date(wo.scheduled_date)
      
      // Check if this work order should be included
      const shouldInclude = showAllJobs || isWithinInterval(scheduledDate, { start: weekStart, end: weekEnd })
      
      if (shouldInclude) {
        const dateKey = format(scheduledDate, 'yyyy-MM-dd')
        // Create group for this date if it doesn't exist (for showAllJobs mode)
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(wo)
      }
    })
    
    // Sort work orders within each day by time if available
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const dateA = new Date(a.scheduled_date!)
        const dateB = new Date(b.scheduled_date!)
        return dateA.getTime() - dateB.getTime()
      })
    })
    
    return grouped
  }, [workOrders, displayDays, weekStart, weekEnd, showAllJobs])
  
  // Get dispenser count from various sources
  const getDispenserCount = (order: WorkOrder): number | null => {
    // Direct dispenser array
    if (order.dispensers && order.dispensers.length > 0) {
      return order.dispensers.length
    }
    
    // Extract from service items
    if (order.service_items) {
      const items = Array.isArray(order.service_items) 
        ? order.service_items 
        : [order.service_items]
      
      for (const item of items) {
        const match = item.toString().match(/(\d+)\s*x\s*(All\s*)?Dispenser/i)
        if (match) {
          return parseInt(match[1], 10)
        }
      }
    }
    
    return null
  }

  // Calculate total work orders for the week
  const totalWeekOrders = useMemo(() => {
    return Object.values(workOrdersByDay).reduce((sum, orders) => sum + orders.length, 0)
  }, [workOrdersByDay])
  
  // Calculate total dispensers for the week
  const totalWeekDispensers = useMemo(() => {
    return Object.values(workOrdersByDay).reduce((total, orders) => {
      return total + orders.reduce((sum, order) => sum + (getDispenserCount(order) || 0), 0)
    }, 0)
  }, [workOrdersByDay])
  
  
  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { color: 'bg-green-500', icon: CheckCircle, text: 'Completed', variant: 'success' }
      case 'in_progress':
        return { color: 'bg-blue-500', icon: Clock, text: 'In Progress', variant: 'secondary' }
      case 'failed':
        return { color: 'bg-red-500', icon: AlertCircle, text: 'Failed', variant: 'destructive' }
      case 'cancelled':
        return { color: 'bg-gray-500', icon: XCircle, text: 'Cancelled', variant: 'outline' }
      default:
        return { color: 'bg-yellow-500', icon: Clock, text: 'Pending', variant: 'warning' }
    }
  }
  
  // Group all work orders by week when showAllJobs is true
  const weeklyGroups = useMemo(() => {
    if (!showAllJobs) return null
    
    const groups: { [weekKey: string]: { workOrders: WorkOrder[], weekStart: Date, weekEnd: Date } } = {}
    
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return
      
      const date = new Date(wo.scheduled_date)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
      const weekKey = format(weekStart, 'yyyy-MM-dd')
      
      if (!groups[weekKey]) {
        groups[weekKey] = {
          workOrders: [],
          weekStart,
          weekEnd
        }
      }
      
      groups[weekKey].workOrders.push(wo)
    })
    
    // Sort by week start date
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, group]) => group)
  }, [workOrders, showAllJobs])
  
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with navigation */}
        <GlowCard glowColor="rgba(59, 130, 246, 0.15)" className="backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 backdrop-blur">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    <GradientText text="Weekly Schedule" gradient="from-blue-600 to-purple-600" />
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">
                    {format(weekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1.5 bg-primary/10 border-primary/20">
                <Wrench className="w-3 h-3 mr-1.5" />
                <span className="font-semibold">{totalWeekOrders}</span> work orders
              </Badge>
              <Badge variant="outline" className="px-3 py-1.5">
                <Calendar className="w-3 h-3 mr-1.5" />
                {workDays.length} work days
              </Badge>
              {totalWeekDispensers > 0 && (
                <Badge variant="outline" className="px-3 py-1.5">
                  <Fuel className="w-3 h-3 mr-1.5" />
                  {totalWeekDispensers} dispensers
                </Badge>
              )}
            </div>
          </CardHeader>
        </GlowCard>
      
        {/* Content based on mode */}
        {showAllJobs && weeklyGroups ? (
          // Show all jobs grouped by week
          <div className="space-y-8">
            {weeklyGroups.map((group, groupIndex) => (
              <div key={format(group.weekStart, 'yyyy-MM-dd')} className="space-y-4">
                {/* Week header */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      Week of {format(group.weekStart, 'MMMM d')} - {format(group.weekEnd, 'MMMM d, yyyy')}
                    </h3>
                  </div>
                  <Badge variant="secondary">
                    {group.workOrders.length} {group.workOrders.length === 1 ? 'job' : 'jobs'}
                  </Badge>
                </div>
                
                {/* Days grid for this week */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {workDays.map((dayName, dayIndex) => {
                    const dayOfWeek = dayNameToIndex[dayName]
                    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                    const dayDate = addDays(group.weekStart, daysSinceMonday)
                    const dateKey = format(dayDate, 'yyyy-MM-dd')
                    const dayOrders = group.workOrders.filter(wo => 
                      wo.scheduled_date && format(new Date(wo.scheduled_date), 'yyyy-MM-dd') === dateKey
                    )
                    const isToday = isSameDay(dayDate, new Date())
                    
                    return (
                      <AnimatedCard
                        key={`${dateKey}-${dayName}`}
                        className={`h-full min-h-[400px] ${isToday ? 'ring-2 ring-primary shadow-lg' : ''} backdrop-blur-sm`}
                        hover="glow"
                        animate="slide"
                        delay={groupIndex * 0.1 + dayIndex * 0.05}
                      >
                        <CardHeader className="pb-3 bg-gradient-to-b from-card to-transparent">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-lg">
                              {dayName}
                            </h3>
                            {isToday && (
                              <Badge variant="default" className="text-xs animate-pulse">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Today
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">
                              {format(dayDate, 'MMMM d')}
                            </p>
                            <Badge variant={dayOrders.length > 0 ? "secondary" : "outline"} className="text-xs">
                              {dayOrders.length} {dayOrders.length === 1 ? 'job' : 'jobs'}
                            </Badge>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0 px-3 pb-3">
                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {dayOrders.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Calendar className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm font-medium">No work orders</p>
                                <p className="text-xs mt-1">Enjoy your day!</p>
                              </div>
                            ) : (
                              dayOrders.map((order) => {
                                const statusInfo = getStatusInfo(order.status)
                                const brandStyle = getBrandStyle(order.site_name)
                                const dispenserCount = getDispenserCount(order)
                                
                                return (
                                  <AnimatedCard
                                    key={order.id}
                                    className={`group relative rounded-lg hover:shadow-lg transition-all duration-200 overflow-hidden ${getBrandCardStyle(order.site_name)} ${
                                      localHighlightedId === order.id 
                                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse bg-primary/5' 
                                        : ''
                                    }`}
                                    hover="lift"
                                    animate="fade"
                                  >
                                    {/* Status indicator bar */}
                                    <div className={`absolute top-0 left-0 w-1 h-full ${statusInfo.color}`} />
                                    
                                    <div className="p-3 pl-4">
                                      {/* Store name at the top - clean brand name */}
                                      <div className="text-sm font-semibold text-foreground mb-2">
                                        {cleanSiteName(order.site_name)}
                                      </div>
                                      
                                      {/* Store and Visit badges - matching list view styling */}
                                      <div className="flex flex-wrap gap-1.5 mb-2">
                                        {order.store_number && (
                                          <Badge 
                                            variant="secondary" 
                                            className="text-xs px-2 py-0.5 bg-green-600 text-white dark:bg-green-500"
                                          >
                                            Store #{order.store_number.replace(/^#/, '')}
                                          </Badge>
                                        )}
                                        {(order.visit_number || order.visit_id) && (
                                          <Badge 
                                            variant="default" 
                                            className="text-xs px-2 py-0.5 bg-blue-600 text-white dark:bg-blue-500"
                                          >
                                            Visit #{order.visit_number || order.visit_id}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {/* Location info with county */}
                                      {order.address && (
                                        <div 
                                          className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors mb-3"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const address = order.address
                                            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                                            window.open(mapsUrl, '_blank')
                                          }}
                                        >
                                          <div className="flex items-start gap-1.5">
                                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-0.5 flex-1">
                                              {(() => {
                                                // Use city_state if available
                                                if (order.city_state) {
                                                  // Remove zipcode from city_state
                                                  const cityStateNoZip = order.city_state.replace(/\s+\d{5}(-\d{4})?$/, '').trim()
                                                  return (
                                                    <>
                                                      <div className="underline decoration-dotted">{cityStateNoZip}</div>
                                                      {order.county && (
                                                        <div className="text-[10px] text-muted-foreground/70">{order.county}</div>
                                                      )}
                                                    </>
                                                  )
                                                }
                                                // Otherwise extract from address
                                                const parts = order.address.split(',')
                                                if (parts.length >= 2) {
                                                  // Get city/state and remove zipcode
                                                  const cityState = parts[parts.length - 2].trim().replace(/\s+\d{5}(-\d{4})?$/, '').trim()
                                                  return (
                                                    <>
                                                      <div className="underline decoration-dotted">{cityState}</div>
                                                      {order.county && (
                                                        <div className="text-[10px] text-muted-foreground/70">{order.county}</div>
                                                      )}
                                                    </>
                                                  )
                                                }
                                                return <div className="underline decoration-dotted">{order.address}</div>
                                              })()}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Dispenser count and Open Visit action */}
                                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2">
                                          {dispenserCount && dispenserCount > 0 && (
                                            <Badge 
                                              variant="secondary" 
                                              className="text-xs px-2 py-0.5 inline-flex items-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                onViewDispensers?.(order)
                                              }}
                                            >
                                              <Fuel className="w-3 h-3 mr-1 flex-shrink-0" />
                                              <span>{dispenserCount}</span>
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {order.visit_url && (
                                          <button 
                                            className="p-1 rounded hover:bg-accent transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onOpenVisit?.(order)
                                            }}
                                            title="Open Visit"
                                          >
                                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </AnimatedCard>
                                )
                              })
                            )}
                          </div>
                        </CardContent>
                      </AnimatedCard>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Normal weekly view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {displayDays.map((day, index) => {
            const dateKey = format(day.date, 'yyyy-MM-dd')
            const dayOrders = workOrdersByDay[dateKey] || []
            const isToday = isSameDay(day.date, new Date())
            
            return (
              <AnimatedCard
                key={day.name}
                className={`h-full min-h-[400px] ${isToday ? 'ring-2 ring-primary shadow-lg' : ''} backdrop-blur-sm`}
                hover="glow"
                animate="slide"
                delay={index * 0.1}
              >
                <CardHeader className="pb-3 bg-gradient-to-b from-card to-transparent">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">
                      {day.name}
                    </h3>
                    {isToday && (
                      <Badge variant="default" className="text-xs animate-pulse">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Today
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">
                      {format(day.date, 'MMMM d')}
                      {showAllJobs && (
                        <span className="text-xs ml-1">
                          ({format(day.date, 'yyyy')})
                        </span>
                      )}
                    </p>
                    <Badge variant={dayOrders.length > 0 ? "secondary" : "outline"} className="text-xs">
                      {dayOrders.length} {dayOrders.length === 1 ? 'job' : 'jobs'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {dayOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Calendar className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">No work orders</p>
                        <p className="text-xs mt-1">Enjoy your day!</p>
                      </div>
                    ) : (
                      dayOrders.map((order) => {
                        const statusInfo = getStatusInfo(order.status)
                        const brandStyle = getBrandStyle(order.site_name)
                        const dispenserCount = getDispenserCount(order)
                        
                        return (
                          <AnimatedCard
                            key={order.id}
                            className={`group relative rounded-lg hover:shadow-lg transition-all duration-200 overflow-hidden ${getBrandCardStyle(order.site_name)} ${
                              localHighlightedId === order.id 
                                ? 'ring-2 ring-primary ring-offset-2 animate-pulse bg-primary/5' 
                                : ''
                            }`}
                            hover="lift"
                            animate="fade"
                          >
                            {/* Status indicator bar */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${statusInfo.color}`} />
                            
                            <div className="p-3 pl-4">
                              {/* Store name at the top - clean brand name */}
                              <div className="text-sm font-semibold text-foreground mb-2">
                                {cleanSiteName(order.site_name)}
                              </div>
                              
                              {/* Store and Visit badges - matching list view styling */}
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {order.store_number && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs px-2 py-0.5 bg-green-600 text-white dark:bg-green-500"
                                  >
                                    Store #{order.store_number.replace(/^#/, '')}
                                  </Badge>
                                )}
                                {(order.visit_number || order.visit_id) && (
                                  <Badge 
                                    variant="default" 
                                    className="text-xs px-2 py-0.5 bg-blue-600 text-white dark:bg-blue-500"
                                  >
                                    Visit #{order.visit_number || order.visit_id}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Location info with county */}
                              {order.address && (
                                <div 
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors mb-3"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const address = order.address
                                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                                    window.open(mapsUrl, '_blank')
                                  }}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <div className="space-y-0.5 flex-1">
                                      {(() => {
                                        // Use city_state if available
                                        if (order.city_state) {
                                          // Remove zipcode from city_state
                                          const cityStateNoZip = order.city_state.replace(/\s+\d{5}(-\d{4})?$/, '').trim()
                                          return (
                                            <>
                                              <div className="underline decoration-dotted">{cityStateNoZip}</div>
                                              {order.county && (
                                                <div className="text-[10px] text-muted-foreground/70">{order.county}</div>
                                              )}
                                            </>
                                          )
                                        }
                                        // Otherwise extract from address
                                        const parts = order.address.split(',')
                                        if (parts.length >= 2) {
                                          // Get city/state and remove zipcode
                                          const cityState = parts[parts.length - 2].trim().replace(/\s+\d{5}(-\d{4})?$/, '').trim()
                                          return (
                                            <>
                                              <div className="underline decoration-dotted">{cityState}</div>
                                              {order.county && (
                                                <div className="text-[10px] text-muted-foreground/70">{order.county}</div>
                                              )}
                                            </>
                                          )
                                        }
                                        return <div className="underline decoration-dotted">{order.address}</div>
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Dispenser count and Open Visit action */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-2">
                                  {dispenserCount && dispenserCount > 0 && (
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs px-2 py-0.5 inline-flex items-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onViewDispensers?.(order)
                                      }}
                                    >
                                      <Fuel className="w-3 h-3 mr-1 flex-shrink-0" />
                                      <span>{dispenserCount}</span>
                                    </Badge>
                                  )}
                                </div>
                                
                                {order.visit_url && (
                                  <button 
                                    className="p-1 rounded hover:bg-accent transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onOpenVisit?.(order)
                                    }}
                                    title="Open Visit"
                                  >
                                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </AnimatedCard>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </AnimatedCard>
            )
          })}
          </div>
        )}
      </div>
      
    </TooltipProvider>
  )
}

export default WorkOrderWeeklyView