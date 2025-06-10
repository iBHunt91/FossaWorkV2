import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import { Automation } from './pages/Automation'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Navigation from './components/Navigation'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { logger } from './services/fileLoggingService'
import chromeDevToolsLogger from './services/chromeDevToolsLogger'
import LoadingSpinner from './components/LoadingSpinner'
import './App.css'

function AppContent() {
  const { isAuthenticated, loading } = useAuth()

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
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 xl:w-72 flex-shrink-0">
        <Navigation />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Navigation - Future Enhancement */}
      {/* Could add a mobile drawer/bottom navigation here */}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App