import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertCircle, RefreshCw, ClipboardList, Database, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { format } from 'date-fns';

interface NoDispensersStateProps {
  workOrderCount: number;
  selectedWeek: Date;
  onRefresh: () => void;
}

export default function NoDispensersState({ workOrderCount, selectedWeek, onRefresh }: NoDispensersStateProps) {
  const navigate = useNavigate();
  
  const handleNavigateToWorkOrders = () => {
    navigate('/work-orders');
  };

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
        <Database className="h-4 w-4 text-orange-600" />
        <AlertTitle>Dispenser Data Required</AlertTitle>
        <AlertDescription>
          Found {workOrderCount} work order{workOrderCount !== 1 ? 's' : ''} for this week, but dispenser information hasn't been scraped yet. 
          Filter calculations require dispenser data to determine fuel grades and filter requirements.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Action Card */}
        <Card className="lg:col-span-2 p-8">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-400/20 dark:bg-orange-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/50 dark:to-yellow-900/50 p-6 rounded-full">
                  <Database className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Dispenser Data Needed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                To calculate filter requirements, we need dispenser information including fuel grades and equipment details.
              </p>
            </div>

            {/* Work Order Summary */}
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    Work Orders Found: {workOrderCount}
                  </span>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  Week of {format(selectedWeek, 'MMM d')}
                </Badge>
              </div>
            </Card>

            {/* Primary Action */}
            <div className="pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Next Step: Scrape Dispenser Data
              </h4>
              
              <Button
                onClick={handleNavigateToWorkOrders}
                variant="default"
                size="lg"
                className="flex items-center justify-center gap-2"
              >
                <ClipboardList className="h-5 w-5" />
                Go to Work Orders
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              <p className="text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                Navigate to the Work Orders page and click "Scrape Dispensers" to fetch the required dispenser data
              </p>
            </div>
          </div>
        </Card>

        {/* Side Panel - Information */}
        <div className="space-y-4">
          {/* What is Dispenser Data */}
          <Card className="p-6">
            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              What is Dispenser Data?
            </h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>Equipment make and model</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>Fuel grades available (Regular, Plus, Premium, Diesel)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>Number of dispensers at each location</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>Special equipment (DEF, high-flow diesel)</span>
              </li>
            </ul>
          </Card>

          {/* Why It's Needed */}
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Why It's Required
            </h4>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>Filter calculations depend on:</p>
              <ul className="space-y-1 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">1.</span>
                  <span>Fuel grade configuration at each dispenser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">2.</span>
                  <span>Store chain-specific part numbers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">3.</span>
                  <span>Equipment type for proper filter selection</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}