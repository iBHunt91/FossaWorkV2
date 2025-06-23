import React from 'react';
import { Card } from '../ui/card';
import { SkeletonLoader } from '../ui/animated-loader';

export default function FiltersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Date Selector Skeleton */}
      <Card className="p-4 border-2 border-dashed border-muted/50 bg-gradient-to-r from-background via-background to-muted/10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse" />
            </div>
            <div className="h-10 w-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-20 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-md animate-pulse" />
            <div className="h-8 w-24 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 rounded-md animate-pulse" />
          </div>
        </div>
      </Card>

      {/* Summary Statistics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { color: 'blue', delay: '0ms' },
          { color: 'green', delay: '100ms' },
          { color: 'purple', delay: '200ms' },
          { color: 'yellow', delay: '300ms' }
        ].map((item, i) => (
          <Card 
            key={i} 
            className="p-4 border border-muted/50 hover:shadow-md transition-all"
            style={{ animationDelay: item.delay }}
          >
            <div className={`h-4 w-20 bg-gradient-to-r from-${item.color}-100 to-${item.color}-200 dark:from-${item.color}-900/20 dark:to-${item.color}-800/20 rounded mb-2 animate-pulse`} />
            <div className={`h-8 w-16 bg-gradient-to-r from-${item.color}-200 to-${item.color}-300 dark:from-${item.color}-800/20 dark:to-${item.color}-700/20 rounded animate-pulse`} />
          </Card>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Filter Summary */}
        <div className="space-y-6">
          <Card className="p-4 overflow-hidden">
            <div className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded animate-pulse" />
                  <div className="h-6 w-32 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            
            {/* Filter type buttons skeleton */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[1, 2, 3, 4].map(i => (
                <div 
                  key={i} 
                  className="h-8 w-20 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-md animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
            
            {/* Filter items skeleton */}
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div 
                  key={i} 
                  className="p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg border animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-8 w-12 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-800/20 dark:to-indigo-800/20 rounded" />
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column - Warnings */}
        <div className="space-y-6">
          <Card className="p-4 overflow-hidden">
            <div className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded animate-pulse" />
                  <div className="h-6 w-32 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse" />
                  <div className="flex gap-1">
                    <div className="h-5 w-12 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-800/20 rounded-full animate-pulse" />
                    <div className="h-5 w-14 bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            
            {/* Warning items skeleton */}
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div 
                  key={i} 
                  className="p-4 bg-gradient-to-r from-yellow-50/50 to-red-50/50 dark:from-yellow-900/10 dark:to-red-900/10 rounded-lg border animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <div className="flex gap-3">
                    <div className="h-4 w-4 bg-yellow-400 rounded-full mt-1 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}