import React from 'react';
import { FiActivity, FiCalendar, FiPlus, FiMinus, FiRefreshCw, FiBarChart2 } from 'react-icons/fi';
import { ChangeRecord, ChangeItem } from '../../types/ChangeHistory';

interface ChangesPanelProps {
  changes: ChangeRecord[];
  loading: boolean;
  formatChangeItem: (change: ChangeItem, timestamp: Date) => string;
}

const ChangesPanel: React.FC<ChangesPanelProps> = ({ changes, loading, formatChangeItem }) => {
  // Determine badge style based on change type
  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'removed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'modified':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'swapped':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <FiPlus className="h-3 w-3" />;
      case 'removed':
        return <FiMinus className="h-3 w-3" />;
      case 'modified':
        return <FiRefreshCw className="h-3 w-3" />;
      case 'swapped':
        return <FiBarChart2 className="h-3 w-3" />;
      default:
        return <FiActivity className="h-3 w-3" />;
    }
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading changes data...</div>
        </div>
      ) : (
        <>
          {changes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400">No recent schedule changes detected.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {changes.map((record, recordIndex) => (
                <div key={recordIndex} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center">
                      <FiCalendar className="mr-2 text-primary-600 dark:text-primary-400" />
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(record.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </h3>
                    </div>
                    <div className="flex space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        +{record.changes.summary?.added || 0}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        -{record.changes.summary?.removed || 0}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        ~{record.changes.summary?.modified || 0}
                      </span>
                      {(record.changes.summary?.swapped || 0) > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          ⇄{record.changes.summary?.swapped || 0}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 divide-y divide-gray-200 dark:divide-gray-700">
                    {/* Critical changes */}
                    {record.changes.critical && record.changes.critical.length > 0 && (
                      <div className="py-2">
                        <h4 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Critical Changes</h4>
                        <ul className="space-y-1.5">
                          {record.changes.critical.map((change, changeIndex) => (
                            <li key={changeIndex} className="text-sm">
                              <div className="flex items-start">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium mr-2 mt-0.5 ${getBadgeStyle(change.type)}`}>
                                  {getChangeIcon(change.type)}
                                </span>
                                <span className="text-gray-800 dark:text-gray-200">{formatChangeItem(change, new Date(record.timestamp))}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* High priority changes */}
                    {record.changes.high && record.changes.high.length > 0 && (
                      <div className="py-2">
                        <h4 className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">High Priority</h4>
                        <ul className="space-y-1.5">
                          {record.changes.high.map((change, changeIndex) => (
                            <li key={changeIndex} className="text-sm">
                              <div className="flex items-start">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium mr-2 mt-0.5 ${getBadgeStyle(change.type)}`}>
                                  {getChangeIcon(change.type)}
                                </span>
                                <span className="text-gray-800 dark:text-gray-200">{formatChangeItem(change, new Date(record.timestamp))}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Medium priority changes */}
                    {record.changes.medium && record.changes.medium.length > 0 && (
                      <div className="py-2">
                        <h4 className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-2">Medium Priority</h4>
                        <ul className="space-y-1.5">
                          {record.changes.medium.map((change, changeIndex) => (
                            <li key={changeIndex} className="text-sm">
                              <div className="flex items-start">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium mr-2 mt-0.5 ${getBadgeStyle(change.type)}`}>
                                  {getChangeIcon(change.type)}
                                </span>
                                <span className="text-gray-800 dark:text-gray-200">{formatChangeItem(change, new Date(record.timestamp))}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Low priority changes */}
                    {record.changes.low && record.changes.low.length > 0 && (
                      <div className="py-2">
                        <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Low Priority</h4>
                        <ul className="space-y-1.5">
                          {record.changes.low.map((change, changeIndex) => (
                            <li key={changeIndex} className="text-sm">
                              <div className="flex items-start">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium mr-2 mt-0.5 ${getBadgeStyle(change.type)}`}>
                                  {getChangeIcon(change.type)}
                                </span>
                                <span className="text-gray-800 dark:text-gray-200">{formatChangeItem(change, new Date(record.timestamp))}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChangesPanel;
