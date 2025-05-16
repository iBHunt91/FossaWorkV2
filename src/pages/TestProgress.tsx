import React, { useState } from 'react';
import { useToast } from '../hooks/useToast';
import SingleVisitAutomation from '../components/SingleVisitAutomation';
import BatchVisitAutomation from '../components/BatchVisitAutomation';
import DispenserProgressCard from '../components/DispenserProgressCard';
import DispenserProgressTester from '../components/DispenserProgressTester';

const TestProgress: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'demo' | 'single' | 'batch' | 'tester'>('demo');
  
  // Mock data for demo
  const mockDispenserProgress = {
    dispenserTitle: 'Dispenser 1 - Main Island',
    dispenserNumber: '1',
    formNumber: 1,
    totalForms: 3,
    status: 'processing' as const,
    currentAction: 'Processing fuel grade: Premium',
    fuelGrades: [
      {
        grade: 'Regular (87)',
        status: 'completed' as const,
        prover: '16459',
        meter: 'A',
        message: 'Successfully processed'
      },
      {
        grade: 'Plus (89)',
        status: 'completed' as const,
        prover: '16460',
        meter: 'B',
        message: 'Successfully processed'
      },
      {
        grade: 'Premium (93)',
        status: 'processing' as const,
        prover: '16461',
        meter: 'C',
        message: 'Currently processing...'
      },
      {
        grade: 'Diesel',
        status: 'pending' as const,
        message: 'Waiting to process'
      }
    ]
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Visual Progress Test</h1>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('demo')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'demo'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Demo Progress
            </button>
            <button
              onClick={() => setActiveTab('single')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'single'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Single Visit
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'batch'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Batch
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tester'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Original Tester
            </button>
          </nav>
        </div>
        
        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'demo' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Demo Dispenser Progress</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This demonstrates the DispenserProgressCard component with mock data.
              </p>
              
              <div className="space-y-4 max-w-2xl">
                {/* Processing Example */}
                <DispenserProgressCard progress={mockDispenserProgress} />
                
                {/* Completed Example */}
                <DispenserProgressCard 
                  progress={{
                    ...mockDispenserProgress,
                    dispenserTitle: 'Dispenser 2 - Completed',
                    dispenserNumber: '2',
                    formNumber: 2,
                    status: 'completed',
                    currentAction: 'All fuel grades processed successfully',
                    fuelGrades: mockDispenserProgress.fuelGrades.map(fg => ({
                      ...fg,
                      status: 'completed',
                      prover: '16462',
                      meter: 'D',
                      message: 'Successfully processed'
                    }))
                  }}
                />
              </div>
            </div>
          )}
          
          {activeTab === 'single' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Single Visit Automation Test</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Test the visual progress display during single visit automation.
              </p>
              
              <SingleVisitAutomation
                activeUserId="test-user"
                addDebugLog={(type, message, data) => {
                  console.log(`[${type}] ${message}`, data);
                }}
                onJobStatusChange={(status) => {
                  console.log('Job status changed:', status);
                  if (status.dispenserProgress) {
                    console.log('Dispenser progress available:', status.dispenserProgress);
                  }
                }}
                onJobComplete={() => {
                  addToast('success', 'Single visit test completed');
                }}
                onJobError={(error) => {
                  addToast('error', `Error: ${error.message}`);
                }}
              />
            </div>
          )}
          
          {activeTab === 'batch' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Batch Automation Test</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Test the visual progress display during batch automation.
              </p>
              
              <BatchVisitAutomation
                activeUserId="test-user"
                workOrders={[]}
                addDebugLog={(type, message, data) => {
                  console.log(`[${type}] ${message}`, data);
                }}
                onJobStatusChange={(status) => {
                  console.log('Batch status changed:', status);
                  if (status.dispenserProgress) {
                    console.log('Dispenser progress available:', status.dispenserProgress);
                  }
                }}
                onJobComplete={() => {
                  addToast('success', 'Batch test completed');
                }}
                onJobError={(error) => {
                  addToast('error', `Error: ${error.message}`);
                }}
              />
            </div>
          )}
          
          {activeTab === 'tester' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Original Progress Tester</h2>
              <DispenserProgressTester />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestProgress;