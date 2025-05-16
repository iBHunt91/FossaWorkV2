import React from 'react';
import DispenserProgressCard from './DispenserProgressCard';

// Mock progress data for testing
const mockDispenserProgress = {
  workOrderId: 'W-12345',
  dispensers: [
    {
      dispenserTitle: 'Dispenser #1/2',
      dispenserNumber: '1',
      formNumber: 1,
      totalForms: 2,
      status: 'processing' as const,
      currentAction: 'Filling form for fuel grade',
      fuelGrades: [
        {
          grade: '87 Octane Regular',
          status: 'completed' as const,
          prover: 'P1',
          meter: 'M1',
          message: 'Successfully saved'
        },
        {
          grade: '89 Plus',
          status: 'processing' as const,
          prover: null,
          meter: null,
          message: 'Filling form data'
        },
        {
          grade: '93 Premium',
          status: 'pending' as const,
          prover: null,
          meter: null,
          message: null
        }
      ]
    },
    {
      dispenserTitle: 'Dispenser #3/4',
      dispenserNumber: '3',
      formNumber: 2,
      totalForms: 2,
      status: 'pending' as const,
      currentAction: 'Waiting to process',
      fuelGrades: [
        {
          grade: '87 Octane Regular',
          status: 'pending' as const,
          prover: null,
          meter: null,
          message: null
        },
        {
          grade: '89 Plus',
          status: 'pending' as const,
          prover: null,
          meter: null,
          message: null
        }
      ]
    }
  ]
};

const DispenserProgressTester: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold mb-4">Dispenser Progress Visual Test</h2>
      
      <div className="space-y-3">
        {mockDispenserProgress.dispensers.map((dispenser, idx) => (
          <DispenserProgressCard key={idx} progress={dispenser} />
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="font-medium mb-2">Test Data Structure:</h3>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(mockDispenserProgress, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default DispenserProgressTester;