import { useState, useMemo, useEffect } from 'react'
import { format, getHours, startOfWeek, endOfWeek, addWeeks, isAfter, isThisWeek } from 'date-fns'

interface WorkOrder {
  id: string
  scheduled_date: string | null
  status: string
}

interface UseWeekendModeParams {
  workDays: string[]
  filteredWorkOrders: WorkOrder[]
  showAllJobs: boolean
}

interface UseWeekendModeReturn {
  isWeekendMode: boolean
  weekendModeEnabled: boolean
  setWeekendModeEnabled: (enabled: boolean) => void
  weekendModeDismissed: boolean
  setWeekendModeDismissed: (dismissed: boolean) => void
  dismissalDay: string | null
}

export const useWeekendMode = ({
  workDays,
  filteredWorkOrders,
  showAllJobs
}: UseWeekendModeParams): UseWeekendModeReturn => {
  // Weekend mode state
  const [weekendModeEnabled, setWeekendModeEnabled] = useState(false)
  const [weekendModeDismissed, setWeekendModeDismissed] = useState(false)

  // Weekend mode detection logic
  const isWeekendMode = useMemo(() => {
    if (weekendModeDismissed || showAllJobs) {
      return false
    }
    
    // Only check weekend mode for current week
    if (!isThisWeek(new Date())) {
      return false
    }

    const now = new Date()
    const currentDayName = format(now, 'EEEE') // Get day name (e.g., "Monday", "Tuesday")
    const hour = getHours(now)
    
    // Check if current day is a work day based on user preferences
    const isWorkDay = workDays.includes(currentDayName)
    
    // Determine if it's "weekend time" based on user's work week
    let isWeekendTime = false
    
    if (!isWorkDay) {
      // It's not a work day, so it's weekend time
      isWeekendTime = true
    } else {
      // It's a work day - check if it's the last work day of the week after 5 PM (end of workday)
      const lastWorkDay = workDays[workDays.length - 1]
      if (currentDayName === lastWorkDay && hour >= 17) {
        isWeekendTime = true
      }
    }
    
    // Check if current week has any remaining work orders (not completed)
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
    
    const currentWeekWorkOrders = filteredWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false
      const date = new Date(wo.scheduled_date)
      return date >= currentWeekStart && date <= currentWeekEnd
    })
    
    const hasRemainingWork = currentWeekWorkOrders.some(wo => {
      const woDate = new Date(wo.scheduled_date!)
      // Check if work order is in the future or today and not completed
      return (isAfter(woDate, now) || 
              (woDate.toDateString() === now.toDateString())) && 
              wo.status !== 'completed'
    })
    
    // Check if next week has work orders
    const nextWeek = addWeeks(now, 1)
    const nextWeekStart = startOfWeek(nextWeek, { weekStartsOn: 1 })
    const nextWeekEnd = endOfWeek(nextWeek, { weekStartsOn: 1 })
    
    const nextWeekWorkOrders = filteredWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false
      const date = new Date(wo.scheduled_date)
      return date >= nextWeekStart && date <= nextWeekEnd
    })
    
    const hasNextWeekWork = nextWeekWorkOrders.length > 0
    
    // Enable weekend mode if it's weekend time, no remaining work, and next week has work
    return isWeekendTime && !hasRemainingWork && hasNextWeekWork
  }, [showAllJobs, filteredWorkOrders, weekendModeDismissed, workDays])

  // Reset weekend mode dismissed on new day
  useEffect(() => {
    const checkNewDay = () => {
      const lastCheck = localStorage.getItem('weekendModeLastCheck')
      const today = new Date().toDateString()
      
      if (lastCheck !== today) {
        setWeekendModeDismissed(false)
        localStorage.setItem('weekendModeLastCheck', today)
      }
    }
    
    checkNewDay()
    // Check every minute
    const interval = setInterval(checkNewDay, 60000)
    
    return () => clearInterval(interval)
  }, [])

  // The dismissalDay is tracked in localStorage via 'weekendModeLastCheck'
  const dismissalDay = localStorage.getItem('weekendModeLastCheck')

  return {
    isWeekendMode,
    weekendModeEnabled,
    setWeekendModeEnabled,
    weekendModeDismissed,
    setWeekendModeDismissed,
    dismissalDay
  }
}