import React, { useState, useEffect } from 'react';
import { FiActivity, FiHome } from 'react-icons/fi';
import PersistentView, { usePersistentViewContext } from '../components/PersistentView';
import { SkeletonDashboardStats } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { getWorkOrders } from '../services/scrapeService';

// Simplified Home component to just render PersistentView wrapper
const Home: React.FC = () => {
  return (
    <PersistentView id="home-dashboard" persistScrollPosition={true}>
      <HomeContent />
    </PersistentView>
  );
};

export default Home;

// HomeContent component uses the persistence context
const HomeContent: React.FC = () => {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  
  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Check if there's an active user
        const activeUserId = localStorage.getItem('activeUserId');
        
        if (!activeUserId) {
          console.warn('No active user found, cannot load work orders');
          addToast('warning', 'Please select a user to view work orders', 5000);
          setIsLoading(false);
          return;
        }
        
        console.log(`Loading work orders for user: ${activeUserId}`);
        
        // Load work orders from the API
        const workOrdersResponse = await getWorkOrders();
        
        // Verify the response contains the work orders
        if (workOrdersResponse.error) {
          console.error('Error loading work orders:', workOrdersResponse.error);
          addToast('error', `Failed to load work orders: ${workOrdersResponse.error}`, 5000);
          setIsLoading(false);
          return;
        }
        
        setWorkOrders(workOrdersResponse.workOrders || []);
        
      } catch (error) {
        console.error('Error loading data:', error);
        addToast('error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [addToast]);

  const renderDashboardHeader = () => {
    if (isLoading) {
      return <SkeletonDashboardStats />;
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <FiActivity className="text-primary-600 dark:text-primary-400" /> Dashboard
        </h2>
        <div className="text-gray-600 dark:text-gray-300">
          {workOrders.length > 0 ? (
            <p>Loaded {workOrders.length} work orders successfully.</p>
          ) : (
            <p>No work orders found. Please try refreshing the data.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full max-w-full overflow-x-hidden">
      {/* Dashboard header with stats */}
      <div className="px-1 sm:px-0">
        {renderDashboardHeader()}
      </div>
      
      {/* Loading indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            <FiHome className="inline mr-2" />
            Home Page is Working!
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            The application is now loading correctly. The previous version had syntax errors 
            that prevented it from loading properly.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-sm">
            <p className="font-medium">Notice:</p> 
            <p>
              This is a simplified version of the Home page to get the application working. 
              The full dashboard functionality will be restored in the next update.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

