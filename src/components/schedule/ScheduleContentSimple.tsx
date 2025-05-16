import React from 'react';
import { WorkOrder } from './ScheduleTypes';

interface ScheduleContentSimpleProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
}

const ScheduleContentSimple: React.FC<ScheduleContentSimpleProps> = ({ workOrders, isLoading }) => {
  console.log('ScheduleContentSimple is rendering!');
  
  return (
    <div style={{ border: '2px solid blue', padding: '20px' }}>
      <h2>Schedule Content Simple</h2>
      <p>Is Loading: {String(isLoading)}</p>
      <p>Work Orders Count: {workOrders ? workOrders.length : 'null'}</p>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {workOrders && workOrders.map((order, index) => (
            <li key={index}>Order {index + 1}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScheduleContentSimple;