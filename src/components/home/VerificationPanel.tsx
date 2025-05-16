import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { ExtendedFilterWarning } from '../../types/FilterWarning';

interface VerificationPanelProps {
  warnings: ExtendedFilterWarning[];
  loading: boolean;
}

const VerificationPanel: React.FC<VerificationPanelProps> = ({ warnings, loading }) => {
  // Function to get badge color based on severity
  const getBadgeColor = (severity: number): string => {
    switch (severity) {
      case 3: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 2: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  // Function to get text color based on severity
  const getTextColor = (severity: number): string => {
    switch (severity) {
      case 3: return 'text-red-700 dark:text-red-400';
      case 2: return 'text-yellow-700 dark:text-yellow-400';
      default: return 'text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading verification data...</div>
        </div>
      ) : (
        <>
          {warnings.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400">No verification warnings found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                  <FiAlertCircle className="mr-1.5" />
                  <span className="font-medium">{warnings.filter(w => w.severity === 3).length} High Severity</span>
                </div>
                <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  <FiAlertCircle className="mr-1.5" />
                  <span className="font-medium">{warnings.filter(w => w.severity === 2).length} Medium Severity</span>
                </div>
                <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  <FiAlertCircle className="mr-1.5" />
                  <span className="font-medium">{warnings.filter(w => w.severity === 1).length} Low Severity</span>
                </div>
              </div>

              {/* Warnings list */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Severity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Store
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Warning Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {warnings.map((warning, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(warning.severity || 1)}`}>
                            {warning.severity === 3 ? 'High' : warning.severity === 2 ? 'Medium' : 'Low'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {warning.storeName || 'Unknown Store'}
                        </td>
                        <td className={`px-6 py-4 text-sm ${getTextColor(warning.severity || 1)}`}>
                          {warning.message || 'Unknown warning'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Note about verification */}
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                These warnings are generated based on available dispenser data. Visit the Filters page for more detailed analysis.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VerificationPanel;
