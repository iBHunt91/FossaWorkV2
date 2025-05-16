import React, { useState, useEffect, useRef } from 'react';
import { FiCalendar, FiChevronDown, FiChevronUp, FiAlertCircle, FiPlusCircle, FiArrowRight, FiRefreshCw, FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiClock, FiList, FiArchive, FiFile, FiTrash2, FiEye, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { ENDPOINTS } from '../config/api';

interface ChangeRecord {
  timestamp: string;
  changes: {
    critical?: ChangeItem[];
    high?: ChangeItem[];
    medium?: ChangeItem[];
    low?: ChangeItem[];
    allChanges?: ChangeItem[];
    summary: {
      removed: number;
      added: number;
      modified: number;
      swapped?: number;
    };
  };
}

// Legacy interface maintained for backward compatibility
interface ChangeHistory {
  date: string;
  timestamp?: number;
  id?: string; // Add optional ID field for deletion
  hidden?: boolean; // Add flag to hide entries client-side
  changes: {
    critical: ChangeItem[];
    high: ChangeItem[];
    medium: ChangeItem[];
    low: ChangeItem[];
    allChanges?: ChangeItem[];
    summary: {
      removed: number;
      added: number;
      modified: number;
      swapped?: number;
    };
  };
}

interface ChangeItem {
  type: string;
  jobId?: string;
  store?: string;
  storeName?: string;
  date?: string;
  dispensers?: number;
  oldDate?: string;
  newDate?: string;
  removedJobId?: string;
  removedStore?: string;
  removedStoreName?: string;
  removedDispensers?: number;
  addedJobId?: string;
  addedStore?: string;
  addedStoreName?: string;
  addedDispensers?: number;
}

interface ScheduleArchive {
  id: string;
  date: string;
  timestamp: number;
  format?: 'json' | 'txt';
}

interface ArchiveContent {
  id: string;
  content: string;
  summary: {
    removed: number;
    added: number;
    modified: number;
  };
  changes: {
    critical: string[];
    high: string[];
  }
}

interface ArchiveItem {
  id: string;
  date: string;
  timestamp: number;
  format?: 'json' | 'txt';
  summary?: {
    removed: number;
    added: number;
    modified: number;
  };
}

const History: React.FC = () => {
  // Active view tabs - simplified to only 'changes'
  const [activeTab, setActiveTab] = useState<'changes'>('changes');
  
  // Live changes states
  const [historyData, setHistoryData] = useState<ChangeHistory[]>([]);
  const [filteredData, setFilteredData] = useState<ChangeHistory[]>([]);
  const [paginatedData, setPaginatedData] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Add state for success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Common states
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: '',
    end: ''
  });
  const [severityFilter, setSeverityFilter] = useState<{
    critical: boolean,
    high: boolean,
    medium: boolean,
    low: boolean
  }>({
    critical: true,
    high: true,
    medium: true,
    low: true
  });
  const [changeTypeFilter, setChangeTypeFilter] = useState<{
    removed: boolean,
    added: boolean,
    modified: boolean
  }>({
    removed: true,
    added: true,
    modified: true
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  });

  // Add state for grouping option
  const [groupingOption, setGroupingOption] = useState<'day' | 'week' | 'month' | 'none'>('day');

  // Use refs to track loading state to prevent race conditions
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Add state for component error
  const [componentError, setComponentError] = useState<string | null>(null);

  // Add a polling interval state to control auto-refresh
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(true);
  const [pollingInterval, setPollingInterval] = useState<number>(30000); // 30 seconds default
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for expanded days
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [dateJumpValue, setDateJumpValue] = useState<string>('');
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Use this to ensure we don't update state after component unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Add useEffect for polling logic
  useEffect(() => {
    // Set up polling interval for auto-refresh if enabled
    if (pollingEnabled) {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Set new interval
      pollingIntervalRef.current = setInterval(() => {
        console.log('Auto-refreshing history data...');
        fetchHistoryData();
      }, pollingInterval);
      
      // Clean up on unmount
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    } else if (pollingIntervalRef.current) {
      // If polling is disabled but interval exists, clear it
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [pollingEnabled, pollingInterval]);

  useEffect(() => {
    // Clear expandedDays when grouping option changes
    setExpandedDays({});
  }, [groupingOption]);

  // Add a function to group history data by date
  const groupHistoryData = (historyData: ChangeHistory[]): { date: string, entries: ChangeHistory[] }[] => {
    if (!Array.isArray(historyData) || historyData.length === 0) {
      return [];
    }
    
    // If grouping is disabled, return each entry as its own "group"
    if (groupingOption === 'none') {
      return historyData.map(entry => ({
        date: entry.date,
        entries: [entry]
      }));
    }
    
    // Create a map to group entries
    const groupedMap = new Map<string, ChangeHistory[]>();
    
    historyData.forEach(entry => {
      if (!entry || !entry.date) {
        return; // Skip entries without date
      }
      
      const entryDate = entry.timestamp ? new Date(entry.timestamp) : new Date(entry.date);
      let dateKey: string;
      
      if (groupingOption === 'day') {
        // Group by day (format: "Jan 1")
        dateKey = entryDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      } else if (groupingOption === 'week') {
        // Group by week (format: "Week of Jan 1")
        // Find the start of the week (Sunday)
        const startOfWeek = new Date(entryDate);
        startOfWeek.setDate(entryDate.getDate() - entryDate.getDay());
        dateKey = `Week of ${startOfWeek.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })}`;
      } else if (groupingOption === 'month') {
        // Group by month (format: "January 2025")
        dateKey = entryDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
      } else {
        // Fallback to day grouping
        dateKey = entryDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
      
      if (!groupedMap.has(dateKey)) {
        groupedMap.set(dateKey, []);
      }
      
      groupedMap.get(dateKey)?.push(entry);
    });
    
    // Convert map to array and sort by date (newest first)
    return Array.from(groupedMap.entries()).map(([date, entries]) => ({
      date,
      entries
    })).sort((a, b) => {
      if (!a.entries.length || !b.entries.length) {
        return 0; // Handle empty entries arrays
      }
      
      // Use the timestamp from the first entry in each group for sorting
      const timestampA = a.entries[0]?.timestamp || new Date(a.entries[0].date).getTime();
      const timestampB = b.entries[0]?.timestamp || new Date(b.entries[0].date).getTime();
      return timestampB - timestampA;
    });
  };

  const fetchHistoryData = async () => {
    // Prevent multiple concurrent fetches
    if (isLoadingRef.current) {
      console.log('Skipping fetch - already loading data');
      return;
    }

    try {
      isLoadingRef.current = true;
      if (isMountedRef.current) setLoading(true);
      if (isMountedRef.current) setError(null);
      
      // Create a mapping from date/timestamp to server ID
      const archiveIdMap = new Map<string, string>();
      
      // First try to get data from the new consolidated change history endpoint
      const changeHistoryUrl = await ENDPOINTS.CHANGE_HISTORY();
      console.log('Fetching change history from:', changeHistoryUrl);
      const response = await fetch(changeHistoryUrl, {
        // Add cache-busting query param to ensure fresh data
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        // Process consolidated change history data
        const rawData = await response.json();
        console.log('Received change history data:', rawData);
        console.log('Data type:', typeof rawData, 'Is array:', Array.isArray(rawData), 'Length:', rawData.length);
        
        // Make sure we have valid data
        if (!Array.isArray(rawData)) {
          console.error('Expected an array but received:', typeof rawData);
          throw new Error('Invalid data format received from server');
        }
        
        if (rawData.length === 0) {
          console.log('Received empty array from server');
          if (isMountedRef.current) setHistoryData([]);
          if (isMountedRef.current) setLoading(false);
          isLoadingRef.current = false;
          return;
        }
        
        // Also fetch the schedule archives to get proper IDs
        try {
          const archivesUrl = await ENDPOINTS.SCHEDULE_ARCHIVES();
          const archivesResponse = await fetch(archivesUrl, {
            // Add cache-busting to ensure fresh data
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (archivesResponse.ok) {
            const archivesData = await archivesResponse.json();
            console.log('Available archives for ID mapping:', archivesData);
            
            if (Array.isArray(archivesData.archives)) {
              archivesData.archives.forEach((archive: any) => {
                if (archive.id) {
                  // Map by timestamp
                  if (archive.timestamp) {
                    archiveIdMap.set(archive.timestamp.toString(), archive.id);
                  }
                  
                  // Map by date
                  if (archive.date) {
                    archiveIdMap.set(archive.date, archive.id);
                  }
                }
              });
            }
            
            console.log('Created archive ID mapping:', Array.from(archiveIdMap.entries()));
            
            // Check if the data needs conversion
            // It should have a timestamp property for the consolidated format
            const needsConversion = rawData[0] && 'timestamp' in rawData[0];
            
            let formattedData;
            
            if (needsConversion) {
              console.log('Converting data from consolidated format');
              // Convert the consolidated format to the expected ChangeHistory format
              formattedData = rawData.map((record: ChangeRecord) => {
                // Format date from ISO timestamp
                const date = new Date(record.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                // Create a ChangeHistory object from the record
                const historyItem: ChangeHistory = {
                  date: formattedDate,
                  timestamp: new Date(record.timestamp).getTime(),
                  changes: {
                    critical: record.changes.critical || [],
                    high: record.changes.high || [],
                    medium: record.changes.medium || [],
                    low: record.changes.low || [],
                    summary: record.changes.summary
                  }
                };

                // Handle the newer allChanges format by distributing into severity categories
                if (record.changes.allChanges && Array.isArray(record.changes.allChanges)) {
                  console.log('Detected allChanges format, converting to severity-based format');
                  
                  // Ensure all severity arrays exist
                  historyItem.changes.critical = historyItem.changes.critical || [];
                  historyItem.changes.high = historyItem.changes.high || [];
                  historyItem.changes.medium = historyItem.changes.medium || [];
                  historyItem.changes.low = historyItem.changes.low || [];
                  
                  // Store the original allChanges array for reference
                  historyItem.changes.allChanges = record.changes.allChanges;
                  
                  // Categorize changes by type into severity categories
                  record.changes.allChanges.forEach((change: ChangeItem) => {
                    // Place removed changes in critical category
                    if (change.type === 'removed') {
                      historyItem.changes.critical.push(change);
                    } 
                    // Place added changes in high category
                    else if (change.type === 'added') {
                      historyItem.changes.high.push(change);
                    }
                    // Place modified, date_changed, or swap in medium category
                    else if (change.type === 'modified' || change.type === 'date_changed' || change.type === 'swap') {
                      historyItem.changes.medium.push(change);
                    }
                    // Place everything else in low category
                    else {
                      historyItem.changes.low.push(change);
                    }
                  });
                }
                
                // Add ID from archive mapping if available
                const timestampStr = new Date(record.timestamp).getTime().toString();
                if (archiveIdMap.has(timestampStr)) {
                  historyItem.id = archiveIdMap.get(timestampStr);
                }
                
                return historyItem;
              });
            } else {
              // Handle plain records that may use allChanges format
              formattedData = rawData.map((record: any) => {
                // Check for allChanges format and convert if needed
                if (record.changes && record.changes.allChanges && Array.isArray(record.changes.allChanges)) {
                  console.log('Converting record with allChanges format:', record.timestamp);
                  
                  // Create a copy that we can modify
                  const convertedRecord = {
                    ...record,
                    changes: {
                      critical: record.changes.critical || [],
                      high: record.changes.high || [],
                      medium: record.changes.medium || [],
                      low: record.changes.low || [],
                      // Keep the original allChanges for reference
                      allChanges: record.changes.allChanges,
                      summary: record.changes.summary || { removed: 0, added: 0, modified: 0 }
                    }
                  };
                  
                  // Categorize changes by type into severity categories
                  record.changes.allChanges.forEach((change: any) => {
                    // Place removed changes in critical category
                    if (change.type === 'removed') {
                      convertedRecord.changes.critical.push(change);
                    } 
                    // Place added changes in high category
                    else if (change.type === 'added') {
                      convertedRecord.changes.high.push(change);
                    }
                    // Place modified, date_changed, or swap in medium category
                    else if (change.type === 'modified' || change.type === 'date_changed' || change.type === 'swap') {
                      convertedRecord.changes.medium.push(change);
                    }
                    // Place everything else in low category
                    else {
                      convertedRecord.changes.low.push(change);
                    }
                  });
                  
                  return convertedRecord;
                }
                
                // Make sure the record has all the required arrays
                if (record.changes) {
                  return {
                    ...record,
                    changes: {
                      critical: record.changes.critical || [],
                      high: record.changes.high || [],
                      medium: record.changes.medium || [],
                      low: record.changes.low || [],
                      summary: record.changes.summary
                    }
                  };
                }
                
                // Return unchanged if already using the correct format
                return record;
              });
            }
            
            // Sort by date (newest first)
            formattedData.sort((a: ChangeHistory, b: ChangeHistory) => {
              // Use timestamp if available, otherwise parse from date
              const timeA = a.timestamp || new Date(a.date).getTime();
              const timeB = b.timestamp || new Date(b.date).getTime();
              return timeB - timeA;
            });
            
            if (isMountedRef.current) {
              setHistoryData(formattedData);
            }
          }
        } catch (error) {
          console.error('Error fetching archive mapping:', error);
          // Continue with main data even if mapping fails
        }
        
        // Still filter and paginate data
        if (isMountedRef.current) {
          filterData();
        }
      } else {
        throw new Error(`Failed to fetch change history: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching history data:', error);
      if (isMountedRef.current) setError('Failed to load history data. Please try again later.');
    } finally {
      if (isMountedRef.current) setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  useEffect(() => {
    // When historyData changes, apply filtering
    if (historyData.length > 0) {
      console.log('Filtering history data...');
      filterData();
    } else {
      setFilteredData([]);
      setPaginatedData([]);
    }
  }, [historyData, searchTerm, dateRange, severityFilter, changeTypeFilter]);
  
  // Replace the duplicate filterData implementation with the corrected version
  const filterData = () => {
    console.log('Filtering with criteria:', {
      searchTerm,
      dateRange,
      severityFilter,
      changeTypeFilter
    });
    
    try {
      let filtered = [...historyData];
      
      // Filter by date range
      if (dateRange.start || dateRange.end) {
        filtered = filtered.filter(entry => {
          const entryDate = entry.timestamp 
            ? new Date(entry.timestamp) 
            : new Date(entry.date);
          
          const startDate = dateRange.start ? new Date(dateRange.start) : new Date(0);
          // Set end date to end of the day
          const endDate = dateRange.end ? new Date(dateRange.end) : new Date(8640000000000000);
          if (dateRange.end) {
            endDate.setHours(23, 59, 59, 999);
          }
          
          return entryDate >= startDate && entryDate <= endDate;
        });
      }
      
      // Filter by search term
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(entry => {
          // Check if any of the changes match the search term
          const hasMatchInCritical = entry.changes.critical.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(lowerSearchTerm)) ||
            (change.store && change.store.toLowerCase().includes(lowerSearchTerm)) ||
            (change.storeName && change.storeName.toLowerCase().includes(lowerSearchTerm))
          );
          
          const hasMatchInHigh = entry.changes.high.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(lowerSearchTerm)) ||
            (change.store && change.store.toLowerCase().includes(lowerSearchTerm)) ||
            (change.storeName && change.storeName.toLowerCase().includes(lowerSearchTerm))
          );
          
          const hasMatchInMedium = entry.changes.medium.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(lowerSearchTerm)) ||
            (change.store && change.store.toLowerCase().includes(lowerSearchTerm)) ||
            (change.storeName && change.storeName.toLowerCase().includes(lowerSearchTerm))
          );
          
          const hasMatchInLow = entry.changes.low.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(lowerSearchTerm)) ||
            (change.store && change.store.toLowerCase().includes(lowerSearchTerm)) ||
            (change.storeName && change.storeName.toLowerCase().includes(lowerSearchTerm))
          );
          
          // Also check in allChanges if it exists
          const hasMatchInAllChanges = entry.changes.allChanges ? entry.changes.allChanges.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(lowerSearchTerm)) ||
            (change.store && change.store.toLowerCase().includes(lowerSearchTerm)) ||
            (change.storeName && change.storeName.toLowerCase().includes(lowerSearchTerm))
          ) : false;
          
          return hasMatchInCritical || hasMatchInHigh || hasMatchInMedium || hasMatchInLow || hasMatchInAllChanges;
        });
      }
      
      // Filter by severity
      if (!severityFilter.critical || !severityFilter.high || !severityFilter.medium || !severityFilter.low) {
        filtered = filtered.map(entry => {
          // Create a copy to avoid modifying the original
          const entryCopy = { ...entry };
          const changes = { ...entry.changes };
          
          // Only include selected severities
          if (!severityFilter.critical) {
            changes.critical = [];
          }
          if (!severityFilter.high) {
            changes.high = [];
          }
          if (!severityFilter.medium) {
            changes.medium = [];
          }
          if (!severityFilter.low) {
            changes.low = [];
          }
          
          // Also update allChanges to only include changes that match the severity filters
          if (changes.allChanges && Array.isArray(changes.allChanges)) {
            changes.allChanges = changes.allChanges.filter(change => {
              if (change.type === 'removed' && !severityFilter.critical) return false;
              if (change.type === 'added' && !severityFilter.high) return false;
              if ((change.type === 'modified' || change.type === 'date_changed') && !severityFilter.medium) return false;
              if (!['removed', 'added', 'modified', 'date_changed'].includes(change.type) && !severityFilter.low) return false;
              return true;
            });
          }
          
          entryCopy.changes = changes;
          return entryCopy;
        });
      }
      
      // Filter by change type
      if (!changeTypeFilter.removed || !changeTypeFilter.added || !changeTypeFilter.modified) {
        filtered = filtered.map(entry => {
          const entryCopy = { ...entry };
          
          // Helper function to filter changes by type
          const filterChangesByType = (changes: ChangeItem[]) => {
            return changes.filter(change => {
              // Skip changes that don't match type filters
              if (change.type === 'removed' && !changeTypeFilter.removed) return false;
              if (change.type === 'added' && !changeTypeFilter.added) return false;
              if (['modified', 'date_changed', 'swap'].includes(change.type) && !changeTypeFilter.modified) return false;
              return true;
            });
          };
          
          // Apply filtering to each severity category
          entryCopy.changes = {
            ...entry.changes,
            critical: filterChangesByType(entry.changes.critical),
            high: filterChangesByType(entry.changes.high),
            medium: filterChangesByType(entry.changes.medium),
            low: filterChangesByType(entry.changes.low)
          };
          
          // Also filter allChanges if present
          if (entryCopy.changes.allChanges && Array.isArray(entryCopy.changes.allChanges)) {
            entryCopy.changes.allChanges = filterChangesByType(entryCopy.changes.allChanges);
          }
          
          return entryCopy;
        });
      }
      
      // Remove entries that have no changes after filtering
      filtered = filtered.filter(entry => {
        const hasChanges = 
          entry.changes.critical.length > 0 || 
          entry.changes.high.length > 0 || 
          entry.changes.medium.length > 0 || 
          entry.changes.low.length > 0 ||
          (entry.changes.allChanges && entry.changes.allChanges.length > 0);
        return hasChanges;
      });
      
      console.log(`Filtered from ${historyData.length} entries to ${filtered.length} entries`);
      setFilteredData(filtered);
    } catch (error) {
      console.error('Error filtering data:', error);
      setComponentError(`Error filtering data: ${error instanceof Error ? error.message : String(error)}`);
      setFilteredData([]);
    }
  };
  
  // Fix the distribution of allChanges to the severity categories in the useEffect
  useEffect(() => {
    // Make sure any internal data structures correctly represent the current format
    if (historyData.length > 0) {
      // Look for entries that have allChanges but not properly distributed to severity categories
      const fixedHistoryData = historyData.map(entry => {
        // If entry has allChanges but empty severity arrays, redistribute the changes
        if (entry.changes.allChanges && 
            Array.isArray(entry.changes.allChanges) && 
            entry.changes.allChanges.length > 0 &&
            entry.changes.critical.length === 0 && 
            entry.changes.high.length === 0 &&
            entry.changes.medium.length === 0 &&
            entry.changes.low.length === 0) {
          
          console.log('Fixing entry with allChanges that was not distributed properly:', entry.date);
          
          // Create a copy with initialized arrays
          const fixedEntry: ChangeHistory = {
            ...entry,
            changes: {
              ...entry.changes,
              critical: [] as ChangeItem[],
              high: [] as ChangeItem[],
              medium: [] as ChangeItem[],
              low: [] as ChangeItem[],
              allChanges: entry.changes.allChanges,
              summary: entry.changes.summary
            }
          };
          
          // Distribute allChanges into severity categories
          if (entry.changes.allChanges) {
            entry.changes.allChanges.forEach((change) => {
              if (change.type === 'removed') {
                fixedEntry.changes.critical.push(change);
              } else if (change.type === 'added') {
                fixedEntry.changes.high.push(change);
              } else if (change.type === 'modified' || change.type === 'date_changed') {
                fixedEntry.changes.medium.push(change);
              } else {
                fixedEntry.changes.low.push(change);
              }
            });
          }
          
          return fixedEntry;
        }
        
        return entry;
      });
      
      // Only update if we actually fixed something
      if (JSON.stringify(fixedHistoryData) !== JSON.stringify(historyData)) {
        console.log('Updated history data with properly distributed allChanges');
        setHistoryData(fixedHistoryData);
      }
    }
  }, [historyData]);

  // Modify the pagination logic to handle groups
  const paginateData = () => {
    if (groupingOption === 'none') {
      // Original pagination for ungrouped view
      const { currentPage, itemsPerPage } = pagination;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setPaginatedData(filteredData.slice(startIndex, endIndex));
    } else {
      // Group data first
      const groupedData = groupHistoryData(filteredData);
      
      // Calculate how many groups to show per page
      const { currentPage, itemsPerPage } = pagination;
      const startGroupIndex = (currentPage - 1) * itemsPerPage;
      const endGroupIndex = startGroupIndex + itemsPerPage;
      
      // Get the groups for this page
      const groupsForPage = groupedData.slice(startGroupIndex, endGroupIndex);
      
      // Flatten the groups back to the original data format
      const entriesForPage = groupsForPage.flatMap(group => group.entries);
      
      setPaginatedData(entriesForPage);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newItemsPerPage = parseInt(e.target.value);
    setPagination(prev => ({
      itemsPerPage: newItemsPerPage,
      currentPage: 1,
      totalPages: Math.max(1, Math.ceil(filteredData.length / newItemsPerPage))
    }));
  };

  // Create a unique ID for each history entry since dates might not be unique
  const getUniqueId = (entry: ChangeHistory, index: number) => {
    // If the entry has a real ID, use it; otherwise use a combo of date and index
    return entry.id || `${entry.date.replace(/[^a-zA-Z0-9]/g, '_')}-${index}`;
  };

  // Get a proper archive ID for API operations
  const getArchiveIdForEntry = (entry: ChangeHistory | null, entryId: string): string => {
    if (!entry) {
      console.warn('No entry found for ID:', entryId);
      return `schedule_changes_${Date.now()}.json`; // Fallback to current timestamp
    }
    
    // If the entry has a server-assigned ID, use that
    if (entry.id) {
      // If ID already looks like a correctly formatted filename (with proper extension)
      if (entry.id.endsWith('.json') || entry.id.endsWith('.txt')) {
        // If it also has the required prefix, use it directly
        if (entry.id.startsWith('schedule_changes_')) {
          console.log('Using properly formatted filename for deletion:', entry.id);
          return entry.id;
        } else {
          // Otherwise, extract the timestamp part and reformat
          const extension = entry.id.endsWith('.json') ? '.json' : '.txt';
          const timestamp = entry.timestamp || Date.now();
          return `schedule_changes_${timestamp}${extension}`;
        }
      }
    }
    
    // For entries with timestamps, construct a valid filename
    // This is the most reliable approach
    if (entry.timestamp) {
      const timestamp = String(entry.timestamp);
      // Make sure it's in the format the server expects
      return `schedule_changes_${timestamp}.json`;
    }
    
    // If we have a date but no timestamp, try to generate a timestamp
    if (entry.date) {
      try {
        const date = new Date(entry.date);
        if (!isNaN(date.getTime())) {
          const timestamp = date.getTime().toString();
          return `schedule_changes_${timestamp}.json`;
        }
      } catch (e) {
        console.error('Error parsing date for API ID:', e);
      }
    }
    
    // Last resort, use current timestamp
    return `schedule_changes_${Date.now()}.json`;
  };

  // Find an entry by its ID
  const findEntryById = (entryId: string): ChangeHistory | null => {
    for (const entry of historyData) {
      const id = getUniqueId(entry, historyData.indexOf(entry));
      if (id === entryId) {
        return entry;
      }
    }
    return null;
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      // Create a fresh object to avoid reference issues
      const newExpandedItems = { ...prev };
      newExpandedItems[id] = !prev[id];
      return newExpandedItems;
    });
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'high':
        return 'text-orange-500 dark:text-orange-400';
      case 'medium':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'low':
        return 'text-green-500 dark:text-green-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getSeverityBgColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900 dark:bg-opacity-20';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900 dark:bg-opacity-20';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20';
      case 'low':
        return 'bg-green-100 dark:bg-green-900 dark:bg-opacity-20';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'removed':
        return <FiAlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />;
      case 'added':
        return <FiPlusCircle className="w-5 h-5 text-green-500 dark:text-green-400" />;
      case 'date_changed':
        return <FiArrowRight className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
      case 'replacement':
        return <FiArrowRight className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
      case 'swap':
        return <FiArrowRight className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      default:
        return <FiAlertCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  // Format date safely
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    
    // Try to parse the date
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Try different format - handle formats like "04/20/2025"
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // Assuming MM/DD/YYYY format
          const newDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
          if (!isNaN(newDate.getTime())) {
            return dateStr; // Return original string if we can parse it
          }
        }
      }
      return dateStr; // Return original string if we can't parse it
    }
    
    return dateStr;
  };

  // Function to extract visit number from job ID
  const extractVisitNumber = (jobId: string | undefined): string => {
    // If jobId is in format "W-123456" extract just the numeric part
    if (jobId && jobId.startsWith('W-')) {
      return jobId.substring(2);
    }
    return jobId || 'Unknown';
  };

  // Re-add the renderChangeDetails function that was removed
  const renderChangeDetails = (change: ChangeItem) => {
    if (!change || !change.type) {
      return (
        <div className="text-gray-500 dark:text-gray-400 italic">Invalid change data</div>
      );
    }
    
    switch (change.type) {
      case 'removed':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-red-600 dark:text-red-400 font-medium">Visit Removed</span>
              <div className="mt-1 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Visit #{extractVisitNumber(change.jobId)}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store {change.store})</span>}
                {change.dispensers !== undefined && 
                  <span>, {change.dispensers} {change.dispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-red-500 dark:text-red-400">removed</span> from {formatDate(change.date)}</span>
              </div>
            </div>
          </div>
        );
      
      case 'added':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-green-600 dark:text-green-400 font-medium">Visit Added</span>
              <div className="mt-1 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Visit #{extractVisitNumber(change.jobId)}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store {change.store})</span>}
                {change.dispensers !== undefined && 
                  <span>, {change.dispensers} {change.dispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-green-500 dark:text-green-400">added</span> on {formatDate(change.date)}</span>
              </div>
            </div>
          </div>
        );
      
      case 'date_changed':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-blue-600 dark:text-blue-400 font-medium">Visit Date Changed</span>
              <div className="mt-1 text-gray-800 dark:text-gray-200">
                <span>Visit #{extractVisitNumber(change.jobId)}</span>
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store {change.store})</span>}: 
                <span className="font-medium"> {formatDate(change.oldDate)} → {formatDate(change.newDate)}</span>
              </div>
            </div>
          </div>
        );
      
      case 'replacement':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Visit Replaced</span>
              <div className="mt-1 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Visit #{extractVisitNumber(change.removedJobId)}</span> 
                {change.removedStoreName && <span> at <span className="font-medium">{change.removedStoreName}</span></span>} 
                {change.removedStore && <span> (Store {change.removedStore})</span>}
                {change.removedDispensers !== undefined && 
                  <span>, {change.removedDispensers} {change.removedDispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-red-500 dark:text-red-400">removed</span> and replaced with </span>
                <span className="font-medium">Visit #{extractVisitNumber(change.addedJobId)}</span> 
                {change.addedStoreName && <span> at <span className="font-medium">{change.addedStoreName}</span></span>} 
                {change.addedStore && <span> (Store {change.addedStore})</span>}
                {change.addedDispensers !== undefined && 
                  <span>, {change.addedDispensers} {change.addedDispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> on {formatDate(change.date)}</span>
              </div>
            </div>
          </div>
        );
      
      case 'swap':
        return (
          <div className="flex items-start">
            {getChangeIcon('swap')}
            <div className="ml-2">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Visits Swapped</span>
              <div className="mt-1 text-gray-800 dark:text-gray-200 space-y-1">
                <div>
                  <span className="font-medium">Visit #{extractVisitNumber(change.job1Id)}</span> 
                  {change.job1StoreName && <span> at <span className="font-medium">{change.job1StoreName}</span></span>} 
                  {change.job1Store && <span> (Store {change.job1Store})</span>}: 
                  <span className="font-medium"> {formatDate(change.oldDate1)} → {formatDate(change.newDate1)}</span>
                </div>
                <div>
                  <span className="font-medium">Visit #{extractVisitNumber(change.job2Id)}</span> 
                  {change.job2StoreName && <span> at <span className="font-medium">{change.job2StoreName}</span></span>} 
                  {change.job2Store && <span> (Store {change.job2Store})</span>}: 
                  <span className="font-medium"> {formatDate(change.oldDate2)} → {formatDate(change.newDate2)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="flex items-start">
            {getChangeIcon('unknown')}
            <div className="ml-2">
              <span className="font-medium text-gray-700 dark:text-gray-200">Unknown Change Type</span>
              <div className="mt-1 text-gray-600 dark:text-gray-300">
                {change.type}: {change.jobId || ''}
              </div>
            </div>
          </div>
        );
    }
  };

  // Add back the resetFilters function
  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setSeverityFilter({
      critical: true,
      high: true,
      medium: true,
      low: true
    });
    setChangeTypeFilter({
      removed: true,
      added: true,
      modified: true
    });
    setShowFilters(false);
  };

  // Fix remaining functions to use handleRefresh instead
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await fetchHistoryData();
    setRefreshing(false);
  };

  // Add this function to format relative time
  const getRelativeTimeFrame = (timestamp: number | undefined): string => {
    if (!timestamp) return '';
    
    const now = new Date().getTime();
    const diff = now - timestamp;
    
    // Convert to minutes/hours/days
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) {
      return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
    } else if (hours < 24) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (days < 7) {
      return days === 1 ? 'Yesterday' : `${days} days ago`;
    } else {
      // For older entries, just show the date without year
      const dateObj = new Date(timestamp);
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Add toggle for auto-refresh in the toolbar
  const renderToolbar = () => {
    return (
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 p-3 rounded-lg shadow-sm border border-blue-100 dark:border-gray-600 mb-4">
        <div className="flex items-center mb-3 md:mb-0">
          <div className="flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 p-2 mr-3 shadow-md w-10 h-10">
            <FiCalendar className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Schedule Changes</h1>
        </div>
  
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Search input */}
          <div className="relative flex-grow md:flex-grow-0 w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by job ID, store, etc."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
  
          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-9 px-2.5 py-1.5 inline-flex items-center space-x-2 rounded-md border ${
              showFilters
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            aria-expanded={showFilters}
          >
            <FiFilter className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Filters</span>
            {(dateRange.start || dateRange.end || !severityFilter.critical || !severityFilter.high || 
             !severityFilter.medium || !severityFilter.low || !changeTypeFilter.added || 
             !changeTypeFilter.removed || !changeTypeFilter.modified) && (
              <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
            )}
          </button>
  
          {/* Group by dropdown */}
          <div className="relative inline-block">
            <select
              value={groupingOption}
              onChange={(e) => setGroupingOption(e.target.value as 'day' | 'week' | 'month' | 'none')}
              className="h-9 appearance-none text-sm pl-2.5 pr-8 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Group by"
            >
              <option value="day">Group by Day</option>
              <option value="week">Group by Week</option>
              <option value="month">Group by Month</option>
              <option value="none">No Grouping</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <FiChevronDown className="h-5 w-5" />
            </div>
          </div>

          {/* Auto-refresh toggle */}
          <div className="h-9 flex items-center space-x-1.5 px-2.5 py-1.5 bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={pollingEnabled}
              onChange={(e) => setPollingEnabled(e.target.checked)}
              className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="auto-refresh" className="text-xs text-gray-700 dark:text-gray-300">
              Auto-refresh
            </label>
          </div>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 inline-flex items-center space-x-2 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            aria-label="Refresh"
          >
            <FiRefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    );
  };

  // Add a filter panel component
  const renderFilterPanel = () => {
    if (!showFilters) return null;
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md p-5 mb-6 animate-slideDown">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Filter Options</h3>
          <div className="space-x-3">
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Reset All
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Close
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Date range filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Date Range</h4>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
            </div>
            <div className="pt-2">
              <button 
                onClick={() => setDateRange({start: '', end: ''})}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear Dates
              </button>
            </div>
          </div>
          
          {/* Severity filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Change Severity</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="critical"
                  checked={severityFilter.critical}
                  onChange={() => setSeverityFilter({...severityFilter, critical: !severityFilter.critical})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="critical" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Critical Changes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="high"
                  checked={severityFilter.high}
                  onChange={() => setSeverityFilter({...severityFilter, high: !severityFilter.high})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="high" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  High Priority
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="medium"
                  checked={severityFilter.medium}
                  onChange={() => setSeverityFilter({...severityFilter, medium: !severityFilter.medium})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="medium" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Medium Priority
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="low"
                  checked={severityFilter.low}
                  onChange={() => setSeverityFilter({...severityFilter, low: !severityFilter.low})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="low" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Low Priority
                </label>
              </div>
            </div>
          </div>
          
          {/* Change type filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Change Type</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="removed"
                  checked={changeTypeFilter.removed}
                  onChange={(e) => setChangeTypeFilter({...changeTypeFilter, removed: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="removed" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Removed Changes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="added"
                  checked={changeTypeFilter.added}
                  onChange={(e) => setChangeTypeFilter({...changeTypeFilter, added: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="added" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Added Changes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="modified"
                  checked={changeTypeFilter.modified}
                  onChange={(e) => setChangeTypeFilter({...changeTypeFilter, modified: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="modified" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Modified Changes
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add function to toggle day expansion
  const toggleDayExpand = (date: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
    
    // If we're expanding this day, and all other days are expanded too, 
    // we should set allExpanded to true
    if (!expandedDays[date]) {
      const allDates = groupHistoryData(filteredData).map(group => group.date);
      const wouldAllBeExpanded = allDates.every(d => 
        d === date ? true : expandedDays[d] !== false
      );
      
      if (wouldAllBeExpanded) {
        setAllExpanded(true);
      }
    } else {
      // If we're collapsing, allExpanded should be false
      setAllExpanded(false);
    }
  };
  
  // Add animation classes to the start of the file
  // This will be added to your CSS in index.css
  useEffect(() => {
    // Add animation CSS classes if they don't exist
    if (!document.getElementById('history-animations')) {
      const style = document.createElement('style');
      style.id = 'history-animations';
      style.innerHTML = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out forwards;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      // Clean up animation styles on unmount
      const animationStyle = document.getElementById('history-animations');
      if (animationStyle) {
        animationStyle.remove();
      }
    };
  }, []);

  const renderDateControls = () => {
    if (filteredData.length === 0) return null;
    
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <div className="flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 p-1.5 mr-2 w-8 h-8">
              <FiClock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Date Navigation</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleJumpToOldest()}
              className="h-8 inline-flex items-center px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <FiChevronsLeft className="mr-1 h-4 w-4" /> Oldest
            </button>
            
            <button
              onClick={() => handleJumpToNewest()}
              className="inline-flex items-center px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Newest <FiChevronsRight className="ml-1 h-4 w-4" />
            </button>
            
            <div className="flex">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <FiCalendar className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={dateJumpValue}
                  onChange={(e) => setDateJumpValue(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="mm/dd/yyyy"
                />
              </div>
              <button
                onClick={handleDateJump}
                className="px-4 py-2.5 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go
              </button>
            </div>
            
            <button
              onClick={() => setAllExpanded(!allExpanded)}
              className="px-4 py-2.5 inline-flex items-center rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {allExpanded ? (
                <>
                  <FiChevronUp className="mr-1 h-5 w-5" /> Collapse All
                </>
              ) : (
                <>
                  <FiChevronDown className="mr-1 h-5 w-5" /> Expand All
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const renderGroupedView = (): React.ReactNode => {
    const groupedData = groupHistoryData(paginatedData);
    
    return (
      <div className="space-y-10">
        {/* Show success message if present */}
        {successMessage && (
          <div className="p-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200" role="alert">
            {successMessage}
          </div>
        )}
        
        {/* Show component error if present */}
        {componentError && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-800 dark:bg-opacity-30 dark:text-red-200" role="alert">
            {componentError}
          </div>
        )}
        
        {groupedData.map((group, groupIndex) => {
          // Check if this group is expanded
          const isDayExpanded = expandedDays[group.date] !== false; // Default to expanded
          
          return (
            <div key={group.date + groupIndex} className="space-y-4" id={`date-${group.date.replace(/\s+/g, '-')}`}>
              <div 
                className="flex items-center mb-2 cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 p-3 rounded-md transition-colors hover:from-blue-100 hover:to-indigo-100 dark:hover:from-gray-750 dark:hover:to-gray-700 group shadow-sm border border-blue-100 dark:border-gray-700"
                onClick={() => toggleDayExpand(group.date)}
              >
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-blue-400 flex items-center justify-center mr-3 shadow-md">
                  <FiCalendar className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {group.date}
                  {group.entries[0].timestamp && (
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({getRelativeTimeFrame(group.entries[0].timestamp)})
                    </span>
                  )}
                </h3>
                <div className="flex-1"></div>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                    {group.entries.length} {group.entries.length === 1 ? 'change' : 'changes'}
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-800 dark:text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {group.entries.reduce((sum, entry) => 
                      sum + 
                      (entry.changes.critical?.length || 0) + 
                      (entry.changes.high?.length || 0) + 
                      (entry.changes.medium?.length || 0) + 
                      (entry.changes.low?.length || 0) +
                      (entry.changes.allChanges?.length || 0), 0)} items
                  </div>
                  {isDayExpanded ? (
                    <FiChevronUp className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform" />
                  ) : (
                    <FiChevronDown className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform" />
                  )}
                </div>
              </div>
              
              {isDayExpanded && (
                <div className="pl-4 border-l-2 border-blue-100 dark:border-gray-700 space-y-4 animate-fadeIn">
                  {group.entries.map((entry, entryIndex) => {
                    // Get a unique ID for this entry
                    const entryId = getUniqueId(entry, entryIndex);
                    const isExpanded = expandedItems[entryId] || false;
                    
                    return (
                      <div 
                        key={entryId} 
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all ${
                          entry.hidden ? 'opacity-50' : 'opacity-100'
                        }`}
                      >
                        <div 
                          className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-opacity-30"
                          onClick={() => toggleExpand(entryId)}
                        >
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 flex items-center justify-center mr-3">
                              <FiClock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {entry.date.includes(',') 
                                  ? entry.date.split(',')[1]?.trim() || entry.date 
                                  : entry.date}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {entry.changes.summary.removed + entry.changes.summary.added + entry.changes.summary.modified} changes
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              {entry.changes.summary.removed > 0 && (
                                <span className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-800 dark:text-red-300">
                                  {entry.changes.summary.removed} <span className="hidden sm:inline">Removed</span>
                                </span>
                              )}
                              {entry.changes.summary.added > 0 && (
                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-800 dark:text-green-300">
                                  {entry.changes.summary.added} <span className="hidden sm:inline">Added</span>
                                </span>
                              )}
                              {entry.changes.summary.modified > 0 && (
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-800 dark:text-blue-300">
                                  {entry.changes.summary.modified} <span className="hidden sm:inline">Modified</span>
                                </span>
                              )}
                            </div>
                            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                              <FiChevronDown className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 space-y-4">
                            {/* All changes */}
                            <div className="space-y-3">
                              {/* Critical changes (removed) */}
                              {entry.changes.critical.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center">
                                    <FiAlertCircle className="mr-1" /> Critical Changes
                                  </h4>
                                  {entry.changes.critical.map((change, changeIndex) => (
                                    <div key={changeIndex} className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 rounded-md border border-red-100 dark:border-red-800">
                                      {renderChangeDetails(change)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* High priority changes (added) */}
                              {entry.changes.high.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center">
                                    <FiPlusCircle className="mr-1" /> Added Jobs
                                  </h4>
                                  {entry.changes.high.map((change, changeIndex) => (
                                    <div key={changeIndex} className="p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-md border border-green-100 dark:border-green-800">
                                      {renderChangeDetails(change)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Medium priority changes (modified) */}
                              {entry.changes.medium.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center">
                                    <FiArrowRight className="mr-1" /> Modified Jobs
                                  </h4>
                                  {entry.changes.medium.map((change, changeIndex) => (
                                    <div key={changeIndex} className="p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md border border-blue-100 dark:border-blue-800">
                                      {renderChangeDetails(change)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Low priority changes */}
                              {entry.changes.low.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-300 flex items-center">
                                    <FiList className="mr-1" /> Other Changes
                                  </h4>
                                  {entry.changes.low.map((change, changeIndex) => (
                                    <div key={changeIndex} className="p-3 bg-gray-50 dark:bg-gray-700 dark:bg-opacity-50 rounded-md border border-gray-200 dark:border-gray-600">
                                      {renderChangeDetails(change)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderNonGroupedView = (): React.ReactNode => {
    return (
      <div className="space-y-4">
        {/* Show success message if present */}
        {successMessage && (
          <div className="p-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200" role="alert">
            {successMessage}
          </div>
        )}
        
        {paginatedData.map((entry, index) => {
          const uniqueId = getUniqueId(entry, index);
          const isExpanded = expandedItems[uniqueId] || false;
          
          return (
            <div 
              key={uniqueId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-opacity-30"
                onClick={() => toggleExpand(uniqueId)}
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-500 flex items-center justify-center mr-3 shadow-sm">
                    <FiCalendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {entry.date}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.changes.summary.removed + entry.changes.summary.added + entry.changes.summary.modified} changes
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    {entry.changes.summary.removed > 0 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-800 dark:text-red-300">
                        {entry.changes.summary.removed} <span className="hidden sm:inline">Removed</span>
                      </span>
                    )}
                    {entry.changes.summary.added > 0 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-800 dark:text-green-300">
                        {entry.changes.summary.added} <span className="hidden sm:inline">Added</span>
                      </span>
                    )}
                    {entry.changes.summary.modified > 0 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 text-blue-800 dark:text-blue-300">
                        {entry.changes.summary.modified} <span className="hidden sm:inline">Modified</span>
                      </span>
                    )}
                  </div>
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <FiChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 space-y-4">
                  {/* All changes */}
                  <div className="space-y-3">
                    {/* Critical changes (removed) */}
                    {entry.changes.critical.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center">
                          <FiAlertCircle className="mr-1" /> Critical Changes
                        </h4>
                        {entry.changes.critical.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 rounded-md border border-red-100 dark:border-red-800">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* High priority changes (added) */}
                    {entry.changes.high.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center">
                          <FiPlusCircle className="mr-1" /> Added Jobs
                        </h4>
                        {entry.changes.high.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-md border border-green-100 dark:border-green-800">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Medium priority changes (modified) */}
                    {entry.changes.medium.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center">
                          <FiArrowRight className="mr-1" /> Modified Jobs
                        </h4>
                        {entry.changes.medium.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md border border-blue-100 dark:border-blue-800">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Low priority changes */}
                    {entry.changes.low.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-300 flex items-center">
                          <FiList className="mr-1" /> Other Changes
                        </h4>
                        {entry.changes.low.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-gray-50 dark:bg-gray-700 dark:bg-opacity-50 rounded-md border border-gray-200 dark:border-gray-600">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleDateJump = () => {
    if (!dateJumpValue) return;
    
    try {
      // Try to parse the date
      const jumpDate = new Date(dateJumpValue);
      
      // Format the date to match the format used in the grouped data
      const formattedJumpDate = jumpDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Look for this date in the grouped data
      const groupedData = groupHistoryData(filteredData);
      const dateGroup = groupedData.find(group => 
        group.date.includes(formattedJumpDate) || 
        group.date.includes(jumpDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}))
      );
      
      if (dateGroup) {
        // Found the date, scroll to it
        const dateElement = document.getElementById(`date-${dateGroup.date.replace(/\s+/g, '-')}`);
        if (dateElement) {
          dateElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Highlight the element briefly
          dateElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900', 'dark:bg-opacity-30');
          setTimeout(() => {
            dateElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900', 'dark:bg-opacity-30');
          }, 2000);
          
          // Make sure the day is expanded
          setExpandedDays({
            ...expandedDays,
            [dateGroup.date]: true
          });
          
          // If using pagination, find which page contains this date
          if (groupingOption !== 'none' && paginatedData.length < filteredData.length) {
            const flattenedEntries = groupedData.flatMap(g => g.entries);
            const entryIndex = flattenedEntries.findIndex(entry => 
              entry.date.includes(jumpDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}))
            );
            
            if (entryIndex >= 0) {
              const pageNumber = Math.floor(entryIndex / pagination.itemsPerPage) + 1;
              if (pageNumber !== pagination.currentPage) {
                setPagination({...pagination, currentPage: pageNumber});
              }
            }
          }
        } else {
          // Element not found but date exists, might be on another page
          setComponentError(`Date found but element not visible. Try changing page or expanding filters.`);
          setTimeout(() => setComponentError(null), 3000);
        }
      } else {
        // Date not found, show a message
        setComponentError(`No changes found for ${formattedJumpDate}`);
        setTimeout(() => setComponentError(null), 3000);
      }
    } catch (error) {
      console.error('Error parsing jump date:', error);
      setComponentError('Please enter a valid date');
      setTimeout(() => setComponentError(null), 3000);
    }
  };

  const handleJumpToOldest = () => {
    setPagination({...pagination, currentPage: pagination.totalPages});
  };

  const handleJumpToNewest = () => {
    setPagination({...pagination, currentPage: 1});
  };

  // Use effect to handle the allExpanded state
  useEffect(() => {
    if (filteredData.length > 0) {
      const allDates = groupHistoryData(filteredData).map(group => group.date);
      const newExpandedState = allDates.reduce((acc, date) => {
        acc[date] = allExpanded;
        return acc;
      }, {} as Record<string, boolean>);
      
      setExpandedDays(newExpandedState);
    }
  }, [allExpanded, filteredData]);

  // Add useEffect to adjust items per page based on grouping
  useEffect(() => {
    // Set appropriate items per page based on grouping
    let newItemsPerPage = 10; // Default
    
    switch (groupingOption) {
      case 'none':
        newItemsPerPage = 20; // Show more individual items when not grouped
        break;
      case 'day':
        newItemsPerPage = 10; // Show 10 different days per page
        break;
      case 'week':
        newItemsPerPage = 8; // Show 8 different weeks per page
        break;
      case 'month':
        newItemsPerPage = 6; // Show 6 different months per page
        break;
    }
    
    // Calculate total pages based on grouping
    let totalPages = 1;
    
    if (groupingOption === 'none') {
      // For ungrouped view, calculate based on individual entries
      totalPages = Math.max(1, Math.ceil(filteredData.length / newItemsPerPage));
    } else {
      // For grouped views, calculate based on number of groups
      const groupedData = groupHistoryData(filteredData);
      totalPages = Math.max(1, Math.ceil(groupedData.length / newItemsPerPage));
    }
    
    // Update pagination with new items per page
    setPagination(prev => ({
      ...prev,
      itemsPerPage: newItemsPerPage,
      currentPage: Math.min(prev.currentPage, totalPages), // Ensure current page is valid
      totalPages: totalPages
    }));
  }, [groupingOption, filteredData]);

  useEffect(() => {
    paginateData();
  }, [filteredData, pagination.currentPage, pagination.itemsPerPage, groupingOption]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:bg-opacity-90 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {renderToolbar()}
        
        {/* Component error message */}
        {componentError && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-800 dark:bg-opacity-30 dark:text-red-200" role="alert">
            <div className="font-medium">An error occurred:</div>
            <div className="mt-1">{componentError}</div>
            <button 
              onClick={() => {
                setComponentError(null);
                handleRefresh();
              }}
              className="mt-2 px-3 py-1 bg-red-700 dark:bg-red-600 text-white rounded hover:bg-red-800 dark:hover:bg-red-700 transition-colors text-sm"
            >
              Refresh Data
            </button>
          </div>
        )}
        
        {/* Success message */}
        {successMessage && !componentError && (
          <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200" role="alert">
            {successMessage}
          </div>
        )}
        
        {showFilters && renderFilterPanel()}
        {renderDateControls()}
        
        {/* Main content area */}
        {!componentError && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            {loading && !historyData.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-gray-400">
                <FiRefreshCw className="animate-spin text-3xl text-blue-500 mb-4" />
                <p>Loading history data...</p>
              </div>
            ) : error && !historyData.length ? (
              <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-800 dark:text-red-200">
                <div className="flex items-center">
                  <FiAlertCircle className="w-6 h-6 mr-3" />
                  <div className="text-lg font-medium">{error}</div>
                </div>
                <div className="mt-4">
                  <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-flex items-center"
                    onClick={handleRefresh}
                  >
                    <FiRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Try Again
                  </button>
                </div>
              </div>
            ) : !historyData.length ? (
              <div className="text-center py-16">
                <FiCalendar className="w-16 h-16 text-gray-300 dark:text-gray-500 mx-auto" />
                <h3 className="mt-6 text-xl font-medium text-gray-900 dark:text-white">No Change History</h3>
                <p className="mt-3 text-base text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                  No schedule changes have been recorded yet. Changes will appear here when modifications are made to the schedule.
                </p>
              </div>
            ) : (
              <div>
                {/* Show loading overlay when refreshing */}
                {(loading || refreshing) && (
                  <div className="fixed inset-0 bg-gray-900 bg-opacity-10 flex items-center justify-center z-50 pointer-events-none">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex items-center">
                      <FiRefreshCw className="animate-spin text-blue-500 mr-3" />
                      <span>Refreshing data...</span>
                    </div>
                  </div>
                )}
                
                {/* Display the filtered and paginated data */}
                {groupingOption !== 'none' ? renderGroupedView() : renderNonGroupedView()}
                
                {/* Pagination controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-5">
                  <div className="flex items-center mb-3 sm:mb-0">
                    <span className="mr-2 text-xs text-gray-700 dark:text-gray-300">Items per page:</span>
                    <select
                      value={pagination.itemsPerPage}
                      onChange={handleItemsPerPageChange}
                      className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                      aria-label="Items per page"
                    >
                      {groupingOption === 'none' && (
                        <>
                          <option value={10}>10 items</option>
                          <option value={20}>20 items</option>
                          <option value={30}>30 items</option>
                          <option value={50}>50 items</option>
                        </>
                      )}
                      {groupingOption === 'day' && (
                        <>
                          <option value={5}>5 days</option>
                          <option value={10}>10 days</option>
                          <option value={15}>15 days</option>
                          <option value={20}>20 days</option>
                        </>
                      )}
                      {groupingOption === 'week' && (
                        <>
                          <option value={4}>4 weeks</option>
                          <option value={8}>8 weeks</option>
                          <option value={12}>12 weeks</option>
                          <option value={16}>16 weeks</option>
                        </>
                      )}
                      {groupingOption === 'month' && (
                        <>
                          <option value={3}>3 months</option>
                          <option value={6}>6 months</option>
                          <option value={9}>9 months</option>
                          <option value={12}>12 months</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <div className="text-xs text-gray-700 dark:text-gray-300 mr-1 hidden sm:block">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </div>
                    <div className="flex shadow-sm rounded-md">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.currentPage === 1}
                        className={`px-2 py-1 rounded-l-md border ${
                          pagination.currentPage === 1
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600'
                        }`}
                        aria-label="First page"
                        title="First page"
                      >
                        <FiChevronsLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1}
                        className={`px-2 py-1 border-t border-b ${
                          pagination.currentPage === 1
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600'
                        }`}
                        aria-label="Previous page"
                        title="Previous page"
                      >
                        <FiChevronLeft className="w-3 h-3" />
                      </button>
                      <div className="px-3 py-1 bg-blue-50 dark:bg-blue-800 dark:bg-opacity-30 border-t border-b text-blue-700 dark:text-blue-200 text-xs border-gray-300 dark:border-gray-600 font-medium sm:hidden">
                        {pagination.currentPage} / {pagination.totalPages}
                      </div>
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className={`px-2 py-1 border-t border-b ${
                          pagination.currentPage === pagination.totalPages
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600'
                        }`}
                        aria-label="Next page"
                        title="Next page"
                      >
                        <FiChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className={`px-2 py-1 rounded-r-md border ${
                          pagination.currentPage === pagination.totalPages
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600'
                        }`}
                        aria-label="Last page"
                        title="Last page"
                      >
                        <FiChevronsRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History; 