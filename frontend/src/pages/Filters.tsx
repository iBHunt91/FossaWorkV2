import React, { useState, useEffect } from 'react';
import { Calendar, Filter, AlertTriangle, Download, RefreshCw, Sparkles, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useJobData } from '../hooks/useJobData';
import { useWeekendMode } from '../hooks/useWeekendMode';
import FiltersContent from '../components/filters/FiltersContent';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import LoadingSpinner from '../components/LoadingSpinner';
import { AnimatedText, GradientText } from '../components/ui/animated-text';
import { AnimatedButton, RippleButton, MagneticButton } from '../components/ui/animated-button';
import { AnimatedCard } from '../components/ui/animated-card';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getUserPreferences } from '../services/api';

// Constants for update system
const UPDATE_CHECK_INTERVAL = 30000; // 30 seconds
const UPDATE_THRESHOLD = 60000; // 1 minute
const REFRESH_DELAY = 1000; // 1 second

export default function Filters() {
  const { user } = useAuth();
  const currentUserId = user?.id || 'authenticated-user';
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Fetch user preferences including work week settings
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
    enabled: !!user,
  });

  // Get work days from preferences for weekend mode
  const workDays = preferences?.work_week?.days || [1, 2, 3, 4, 5];
  
  // Note: Weekend mode isn't directly used in Filters page, but we'll pass work days to FiltersContent
  // to ensure week calculations respect the user's work week

  // Check for updates every 30 seconds
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Check if data has changed since last update
        // This would typically check against an API endpoint
        const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
        if (timeSinceLastUpdate > UPDATE_THRESHOLD) {
          setHasUpdate(true);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // Auto-refresh when update is available
  useEffect(() => {
    if (hasUpdate && !isRefreshing) {
      handleRefresh();
    }
  }, [hasUpdate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setHasUpdate(false);
    try {
      // Trigger data refresh through context or API
      await new Promise(resolve => setTimeout(resolve, REFRESH_DELAY)); // Simulated refresh
      setLastUpdateTime(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    // Get export data from hidden element
    const exportElement = document.querySelector('[data-export-data]');
    if (!exportElement) {
      console.error('No export data available');
      return;
    }
    
    try {
      const filterData = JSON.parse(exportElement.getAttribute('data-export-data') || '{}');
      
      // Generate CSV content
      const csvRows = [
        ['Part Number', 'Description', 'Quantity', 'Boxes Needed', 'Stores Affected', 'Filter Type']
      ];
      
      if (filterData.summary) {
        filterData.summary.forEach((item: any) => {
          csvRows.push([
            item.partNumber,
            item.description,
            item.quantity.toString(),
            item.boxes.toString(),
            item.storeCount.toString(),
            item.filterType
          ]);
        });
      }
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filter-summary-week-${format(selectedWeek, 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting filter data:', error);
    }
  };

  return (
    <ErrorBoundary>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
              <div className="relative">
                <Filter className="w-8 h-8 text-primary" />
                <Sparkles className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <GradientText>Filter Management</GradientText>
            </h1>
            <AnimatedText 
              text="Calculate and manage filter requirements for scheduled maintenance"
              className="text-muted-foreground"
              animationType="fade"
              delay={0.1}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <MagneticButton
                variant={hasUpdate ? 'default' : 'outline'}
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "flex items-center gap-2 transition-all",
                  hasUpdate && "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0"
                )}
              >
                <RefreshCw className={cn("w-4 h-4 transition-transform", isRefreshing && "animate-spin")} />
                {isRefreshing ? 'Updating...' : hasUpdate ? 'Update Available' : 'Refresh'}
                {hasUpdate && !isRefreshing && (
                  <Bell className="w-3 h-3 animate-bounce" />
                )}
              </MagneticButton>
              {hasUpdate && !isRefreshing && (
                <div 
                  className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
                  aria-label="Update available"
                  role="status"
                />
              )}
            </div>
            
            <RippleButton
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-2 hover:bg-green-50 hover:border-green-500 hover:text-green-600 dark:hover:bg-green-900/20"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </RippleButton>
          </div>
        </div>

        {/* Main Content */}
        <FiltersContent
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          onExport={handleExport}
          isRefreshing={isRefreshing}
          workDays={workDays}
        />
      </div>
    </ErrorBoundary>
  );
}