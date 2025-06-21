import { renderHook, act } from '@testing-library/react'
import { useWeekendMode } from '../useWeekendMode'

describe('useWeekendMode', () => {
  const mockWorkOrders = [
    { id: '1', scheduled_date: '2024-01-15', status: 'pending' },
    { id: '2', scheduled_date: '2024-01-22', status: 'pending' }
  ]

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Mock current date
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with weekend mode disabled', () => {
    const { result } = renderHook(() =>
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: mockWorkOrders,
        showAllJobs: false
      })
    )

    expect(result.current.weekendModeEnabled).toBe(false)
    expect(result.current.weekendModeDismissed).toBe(false)
  })

  it('should allow enabling and disabling weekend mode', () => {
    const { result } = renderHook(() =>
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: mockWorkOrders,
        showAllJobs: false
      })
    )

    act(() => {
      result.current.setWeekendModeEnabled(true)
    })

    expect(result.current.weekendModeEnabled).toBe(true)

    act(() => {
      result.current.setWeekendModeEnabled(false)
    })

    expect(result.current.weekendModeEnabled).toBe(false)
  })

  it('should allow dismissing weekend mode', () => {
    const { result } = renderHook(() =>
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: mockWorkOrders,
        showAllJobs: false
      })
    )

    act(() => {
      result.current.setWeekendModeDismissed(true)
    })

    expect(result.current.weekendModeDismissed).toBe(true)
  })

  it('should not detect weekend mode when showAllJobs is true', () => {
    const { result } = renderHook(() =>
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: mockWorkOrders,
        showAllJobs: true
      })
    )

    expect(result.current.isWeekendMode).toBe(false)
  })

  it('should track dismissal day in localStorage', () => {
    const today = new Date().toDateString()
    
    const { result } = renderHook(() =>
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: mockWorkOrders,
        showAllJobs: false
      })
    )

    expect(result.current.dismissalDay).toBe(today)
    expect(localStorage.getItem('weekendModeLastCheck')).toBe(today)
  })
})