import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import JobMap from './pages/JobMap'
import { Automation } from './pages/Automation'
import Settings from './pages/Settings'
import Login from './pages/Login'
import DesignSystem from './pages/DesignSystem'
import Navigation from './components/Navigation'
import { MobileNavigation } from './components/MobileNavigation'
import { MobileDrawer } from './components/MobileDrawer'
import { HamburgerMenu } from './components/HamburgerMenu'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ScrapingStatusProvider } from './contexts/ScrapingStatusContext'
import { logger } from './services/fileLoggingService'
import chromeDevToolsLogger from './services/chromeDevToolsLogger'
import LoadingSpinner from './components/LoadingSpinner'
import './App.css'

function AppContent() {
  const { isAuthenticated, loading } = useAuth()
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  React.useEffect(() => {
    logger.componentLifecycle('App', 'mount');
    logger.info('app.startup', '✅ FossaWork V2 Frontend mounted successfully');
    
    // Initialize Chrome DevTools logging
    logger.info('app.startup', '🔧 Initializing Chrome DevTools logging capture');
    
    return () => {
      logger.componentLifecycle('App', 'unmount');
      chromeDevToolsLogger.destroy();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden md:flex md:w-64 xl:w-72 flex-shrink-0">
        <Navigation />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 sm:hidden">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">FossaWork</h1>
          <HamburgerMenu onClick={() => setIsMobileDrawerOpen(true)} />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/job-map" element={<JobMap />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/design" element={<DesignSystem />} />
            {/* Add profile route for mobile navigation */}
            <Route path="/profile" element={<Settings />} />
            <Route path="/dispensers" element={<Dashboard />} />
            <Route path="/batch-processor" element={<Dashboard />} />
            <Route path="/queue-manager" element={<Dashboard />} />
            <Route path="/notifications" element={<Settings />} />
            <Route path="/users" element={<Settings />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation onMenuClick={() => setIsMobileDrawerOpen(true)} />
      
      {/* Mobile Drawer */}
      <MobileDrawer 
        isOpen={isMobileDrawerOpen} 
        onClose={() => setIsMobileDrawerOpen(false)} 
      />
      
    </div>
  )
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ScrapingStatusProvider>
            <AppContent />
          </ScrapingStatusProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App