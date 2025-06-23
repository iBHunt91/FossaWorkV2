import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Filter, AlertCircle, ArrowRight, RefreshCw, FileText, ClipboardList, CheckCircle, ArrowLeft, ExternalLink, Package, Sparkles, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { format, addWeeks, subWeeks } from 'date-fns';
import { AnimatedText } from '../ui/animated-text';
import { RippleButton, MagneticButton, AnimatedButton } from '../ui/animated-button';
import { AnimatedCard } from '../ui/animated-card';

interface EmptyStateProps {
  selectedWeek: Date;
  onRefresh: () => void;
  onWeekChange: (date: Date) => void;
  nearestWeekWithWork?: Date | null;
}

export default function EmptyState({ selectedWeek, onRefresh, onWeekChange, nearestWeekWithWork }: EmptyStateProps) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Calculate actual week boundaries
  const weekStartDate = new Date(selectedWeek);
  weekStartDate.setDate(selectedWeek.getDate() - selectedWeek.getDay() + 1); // Monday
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6); // Sunday
  
  const weekStart = format(weekStartDate, 'MMM d');
  const weekEnd = format(weekEndDate, 'MMM d, yyyy');
  
  const handleNavigateToWorkOrders = () => {
    navigate('/work-orders');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handlePreviousWeek = () => {
    onWeekChange(subWeeks(selectedWeek, 1));
  };

  const handleNextWeek = () => {
    onWeekChange(addWeeks(selectedWeek, 1));
  };

  const handleGoToNearestWeek = () => {
    if (nearestWeekWithWork) {
      onWeekChange(nearestWeekWithWork);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle>No Filter Calculations Available</AlertTitle>
        <AlertDescription>
          No work orders found for {weekStart} - {weekEnd}. Filters are automatically calculated when work orders are scheduled.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Empty State Card */}
        <AnimatedCard className="lg:col-span-2 p-8">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-orange-400/20 dark:bg-orange-500/20 rounded-full blur-xl animate-pulse group-hover:blur-2xl transition-all" />
                <div className="relative bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/50 dark:to-yellow-900/50 p-6 rounded-full group-hover:scale-110 transition-transform">
                  <Package className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                  <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2 animate-bounce" />
                </div>
              </div>
            </div>

            {/* Title and Description */}
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                <AnimatedText text="No Filters to Calculate" animationType="reveal" />
              </h3>
              <div className="max-w-md mx-auto">
                <AnimatedText 
                  text="Filter requirements are calculated automatically based on scheduled work orders and dispenser configurations."
                  className="text-gray-600 dark:text-gray-400"
                  animationType="fade"
                  delay={0.2}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <AnimatedText 
                  text="What would you like to do?"
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  animationType="fade"
                  delay={0.4}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                <RippleButton
                  onClick={handleNavigateToWorkOrders}
                  variant="default"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                >
                  <ClipboardList className="h-4 w-4" />
                  View Work Orders
                </RippleButton>
                
                <MagneticButton
                  onClick={handleRefresh}
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                </MagneticButton>
              </div>

              {/* Smart Week Navigation - Show if there's a week with work orders */}
              {nearestWeekWithWork && (
                <div className="pt-4">
                  <div className="flex justify-center">
                    <AnimatedButton
                      onClick={handleGoToNearestWeek}
                      variant="default"
                      className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg"
                    >
                      <Target className="h-4 w-4" />
                      Week of {format(nearestWeekWithWork, 'MMM d')}
                    </AnimatedButton>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    <AnimatedText 
                      text="Jump to nearest week with work orders"
                      animationType="fade"
                      delay={0.8}
                    />
                  </div>
                </div>
              )}

              {/* Week Navigation */}
              <div className="flex flex-col items-center gap-3 pt-4">
                <div className="flex items-center gap-2">
                  <MagneticButton
                    onClick={handlePreviousWeek}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous Week
                  </MagneticButton>
                  
                  <div className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg border shadow-sm">
                    <span className="text-sm font-medium">Week of {weekStart}</span>
                  </div>
                  
                  <MagneticButton
                    onClick={handleNextWeek}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
                  >
                    Next Week
                    <ArrowRight className="h-4 w-4" />
                  </MagneticButton>
                </div>
                
                {/* Date range display */}
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <AnimatedText 
                    text={`Monday ${weekStart} - Sunday ${weekEnd}`}
                    animationType="fade"
                    delay={0.6}
                  />
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Side Panel - How It Works */}
        <div className="space-y-4">
          {/* Quick Start Guide */}
          <AnimatedCard className="p-6 hover:shadow-lg transition-all duration-300">
            <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 animate-pulse" />
              <AnimatedText text="Quick Start Guide" animationType="fade" />
            </h4>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3 group">
                <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold shadow-sm group-hover:scale-110 transition-transform">1</span>
                <div className="group-hover:translate-x-1 transition-transform">
                  <p className="font-medium">Check Work Orders</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Ensure you have work orders scheduled for the selected week</p>
                </div>
              </li>
              <li className="flex gap-3 group">
                <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold shadow-sm group-hover:scale-110 transition-transform">2</span>
                <div className="group-hover:translate-x-1 transition-transform">
                  <p className="font-medium">Verify Dispenser Data</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Make sure dispenser information is up to date</p>
                </div>
              </li>
              <li className="flex gap-3 group">
                <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-bold shadow-sm group-hover:scale-110 transition-transform">3</span>
                <div className="group-hover:translate-x-1 transition-transform">
                  <p className="font-medium">Automatic Calculation</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Filters are calculated instantly when data is available</p>
                </div>
              </li>
            </ol>
          </AnimatedCard>

          {/* Filter Info */}
          <AnimatedCard className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600 animate-pulse" />
              <AnimatedText text="About Filter Calculations" animationType="fade" />
            </h4>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-start gap-3 group">
                <span className="text-blue-600 mt-1 group-hover:scale-125 transition-transform">•</span>
                <span className="group-hover:translate-x-1 transition-transform">Calculated based on fuel grades at each dispenser</span>
              </div>
              <div className="flex items-start gap-3 group">
                <span className="text-blue-600 mt-1 group-hover:scale-125 transition-transform">•</span>
                <span className="group-hover:translate-x-1 transition-transform">Different part numbers for each store chain</span>
              </div>
              <div className="flex items-start gap-3 group">
                <span className="text-blue-600 mt-1 group-hover:scale-125 transition-transform">•</span>
                <span className="group-hover:translate-x-1 transition-transform">12 filters per standard box, 6 for DEF filters</span>
              </div>
              <div className="flex items-start gap-3 group">
                <span className="text-blue-600 mt-1 group-hover:scale-125 transition-transform">•</span>
                <span className="group-hover:translate-x-1 transition-transform">Smart logic for Premium vs Super/Ultra grades</span>
              </div>
            </div>
          </AnimatedCard>

          {/* Common Issues */}
          <AnimatedCard className="p-6 hover:shadow-lg transition-all duration-300">
            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 animate-bounce" />
              <AnimatedText text="Common Reasons for No Data" animationType="fade" />
            </h4>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors group">
                <span className="text-yellow-600 mt-0.5 font-bold group-hover:scale-110 transition-transform">1.</span>
                <span className="group-hover:translate-x-1 transition-transform">No work orders scheduled for this week</span>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors group">
                <span className="text-yellow-600 mt-0.5 font-bold group-hover:scale-110 transition-transform">2.</span>
                <span className="group-hover:translate-x-1 transition-transform">Work orders not synced from WorkFossa yet</span>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors group">
                <span className="text-yellow-600 mt-0.5 font-bold group-hover:scale-110 transition-transform">3.</span>
                <span className="group-hover:translate-x-1 transition-transform">Selected week is too far in the future</span>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors group">
                <span className="text-yellow-600 mt-0.5 font-bold group-hover:scale-110 transition-transform">4.</span>
                <span className="group-hover:translate-x-1 transition-transform">Dispenser data needs to be updated</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-yellow-600 mt-0.5 animate-bounce" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Tip:</strong> Try selecting a different week or refresh your work order data.
                </p>
              </div>
            </div>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}