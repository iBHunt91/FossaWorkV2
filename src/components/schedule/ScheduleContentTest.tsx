import React from 'react';
import { WorkOrder } from './ScheduleTypes';

interface ScheduleContentTestProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
}

const ScheduleContentTest: React.FC<ScheduleContentTestProps> = ({ workOrders, isLoading }) => {
  console.log('ScheduleContentTest component rendering');
  
  // Test imports one by one
  try {
    console.log('Testing Panel import...');
    const Panel = require('./Panel').default;
    console.log('Panel imported successfully');
  } catch (error) {
    console.error('Error importing Panel:', error);
  }
  
  try {
    console.log('Testing ScheduleHeader import...');
    const ScheduleHeader = require('./ScheduleHeader').default;
    console.log('ScheduleHeader imported successfully');
  } catch (error) {
    console.error('Error importing ScheduleHeader:', error);
  }
  
  try {
    console.log('Testing WeekNavigator import...');
    const WeekNavigator = require('./WeekNavigator').default;
    console.log('WeekNavigator imported successfully');
  } catch (error) {
    console.error('Error importing WeekNavigator:', error);
  }
  
  return (
    <div style={{ border: '2px solid purple', padding: '20px' }}>
      <h2>Schedule Content Test</h2>
      <p>Component loaded successfully!</p>
      <p>Work orders: {workOrders?.length || 0}</p>
      <p>Loading: {String(isLoading)}</p>
    </div>
  );
};

export default ScheduleContentTest;