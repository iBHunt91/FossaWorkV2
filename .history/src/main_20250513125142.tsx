import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App'
import './index.css'
import './styles/animations.css'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { ScrapeProvider } from './context/ScrapeContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Router>
        <ToastProvider>
          <ScrapeProvider>
            <App />
          </ScrapeProvider>
        </ToastProvider>
      </Router>
    </ThemeProvider>
  </React.StrictMode>,
) 