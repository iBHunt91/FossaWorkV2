import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useWorkOrderSyncProgress } from '../hooks/useProgressPolling';

interface CompactSyncProgressProps {
  scheduleId?: number | null;
  isActive: boolean;
  onClick?: () => void;
}

const CompactSyncProgress: React.FC<CompactSyncProgressProps> = ({ 
  scheduleId, 
  isActive,
  onClick 
}) => {
  // Use the progress hook
  const { data: syncProgress } = useWorkOrderSyncProgress(
    scheduleId || null,
    isActive
  );

  // Log for debugging
  React.useEffect(() => {
    if (syncProgress) {
      console.log('CompactSyncProgress - Progress data:', syncProgress);
    }
  }, [syncProgress]);

  // Don't show if no active sync
  if (!isActive || !syncProgress || syncProgress.status !== 'in_progress') {
    return null;
  }

  const percentage = Number(syncProgress.percentage || 0);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
        "border border-blue-200 dark:border-blue-800",
        "cursor-pointer hover:shadow-md transition-all duration-200",
        "animate-slide-in-from-top"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Work order sync in progress"
    >
      {/* Spinning Icon */}
      <div className="relative">
        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>

      {/* Progress Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
            Syncing...
          </p>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {Math.round(percentage)}%
          </span>
        </div>
        
        {/* Progress Bar */}
        <Progress 
          value={percentage} 
          className="h-1.5 bg-blue-200 dark:bg-blue-800"
        />

        {/* Status Text */}
        {syncProgress.message && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {syncProgress.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CompactSyncProgress;