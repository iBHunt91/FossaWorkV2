import React, { useState, useEffect } from 'react';
import { FiCalendar, FiChevronDown, FiChevronUp, FiAlertCircle, FiPlusCircle, FiArrowRight, FiRefreshCw, FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiClock, FiList, FiArchive, FiFile, FiTrash2, FiEye, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { ENDPOINTS } from '../config/api';

interface ChangeRecord {
  timestamp: string;
  changes: {
    critical: ChangeItem[];
    high: ChangeItem[];
    medium: ChangeItem[];
    low: ChangeItem[];
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
  id?: string;
  changes: {
    critical: ChangeItem[];
    high: ChangeItem[];
    medium: ChangeItem[];
    low: ChangeItem[];
    summary: {
      removed: number;
      added: number;
      modified: number;
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

  // Remove unused states
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Add new state variables for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Add state for grouping option
  const [groupByDay, setGroupByDay] = useState<boolean>(true);

  // Add a function to group history data by date
  const groupHistoryByDay = (historyData: ChangeHistory[]): { date: string, entries: ChangeHistory[] }[] => {
    // Create a map to group entries by date (just the date part without time)
    const groupedMap = new Map<string, ChangeHistory[]>();
    
    historyData.forEach(entry => {
      // Extract just the date part (without time)
      const dateParts = entry.date.split(',')[0]; // This should extract "Jan 1" from "Jan 1, 12:00 PM"
      const dateKey = dateParts.trim();
      
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
      // Use the timestamp from the first entry in each group for sorting
      const timestampA = a.entries[0].timestamp || new Date(a.date).getTime();
      const timestampB = b.entries[0].timestamp || new Date(b.date).getTime();
      return timestampB - timestampA;
    });
  };

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to get data from the new consolidated change history endpoint
      const changeHistoryUrl = await ENDPOINTS.CHANGE_HISTORY();
      console.log('Fetching change history from:', changeHistoryUrl);
      const response = await fetch(changeHistoryUrl);
      
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
          setHistoryData([]);
          setLoading(false);
          return;
        }
        
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
            
            // Ensure all change arrays exist, even if empty
            const changes = {
              critical: record.changes?.critical || [],
              high: record.changes?.high || [],
              medium: record.changes?.medium || [],
              low: record.changes?.low || [],
              summary: record.changes?.summary || {
                removed: 0,
                added: 0,
                modified: 0
              }
            };
            
            // Extract an ID if available in the record, create one from timestamp if not
            const id = (record as any).id || `history_${date.getTime()}`;
            
            return {
              id, // Store the ID for API operations
              date: formattedDate,
              timestamp: date.getTime(), // Store timestamp for relative time calculations
              changes
            };
          });
        } else {
          console.log('Data is already in the expected format');
          // Add IDs to existing format if they don't have them
          formattedData = rawData.map((entry: ChangeHistory, index: number) => {
            if (!entry.id) {
              // Create a stable ID based on the date if possible
              const timestamp = entry.timestamp || new Date(entry.date).getTime();
              entry.id = `history_${timestamp}_${index}`;
            }
            return entry;
          });
        }
        
        console.log('Formatted history data:', formattedData);
        setHistoryData(formattedData);
        setLoading(false);
        return;
      } else {
        console.error('Change history API returned an error:', response.status, response.statusText);
        try {
          const errorText = await response.text();
          console.error('Error response:', errorText);
        } catch (e) {
          console.error('Could not read error response');
        }
      }
      
      // Fall back to the old endpoint if the new one fails
      console.log('Could not fetch from consolidated change history, falling back to old endpoint');
      const oldUrl = await ENDPOINTS.HISTORY();
      console.log('Fetching from old history endpoint:', oldUrl);
      const oldResponse = await fetch(oldUrl);
      
      if (!oldResponse.ok) {
        console.error('Old history API returned an error:', oldResponse.status, oldResponse.statusText);
        try {
          const errorText = await oldResponse.text();
          console.error('Error response:', errorText);
        } catch (e) {
          console.error('Could not read error response');
        }
        
        const errorData = await oldResponse.json();
        throw new Error(errorData.error || `Failed to load history data: ${oldResponse.status} ${oldResponse.statusText}`);
      }
      
      const data = await oldResponse.json();
      console.log('Received data from old endpoint:', data);
      
      // Process the old data format to add timestamps
      const processedData = data.map((entry: ChangeHistory, index: number) => {
        // Try to extract date and create a timestamp
        try {
          // Remove the year part for display if it exists
          let displayDate = entry.date;
          if (displayDate.includes(',')) {
            const parts = displayDate.split(',');
            const datePart = parts[0].trim();
            const dateBits = datePart.split(' ');
            // Keep month and day, remove year if it exists
            if (dateBits.length > 2) {
              displayDate = `${dateBits[0]} ${dateBits[1]},${parts[1]}`;
            }
          }
          
          // Create a timestamp for relative time calculations
          const timestamp = new Date(entry.date).getTime();
          
          // Generate a stable ID for this entry if it doesn't have one
          const id = entry.id || `history_${timestamp}_${index}`;
          
          return {
            ...entry,
            id,
            date: displayDate,
            timestamp: !isNaN(timestamp) ? timestamp : undefined
          };
        } catch (e) {
          console.error('Error processing date:', e);
          // Still add an ID even if we couldn't process the date
          if (!entry.id) {
            entry.id = `history_fallback_${index}`;
          }
          return entry;
        }
      });
      
      setHistoryData(processedData);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching history data:', err);
      setError(err.message || 'Failed to load history data. Please try again later.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  useEffect(() => {
    filterData();
  }, [historyData, searchTerm, dateRange, severityFilter, changeTypeFilter]);

  useEffect(() => {
    paginateData();
  }, [filteredData, pagination.currentPage, pagination.itemsPerPage]);

  const filterData = () => {
    let filtered = [...historyData];
    
    // Log the initial data we're filtering
    console.log(`Starting filterData with ${historyData.length} history items`);
    
    // Filter by date range
    if (dateRange.start) {
      filtered = filtered.filter(entry => new Date(entry.date) >= new Date(dateRange.start));
    }
    
    if (dateRange.end) {
      filtered = filtered.filter(entry => new Date(entry.date) <= new Date(dateRange.end));
    }
    
    // Filter by severity
    filtered = filtered.map(entry => {
      const filteredChanges = {
        ...entry.changes,
        critical: severityFilter.critical ? entry.changes.critical : [],
        high: severityFilter.high ? entry.changes.high : [],
        medium: severityFilter.medium ? entry.changes.medium : [],
        low: severityFilter.low ? entry.changes.low : []
      };
      
      return {
        ...entry,
        changes: filteredChanges
      };
    });
    
    // Filter by change type - apply across all severity levels
    if (!changeTypeFilter.removed || !changeTypeFilter.added || !changeTypeFilter.modified) {
      filtered = filtered.map(entry => {
        // Helper function to filter changes by type
        const filterChangesByType = (changes: ChangeItem[]) => {
          return changes.filter(change => {
            if (change.type === 'removed' && !changeTypeFilter.removed) return false;
            if (change.type === 'added' && !changeTypeFilter.added) return false;
            if ((change.type === 'date_changed' || change.type === 'replacement') && !changeTypeFilter.modified) return false;
            return true;
          });
        };
        
        // Apply the filter to each severity level
        const filteredChanges = {
          ...entry.changes,
          critical: filterChangesByType(entry.changes.critical),
          high: filterChangesByType(entry.changes.high),
          medium: filterChangesByType(entry.changes.medium),
          low: filterChangesByType(entry.changes.low)
        };
        
        return {
          ...entry,
          changes: filteredChanges
        };
      });
    }
    
    // Filter entries with no changes after all filtering
    filtered = filtered.filter(entry => 
      entry.changes.critical.length > 0 || 
      entry.changes.high.length > 0 || 
      entry.changes.medium.length > 0 || 
      entry.changes.low.length > 0
    );
    
    console.log(`After filtering, ${filtered.length} items remain`);
    
    // Apply search term filtering
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => {
        // Check if date contains search term
        if (entry.date.toLowerCase().includes(term)) return true;
        
        // Check if any change details contain search term
        const hasMatchInChanges = ['critical', 'high', 'medium', 'low'].some(severity => {
          const changes = entry.changes[severity as keyof typeof entry.changes] as ChangeItem[];
          return changes.some(change => 
            (change.jobId && change.jobId.toLowerCase().includes(term)) || 
            (change.store && change.store.toLowerCase().includes(term)) ||
            (change.date && change.date.toLowerCase().includes(term)) ||
            (change.oldDate && change.oldDate.toLowerCase().includes(term)) ||
            (change.newDate && change.newDate.toLowerCase().includes(term)) ||
            (change.removedJobId && change.removedJobId.toLowerCase().includes(term)) ||
            (change.addedJobId && change.addedJobId.toLowerCase().includes(term)) ||
            (change.removedStore && change.removedStore.toLowerCase().includes(term)) ||
            (change.addedStore && change.addedStore.toLowerCase().includes(term))
          );
        });
        
        return hasMatchInChanges;
      });
    }
    
    console.log(`Final filtered data count: ${filtered.length}`);
    setFilteredData(filtered);
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      currentPage: 1,
      totalPages: Math.max(1, Math.ceil(filtered.length / prev.itemsPerPage))
    }));
  };

  const paginateData = () => {
    const { currentPage, itemsPerPage } = pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedData(filteredData.slice(startIndex, endIndex));
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
      return entryId;
    }
    
    // If the entry has a server-assigned ID, use that
    if (entry.id) {
      // Check if the ID is in a valid format for API operations
      if (entry.id.startsWith('history_')) {
        console.log('Using timestamp-based ID for deletion');
        
        // For timestamp-based IDs, use the timestamp value directly
        // The format might be "history_1621234567890_0", extract the timestamp part
        const parts = entry.id.split('_');
        if (parts.length >= 2 && !isNaN(Number(parts[1]))) {
          // Use the timestamp directly, which is more likely to be handled correctly by the API
          return parts[1];
        }
      }
      
      return entry.id;
    }
    
    // For entries with timestamps, try to use that directly
    if (entry.timestamp) {
      return String(entry.timestamp);
    }
    
    // For entries with dates, try to get an ISO date string which is more API-friendly
    if (entry.date) {
      try {
        // Try to parse the date and get a clean format
        const date = new Date(entry.date);
        if (!isNaN(date.getTime())) {
          // Use ISO date format which is more reliable for APIs
          return date.toISOString();
        }
      } catch (e) {
        console.error('Error parsing date for API ID:', e);
      }
      
      // If we can't parse the date, encode the original
      return encodeURIComponent(entry.date);
    }
    
    // Last resort, use the entryId
    return encodeURIComponent(entryId);
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
        return <FiAlertCircle className="w-5 h-5 text-red-500" />;
      case 'added':
        return <FiPlusCircle className="w-5 h-5 text-green-500" />;
      case 'date_changed':
        return <FiArrowRight className="w-5 h-5 text-blue-500" />;
      case 'replacement':
        return <FiArrowRight className="w-5 h-5 text-purple-500" />;
      default:
        return <FiAlertCircle className="w-5 h-5 text-gray-500" />;
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
  
  // Delete an archive
  const deleteArchive = async (archiveId: string) => {
    try {
      setDeleteLoading(true);
      const url = await ENDPOINTS.DELETE_ARCHIVE(archiveId);
      
      const response = await fetch(url, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete archive: ${response.status} ${response.statusText}`);
      }
      
      // Refresh the data
      await fetchHistoryData();
      
      setDeletingArchiveId(null);
    } catch (err) {
      console.error('Error deleting archive:', err);
      // Don't use setArchiveError which no longer exists
      setError('Failed to delete archive. Please try again later.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Function to extract visit number from job ID
  const extractVisitNumber = (jobId: string | undefined): string => {
    // If jobId is in format "W-123456" extract just the numeric part
    if (jobId && jobId.startsWith('W-')) {
      return jobId.substring(2);
    }
    return jobId || 'Unknown';
  };

  // Function to show delete confirmation
  const confirmDelete = (entryId: string) => {
    setDeleteTargetId(entryId);
    setShowDeleteConfirm(true);
  };

  // Function to cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  // Add function to handle deletion
  const handleDeleteEntry = async (entryId: string) => {
    try {
      setDeleteLoading(true);
      
      // Find the entry to delete
      const entry = findEntryById(entryId);
      
      // Try different ID formats to find one that works
      let success = false;
      let lastError = null;
      
      // First try: use the getArchiveIdForEntry method
      try {
        const archiveId = getArchiveIdForEntry(entry, entryId);
        console.log('Attempting delete with ID format 1:', archiveId);
        
        const url = await ENDPOINTS.DELETE_ARCHIVE(archiveId);
        console.log('Delete URL:', url);
        
        const response = await fetch(url, {
          method: 'DELETE',
        });
        
        console.log('Delete response status:', response.status);
        
        if (response.ok) {
          success = true;
          console.log('Successfully deleted entry with ID format 1');
        } else {
          const errorText = await response.text().catch(() => 'Could not read error response');
          console.warn('First delete attempt failed:', response.status, errorText);
          lastError = new Error(`Failed to delete entry: ${response.status} ${response.statusText}`);
        }
      } catch (e) {
        console.warn('Error in first delete attempt:', e);
        lastError = e;
      }
      
      // Second try: if the entry has a timestamp, use it directly
      if (!success && entry?.timestamp) {
        try {
          const timestamp = String(entry.timestamp);
          console.log('Attempting delete with timestamp ID format:', timestamp);
          
          const url = await ENDPOINTS.DELETE_ARCHIVE(timestamp);
          
          const response = await fetch(url, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            success = true;
            console.log('Successfully deleted entry with timestamp ID');
          } else {
            const errorText = await response.text().catch(() => 'Could not read error response');
            console.warn('Second delete attempt failed:', response.status, errorText);
            lastError = new Error(`Failed to delete entry: ${response.status} ${response.statusText}`);
          }
        } catch (e) {
          console.warn('Error in second delete attempt:', e);
          lastError = e;
        }
      }
      
      // Third try: last resort, try with the raw entry date
      if (!success && entry?.date) {
        try {
          console.log('Attempting delete with raw date ID:', entry.date);
          
          const url = await ENDPOINTS.DELETE_ARCHIVE(encodeURIComponent(entry.date));
          
          const response = await fetch(url, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            success = true;
            console.log('Successfully deleted entry with raw date ID');
          } else {
            const errorText = await response.text().catch(() => 'Could not read error response');
            console.warn('Third delete attempt failed:', response.status, errorText);
            lastError = new Error(`Failed to delete entry: ${response.status} ${response.statusText}`);
          }
        } catch (e) {
          console.warn('Error in third delete attempt:', e);
          lastError = e;
        }
      }
      
      if (success) {
        // Show success message
        setError(null);
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
        
        // Refresh the history data after successful deletion
        await fetchHistoryData();
      } else {
        // If all attempts failed, throw the last error
        throw lastError || new Error('Failed to delete entry after multiple attempts');
      }
    } catch (err) {
      console.error('Error deleting history entry:', err);
      setError('Failed to delete history entry. Please try again later.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Update renderChangeDetails function to use extractVisitNumber
  const renderChangeDetails = (change: ChangeItem) => {
    switch (change.type) {
      case 'removed':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-red-600 dark:text-red-400 font-medium">Visit Removed</span>
              <div className="mt-1">
                <span className="font-medium">Visit #{extractVisitNumber(change.jobId)}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store {change.store})</span>}
                {change.dispensers !== undefined && 
                  <span>, {change.dispensers} {change.dispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-red-500">removed</span> from {formatDate(change.date)}</span>
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
              <div className="mt-1">
                <span className="font-medium">Visit #{extractVisitNumber(change.jobId)}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store {change.store})</span>}
                {change.dispensers !== undefined && 
                  <span>, {change.dispensers} {change.dispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-green-500">added</span> on {formatDate(change.date)}</span>
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
              <div className="mt-1">
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
              <div className="mt-1">
                <span className="font-medium">Visit #{extractVisitNumber(change.removedJobId)}</span> 
                {change.removedStoreName && <span> at <span className="font-medium">{change.removedStoreName}</span></span>} 
                {change.removedStore && <span> (Store {change.removedStore})</span>}
                {change.removedDispensers !== undefined && 
                  <span>, {change.removedDispensers} {change.removedDispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-red-500">removed</span> and replaced with </span>
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
      
      default:
        return (
          <div className="flex items-start">
            {getChangeIcon('unknown')}
            <div className="ml-2">
              <span className="font-medium">Unknown Change Type</span>
              <div className="mt-1">
                {change.type}: {change.jobId || ''}
              </div>
            </div>
          </div>
        );
    }
  };

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

  // Fix remaining handleRefresh references by adding the handleRefresh function back
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

  // Modify renderContent to use grouping
  const renderContent = (): React.ReactNode => {
    // Debug info
    console.log("Rendering with data:", {
      historyData: historyData.length,
      filteredData: filteredData.length,
      paginatedData: paginatedData.length,
      pagination
    });
    
    // Debug empty states
    if (filteredData.length === 0 && historyData.length > 0) {
      console.log("Filter is removing all data. Filter state:", {
        searchTerm,
        dateRange,
        severityFilter,
        changeTypeFilter
      });
    }
    
    // Default to changes view
    if (loading) {
      return (
        <div className="flex items-center justify-center h-60">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Loading history data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch your data...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-60">
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 dark:bg-opacity-30 flex items-center justify-center mb-4">
              <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Error Loading Data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button 
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={fetchHistoryData}
            >
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (historyData.length === 0) {
      return (
        <div className="flex items-center justify-center h-60">
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <FiList className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No History Data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {filteredData.length > 0 
                ? "No data matches your current filters. Try adjusting your search criteria."
                : "There is no schedule change history available yet."}
            </p>
            {filteredData.length > 0 && (
              <button 
                className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={resetFilters}
              >
                <FiFilter className="w-4 h-4 mr-2" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      );
    }

    // If we're grouping by day
    if (groupByDay) {
      const groupedData = groupHistoryByDay(paginatedData);
      
      return (
        <div className="space-y-8">
          {groupedData.map((group, groupIndex) => (
            <div key={group.date + groupIndex} className="space-y-4">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 flex items-center justify-center mr-3">
                  <FiCalendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {group.date}
                  {group.entries[0].timestamp && (
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({getRelativeTimeFrame(group.entries[0].timestamp)})
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="pl-11 space-y-4">
                {group.entries.map((entry, index) => {
                  const uniqueId = getUniqueId(entry, index);
                  const isExpanded = expandedItems[uniqueId] || false;
                  const changeCount = entry.changes.critical.length + entry.changes.high.length + entry.changes.medium.length + entry.changes.low.length;
                  
                  // Extract just the time portion for display in the group
                  const timePortion = entry.date.includes(',') && entry.date.split(',').length > 1 
                    ? entry.date.split(',')[1].trim() 
                    : "Time not available";
                  
                  // Better time display that focuses on just the time (e.g., "12:30 PM")
                  let timeDisplay = "Time not available";
                  if (entry.date.includes(',') && entry.date.split(',').length > 1) {
                    const timeString = entry.date.split(',')[1].trim();
                    // Try to extract just the time portion without extra information
                    if (timeString.includes(':')) {
                      // Match patterns like "12:34 PM" or "01:45 AM"
                      const timeMatch = timeString.match(/\d{1,2}:\d{2}(:\d{2})?\s*[APap][Mm]?/);
                      if (timeMatch) {
                        timeDisplay = timeMatch[0];
                      } else {
                        timeDisplay = timeString; // Fallback to the full time string
                      }
                    } else {
                      timeDisplay = timeString;
                    }
                  }
                  
                  return (
                    <div 
                      key={uniqueId}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-150"
                    >
                      <div className="flex justify-between">
                        <div 
                          className="p-4 cursor-pointer flex-grow flex justify-between items-center"
                          onClick={() => toggleExpand(uniqueId)}
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3">
                              <FiClock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white mb-0.5 flex items-center">
                                {timeDisplay}
                                {entry.timestamp && (
                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                    ({getRelativeTimeFrame(entry.timestamp)})
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {changeCount} {changeCount === 1 ? 'change' : 'changes'} detected
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="hidden sm:flex items-center space-x-2">
                              {entry.changes.summary.removed > 0 && (
                                <span className="px-2.5 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                  {entry.changes.summary.removed} Removed
                                </span>
                              )}
                              {entry.changes.summary.added > 0 && (
                                <span className="px-2.5 py-1 text-xs rounded-full bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                  {entry.changes.summary.added} Added
                                </span>
                              )}
                              {entry.changes.summary.modified > 0 && (
                                <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  {entry.changes.summary.modified} Modified
                                </span>
                              )}
                            </div>
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                              <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                        </div>
                        {/* Delete button */}
                        <div className="flex items-center pr-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const entryToDelete = findEntryById(uniqueId);
                              console.log('Attempting to delete entry:', uniqueId, entryToDelete);
                              confirmDelete(uniqueId);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                            aria-label="Delete history entry"
                            title="Delete history entry"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                          {/* Mobile summary badges */}
                          <div className="flex sm:hidden items-center space-x-2 mb-4">
                            {entry.changes.summary.removed > 0 && (
                              <span className="px-2.5 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                {entry.changes.summary.removed} Removed
                              </span>
                            )}
                            {entry.changes.summary.added > 0 && (
                              <span className="px-2.5 py-1 text-xs rounded-full bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                {entry.changes.summary.added} Added
                              </span>
                            )}
                            {entry.changes.summary.modified > 0 && (
                              <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {entry.changes.summary.modified} Modified
                              </span>
                            )}
                          </div>
                          
                          {/* Combine all changes without severity section headers */}
                          <div className="space-y-3">
                            {/* Combine all changes together */}
                            {[...entry.changes.critical, ...entry.changes.high, ...entry.changes.medium, ...entry.changes.low].map((change, changeIndex) => {
                              // Get appropriate background color based on change type
                              let bgColorClass = "bg-gray-50 dark:bg-gray-900 dark:bg-opacity-20";
                              if (change.type === 'removed' || change.type === 'replacement') {
                                bgColorClass = "bg-red-50 dark:bg-red-900 dark:bg-opacity-10";
                              } else if (change.type === 'added') {
                                bgColorClass = "bg-green-50 dark:bg-green-900 dark:bg-opacity-10";
                              } else if (change.type === 'date_changed') {
                                bgColorClass = "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-10";
                              }
                              
                              return (
                                <div key={changeIndex} className={`p-3 rounded-md ${bgColorClass} border border-gray-100 dark:border-gray-800`}>
                                  {renderChangeDetails(change)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* Show delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this history entry? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (deleteTargetId) {
                        console.log('Confirming deletion of entry ID:', deleteTargetId);
                        const entryToDelete = findEntryById(deleteTargetId);
                        console.log('Entry to delete:', entryToDelete);
                        handleDeleteEntry(deleteTargetId);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                    disabled={deleteLoading}
                  >
                    {deleteLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Original non-grouped view
      return (
        <div className="space-y-4">
          {paginatedData.map((entry, index) => {
            const uniqueId = getUniqueId(entry, index);
            const isExpanded = expandedItems[uniqueId] || false;
            const changeCount = entry.changes.critical.length + entry.changes.high.length + entry.changes.medium.length + entry.changes.low.length;
            
            return (
              <div 
                key={uniqueId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-150"
              >
                <div className="flex justify-between">
                  <div 
                    className="p-4 cursor-pointer flex-grow flex justify-between items-center"
                    onClick={() => toggleExpand(uniqueId)}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900 dark:bg-opacity-30 flex items-center justify-center mr-4">
                        <FiCalendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white mb-0.5 flex items-center">
                          {entry.date.split(',')[0]} {/* Show date without year */}
                          {entry.date.includes(',') && entry.date.split(',').length > 1 && (
                            <span className="mx-1 text-gray-700 dark:text-gray-300">
                              {entry.date.split(',')[1].trim()}
                            </span>
                          )}
                          {entry.timestamp && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({getRelativeTimeFrame(entry.timestamp)})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {changeCount} {changeCount === 1 ? 'change' : 'changes'} detected
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="hidden sm:flex items-center space-x-2">
                        {entry.changes.summary.removed > 0 && (
                          <span className="px-2.5 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            {entry.changes.summary.removed} Removed
                          </span>
                        )}
                        {entry.changes.summary.added > 0 && (
                          <span className="px-2.5 py-1 text-xs rounded-full bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                            {entry.changes.summary.added} Added
                          </span>
                        )}
                        {entry.changes.summary.modified > 0 && (
                          <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {entry.changes.summary.modified} Modified
                          </span>
                        )}
                      </div>
                      <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                    </div>
                  </div>
                  {/* Delete button */}
                  <div className="flex items-center pr-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const entryToDelete = findEntryById(uniqueId);
                        console.log('Attempting to delete entry:', uniqueId, entryToDelete);
                        confirmDelete(uniqueId);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      aria-label="Delete history entry"
                      title="Delete history entry"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    {/* Mobile summary badges */}
                    <div className="flex sm:hidden items-center space-x-2 mb-4">
                      {entry.changes.summary.removed > 0 && (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                          {entry.changes.summary.removed} Removed
                        </span>
                      )}
                      {entry.changes.summary.added > 0 && (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                          {entry.changes.summary.added} Added
                        </span>
                      )}
                      {entry.changes.summary.modified > 0 && (
                        <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {entry.changes.summary.modified} Modified
                        </span>
                      )}
                    </div>
                    
                    {/* Combine all changes without severity section headers */}
                    <div className="space-y-3">
                      {/* Combine all changes together */}
                      {[...entry.changes.critical, ...entry.changes.high, ...entry.changes.medium, ...entry.changes.low].map((change, changeIndex) => {
                        // Get appropriate background color based on change type
                        let bgColorClass = "bg-gray-50 dark:bg-gray-900 dark:bg-opacity-20";
                        if (change.type === 'removed' || change.type === 'replacement') {
                          bgColorClass = "bg-red-50 dark:bg-red-900 dark:bg-opacity-10";
                        } else if (change.type === 'added') {
                          bgColorClass = "bg-green-50 dark:bg-green-900 dark:bg-opacity-10";
                        } else if (change.type === 'date_changed') {
                          bgColorClass = "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-10";
                        }
                        
                        return (
                          <div key={changeIndex} className={`p-3 rounded-md ${bgColorClass} border border-gray-100 dark:border-gray-800`}>
                            {renderChangeDetails(change)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Show delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this history entry? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (deleteTargetId) {
                        console.log('Confirming deletion of entry ID:', deleteTargetId);
                        const entryToDelete = findEntryById(deleteTargetId);
                        console.log('Entry to delete:', entryToDelete);
                        handleDeleteEntry(deleteTargetId);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                    disabled={deleteLoading}
                  >
                    {deleteLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">History</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track and review changes to your schedule
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center rounded-md px-3.5 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 ${
              showFilters 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <FiFilter className={`mr-2 h-4 w-4 ${showFilters ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
            {showFilters ? 'Hide Filters' : 'Filter Results'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <FiRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {/* Navigation Tabs - removed as only one tab is used */}
      
      {/* Improved Filters */}
      {showFilters && (
        <div className="mb-6 p-5 bg-slate-900 dark:bg-gray-800 rounded-lg shadow-md border border-slate-700 dark:border-gray-700 transition-all duration-200 ease-in-out">
          <h3 className="text-lg font-medium text-white dark:text-gray-100 mb-5">Filter History</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div>
              {/* Search field */}
              <div className="mb-5">
                <label htmlFor="search" className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                  Search
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="search"
                    id="search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 block w-full rounded-md border-slate-700 dark:border-gray-600 bg-slate-800 dark:bg-gray-700 text-white dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm transition-colors duration-200"
                    placeholder="Search by job ID, store, or date..."
                  />
                  {searchTerm && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-gray-400 hover:text-gray-300 dark:hover:text-gray-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Change Type Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                  Change Types
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChangeTypeFilter({...changeTypeFilter, removed: !changeTypeFilter.removed})}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      changeTypeFilter.removed 
                        ? 'bg-red-900 bg-opacity-50 text-red-200 border border-red-800' 
                        : 'bg-slate-800 bg-opacity-50 text-gray-400 border border-slate-700'
                    } transition-colors duration-200`}
                  >
                    <FiAlertCircle className="w-4 h-4 mr-1.5" />
                    <span>Removed</span>
                  </button>
                  <button
                    onClick={() => setChangeTypeFilter({...changeTypeFilter, added: !changeTypeFilter.added})}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      changeTypeFilter.added 
                        ? 'bg-green-900 bg-opacity-50 text-green-200 border border-green-800' 
                        : 'bg-slate-800 bg-opacity-50 text-gray-400 border border-slate-700'
                    } transition-colors duration-200`}
                  >
                    <FiPlusCircle className="w-4 h-4 mr-1.5" />
                    <span>Added</span>
                  </button>
                  <button
                    onClick={() => setChangeTypeFilter({...changeTypeFilter, modified: !changeTypeFilter.modified})}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      changeTypeFilter.modified 
                        ? 'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-800' 
                        : 'bg-slate-800 bg-opacity-50 text-gray-400 border border-slate-700'
                    } transition-colors duration-200`}
                  >
                    <FiArrowRight className="w-4 h-4 mr-1.5" />
                    <span>Modified</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Right column */}
            <div>
              {/* Date Range Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                  Date Range
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        name="start-date"
                        id="start-date"
                        value={dateRange.start}
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                        className="pl-10 block w-full rounded-md border-slate-700 dark:border-gray-600 bg-slate-800 dark:bg-gray-700 text-white dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm transition-colors duration-200"
                        placeholder="mm/dd/yyyy"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <FiArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                    
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        name="end-date"
                        id="end-date"
                        value={dateRange.end}
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                        className="pl-10 block w-full rounded-md border-slate-700 dark:border-gray-600 bg-slate-800 dark:bg-gray-700 text-white dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm transition-colors duration-200"
                        placeholder="mm/dd/yyyy"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        const today = new Date();
                        setDateRange({
                          start: today.toISOString().slice(0, 10),
                          end: today.toISOString().slice(0, 10)
                        });
                      }}
                      className="py-2 px-3 text-sm text-center text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors duration-200"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(today.getDate() - 1);
                        setDateRange({
                          start: yesterday.toISOString().slice(0, 10),
                          end: yesterday.toISOString().slice(0, 10)
                        });
                      }}
                      className="py-2 px-3 text-sm text-center text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors duration-200"
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const lastWeek = new Date();
                        lastWeek.setDate(today.getDate() - 7);
                        setDateRange({
                          start: lastWeek.toISOString().slice(0, 10),
                          end: today.toISOString().slice(0, 10)
                        });
                      }}
                      className="py-2 px-3 text-sm text-center text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors duration-200"
                    >
                      Last 7 days
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const lastMonth = new Date();
                        lastMonth.setMonth(today.getMonth() - 1);
                        setDateRange({
                          start: lastMonth.toISOString().slice(0, 10),
                          end: today.toISOString().slice(0, 10)
                        });
                      }}
                      className="py-2 px-3 text-sm text-center text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors duration-200"
                    >
                      Last 30 days
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-700 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-400 dark:text-gray-400">
              {filteredData.length} {filteredData.length === 1 ? 'result' : 'results'} found
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetFilters}
                className="inline-flex items-center px-3 py-2 border border-slate-600 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 dark:text-gray-200 bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Filters
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="inline-flex items-center px-3 py-2 border border-blue-700 rounded-md shadow-sm text-sm font-medium text-blue-300 bg-blue-900 bg-opacity-30 hover:bg-blue-800 hover:bg-opacity-30 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Stats */}
      {!loading && !error && historyData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 rounded-full p-3">
                <FiAlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Removals</h3>
                <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
                  {filteredData.reduce((total, entry) => total + entry.changes.summary.removed, 0)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 rounded-full p-3">
                <FiPlusCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Additions</h3>
                <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
                  {filteredData.reduce((total, entry) => total + entry.changes.summary.added, 0)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 rounded-full p-3">
                <FiArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Modifications</h3>
                <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
                  {filteredData.reduce((total, entry) => total + entry.changes.summary.modified, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Change History</h2>
          <div className="flex items-center">
            <label htmlFor="groupByDay" className="mr-2 text-sm text-gray-700 dark:text-gray-300">
              Group by day
            </label>
            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
              <input 
                type="checkbox" 
                name="groupByDay" 
                id="groupByDay" 
                checked={groupByDay}
                onChange={() => setGroupByDay(!groupByDay)}
                className="absolute block w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-4 border-gray-300 dark:border-gray-600 appearance-none cursor-pointer focus:outline-none transition-transform duration-200 ease-in"
                style={{ 
                  transform: groupByDay ? 'translateX(100%)' : 'translateX(0)', 
                  backgroundColor: groupByDay ? '#3b82f6' : '#ffffff',
                  borderColor: groupByDay ? '#3b82f6' : '#d1d5db' 
                }}
              />
              <label 
                htmlFor="groupByDay" 
                className="block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer"
              />
            </div>
          </div>
        </div>
        {renderContent()}
      </div>
      
      {/* Quick Download Option (optional) */}
      {!loading && !error && historyData.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              // This is just a UI example - would need actual export functionality
              alert("Export functionality would be implemented here");
            }}
            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export History
          </button>
        </div>
      )}
    </div>
  );
};

export default History; 