/**
 * Basic tests for Weekend Mode functionality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useWeekendMode } from '../../src/hooks/useWeekendMode';

describe('useWeekendMode', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock date to a known value
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with weekend mode disabled', () => {
    const { result } = renderHook(() => 
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: [],
        showAllJobs: false
      })
    );

    expect(result.current.weekendModeEnabled).toBe(false);
    expect(result.current.isWeekendMode).toBe(false);
  });

  it('should detect weekend mode on Friday at 5 PM with no work orders', () => {
    // Set date to Friday at 5 PM
    const friday5pm = new Date('2025-01-17T17:00:00');
    jest.setSystemTime(friday5pm);

    const { result } = renderHook(() => 
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: [], // No work orders
        showAllJobs: false
      })
    );

    expect(result.current.isWeekendMode).toBe(true);
  });

  it('should not detect weekend mode during work hours', () => {
    // Set date to Wednesday at 2 PM
    const wednesday2pm = new Date('2025-01-15T14:00:00');
    jest.setSystemTime(wednesday2pm);

    const { result } = renderHook(() => 
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: [{ id: '1', scheduled_date: '2025-01-15' }],
        showAllJobs: false
      })
    );

    expect(result.current.isWeekendMode).toBe(false);
  });

  it('should persist dismissal state in localStorage', () => {
    const { result } = renderHook(() => 
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: [],
        showAllJobs: false
      })
    );

    // Dismiss weekend mode
    result.current.setWeekendModeDismissed(true);

    // Check localStorage
    const stored = localStorage.getItem('weekendModeDismissed');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed.dismissed).toBe(true);
    expect(parsed.weekStart).toBeDefined();
  });

  it('should enable weekend mode programmatically', () => {
    const { result } = renderHook(() => 
      useWeekendMode({
        workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        filteredWorkOrders: [],
        showAllJobs: false
      })
    );

    expect(result.current.weekendModeEnabled).toBe(false);

    // Enable weekend mode
    result.current.setWeekendModeEnabled(true);

    expect(result.current.weekendModeEnabled).toBe(true);
  });
});