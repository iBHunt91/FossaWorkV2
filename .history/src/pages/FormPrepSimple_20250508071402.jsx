import React from 'react';

const FormPrepSimple = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6 animate-fadeIn">
          {/* Page header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 text-white rounded-xl shadow-lg mb-6 flex flex-col overflow-hidden border border-gray-700 dark:border-gray-800">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <span>Icon</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white mb-0">Form Prep</h1>
                  <p className="text-sm text-gray-300 mt-0.5">Automate form completion for service visits</p>
                </div>
              </div>
              
              <div className="relative z-10">
                {/* Tab buttons */}
                <div className="flex items-center space-x-2 relative z-10">
                  <button className="px-4 py-2 rounded-md flex items-center gap-2 transition-colors bg-blue-600 text-white">
                    <span>Icon</span>
                    Single Visit
                  </button>
                  <button className="px-4 py-2 rounded-md flex items-center gap-2 transition-colors bg-[#2d3c55] text-gray-300 hover:bg-[#3a4a66]">
                    <span>Icon</span>
                    Batch Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Content panels */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title flex items-center space-x-2 mb-0">
                  <span>Icon</span>
                  <span>Panel Title</span>
                </h2>
              </div>
              
              <div className="mt-4">
                {/* Panel content */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="badge badge-primary flex items-center space-x-1 py-1 px-3">
                      <span>Selected item</span>
                    </div>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    {/* Header content */}
                    <div>Header</div>
                  </div>
                
                  <div className="overflow-x-auto">
                    {/* Table content */}
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead>
                        <tr>
                          <th>Column 1</th>
                          <th>Column 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Data 1</td>
                          <td>Data 2</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPrepSimple; 