import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, TrendingUp } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isThisWeek } from 'date-fns';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AnimatedText } from '../ui/animated-text';
import { RippleButton, MagneticButton } from '../ui/animated-button';
import { cn } from '../../lib/utils';

interface DateSelectorProps {
  selectedWeek: Date;
  onWeekChange: (date: Date) => void;
  workOrderCount: number;
  totalFilters: number;
  workDays?: number[];
}

export default function DateSelector({ 
  selectedWeek, 
  onWeekChange, 
  workOrderCount,
  totalFilters,
  workDays = [1, 2, 3, 4, 5] // Default to Monday-Friday
}: DateSelectorProps) {
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
  const isCurrentWeek = isThisWeek(selectedWeek, { weekStartsOn: 1 });

  const handlePreviousWeek = () => {
    onWeekChange(subWeeks(selectedWeek, 1));
  };

  const handleNextWeek = () => {
    onWeekChange(addWeeks(selectedWeek, 1));
  };

  const handleCurrentWeek = () => {
    onWeekChange(new Date());
  };

  return (
    <Card className="p-4 border-2 border-dashed border-muted hover:border-primary/20 transition-all duration-300 hover:shadow-lg bg-gradient-to-r from-background via-background to-muted/10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MagneticButton
              variant="outline"
              size="icon"
              onClick={handlePreviousWeek}
              className="h-10 w-10 hover:scale-110 transition-all group"
            >
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </MagneticButton>
            
            <div className="text-center min-w-[200px] group">
              <div className="font-semibold text-lg group-hover:scale-105 transition-transform">
                <AnimatedText 
                  text={`${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`}
                  animationType="fade"
                />
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Week {format(selectedWeek, 'w')} of {format(selectedWeek, 'yyyy')}
              </div>
              {/* Show work week indicator if not using standard Mon-Fri */}
              {JSON.stringify(workDays) !== JSON.stringify([1, 2, 3, 4, 5]) && (
                <div className="text-xs text-muted-foreground mt-1">
                  Work Days: {workDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                </div>
              )}
            </div>
            
            <MagneticButton
              variant="outline"
              size="icon"
              onClick={handleNextWeek}
              className="h-10 w-10 hover:scale-110 transition-all group"
            >
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </MagneticButton>
          </div>

          {!isCurrentWeek && (
            <RippleButton
              variant="outline"
              size="sm"
              onClick={handleCurrentWeek}
              className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 dark:hover:bg-blue-900/20"
            >
              <Calendar className="h-4 w-4" />
              Current Week
            </RippleButton>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Badge 
            variant="secondary" 
            className={cn(
              "px-3 py-1.5 transition-all hover:scale-105",
              workOrderCount > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : ""
            )}
          >
            <span className="text-xs text-muted-foreground mr-1">Jobs:</span>
            <span className="font-bold">{workOrderCount}</span>
          </Badge>
          
          <Badge 
            variant="secondary" 
            className={cn(
              "px-3 py-1.5 transition-all hover:scale-105",
              totalFilters > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" : ""
            )}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            <span className="text-xs text-muted-foreground mr-1">Filters:</span>
            <span className="font-bold">{totalFilters}</span>
          </Badge>

          {isCurrentWeek && (
            <Badge className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg animate-pulse">
              <Calendar className="h-3 w-3 mr-1" />
              Current Week
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}