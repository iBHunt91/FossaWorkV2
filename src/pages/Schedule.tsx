import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { workOrderService } from '../services/workOrderService';
import ScheduleContent from '../components/schedule/ScheduleContent';
import { WorkOrder } from '../components/schedule/ScheduleTypes';

const Schedule: React.FC = () => {
  const { theme } = useTheme();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWorkOrders = async () => {
      try {
        setIsLoading(true);
        const orders = await workOrderService.getWorkOrders();
        
        // Ensure orders is an array
        if (orders && Array.isArray(orders)) {
          setWorkOrders(orders);
        } else {
          console.warn('Work orders response is not an array:', orders);
          setWorkOrders([]);
        }
      } catch (error) {
        console.error('Error loading work orders:', error);
        setWorkOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkOrders();
  }, []);

  return (
    <div className="container mx-auto p-4 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Work Schedule</h1>
      <ScheduleContent 
        workOrders={workOrders}
        isLoading={isLoading}
      />
    </div>
  );
};

export default Schedule;