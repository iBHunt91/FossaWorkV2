import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App'
import './index.css'
import './styles/animations.css'
import './styles/tailwind-helpers.css'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { ScrapeProvider } from './context/ScrapeContext'

console.log('Main.tsx is loading...');
const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
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
  );
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
} 