import React, { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Fuel, Building2, Wrench, AlertCircle, CheckCircle, ExternalLink, Eye, Sparkles, Hash, XCircle } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, isWithinInterval, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedButton, RippleButton } from '@/components/ui/animated-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
}

interface WorkOrderWeeklyViewProps {
  workOrders: WorkOrder[]
  workDays: string[]
  onWorkOrderClick?: (workOrder: WorkOrder) => void
  onViewDispensers?: (workOrder: WorkOrder) => void
  onOpenVisit?: (workOrder: WorkOrder) => void
}

const WorkOrderWeeklyView: React.FC<WorkOrderWeeklyViewProps> = ({
  workOrders,
  workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  onWorkOrderClick,
  onViewDispensers,
  onOpenVisit
}) => {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  
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
    
    // Initialize all days
    displayDays.forEach(day => {
      grouped[format(day.date, 'yyyy-MM-dd')] = []
    })
    
    // Filter and group work orders
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return
      
      const scheduledDate = new Date(wo.scheduled_date)
      
      // Check if this work order falls within the current week
      if (isWithinInterval(scheduledDate, { start: weekStart, end: weekEnd })) {
        const dateKey = format(scheduledDate, 'yyyy-MM-dd')
        if (grouped[dateKey]) {
          grouped[dateKey].push(wo)
        }
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
  }, [workOrders, displayDays, weekStart, weekEnd])
  
  // Calculate total work orders for the week
  const totalWeekOrders = useMemo(() => {
    return Object.values(workOrdersByDay).reduce((sum, orders) => sum + orders.length, 0)
  }, [workOrdersByDay])
  
  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1))
  }
  
  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1))
  }
  
  const goToCurrentWeek = () => {
    setCurrentWeek(new Date())
  }
  
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
  
  // Get brand info from site name
  const getBrandInfo = (siteName: string) => {
    const lower = siteName.toLowerCase()
    if (lower.includes('7-eleven') || lower.includes('7 eleven')) 
      return { name: '7-Eleven', color: 'bg-red-500', textColor: 'text-red-600' }
    if (lower.includes('wawa')) 
      return { name: 'Wawa', color: 'bg-amber-500', textColor: 'text-amber-600' }
    if (lower.includes('circle k')) 
      return { name: 'Circle K', color: 'bg-orange-500', textColor: 'text-orange-600' }
    if (lower.includes('shell')) 
      return { name: 'Shell', color: 'bg-yellow-500', textColor: 'text-yellow-600' }
    if (lower.includes('speedway'))
      return { name: 'Speedway', color: 'bg-blue-500', textColor: 'text-blue-600' }
    return { name: 'Other', color: 'bg-gray-500', textColor: 'text-gray-600' }
  }
  
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
              
              <div className="flex items-center gap-2">
                <RippleButton
                  onClick={goToPreviousWeek}
                  size="sm"
                  variant="outline"
                  className="hover:bg-primary/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </RippleButton>
                
                <RippleButton
                  onClick={goToCurrentWeek}
                  size="sm"
                  variant="outline"
                  className="hover:bg-primary/10"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Today
                </RippleButton>
                
                <RippleButton
                  onClick={goToNextWeek}
                  size="sm"
                  variant="outline"
                  className="hover:bg-primary/10"
                >
                  <ChevronRight className="w-4 h-4" />
                </RippleButton>
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
              {totalWeekOrders > 0 && (
                <Badge variant="outline" className="px-3 py-1.5">
                  <Fuel className="w-3 h-3 mr-1.5" />
                  {workOrders.reduce((sum, wo) => sum + (getDispenserCount(wo) || 0), 0)} dispensers
                </Badge>
              )}
            </div>
          </CardHeader>
        </GlowCard>
      
        {/* Weekly calendar grid */}
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
                        const brandInfo = getBrandInfo(order.site_name)
                        const dispenserCount = getDispenserCount(order)
                        
                        return (
                          <div
                            key={order.id}
                            className="group relative rounded-lg border bg-card/50 hover:bg-card hover:shadow-md transition-all duration-200 overflow-hidden"
                          >
                            {/* Status indicator bar */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${statusInfo.color}`} />
                            
                            <div className="p-3 pl-4">
                              {/* Header with site name and actions */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                    {order.site_name}
                                  </h4>
                                  {order.store_number && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Hash className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {order.store_number}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {dispenserCount && dispenserCount > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onViewDispensers?.(order)
                                          }}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Dispensers</TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  {order.visit_url && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onOpenVisit?.(order)
                                          }}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Open Visit</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                              
                              {/* Time */}
                              {order.scheduled_date && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">
                                    {format(new Date(order.scheduled_date), 'h:mm a')}
                                  </span>
                                </div>
                              )}
                              
                              {/* Address preview */}
                              {order.address && (
                                <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
                                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2 leading-tight">
                                    {order.address}
                                  </span>
                                </div>
                              )}
                              
                              {/* Badges row */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Brand badge */}
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs px-2 py-0.5 ${brandInfo.textColor} border-current/30`}
                                >
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {brandInfo.name}
                                </Badge>
                                
                                {/* Service code */}
                                {order.service_code && (
                                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                    <Wrench className="w-3 h-3 mr-1" />
                                    {order.service_code}
                                  </Badge>
                                )}
                                
                                {/* Dispenser count */}
                                {dispenserCount && dispenserCount > 0 && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  >
                                    <Fuel className="w-3 h-3 mr-1" />
                                    {dispenserCount}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Click action hint */}
                              <div 
                                className="mt-2 pt-2 border-t flex items-center justify-between cursor-pointer"
                                onClick={() => onWorkOrderClick?.(order)}
                              >
                                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                  Click for details
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </div>
                          </div>
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
    </TooltipProvider>
  )
}

export default WorkOrderWeeklyView