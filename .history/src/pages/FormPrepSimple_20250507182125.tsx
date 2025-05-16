import React, { useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

/**
 * Simplified FormPrep component with updated styling
 */
const FormPrepSimple: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6 animate-fadeIn">
          {/* Page header - updated to match Dashboard Header style */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <FiFileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white mb-0">Form Prep</h1>
                  <p className="text-sm text-gray-300 mt-0.5">Automate form completion for service visits</p>
                </div>
              </div>
              
              <div className="relative z-10">
                {/* Decorative element */}
                <div className="absolute top-0 right-0 w-32 h-32 -mt-8 -mr-8 bg-gradient-to-br from-primary-400/20 to-primary-600/10 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Form Prep Module</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
                The form prep functionality is currently being updated to incorporate new styling guidelines.
              </p>
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
                onClick={() => addToast('info', 'This is a simplified version of the Form Prep module.')}
              >
                Demo Toast
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPrepSimple; 