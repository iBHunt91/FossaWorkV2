import React from 'react';

interface SystemMonitorProps {
  systemStatus: {
    memory: {
      usedPercent: number;
      total: string;
    };
    cpu: {
      usagePercent: number;
    };
    localStorage?: {
      usedPercent: number;
      used: string;
      total: string;
    };
  };
}

/**
 * SystemMonitor component displays resource usage meters
 */
const SystemMonitor: React.FC<SystemMonitorProps> = ({ systemStatus }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Memory Usage */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Memory Usage</span>
          <span 
            className={`text-xs font-medium ${
              systemStatus.memory.usedPercent > 90 
                ? 'text-red-600 dark:text-red-400' 
                : systemStatus.memory.usedPercent > 70 
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {systemStatus.memory.usedPercent.toFixed(1)}%
          </span>
        </div>
        
        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2">
          <div 
            className={`absolute top-0 left-0 h-1.5 rounded-full ${
              systemStatus.memory.usedPercent > 90 
                ? 'bg-red-500' 
                : systemStatus.memory.usedPercent > 70 
                  ? 'bg-amber-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${systemStatus.memory.usedPercent}%` }}
          />
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Total: {systemStatus.memory.total}
        </div>
      </div>
      
      {/* CPU Usage */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">CPU Usage</span>
          <span 
            className={`text-xs font-medium ${
              systemStatus.cpu.usagePercent > 90 
                ? 'text-red-600 dark:text-red-400' 
                : systemStatus.cpu.usagePercent > 70 
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {systemStatus.cpu.usagePercent.toFixed(1)}%
          </span>
        </div>
        
        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2">
          <div 
            className={`absolute top-0 left-0 h-1.5 rounded-full ${
              systemStatus.cpu.usagePercent > 90 
                ? 'bg-red-500' 
                : systemStatus.cpu.usagePercent > 70 
                  ? 'bg-amber-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${systemStatus.cpu.usagePercent}%` }}
          />
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          &nbsp; {/* Placeholder to match the memory card height */}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;