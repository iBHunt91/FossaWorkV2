import React, { useState } from 'react';
import { Table, Edit2, Check, X, ChevronDown, ChevronUp, ExternalLink, Undo, Filter, Calendar, MapPin, AlertTriangle, Fuel, Droplet } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { FilterDetail } from '../../types/filters';
import { cn } from '../../lib/utils';
import { cleanSiteName } from '../../utils/storeColors';
import { AnimatedText } from '../ui/animated-text';
import { RippleButton } from '../ui/animated-button';
import { AnimatedCard } from '../ui/animated-card';
import { DispenserInfoModal } from '../DispenserInfoModal';

interface FilterDetailsPanelProps {
  filterDetails: FilterDetail[];
  editedValues: Record<string, number>;
  onEdit: (jobId: string, filterType: string, value: number) => void;
  onRevert: (jobId: string, filterType: string) => void;
}

export default function FilterDetailsPanel({
  filterDetails,
  editedValues,
  onEdit,
  onRevert
}: FilterDetailsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'store' | 'jobId'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [isDispenserModalOpen, setIsDispenserModalOpen] = useState(false);

  const itemsPerPage = 10;

  // Sort details
  const sortedDetails = [...filterDetails].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        break;
      case 'store':
        comparison = a.storeName.localeCompare(b.storeName);
        break;
      case 'jobId':
        comparison = a.jobId.localeCompare(b.jobId);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Paginate
  const totalPages = Math.ceil(sortedDetails.length / itemsPerPage);
  const paginatedDetails = sortedDetails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: 'date' | 'store' | 'jobId') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const startEdit = (jobId: string, partNumber: string, currentValue: number) => {
    setEditingCell(`${jobId}-${partNumber}`);
    setTempValue(currentValue.toString());
  };

  const confirmEdit = (jobId: string, partNumber: string) => {
    const value = parseInt(tempValue);
    if (!isNaN(value) && value >= 0) {
      onEdit(jobId, partNumber, value);
    }
    setEditingCell(null);
    setTempValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setTempValue('');
  };

  const isEdited = (jobId: string, partNumber: string) => {
    return editedValues[`${jobId}-${partNumber}`] !== undefined;
  };

  return (
    <>
      <AnimatedCard className="overflow-hidden">
      <div 
        className="p-4 border-b cursor-pointer hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent transition-all duration-300 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Table className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              <AnimatedText text="Filter Details" animationType="fade" />
            </h3>
            <Badge 
              variant="secondary" 
              className="group-hover:scale-105 transition-transform bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 dark:from-green-900/20 dark:to-emerald-900/20 dark:text-green-300"
            >
              <Filter className="h-3 w-3 mr-1" />
              {filterDetails.length} Jobs
            </Badge>
          </div>
          <div className="transition-transform group-hover:scale-110">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Sort Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sort by:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('date')}
                className={cn(sortBy === 'date' && 'font-semibold')}
              >
                Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('store')}
                className={cn(sortBy === 'store' && 'font-semibold')}
              >
                Store {sortBy === 'store' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('jobId')}
                className={cn(sortBy === 'jobId' && 'font-semibold')}
              >
                Job ID {sortBy === 'jobId' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Button>
            </div>
          </div>

          {/* Enhanced Details Table - Better Width Utilization */}
          <div className="overflow-x-auto bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Visit #
                    </div>
                  </th>
                  <th className="text-left p-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Store Details
                    </div>
                  </th>
                  <th className="text-left p-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Scheduled Date
                    </div>
                  </th>
                  <th className="text-center p-3 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filter Requirements
                    </div>
                  </th>
                  <th className="text-center p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDetails.map((detail, index) => {
                  // Extract visit number from jobId (format: W-123456 -> 123456)
                  const visitNumber = detail.jobId.replace(/^W-/, '');
                  const scheduledDate = new Date(detail.scheduledDate);
                  const dayOfWeek = format(scheduledDate, 'EEE'); // Mon, Tue, etc.
                  
                  return (
                    <tr 
                      key={detail.jobId} 
                      className="border-b hover:bg-muted/50 transition-colors group"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="font-mono font-bold bg-gradient-to-r from-primary/10 to-primary/20 border-primary/30 text-primary hover:bg-primary/20"
                          >
                            #{visitNumber}
                          </Badge>
                          {detail.warnings && detail.warnings.length > 0 && (
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {cleanSiteName(detail.storeName)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              Store #{detail.storeNumber.replace(/^#/, '')}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(scheduledDate, 'MM/dd/yy')}
                          </div>
                          <Badge 
                            variant="outline" 
                            className="text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                          >
                            {dayOfWeek}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(detail.filters).map(([partNumber, filter]) => {
                            // Determine color scheme based on filter type
                            let bgGradient = "from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700";
                            let borderColor = "border-gray-300 dark:border-gray-600";
                            let iconColor = "text-gray-600 dark:text-gray-400";
                            
                            if (filter.filterType === 'gas') {
                              bgGradient = "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20";
                              borderColor = "border-blue-300 dark:border-blue-600";
                              iconColor = "text-blue-600 dark:text-blue-400";
                            } else if (filter.filterType === 'diesel') {
                              bgGradient = "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20";
                              borderColor = "border-green-300 dark:border-green-600";
                              iconColor = "text-green-600 dark:text-green-400";
                            } else if (filter.filterType === 'def') {
                              bgGradient = "from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20";
                              borderColor = "border-cyan-300 dark:border-cyan-600";
                              iconColor = "text-cyan-600 dark:text-cyan-400";
                            }
                            
                            return (
                              <div key={partNumber} className={`inline-flex items-center gap-2 bg-gradient-to-r ${bgGradient} px-3 py-2 rounded-lg border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                    {partNumber}
                                  </span>
                                  <span className={`text-xs font-medium ${iconColor} uppercase tracking-wider`}>
                                    {filter.filterType}
                                  </span>
                                </div>
                                {editingCell === `${detail.jobId}-${partNumber}` ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={tempValue}
                                      onChange={(e) => setTempValue(e.target.value)}
                                      className="w-14 h-7 text-sm"
                                      min="0"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmEdit(detail.jobId, partNumber);
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => confirmEdit(detail.jobId, partNumber)}
                                    >
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={cancelEdit}
                                    >
                                      <X className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className={cn(
                                        "font-bold text-lg",
                                        isEdited(detail.jobId, partNumber) ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-white"
                                      )}>
                                        {editedValues[`${detail.jobId}-${partNumber}`] ?? filter.quantity}
                                      </span>
                                      {isEdited(detail.jobId, partNumber) && (
                                        <Check className="h-3 w-3 text-green-600" />
                                      )}
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => startEdit(detail.jobId, partNumber, filter.quantity)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {detail.warnings && detail.warnings.length > 0 && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {detail.warnings.length} warning{detail.warnings.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {Object.keys(detail.filters).some(pn => isEdited(detail.jobId, pn)) && (
                            <RippleButton
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                Object.keys(detail.filters).forEach(pn => {
                                  if (isEdited(detail.jobId, pn)) {
                                    onRevert(detail.jobId, pn);
                                  }
                                });
                              }}
                              className="h-8 w-8 hover:bg-yellow-100 hover:text-yellow-600"
                              title="Revert all changes"
                            >
                              <Undo className="h-3 w-3" />
                            </RippleButton>
                          )}
                          <RippleButton
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedWorkOrderId(detail.jobId);
                              setIsDispenserModalOpen(true);
                            }}
                            className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600"
                            title="View dispensers"
                          >
                            <Fuel className="h-3 w-3" />
                          </RippleButton>
                          <RippleButton
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              // Handle view work order details
                            }}
                            className="h-8 w-8 hover:bg-green-100 hover:text-green-600"
                            title="View work order details"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </RippleButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filterDetails.length)} of {filterDetails.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && <span>...</span>}
                        <Button
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </AnimatedCard>

      {/* Dispenser Info Modal */}
      <DispenserInfoModal
      isOpen={isDispenserModalOpen}
      onClose={() => {
        setIsDispenserModalOpen(false);
        setSelectedWorkOrderId(null);
      }}
      dispenserData={selectedWorkOrderId && filterDetails.find(d => d.jobId === selectedWorkOrderId) ? (() => {
        const detail = filterDetails.find(d => d.jobId === selectedWorkOrderId);
        console.log('[FilterDetailsPanel] Opening modal with data:', {
          jobId: selectedWorkOrderId,
          filters: detail?.filters,
          dispensers: detail?.dispensers,
          detail: detail
        });
        return {
          workOrder: {
          id: selectedWorkOrderId,
          external_id: selectedWorkOrderId,
          storeNumber: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.storeNumber || '',
          storeName: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.storeName || '',
          customerName: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.customerName || '',
          address: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.address || '',
          serviceCode: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.serviceCode || '',
          serviceName: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.serviceName || '',
          scheduledDate: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.scheduledDate || '',
          site_name: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.storeName || ''
        },
        dispensers: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.dispensers || [],
        filters: filterDetails.find(d => d.jobId === selectedWorkOrderId)?.filters || {}
      };
      })() : null}
    />
    </>
  );
}