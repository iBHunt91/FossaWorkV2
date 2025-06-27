import { parseISO, isValid, parse } from 'date-fns'

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
    
    const { format } = require('date-fns')
    return format(dateObj, formatString)
  } catch (error) {
    console.error('Error formatting date:', date, error)
    return defaultValue
  }
}