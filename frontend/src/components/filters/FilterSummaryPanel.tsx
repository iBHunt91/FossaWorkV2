import React, { useState } from 'react';
import { Package, Filter, ChevronDown, ChevronUp, Download, TrendingUp, BarChart3, Target } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FilterSummary } from '../../types/filters';
import { cn } from '../../lib/utils';
import { AnimatedText } from '../ui/animated-text';
import { RippleButton, AnimatedButton } from '../ui/animated-button';
import { AnimatedCard } from '../ui/animated-card';

interface FilterSummaryPanelProps {
  filterSummary: FilterSummary[];
  onFilterTypeChange: (type: string) => void;
  selectedFilterType: string;
}

export default function FilterSummaryPanel({
  filterSummary,
  onFilterTypeChange,
  selectedFilterType
}: FilterSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'quantity' | 'partNumber'>('quantity');

  // Sort filters
  const sortedFilters = [...filterSummary].sort((a, b) => {
    if (sortBy === 'quantity') {
      return b.quantity - a.quantity;
    }
    return a.partNumber.localeCompare(b.partNumber);
  });

  // Filter types for quick selection
  const filterTypes = [
    { value: 'all', label: 'All Filters', color: 'bg-gray-500' },
    { value: 'gas', label: 'Gas Filters', color: 'bg-blue-500' },
    { value: 'diesel', label: 'Diesel Filters', color: 'bg-green-500' }
  ];

  const handleExportSummary = () => {
    const csvContent = [
      ['Part Number', 'Description', 'Quantity', 'Boxes Needed', 'Stores Affected'],
      ...sortedFilters.map(filter => [
        filter.partNumber,
        filter.description,
        filter.quantity,
        filter.boxes,
        filter.storeCount
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filter-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatedCard className="overflow-hidden">
      <div 
        className="p-4 border-b cursor-pointer hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent transition-all duration-300 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Package className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            </div>
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              <AnimatedText text="Filter Summary" animationType="fade" />
            </h3>
            <Badge 
              variant="secondary" 
              className="group-hover:scale-105 transition-transform bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-300"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              {filterSummary.length} Types
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <RippleButton
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleExportSummary();
              }}
              className="hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/20"
            >
              <Download className="h-4 w-4" />
            </RippleButton>
            <div className="transition-transform group-hover:scale-110">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Filter Type Selector */}
          <div className="space-y-2">
            <AnimatedText 
              text="Filter by Type:"
              className="text-sm font-medium text-muted-foreground"
              animationType="fade"
            />
            <div className="flex flex-wrap gap-2">
              {filterTypes.map((type, index) => (
                <RippleButton
                  key={type.value}
                  variant={selectedFilterType === type.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onFilterTypeChange(type.value)}
                  className={cn(
                    "flex items-center gap-2 transition-all",
                    selectedFilterType === type.value && "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={cn('w-3 h-3 rounded-full transition-all', type.color, 'group-hover:scale-125')} />
                  {type.label}
                </RippleButton>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Sort by:
            </span>
            <div className="flex gap-1">
              <AnimatedButton
                variant={sortBy === 'quantity' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSortBy('quantity')}
                className={cn(
                  "transition-all",
                  sortBy === 'quantity' && "bg-gradient-to-r from-green-500 to-emerald-500"
                )}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Quantity
              </AnimatedButton>
            </div>
          </div>

          {/* Filter List */}
          <div className="space-y-3">
            {sortedFilters.map((filter, index) => (
              <div 
                key={filter.partNumber}
                className="group flex items-center justify-between p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg hover:from-muted/60 hover:to-muted/80 transition-all duration-300 hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-primary/20"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-lg group-hover:text-primary transition-colors">
                      {filter.partNumber}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs font-semibold transition-all group-hover:scale-105',
                        filter.filterType === 'gas' && 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20',
                        filter.filterType === 'diesel' && 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20',
                        filter.filterType === 'def' && 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      )}
                    >
                      {filter.filterType.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Target className="h-3 w-3" />
                    Used by <span className="font-semibold">{filter.storeCount}</span> store{filter.storeCount !== 1 ? 's' : ''}
                  </div>
                </div>
                
                <div className="text-right space-y-1">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                    {filter.quantity}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {filter.boxes} box{filter.boxes !== 1 ? 'es' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </AnimatedCard>
  );
}