import React, { useState, useEffect } from 'react';
import { workOrderService } from '../services/workOrderService';

const ScheduleDebug: React.FC = () => {
  const [workOrderServiceOrders, setWorkOrderServiceOrders] = useState<any>(null);
  const [workOrderError, setWorkOrderError] = useState<string>('');
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get active user ID
    const userId = workOrderService.getActiveUserId();
    setActiveUserId(userId);

    // Test getWorkOrders from workOrderService
    const testWorkOrderService = async () => {
      try {
        console.log('Testing getWorkOrders from workOrderService...');
        console.log('Active user ID:', userId);
        const orders = await workOrderService.getWorkOrders();
        console.log('Work order service orders:', orders);
        setWorkOrderServiceOrders(orders);
      } catch (error: any) {
        console.error('Error from workOrderService:', error);
        console.error('Stack trace:', error.stack);
        setWorkOrderError(error.message || 'Unknown error');
      }
    };

    testWorkOrderService();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Schedule Debug Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">User Info</h2>
        <pre className="bg-gray-100 p-4 rounded">
          Active User ID: {activeUserId || 'None'}
          {'\n'}
          localStorage activeUserId: {localStorage.getItem('activeUserId') || 'None'}
        </pre>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">WorkOrderService.getWorkOrders()</h2>
        <pre className="bg-gray-100 p-4 rounded">
          Type: {typeof workOrderServiceOrders}
          {'\n'}
          Is Array: {Array.isArray(workOrderServiceOrders) ? 'Yes' : 'No'}
          {'\n'}
          Length: {Array.isArray(workOrderServiceOrders) ? workOrderServiceOrders.length : 'N/A'}
          {'\n'}
          Error: {workOrderError || 'None'}
          {'\n'}
          First 3 items: {Array.isArray(workOrderServiceOrders) ? JSON.stringify(workOrderServiceOrders.slice(0, 3), null, 2) : JSON.stringify(workOrderServiceOrders, null, 2).slice(0, 500)}...
        </pre>
      </div>
    </div>
  );
};

export default ScheduleDebug;