import { useState, useEffect, useCallback, useRef } from 'react'

interface PollingOptions {
  interval?: number
  timeout?: number
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export const useProgressPolling = <T = any>(
  pollFunction: () => Promise<T>,
  shouldPoll: boolean,
  options: PollingOptions = {}
) => {
  const {
    interval = 1000,
    timeout = 120000, // 2 minutes default
    onSuccess,
    onError,
    onComplete
  } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  
  // Store callbacks in refs to avoid dependency issues
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const onCompleteRef = useRef(onComplete)
  
  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
    onCompleteRef.current = onComplete
  })

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsPolling(false)
    startTimeRef.current = null
  }, [])

  const poll = useCallback(async () => {
    try {
      const result = await pollFunction()
      setData(result)
      setError(null)
      
      if (onSuccessRef.current) {
        onSuccessRef.current(result)
      }

      // Check if polling should stop based on result
      if (result && typeof result === 'object') {
        const status = (result as any).status
        // Stop polling for terminal states or when progress is not found
        if (status === 'completed' || status === 'failed' || status === 'cancelled' || 
            status === 'not_found' || status === 'idle') {
          stopPolling()
          if (onCompleteRef.current) {
            onCompleteRef.current()
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Polling failed')
      setError(error)
      if (onErrorRef.current) {
        onErrorRef.current(error)
      }
    }
  }, [pollFunction, stopPolling])

  useEffect(() => {
    if (shouldPoll) {
      setIsPolling(true)
      startTimeRef.current = Date.now()
      
      // Initial poll
      poll()

      // Set up interval
      intervalRef.current = setInterval(poll, interval)

      // Set up timeout
      timeoutRef.current = setTimeout(() => {
        stopPolling()
        const timeoutError = new Error('Polling timeout')
        setError(timeoutError)
        if (onErrorRef.current) {
          onErrorRef.current(timeoutError)
        }
      }, timeout)
    }

    return () => {
      stopPolling()
    }
  }, [shouldPoll, poll, interval, timeout, stopPolling])

  const getElapsedTime = useCallback(() => {
    if (!startTimeRef.current) return 0
    return Date.now() - startTimeRef.current
  }, [])

  return {
    data,
    error,
    isPolling,
    stopPolling,
    getElapsedTime
  }
}

// Specific hook for work order scraping progress
export const useWorkOrderScrapingProgress = (userId: string, isActive: boolean) => {
  const pollFunction = useCallback(async () => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/work-orders/scrape/progress/${userId}`,
      {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Progress fetch failed: ${response.status}`)
    }
    
    return response.json()
  }, [userId])

  return useProgressPolling(pollFunction, isActive, {
    interval: 1000,
    timeout: 300000 // 5 minutes for work order scraping
  })
}

// Specific hook for dispenser scraping progress
export const useDispenserScrapingProgress = (userId: string, isActive: boolean) => {
  const pollFunction = useCallback(async () => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/work-orders/scrape-dispensers/progress/${userId}`,
      {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      // If 404, return a not_found status instead of throwing
      if (response.status === 404) {
        return { status: 'not_found', message: 'No active scraping session' }
      }
      throw new Error(`Progress fetch failed: ${response.status}`)
    }
    
    return response.json()
  }, [userId])

  return useProgressPolling(pollFunction, isActive, {
    interval: 1000,
    timeout: 600000 // 10 minutes for dispenser scraping
  })
}

// Specific hook for single dispenser scraping progress
export const useSingleDispenserProgress = (userId: string, workOrderId: string | null, isActive: boolean) => {
  const pollFunction = useCallback(async () => {
    if (!workOrderId) return null
    
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/work-orders/${workOrderId}/scrape-dispensers/progress?user_id=${userId}`,
      {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      // If 404, return a not_found status instead of throwing
      if (response.status === 404) {
        return { status: 'not_found', message: 'No active scraping session for this work order' }
      }
      throw new Error(`Progress fetch failed: ${response.status}`)
    }
    
    return response.json()
  }, [userId, workOrderId])

  return useProgressPolling(pollFunction, isActive && !!workOrderId, {
    interval: 1000,
    timeout: 120000 // 2 minutes for single dispenser
  })
}