import React from 'react';
import { AlertTriangle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

interface ErrorStateProps {
  error?: Error | null;
  onRetry?: () => void;
}

export default function ErrorState({ error, onRetry }: ErrorStateProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleRefresh = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <Card className="max-w-lg w-full p-8 text-center space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-400/20 dark:bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-white dark:bg-gray-800 p-6 rounded-full shadow-lg">
              <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-500" />
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Oops! Something went wrong
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            We encountered an error while loading filter data. This might be a temporary issue.
          </p>
        </div>

        {/* Error Details (if available) */}
        {error && (
          <Alert className="text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Error details:</strong> {error.message || 'Unknown error occurred'}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={handleRefresh}
            variant="default"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
                Troubleshooting Tips
              </h5>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Make sure you're logged in</li>
                <li>• Try refreshing the page</li>
                <li>• If the problem persists, contact support</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}