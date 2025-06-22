import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ScrapingStatusContextType {
  // Force refresh function that components can call
  refreshStatus: () => void
  // Subscribers that want to be notified of updates
  subscribers: Set<() => void>
  // Subscribe to updates
  subscribe: (callback: () => void) => () => void
}

const ScrapingStatusContext = createContext<ScrapingStatusContextType | undefined>(undefined)

export const ScrapingStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscribers] = useState(new Set<() => void>())

  const refreshStatus = useCallback(() => {
    // Notify all subscribers that they should refresh
    subscribers.forEach(callback => callback())
  }, [subscribers])

  const subscribe = useCallback((callback: () => void) => {
    subscribers.add(callback)
    // Return unsubscribe function
    return () => {
      subscribers.delete(callback)
    }
  }, [subscribers])

  return (
    <ScrapingStatusContext.Provider value={{ refreshStatus, subscribers, subscribe }}>
      {children}
    </ScrapingStatusContext.Provider>
  )
}

export const useScrapingStatus = () => {
  const context = useContext(ScrapingStatusContext)
  if (!context) {
    throw new Error('useScrapingStatus must be used within a ScrapingStatusProvider')
  }
  return context
}