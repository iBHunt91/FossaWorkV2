import React, { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Fuel } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, isWithinInterval } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedText, ShimmerText } from '@/components/ui/animated-text'
import { AnimatedButton } from '@/components/ui/animated-button'

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
}

const WorkOrderWeeklyView: React.FC<WorkOrderWeeklyViewProps> = ({
  workOrders,
  workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  onWorkOrderClick
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
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500'
      case 'in_progress':
        return 'bg-blue-500'
      case 'failed':
        return 'bg-red-500'
      case 'cancelled':
        return 'bg-gray-500'
      default:
        return 'bg-yellow-500'
    }
  }
  
  // Get brand from site name
  const getBrand = (siteName: string) => {
    const lower = siteName.toLowerCase()
    if (lower.includes('7-eleven') || lower.includes('7 eleven')) return '7-Eleven'
    if (lower.includes('wawa')) return 'Wawa'
    if (lower.includes('circle k')) return 'Circle K'
    if (lower.includes('shell')) return 'Shell'
    return 'Other'
  }
  
  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <GlowCard glowColor="rgba(59, 130, 246, 0.2)">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-2xl">
                  <ShimmerText text="Weekly Schedule" />
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AnimatedButton
                onClick={goToPreviousWeek}
                size="sm"
                variant="outline"
                animation="scale"
              >
                <ChevronLeft className="w-4 h-4" />
              </AnimatedButton>
              
              <AnimatedButton
                onClick={goToCurrentWeek}
                size="sm"
                variant="outline"
                animation="pulse"
              >
                Today
              </AnimatedButton>
              
              <AnimatedButton
                onClick={goToNextWeek}
                size="sm"
                variant="outline"
                animation="scale"
              >
                <ChevronRight className="w-4 h-4" />
              </AnimatedButton>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-4 text-sm">
            <Badge variant="secondary" className="px-3 py-1">
              <span className="font-medium">{totalWeekOrders}</span> work orders this week
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              {workDays.length} work days
            </Badge>
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
              className={`h-full ${isToday ? 'ring-2 ring-primary' : ''}`}
              hover="lift"
              animate="slide"
              delay={index * 0.1}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {day.name}
                  </h3>
                  {isToday && (
                    <Badge variant="default" className="text-xs">
                      Today
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(day.date, 'MMM d')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dayOrders.length} {dayOrders.length === 1 ? 'order' : 'orders'}
                </p>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {dayOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No work orders
                    </p>
                  ) : (
                    dayOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => onWorkOrderClick?.(order)}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm leading-tight line-clamp-1">
                            {order.site_name}
                          </h4>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(order.status)} flex-shrink-0 mt-1.5`} />
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="line-clamp-1">{order.store_number || 'Store'}</span>
                        </div>
                        
                        {order.scheduled_date && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(order.scheduled_date), 'h:mm a')}</span>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="outline" className="text-xs px-2 py-0">
                            {order.service_code || 'Service'}
                          </Badge>
                          {(() => {
                            // Try dispenser count from various sources
                            if (order.dispensers && order.dispensers.length > 0) {
                              return (
                                <Badge variant="secondary" className="text-xs px-2 py-0">
                                  <Fuel className="w-3 h-3 mr-1" />
                                  {order.dispensers.length}
                                </Badge>
                              )
                            }
                            
                            // Extract from service items
                            if (order.service_items) {
                              const items = Array.isArray(order.service_items) 
                                ? order.service_items 
                                : [order.service_items]
                              
                              for (const item of items) {
                                const match = item.toString().match(/(\d+)\s*x\s*(All\s*)?Dispenser/i)
                                if (match) {
                                  const count = parseInt(match[1], 10)
                                  return (
                                    <Badge variant="secondary" className="text-xs px-2 py-0">
                                      <Fuel className="w-3 h-3 mr-1" />
                                      {count}
                                    </Badge>
                                  )
                                }
                              }
                            }
                            
                            return null
                          })()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </AnimatedCard>
          )
        })}
      </div>
    </div>
  )
}

export default WorkOrderWeeklyView