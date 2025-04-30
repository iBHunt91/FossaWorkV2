import React from 'react';
import { useToastNotification } from '../hooks/useToastNotification';

const ToastExample: React.FC = () => {
  const toast = useToastNotification();

  const showSuccessToast = () => {
    toast.success('Operation completed successfully!');
  };

  const showErrorToast = () => {
    toast.error('An error occurred. Please try again.', { duration: 8000 });
  };

  const showInfoToast = () => {
    toast.info('New updates are available!');
  };

  const showWarningToast = () => {
    toast.warning('This action cannot be undone.', { duration: 10000 });
  };

  const changePosition = (position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center') => {
    toast.configure(position);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Toast Notification Examples</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={showSuccessToast}
          className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
        >
          Success Toast
        </button>
        
        <button
          onClick={showErrorToast}
          className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Error Toast (8s)
        </button>
        
        <button
          onClick={showInfoToast}
          className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Info Toast
        </button>
        
        <button
          onClick={showWarningToast}
          className="py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors"
        >
          Warning Toast (10s)
        </button>
      </div>
      
      <div className="mt-6">
        <h3 className="text-xl font-medium mb-4 text-gray-800 dark:text-white">Toast Position</h3>
        <p className="mb-2 text-gray-600 dark:text-gray-300">Current position: <span className="font-semibold">{toast.position}</span></p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => changePosition('top-left')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Top Left
          </button>
          <button
            onClick={() => changePosition('top-center')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Top Center
          </button>
          <button
            onClick={() => changePosition('top-right')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Top Right
          </button>
          <button
            onClick={() => changePosition('bottom-left')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Bottom Left
          </button>
          <button
            onClick={() => changePosition('bottom-center')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Bottom Center
          </button>
          <button
            onClick={() => changePosition('bottom-right')}
            className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg text-sm transition-colors"
          >
            Bottom Right
          </button>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Usage Tips</h3>
        <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1 text-sm">
          <li>Hover over a toast to pause its timer</li>
          <li>Click the X button to dismiss immediately</li>
          <li>Customize duration with the options parameter</li>
          <li>Watch the progress bar to track remaining time</li>
        </ul>
      </div>
    </div>
  );
};

export default ToastExample; 