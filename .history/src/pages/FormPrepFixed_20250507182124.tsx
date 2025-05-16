import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiUpload, FiInfo, 
  FiExternalLink, FiFileText, FiClipboard, FiSearch, 
  FiChevronDown, FiEye, FiRefreshCw, FiFilter,
  FiClock, FiMapPin, FiCheckCircle, FiXCircle
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

/**
 * Form Prep component for automating form completion
 */
const FormPrepFixed: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [visitUrl, setVisitUrl] = useState<string>('');
  const [isHeadless, setIsHeadless] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Demo handler for process button
  const handleSingleVisit = () => {
    setIsProcessing(true);
    addToast('info', 'Processing visit: ' + visitUrl);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      addToast('success', 'Form processing completed');
    }, 2000);
  };

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
                
                {/* Tab buttons - updated to match Dashboard Action Buttons */}
                <div className="flex items-center space-x-2 relative z-10">
                  <button
                    onClick={() => setActiveTab('single')}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      activeTab === 'single'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'
                    }`}
                  >
                    <FiFileText className="h-4 w-4" />
                    Single Visit
                  </button>
                  <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      activeTab === 'batch'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]'
                    }`}
                  >
                    <FiUpload className="h-4 w-4" />
                    Batch Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'single' && (
            <div className="space-y-6">
              {/* Visit URL & Process Form Panel */}
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2 mb-4">
                    <FiExternalLink className="text-primary-500 dark:text-primary-400" />
                    <span>Process Work Order Visit</span>
                  </h2>
                </div>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Visit URL
                    </label>
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 pl-10 py-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="https://app.workfossa.com/visit/..."
                        value={visitUrl}
                        onChange={(e) => setVisitUrl(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                        <button 
                          className="inline-flex items-center px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
                          onClick={() => {
                            if (visitUrl) {
                              addToast('info', 'Opening URL: ' + visitUrl);
                            }
                          }}
                          disabled={!visitUrl}
                        >
                          <FiEye className="mr-1.5 h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Automation Options</h3>
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                          checked={!isHeadless}
                          onChange={() => setIsHeadless(!isHeadless)}
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Show browser during automation (debug mode)</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6 space-x-3">
                    {isProcessing ? (
                      <button
                        className="btn bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 flex items-center space-x-2 px-4 py-2 rounded-md"
                        onClick={() => {
                          setIsProcessing(false);
                          addToast('info', 'Processing stopped');
                        }}
                      >
                        <FiX className="h-4 w-4" />
                        <span>Stop Processing</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        onClick={handleSingleVisit}
                        disabled={!visitUrl}
                      >
                        <FiPlay className="h-4 w-4" />
                        <span>Process Visit Form</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div className="panel bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="panel-header">
                  <h2 className="panel-title text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2 mb-4">
                    <FiUpload className="text-primary-500 dark:text-primary-400" />
                    <span>Batch Processing</span>
                  </h2>
                </div>
                
                <div className="mt-4">
                  <div className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                      <FiClipboard className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Processing</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Process multiple visits in batch mode.</p>
                    <button 
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors"
                      onClick={() => addToast('info', 'Batch processing functionality is coming soon.')}
                    >
                      <span>Preview Batch Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormPrepFixed; 