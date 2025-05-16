import React from 'react';
import { useDispenserData } from '../context/DispenserContext';

const TestDispenser: React.FC = () => {
  console.log('TestDispenser component rendering');
  
  try {
    const context = useDispenserData();
    console.log('Dispenser context loaded:', context);
    
    return (
      <div>
        <h1>Test Dispenser Hook</h1>
        <p>Hook loaded successfully!</p>
        <pre>{JSON.stringify(context.dispenserData, null, 2).slice(0, 200)}...</pre>
      </div>
    );
  } catch (error: any) {
    console.error('Error using dispenser hook:', error);
    return (
      <div>
        <h1>Test Dispenser Hook</h1>
        <p style={{ color: 'red' }}>Error: {error.message}</p>
      </div>
    );
  }
};

export default TestDispenser;