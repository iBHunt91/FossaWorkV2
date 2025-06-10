import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { setupMemoryMonitoring, startMemoryMonitoring } from './utils/memoryMonitor'
import { logger } from './services/fileLoggingService'

// Setup memory monitoring for browser
setupMemoryMonitoring(2048, 30000); // 2GB limit, check every 30s
startMemoryMonitoring();

// Initialize logging service (it auto-initializes, but this ensures it's loaded)
logger.info('app.startup', '🚀 FossaWork V2 Frontend starting up...');

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)