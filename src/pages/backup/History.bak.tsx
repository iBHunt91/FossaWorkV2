import React, { useState, useEffect } from 'react';
import { FiCalendar, FiChevronDown, FiChevronUp, FiAlertCircle, FiPlusCircle, FiArrowRight, FiRefreshCw, FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiClock, FiList, FiArchive, FiFile, FiTrash2, FiEye } from 'react-icons/fi';
import { ENDPOINTS } from '../config/api';

interface ChangeHistory {
  date: string;
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
  // Active view tabs
  const [activeTab, setActiveTab] = useState<'changes' | 'archives'>('changes');
  
  // Live changes states
  const [historyData, setHistoryData] = useState<ChangeHistory[]>([]);
  const [filteredData, setFilteredData] = useState<ChangeHistory[]>([]);
  const [paginatedData, setPaginatedData] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Archive states
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveContent | null>(null);
  const [loadingArchives, setLoadingArchives] = useState<boolean>(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  
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
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  });

  // Add new state for delete confirmation
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      const url = await ENDPOINTS.HISTORY();
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load history data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setHistoryData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching history data:', err);
      setError('Failed to load history data. Please try again later.');
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    try {
      setLoadingArchives(true);
      setArchiveError(null);
      const url = await ENDPOINTS.SCHEDULE_ARCHIVES();
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load archive data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const archiveData = data.archives || [];
      
      // Enhance with summary data where available
      const enhancedArchives = await Promise.all(
        archiveData.map(async (archive: ArchiveItem) => {
          try {
            const detailUrl = await ENDPOINTS.SCHEDULE_ARCHIVE(archive.id);
            const detailResponse = await fetch(detailUrl);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              return {
                ...archive,
                summary: detailData.summary
              };
            }
          } catch (e) {
            console.error(`Could not fetch details for archive ${archive.id}`, e);
          }
          return archive;
        })
      );
      
      setArchives(enhancedArchives);
      setLoadingArchives(false);
    } catch (err) {
      console.error('Error fetching archive data:', err);
      setArchiveError('Failed to load history data. Please try again later.');
      setLoadingArchives(false);
    }
  };

  const fetchArchiveContent = async (archiveId: string) => {
    try {
      setLoadingArchives(true);
      setArchiveError(null);
      const url = await ENDPOINTS.SCHEDULE_ARCHIVE(archiveId);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load archive content: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setSelectedArchive(data);
      setLoadingArchives(false);
    } catch (err) {
      console.error('Error fetching archive content:', err);
      setArchiveError('Failed to load archive content. Please try again later.');
      setLoadingArchives(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'changes') {
      fetchHistoryData();
    } else {
      fetchArchives();
    }
  }, [activeTab]);

  useEffect(() => {
    filterData();
  }, [historyData, searchTerm, dateRange, severityFilter]);

  useEffect(() => {
    paginateData();
  }, [filteredData, pagination.currentPage, pagination.itemsPerPage]);

  const filterData = () => {
    let filtered = [...historyData];
    
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
    
    // Filter entries with no changes after severity filtering
    filtered = filtered.filter(entry => 
      entry.changes.critical.length > 0 || 
      entry.changes.high.length > 0 || 
      entry.changes.medium.length > 0 || 
      entry.changes.low.length > 0
    );
    
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
    
    setFilteredData(filtered);
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      currentPage: 1,
      totalPages: Math.max(1, Math.ceil(filtered.length / prev.itemsPerPage))
    }));
  };

  const filterArchives = () => {
    let filtered = [...archives];
    
    // Apply date range filtering
    if (dateRange.start) {
      filtered = filtered.filter(archive => new Date(archive.timestamp) >= new Date(dateRange.start));
    }
    
    if (dateRange.end) {
      filtered = filtered.filter(archive => new Date(archive.timestamp) <= new Date(dateRange.end));
    }
    
    // Apply search term filtering
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(archive => 
        archive.date.toLowerCase().includes(term) || 
        archive.id.toLowerCase().includes(term)
      );
    }
    
    return filtered;
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

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    if (activeTab === 'changes') {
      await fetchHistoryData();
    } else {
      await fetchArchives();
      setSelectedArchive(null);
    }
    
    setRefreshing(false);
  };

  // Create a unique ID for each history entry since dates might not be unique
  const getUniqueId = (entry: ChangeHistory, index: number) => {
    return `${entry.date}-${index}`;
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
      
      // Refresh the archives list
      await fetchArchives();
      
      // If the deleted archive was selected, clear the selection
      if (selectedArchive?.id === archiveId) {
        setSelectedArchive(null);
      }
      
      setDeletingArchiveId(null);
    } catch (err) {
      console.error('Error deleting archive:', err);
      setArchiveError('Failed to delete archive. Please try again later.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Render change details with fixed date formatting
  const renderChangeDetails = (change: ChangeItem) => {
    switch (change.type) {
      case 'removed':
        return (
          <div className="flex items-start">
            {getChangeIcon(change.type)}
            <div className="ml-2">
              <span className="text-red-600 dark:text-red-400 font-medium">Visit Removed</span>
              <div className="mt-1">
                <span className="font-medium">Visit #{change.jobId}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store #{change.store})</span>}
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
                <span className="font-medium">Visit #{change.jobId}</span> 
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store #{change.store})</span>}
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
                <span>Visit #{change.jobId}</span>
                {change.storeName && <span> at <span className="font-medium">{change.storeName}</span></span>} 
                {change.store && <span> (Store #{change.store})</span>}: 
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
                <span className="font-medium">Visit #{change.removedJobId}</span> 
                {change.removedStoreName && <span> at <span className="font-medium">{change.removedStoreName}</span></span>} 
                {change.removedStore && <span> (Store #{change.removedStore})</span>}
                {change.removedDispensers !== undefined && 
                  <span>, {change.removedDispensers} {change.removedDispensers === 1 ? 'dispenser' : 'dispensers'}</span>
                }
                <span> was <span className="font-bold text-red-500">removed</span> and replaced with </span>
                <span className="font-medium">Visit #{change.addedJobId}</span> 
                {change.addedStoreName && <span> at <span className="font-medium">{change.addedStoreName}</span></span>} 
                {change.addedStore && <span> (Store #{change.addedStore})</span>}
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
    setShowFilters(false);
  };

  // Render tabs for navigation
  const renderTabs = () => {
    return (
      <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`flex items-center px-4 py-2 font-medium ${
            activeTab === 'changes'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('changes')}
        >
          <FiClock className="w-4 h-4 mr-2" />
          Change History
        </button>
        <button
          className={`flex items-center px-4 py-2 font-medium ${
            activeTab === 'archives'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('archives')}
        >
          <FiArchive className="w-4 h-4 mr-2" />
          Archived Reports
        </button>
      </div>
    );
  };

  // Format a readable date from archive ID
  const formatArchiveDate = (id: string): string => {
    try {
      const timestamp = id.replace('schedule_changes_', '').replace(/\.(txt|json)$/, '');
      return timestamp.replace(/T/g, ' ').replace(/-/g, (m, i) => {
        return i < 10 ? '/' : (i < 16 ? ':' : '-');
      });
    } catch (e) {
      return id;
    }
  };

  // Render archive content
  const renderArchiveContent = () => {
    if (!selectedArchive) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FiFile className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Select an archive to view its contents</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 dark:text-white">Schedule Changes Report</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatArchiveDate(selectedArchive.id)}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-3 rounded-md text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedArchive.summary.removed}</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Removed</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-3 rounded-md text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedArchive.summary.added}</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Added</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-md text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedArchive.summary.modified}</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Modified</div>
          </div>
        </div>
        
        {selectedArchive.changes.critical.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Critical Changes</h4>
            <div className="border border-red-200 dark:border-red-900 rounded-md">
              {selectedArchive.changes.critical.map((change, index) => (
                <div key={index} className="p-3 border-b border-red-200 dark:border-red-900 last:border-0">
                  {change}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {selectedArchive.changes.high.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-2">High Severity Changes</h4>
            <div className="border border-orange-200 dark:border-orange-900 rounded-md">
              {selectedArchive.changes.high.map((change, index) => (
                <div key={index} className="p-3 border-b border-orange-200 dark:border-orange-900 last:border-0">
                  {change}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
          <h4 className="font-medium mb-2">Raw Content</h4>
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-80">
            {selectedArchive.content}
          </pre>
        </div>
      </div>
    );
  };

  // Render the archive items
  const renderArchiveList = () => {
    const filteredArchives = filterArchives();
    
    if (loadingArchives && filteredArchives.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <div className="spinner-border animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading archives...</p>
        </div>
      );
    }

    if (archiveError) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <FiAlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-lg font-medium text-gray-800 dark:text-white">Error loading archives</p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{archiveError}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (filteredArchives.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <FiArchive className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
          <div className="text-gray-500 dark:text-gray-400 text-center">
            <p className="text-lg font-medium">No schedule archives found</p>
            <p className="text-sm mt-2">Archives will be created when significant schedule changes are detected</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full">
        <div className="w-1/3 pr-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Schedule Archives</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select an archive to view the recorded changes
              </p>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredArchives.map((archive: ArchiveItem) => (
                <li key={archive.id}>
                  <div className="relative hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                    <button
                      onClick={() => fetchArchiveContent(archive.id)}
                      className={`w-full text-left p-4 ${
                        selectedArchive?.id === archive.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3">
                          {archive.format === 'json' ? 
                            <FiFile className="h-5 w-5 text-blue-500" /> : 
                            <FiArchive className="h-5 w-5 text-amber-500" />
                          }
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">
                            {archive.date}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {archive.format === 'json' ? 'JSON Format' : 'Text Format'}
                          </div>
                        </div>
                      </div>
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingArchiveId(archive.id);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-100 dark:hover:bg-red-900 dark:hover:bg-opacity-30 transition-opacity"
                      title="Delete archive"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                    
                    {/* Confirmation dialog */}
                    {deletingArchiveId === archive.id && (
                      <div className="absolute inset-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-between p-4">
                        <span className="text-red-600 dark:text-red-400 text-sm font-medium">Delete this archive?</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteArchive(archive.id);
                            }}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? 'Deleting...' : 'Yes'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingArchiveId(null);
                            }}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-sm rounded"
                            disabled={deleteLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="w-2/3 pl-4">
          {loadingArchives && selectedArchive ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="spinner-border animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading archive content...</p>
            </div>
          ) : selectedArchive ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Schedule Changes Report</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatArchiveDate(selectedArchive.id)}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedArchive.summary.removed}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Removed</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedArchive.summary.added}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Added</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedArchive.summary.modified}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Modified</div>
                </div>
              </div>
              
              {selectedArchive.changes.critical.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Critical Changes</h4>
                  <div className="border border-red-200 dark:border-red-900 rounded-md">
                    {selectedArchive.changes.critical.map((change, index) => (
                      <div key={index} className="p-3 border-b border-red-200 dark:border-red-900 last:border-0">
                        {change}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedArchive.changes.high.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-2">High Severity Changes</h4>
                  <div className="border border-orange-200 dark:border-orange-900 rounded-md">
                    {selectedArchive.changes.high.map((change, index) => (
                      <div key={index} className="p-3 border-b border-orange-200 dark:border-orange-900 last:border-0">
                        {change}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <h4 className="font-medium mb-2">Raw Content</h4>
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-80">
                  {selectedArchive.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <FiFile className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Select an archive to view its contents</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the main content based on active tab
  const renderContent = () => {
    if (activeTab === 'archives') {
      return renderArchiveList();
    }
    
    // Default to changes view
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <div className="spinner-border animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading change history...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <FiAlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-lg font-medium text-gray-800 dark:text-white">Error loading history</p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (historyData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <FiCalendar className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
          <div className="text-gray-500 dark:text-gray-400 text-center">
            <p className="text-lg font-medium">No change history found</p>
            <p className="text-sm mt-2">Changes to your schedule will appear here once detected</p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {paginatedData.map((entry, index) => {
          const uniqueId = getUniqueId(entry, index);
          const isExpanded = expandedItems[uniqueId] || false;
          const changeCount = entry.changes.critical.length + entry.changes.high.length + entry.changes.medium.length + entry.changes.low.length;
          
          return (
            <div 
              key={uniqueId}
              className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer flex justify-between items-center"
                onClick={() => toggleExpand(uniqueId)}
              >
                <div className="flex items-center">
                  <FiCalendar className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-3" />
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white">{entry.date}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {changeCount} {changeCount === 1 ? 'change' : 'changes'} detected
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {entry.changes.critical.length > 0 && (
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityBgColor('critical')} ${getSeverityColor('critical')}`}>
                        {entry.changes.critical.length} Critical
                      </span>
                    )}
                    {entry.changes.high.length > 0 && (
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityBgColor('high')} ${getSeverityColor('high')}`}>
                        {entry.changes.high.length} High
                      </span>
                    )}
                  </div>
                  {isExpanded ? 
                    <FiChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" /> : 
                    <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  }
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{entry.changes.summary.removed}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Removed</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{entry.changes.summary.added}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Added</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-md text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{entry.changes.summary.modified}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">Jobs Modified</div>
                    </div>
                  </div>
                  
                  {entry.changes.critical.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Critical Changes</h4>
                      <div className="space-y-4">
                        {entry.changes.critical.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-10 rounded-md">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {entry.changes.high.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-2">High Severity Changes</h4>
                      <div className="space-y-4">
                        {entry.changes.high.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-orange-50 dark:bg-orange-900 dark:bg-opacity-10 rounded-md">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {entry.changes.medium.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium text-yellow-600 dark:text-yellow-400 mb-2">Medium Severity Changes</h4>
                      <div className="space-y-4">
                        {entry.changes.medium.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10 rounded-md">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {entry.changes.low.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">Low Severity Changes</h4>
                      <div className="space-y-4">
                        {entry.changes.low.map((change, changeIndex) => (
                          <div key={changeIndex} className="p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-10 rounded-md">
                            {renderChangeDetails(change)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center text-sm">
              <span className="mr-2">Items per page:</span>
              <select 
                value={pagination.itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-5 h-5" />
                <FiChevronLeft className="w-5 h-5 -ml-3" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              
              <span className="text-sm">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-5 h-5" />
                <FiChevronRight className="w-5 h-5 -ml-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Change History</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your schedule change reports
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <FiFilter className="mr-2 h-4 w-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="search"
                  id="search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Search history..."
                />
              </div>
            </div>
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <div className="mt-1">
                <input
                  type="date"
                  name="start-date"
                  id="start-date"
                  value={dateRange.start}
                  onChange={e => setDateRange({...dateRange, start: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <div className="mt-1">
                <input
                  type="date"
                  name="end-date"
                  id="end-date"
                  value={dateRange.end}
                  onChange={e => setDateRange({...dateRange, end: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {loading && !selectedArchive && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Schedule Archives</h2>
          {!loading && renderArchiveList()}
        </div>
        
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Archive Details</h2>
          {loading && selectedArchive ? (
            <div className="flex justify-center py-12 bg-white shadow sm:rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            renderArchiveContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default History; 