/**
 * Demo component showing the logging system working in frontend-only mode
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../services/loggingService';

const LogViewerDemo: React.FC = () => {
  const [isGeneratingLogs, setIsGeneratingLogs] = useState(false);

  const generateTestLogs = async () => {
    setIsGeneratingLogs(true);
    logger.userAction('Start log generation demo');

    // Simulate various application scenarios
    logger.info('demo.startup', '🚀 Starting demo application');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate API calls
    logger.info('demo.api', '📤 Fetching user data...');
    await new Promise(resolve => setTimeout(resolve, 300));
    logger.info('demo.api', '✅ User data retrieved successfully', { 
      userId: 'demo-123',
      fetchTime: '245ms',
      dataSize: '2.4KB'
    });

    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simulate user interactions
    logger.userAction('Click dashboard button', { component: 'Dashboard', buttonId: 'main-cta' });
    logger.info('demo.navigation', '🧭 Navigating to work orders page');
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Simulate some warnings
    logger.warn('demo.validation', '⚠️ Form validation warning: Email format not optimal', {
      field: 'email',
      value: 'user@domain',
      suggestion: 'Add .com extension'
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate backend-like operations
    logger.info('demo.automation', '🤖 Starting fuel dispenser automation', {
      dispenserId: 'DISP-001',
      fuelGrades: ['Regular', 'Mid-Grade', 'Premium'],
      location: 'Shell Station #1234'
    });
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    logger.info('demo.automation', '📊 Automation progress update', {
      dispenserId: 'DISP-001',
      progress: 75,
      currentStep: 'Verifying fuel grades',
      estimatedTimeRemaining: '45 seconds'
    });
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Simulate an error (not a real error)
    try {
      throw new Error('Demo error: Connection timeout to fuel dispenser');
    } catch (error) {
      logger.error('demo.automation', '❌ Simulated error in automation process', {
        dispenserId: 'DISP-001',
        error: error.message,
        retryAttempt: 1,
        maxRetries: 3
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate recovery
    logger.info('demo.automation', '🔄 Retrying automation with backup connection');
    await new Promise(resolve => setTimeout(resolve, 300));
    logger.info('demo.automation', '✅ Automation completed successfully', {
      dispenserId: 'DISP-001',
      totalTime: '2.3 minutes',
      fuelGradesTested: 3,
      status: 'All systems operational'
    });
    
    // Performance logging
    logger.debug('demo.performance', '📈 Performance metrics', {
      memoryUsage: '45.2 MB',
      renderTime: '12ms',
      apiCalls: 8,
      cacheHitRate: '92%'
    });
    
    logger.userAction('Complete demo log generation', { 
      totalLogsGenerated: 12,
      demoLength: '4.5 seconds'
    });
    
    setIsGeneratingLogs(false);
  };

  const generateErrorScenario = () => {
    logger.userAction('Trigger error scenario demo');
    
    // Simulate unhandled error
    setTimeout(() => {
      // This will be caught by the global error handler
      throw new Error('Demo unhandled error: This shows how the logging system catches unexpected errors');
    }, 100);
    
    // Simulate promise rejection
    setTimeout(() => {
      Promise.reject(new Error('Demo promise rejection: This shows async error handling'));
    }, 200);
    
    logger.warn('demo.errors', '⚠️ Error scenario demo triggered - check logs for captured errors');
  };

  const simulateUserJourney = async () => {
    logger.userAction('Start user journey simulation');
    
    const journey = [
      { action: 'Page load', component: 'Dashboard', time: 200 },
      { action: 'View work orders', component: 'WorkOrderList', time: 300 },
      { action: 'Select work order', component: 'WorkOrderCard', data: { workOrderId: 'WO-123' }, time: 150 },
      { action: 'Start automation', component: 'AutomationPanel', time: 400 },
      { action: 'Monitor progress', component: 'ProgressTracker', time: 250 },
      { action: 'View results', component: 'ResultsPanel', time: 200 },
      { action: 'Export data', component: 'ExportButton', time: 300 }
    ];
    
    for (const step of journey) {
      logger.componentLifecycle(step.component, 'render', step.data);
      logger.userAction(step.action, { 
        component: step.component, 
        timestamp: Date.now(),
        ...step.data 
      });
      await new Promise(resolve => setTimeout(resolve, step.time));
    }
    
    logger.info('demo.journey', '✅ User journey simulation completed', {
      totalSteps: journey.length,
      totalTime: journey.reduce((sum, step) => sum + step.time, 0) + 'ms'
    });
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-4">
        🧪 Logging System Demo
      </h3>
      
      <p className="text-blue-800 mb-4">
        This demonstrates the comprehensive logging system working in real-time. 
        All logs are captured and displayed below with detailed metadata.
      </p>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={generateTestLogs}
          disabled={isGeneratingLogs}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isGeneratingLogs
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isGeneratingLogs ? '🔄 Generating...' : '🎯 Full Demo Sequence'}
        </button>
        
        <button
          onClick={generateErrorScenario}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          💥 Error Handling Demo
        </button>
        
        <button
          onClick={simulateUserJourney}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          👤 User Journey Demo
        </button>
        
        <button
          onClick={() => {
            console.log('This console.log will be captured!');
            console.warn('This console.warn will be captured!');
            console.error('This console.error will be captured!');
            logger.info('demo.console', '📝 Console capture demo - check the logs!');
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          🖥️ Console Capture Demo
        </button>
      </div>
      
      <div className="mt-4 text-sm text-blue-700">
        <strong>Features demonstrated:</strong> API logging, user actions, component lifecycle, 
        error handling, performance metrics, automation events, and console capture.
      </div>
    </div>
  );
};

export default LogViewerDemo;