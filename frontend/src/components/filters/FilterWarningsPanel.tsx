import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Info, AlertCircle, XCircle, Shield, Zap, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FilterWarning } from '../../types/filters';
import { cn } from '../../lib/utils';
import { AnimatedText } from '../ui/animated-text';
import { RippleButton, AnimatedButton } from '../ui/animated-button';
import { AnimatedCard } from '../ui/animated-card';

interface FilterWarningsPanelProps {
  warnings: FilterWarning[];
  onWarningClick?: (warning: FilterWarning) => void;
}

export default function FilterWarningsPanel({ warnings, onWarningClick }: FilterWarningsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');


  // Group warnings by message and combine affected jobs
  const groupedWarnings = warnings.reduce((acc, warning) => {
    const key = `${warning.type}-${warning.message}`;
    if (acc[key]) {
      // Combine affected jobs and use highest severity
      const combinedJobs = [...acc[key].affectedJobs, ...warning.affectedJobs];
      acc[key] = {
        ...acc[key],
        affectedJobs: [...new Set(combinedJobs)], // Remove duplicates
        severity: Math.max(acc[key].severity, warning.severity),
        timestamp: warning.timestamp // Keep latest timestamp
      };
    } else {
      acc[key] = { 
        ...warning,
        affectedJobs: [...warning.affectedJobs] // Ensure we have a copy of the array
      };
    }
    return acc;
  }, {} as Record<string, FilterWarning>);


  const groupedWarningsArray = Object.values(groupedWarnings);

  // Group warnings by severity
  const highSeverity = groupedWarningsArray.filter(w => w.severity >= 7);
  const mediumSeverity = groupedWarningsArray.filter(w => w.severity >= 4 && w.severity < 7);
  const lowSeverity = groupedWarningsArray.filter(w => w.severity < 4);

  // Filter warnings based on selection
  const filteredWarnings = selectedSeverity === 'all' ? groupedWarningsArray :
    selectedSeverity === 'high' ? highSeverity :
    selectedSeverity === 'medium' ? mediumSeverity :
    lowSeverity;

  const getSeverityIcon = (severity: number) => {
    if (severity >= 7) return <XCircle className="h-4 w-4 text-red-500" />;
    if (severity >= 4) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    if (severity >= 4) return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
  };

  const getWarningTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'missing_data': 'Missing Data',
      'unknown_grade': 'Unknown Fuel Grade',
      'multi_day': 'Multi-Day Job',
      'calculation_error': 'Calculation Error',
      'config_issue': 'Configuration Issue'
    };
    return labels[type] || type;
  };

  return (
    <AnimatedCard className="overflow-hidden">
      <div 
        className="p-4 border-b cursor-pointer hover:bg-gradient-to-r hover:from-yellow-50/50 hover:to-red-50/50 dark:hover:from-yellow-900/10 dark:hover:to-red-900/10 transition-all duration-300 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <AlertTriangle className="h-5 w-5 text-yellow-500 group-hover:scale-110 transition-transform" />
              {warnings.length > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <h3 className="font-semibold group-hover:text-yellow-600 transition-colors">
              <AnimatedText text="Warnings & Issues" animationType="fade" />
            </h3>
            <div className="flex items-center gap-2">
              {highSeverity.length > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  <XCircle className="h-3 w-3 mr-1" />
                  {highSeverity.length} High
                </Badge>
              )}
              {mediumSeverity.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {mediumSeverity.length} Medium
                </Badge>
              )}
              {lowSeverity.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                  <Info className="h-3 w-3 mr-1" />
                  {lowSeverity.length} Low
                </Badge>
              )}
            </div>
          </div>
          <div className="transition-transform group-hover:scale-110">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Severity Filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <AnimatedText 
                text="Filter by Severity:"
                className="text-sm font-medium text-muted-foreground"
                animationType="fade"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <RippleButton
                variant={selectedSeverity === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity('all')}
                className="transition-all hover:scale-105"
              >
                All ({groupedWarningsArray.length})
              </RippleButton>
              <RippleButton
                variant={selectedSeverity === 'high' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity('high')}
                className={cn(
                  "transition-all hover:scale-105",
                  selectedSeverity !== 'high' && 'hover:border-red-500 hover:text-red-600'
                )}
              >
                <XCircle className="h-3 w-3 mr-1" />
                High ({highSeverity.length})
              </RippleButton>
              <RippleButton
                variant={selectedSeverity === 'medium' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity('medium')}
                className={cn(
                  "transition-all hover:scale-105",
                  selectedSeverity === 'medium' && 'bg-yellow-500 hover:bg-yellow-600',
                  selectedSeverity !== 'medium' && 'hover:border-yellow-500 hover:text-yellow-600'
                )}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                Medium ({mediumSeverity.length})
              </RippleButton>
              <RippleButton
                variant={selectedSeverity === 'low' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity('low')}
                className={cn(
                  "transition-all hover:scale-105",
                  selectedSeverity === 'low' && 'bg-blue-500 hover:bg-blue-600',
                  selectedSeverity !== 'low' && 'hover:border-blue-500 hover:text-blue-600'
                )}
              >
                <Info className="h-3 w-3 mr-1" />
                Low ({lowSeverity.length})
              </RippleButton>
            </div>
          </div>

          {/* Warnings List */}
          {filteredWarnings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
              <AnimatedText 
                text="No warnings to display"
                className="text-muted-foreground text-lg"
                animationType="fade"
              />
              <AnimatedText 
                text="All systems are running smoothly!"
                className="text-sm text-muted-foreground"
                animationType="fade"
                delay={0.2}
              />
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredWarnings.map((warning, index) => (
                <div
                  key={warning.id}
                  className={cn(
                    "group p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md",
                    getSeverityColor(warning.severity),
                    "hover:border-opacity-80"
                  )}
                  onClick={() => onWarningClick?.(warning)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Enhanced Layout - Better Width Utilization */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Section - Warning Details */}
                    <div className="lg:col-span-8 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 group-hover:scale-110 transition-transform">
                          {getSeverityIcon(warning.severity)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge 
                              variant="outline" 
                              className="text-xs group-hover:scale-105 transition-transform"
                            >
                              {getWarningTypeLabel(warning.type)}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                'text-xs',
                                warning.severity >= 7 && 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300',
                                warning.severity >= 4 && warning.severity < 7 && 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300',
                                warning.severity < 4 && 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300'
                              )}
                            >
                              Severity: {warning.severity}/10
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(warning.timestamp).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="text-sm font-medium group-hover:text-foreground transition-colors">
                            {warning.message}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Section - Affected Visits */}
                    <div className="lg:col-span-4 space-y-3">
                      <div className="bg-muted/20 p-3 rounded-lg border border-dashed">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                          <Zap className="h-3 w-3" />
                          Affected Visits ({warning.affectedJobs?.length || 0})
                        </div>
                        {warning.affectedJobs && warning.affectedJobs.length > 0 ? (
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {warning.affectedJobs.slice(0, 6).map((jobId, idx) => (
                              <div key={idx} className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border font-mono">
                                Visit #{jobId.replace(/^W-/, '')}
                              </div>
                            ))}
                            {warning.affectedJobs.length > 6 && (
                              <div className="text-xs text-center text-muted-foreground pt-1">
                                +{warning.affectedJobs.length - 6} more visits
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            No visits affected or data unavailable
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Simplified Summary */}
          {groupedWarningsArray.length > 0 && (
            <div className="pt-4 border-t border-dashed">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Total Warnings
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                    {groupedWarningsArray.length}
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Zap className="h-4 w-4" />
                    Visits Affected
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                    {new Set(groupedWarningsArray.flatMap(w => w.affectedJobs)).size}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <XCircle className="h-4 w-4" />
                    Critical Issues
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    {highSeverity.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatedCard>
  );
}