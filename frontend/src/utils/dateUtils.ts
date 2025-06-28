import { parseISO, isValid, parse, format, startOfWeek, endOfWeek, addWeeks } from 'date-fns'

/**
 * Parse a date string that may or may not have timezone information.
 * If no timezone is specified, treats it as local time (not UTC).
 * 
 * @param dateString - The date string to parse
 * @returns A Date object or null if parsing fails
 */
export function parseScheduledDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  
  try {
    // First try parsing as ISO format
    const date = parseISO(dateString)
    if (isValid(date)) {
      return date
    }
    
    // If that fails, try common date formats
    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'MM-dd-yyyy',
      'yyyy-MM-dd HH:mm:ss',
      'MM/dd/yyyy HH:mm:ss'
    ]
    
    for (const format of formats) {
      try {
        const parsedDate = parse(dateString, format, new Date())
        if (isValid(parsedDate)) {
          return parsedDate
        }
      } catch {
        // Continue to next format
      }
    }
    
    // Last resort: try native Date parsing
    const nativeDate = new Date(dateString)
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate
    }
    
    return null
  } catch (error) {
    console.error('Error parsing date:', dateString, error)
    return null
  }
}

/**
 * Format a date for display, handling null/undefined values
 * 
 * @param date - The date to format
 * @param formatString - The format string (date-fns format)
 * @param defaultValue - Value to return if date is null/invalid
 * @returns Formatted date string or default value
 */
export function formatDate(date: Date | string | null | undefined, formatString: string, defaultValue: string = ''): string {
  if (!date) return defaultValue
  
  try {
    const dateObj = typeof date === 'string' ? parseScheduledDate(date) : date
    if (!dateObj || !isValid(dateObj)) return defaultValue
    
    return format(dateObj, formatString)
  } catch (error) {
    console.error('Error formatting date:', date, error)
    return defaultValue
  }
}

export interface WeekRange {
  start: Date
  end: Date
  workDays: Date[]
}

/**
 * Calculate week range based on work week preferences
 * @param weekOffset - Number of weeks to offset from current week (0 = current, 1 = next, -1 = previous)
 * @param workDays - Array of work day numbers (0 = Sunday, 1 = Monday, etc.)
 * @returns WeekRange object with start, end, and work days
 */
export function getWeekRange(weekOffset: number = 0, workDays: number[] = [1, 2, 3, 4, 5]): WeekRange {
  const today = new Date()
  const currentDay = today.getDay()
  
  // Find the start of the current week (Sunday)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - currentDay + (weekOffset * 7))
  weekStart.setHours(0, 0, 0, 0)
  
  // Find the end of the current week (Saturday)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  
  // Filter dates within this week that are work days
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    if (workDays.includes(date.getDay())) {
      dates.push(date)
    }
  }
  
  // Return the first and last work days of the week
  if (dates.length > 0) {
    return { 
      start: dates[0], 
      end: dates[dates.length - 1],
      workDays: dates
    }
  } else {
    // No work days in this week, return week bounds
    return { start: weekStart, end: weekEnd, workDays: [] }
  }
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Check if date is within a date range (inclusive)
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

/**
 * Get work orders within date range
 */
export function filterWorkOrdersByDateRange(workOrders: any[], start: Date, end: Date): any[] {
  return workOrders.filter(order => {
    if (!order.scheduled_date) return false
    const orderDate = parseScheduledDate(order.scheduled_date)
    return orderDate && isDateInRange(orderDate, start, end)
  })
}

/**
 * Get date range display string
 */
export function getDateRangeDisplay(start: Date, end: Date): string {
  const startStr = formatDateISO(start)
  const endStr = formatDateISO(end)
  
  if (startStr === endStr) {
    return startStr
  }
  
  return `${startStr} to ${endStr}`
}