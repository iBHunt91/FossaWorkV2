import React from 'react';
import FilterDebugger from '../components/FilterDebugger';

/**
 * Temporary debug page to diagnose filter calculation issues
 */
const Debug: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Filter Debug Page</h1>
      <FilterDebugger />
    </div>
  );
};

export default Debug;