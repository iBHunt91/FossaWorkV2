import React from 'react';
import { FiWifi, FiWifiOff } from 'react-icons/fi';

interface NetworkStatusProps {
  online: boolean;
  latency: number | null;
  lastChecked: Date | null;
}

/**
 * NetworkStatus component displays network connectivity information
 */
const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  online, 
  latency, 
  lastChecked 
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          {online ? (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <FiWifi className="w-4 h-4 mr-1.5" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600 dark:text-red-400">
              <FiWifiOff className="w-4 h-4 mr-1.5" />
              <span className="text-sm font-medium">Disconnected</span>
            </div>
          )}
        </div>
        
        {online && latency !== null && (
          <div className={`flex items-center text-xs font-medium ${
            latency > 1000 
              ? 'text-red-600 dark:text-red-400' 
              : latency > 500 
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
          }`}>
            <span>{latency} ms</span>
          </div>
        )}
      </div>
      
      {online && latency !== null && (
        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2">
          <div 
            className={`absolute top-0 left-0 h-1.5 rounded-full ${
              latency > 1000 
                ? 'bg-red-500' 
                : latency > 500 
                  ? 'bg-amber-500'
                  : 'bg-green-500'
            }`}
            style={{ 
              // Scale latency for visualization
              // 0-100ms excellent (100%), 
              // 100-500ms good (70%), 
              // 500-1000ms fair (40%), 
              // 1000ms+ poor (20%)
              width: latency <= 100 
                ? '100%' 
                : latency <= 500 
                  ? '70%' 
                  : latency <= 1000 
                    ? '40%' 
                    : '20%' 
            }}
          />
        </div>
      )}
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {lastChecked 
          ? `Last checked: ${lastChecked.toLocaleTimeString()}` 
          : 'Not checked yet'}
      </div>
    </div>
  );
};

export default NetworkStatus;