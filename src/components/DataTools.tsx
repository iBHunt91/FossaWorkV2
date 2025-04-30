import React, { useState } from 'react';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { scrapeAllData, forceRescrapeDispenserData } from '../services/scrapeService';
import { useToast } from '../context/ToastContext';

const DataTools: React.FC = () => {
  const [isRetryingWorkOrders, setIsRetryingWorkOrders] = useState(false);
  const [isRetryingDispensers, setIsRetryingDispensers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleRetryWorkOrders = async () => {
    try {
      setIsRetryingWorkOrders(true);
      setError(null);
      
      const result = await scrapeAllData();
      addToast('info', 'Rescraping work orders initiated. This may take a few minutes.');
      
      // Automatic refresh after some time
      setTimeout(() => {
        window.location.reload();
      }, 30000);
    } catch (error) {
      console.error('Error retrying work orders:', error);
      setError('Failed to retry work orders. Please try again.');
      
      if (error instanceof Error) {
        addToast('error', `Error: ${error.message}`);
      } else {
        addToast('error', 'An unknown error occurred');
      }
    } finally {
      setIsRetryingWorkOrders(false);
    }
  };

  const handleRetryDispenserData = async () => {
    try {
      setIsRetryingDispensers(true);
      setError(null);
      
      // We'll call this for all work orders since there's no single function to rescrape all dispensers
      const workOrders = document.querySelectorAll('[data-order-id]');
      const orderIds = Array.from(workOrders).map(el => el.getAttribute('data-order-id')).filter(Boolean);
      
      if (orderIds.length === 0) {
        throw new Error('No work orders found to rescrape');
      }
      
      // Start with a notification
      addToast('info', `Rescraping dispensers for ${orderIds.length} work orders. This may take a few minutes.`);
      
      // Process each order (with a small delay to avoid overwhelming the server)
      for (const orderId of orderIds) {
        if (orderId) {
          try {
            await forceRescrapeDispenserData(orderId);
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Error rescraping dispenser for order ${orderId}:`, err);
          }
        }
      }
      
      // Automatic refresh after some time
      setTimeout(() => {
        window.location.reload();
      }, 30000);
    } catch (error) {
      console.error('Error retrying dispenser data:', error);
      setError('Failed to retry dispenser data. Please try again.');
      
      if (error instanceof Error) {
        addToast('error', `Error: ${error.message}`);
      } else {
        addToast('error', 'An unknown error occurred');
      }
    } finally {
      setIsRetryingDispensers(false);
    }
  };

  const handleTryAgain = () => {
    setError(null);
    window.location.reload();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Data Tools</h3>
      
      <div className="space-y-3">
        <button
          onClick={handleRetryWorkOrders}
          disabled={isRetryingWorkOrders}
          className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {isRetryingWorkOrders ? (
            <>
              <FiRefreshCw className="animate-spin mr-2" />
              Retrying...
            </>
          ) : (
            'Retry Work Orders'
          )}
        </button>
        
        <button
          onClick={handleRetryDispenserData}
          disabled={isRetryingDispensers}
          className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {isRetryingDispensers ? (
            <>
              <FiRefreshCw className="animate-spin mr-2" />
              Retrying...
            </>
          ) : (
            'Retry Dispenser Data'
          )}
        </button>
        
        {error && (
          <div className="mt-3 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">
            <div className="flex items-start">
              <FiAlertCircle className="flex-shrink-0 h-5 w-5 text-red-400 dark:text-red-300 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error: {error}
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-200">
                  <p>
                    This may be a temporary issue. Please try again, or try the following:
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Check if the store has dispensers configured in Fossa</li>
                    <li>Verify your network connection is stable</li>
                    <li>
                      If the problem persists, try "Force Rescrape" on specific stores
                    </li>
                  </ul>
                </div>
                <div className="mt-3">
                  <button
                    onClick={handleTryAgain}
                    className="bg-red-100 dark:bg-red-800 px-2 py-1 rounded-md text-red-800 dark:text-red-200 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataTools; 