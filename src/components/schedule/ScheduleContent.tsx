import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispenserData } from '../../context/DispenserContext';
import { useToast } from '../../hooks/useToast';
import CalendarView from '../CalendarView';
import { Skeleton } from '../Skeleton';
import DispenserModal from '../DispenserModal';
import StoreFilterNeedsModal from '../StoreFilterNeedsModal';
import InstructionsModal from '../InstructionsModal';
import { clearDispenserData, forceRescrapeDispenserData } from '../../services/scrapeService';
import { 
  WorkOrder, 
  WorkWeekDates, 
  GroupedWorkOrders, 
  StoreFilter, 
  ViewMode, 
  CalendarEvent,
  ScheduleStats,
  Dispenser 
} from './ScheduleTypes';
import { 
  calculateWorkWeekDates,
  calculateWorkWeekDatesSync,
  getStoreTypeForFiltering, 
  extractVisitNumber, 
  processInstructions 
} from './ScheduleUtils';

import Panel from './Panel';
import ScheduleHeader from './ScheduleHeader';
import WeekNavigator from './WeekNavigator';
import StoreFilterComponent from './StoreFilter';
import ViewSelector from './ViewSelector';
import WeeklyView from './WeeklyView';
import CompactView from './CompactView';

interface ScheduleContentProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
}

const ScheduleContent: React.FC<ScheduleContentProps> = ({ workOrders, isLoading }) => {
  
  const { addToast } = useToast();
  const { dispenserData, loadDispenserData } = useDispenserData();
  
  // State
  const [activeFilter, setActiveFilter] = useState<StoreFilter>('all');
  const [activeView, setActiveView] = useState<ViewMode>('weekly');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [workWeekDates, setWorkWeekDates] = useState<WorkWeekDates>(calculateWorkWeekDatesSync(new Date()));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  
  // Modal state
  const [showDispenserModal, setShowDispenserModal] = useState(false);
  const [selectedDispensers, setSelectedDispensers] = useState<Dispenser[]>([]);
  const [selectedOrderIdModal, setSelectedOrderIdModal] = useState<string>('');
  const [selectedVisitNumberModal, setSelectedVisitNumberModal] = useState<string>('');
  const [selectedStoreNumberModal, setSelectedStoreNumberModal] = useState<string>('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WorkOrder | null>(null);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [selectedInstructions, setSelectedInstructions] = useState<string>('');
  const [selectedOrderName, setSelectedOrderName] = useState<string>('');

  // Update work week dates when selected date changes
  useEffect(() => {
    const updateWorkWeekDates = async () => {
      try {
        const dates = await calculateWorkWeekDates(selectedDate);
        setWorkWeekDates(dates);
      } catch (error) {
        console.error('Error calculating work week dates:', error);
        // Fallback to sync method if async fails
        setWorkWeekDates(calculateWorkWeekDatesSync(selectedDate));
      }
    };
    
    updateWorkWeekDates();
  }, [selectedDate]);

  // Filter work orders based on active filter
  const filteredWorkOrders = useMemo(() => {
    if (!workOrders || !Array.isArray(workOrders)) return [];
    if (activeFilter === 'all') return workOrders;
    
    return workOrders.filter(order => {
      const storeType = getStoreTypeForFiltering(order);
      return storeType === activeFilter;
    });
  }, [workOrders, activeFilter]);

  // Group work orders with safety checks
  const groupAndSortWorkOrders = useCallback((): GroupedWorkOrders => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd } = workWeekDates;

    if (!filteredWorkOrders || !Array.isArray(filteredWorkOrders)) {
      console.warn('groupAndSortWorkOrders: filteredWorkOrders is not an array', filteredWorkOrders);
      return { currentDay: [], thisWeek: [], nextWeek: [], other: [] };
    }

    const sortedOrders = [...filteredWorkOrders].sort((a, b) => {
      try {
        const dateA = new Date(a?.visits?.nextVisit?.date || a?.nextVisitDate || a?.visitDate || a?.date || 0);
        const dateB = new Date(b?.visits?.nextVisit?.date || b?.nextVisitDate || b?.visitDate || b?.date || 0);
        return dateA.getTime() - dateB.getTime();
      } catch (error) {
        console.error('Error sorting orders:', error);
        return 0;
      }
    });
    
    const groups: GroupedWorkOrders = { currentDay: [], thisWeek: [], nextWeek: [], other: [] };

    sortedOrders.forEach((order, index) => {
      try {
        const orderDateStr = order?.visits?.nextVisit?.date || order?.nextVisitDate || order?.visitDate || order?.date;
        if (!orderDateStr) {
          groups.other.push(order); 
          return;
        }
        const orderDate = new Date(orderDateStr);
        if (isNaN(orderDate.getTime())) {
          console.warn(`Invalid date for order at index ${index}:`, orderDateStr);
          groups.other.push(order);
          return;
        }
        orderDate.setHours(0,0,0,0);

        if (orderDate.getTime() === today.getTime()) groups.currentDay.push(order);
        if (orderDate >= currentWeekStart && orderDate <= currentWeekEnd) groups.thisWeek.push(order);
        else if (orderDate >= nextWeekStart && orderDate <= nextWeekEnd) groups.nextWeek.push(order);
        else groups.other.push(order);
      } catch (error) {
        console.error(`Error processing order at index ${index}:`, error);
        groups.other.push(order);
      }
    });
    return groups;
  }, [filteredWorkOrders, workWeekDates]);

  const groupedWorkOrders = useMemo(() => {
    if (isLoading) return { currentDay: [], thisWeek: [], nextWeek: [], other: [] };
    return groupAndSortWorkOrders();
  }, [isLoading, groupAndSortWorkOrders]);

  // Calculate calendar events
  const calendarEvents = useMemo((): CalendarEvent[] => {
    if (!filteredWorkOrders || !Array.isArray(filteredWorkOrders)) return [];
    
    return filteredWorkOrders.map(wo => {
      const jobDate = wo.visits?.nextVisit?.date || wo.nextVisitDate || wo.visitDate || wo.scheduledDate || wo.date;
      return {
        id: wo.id,
        title: `${wo.customer.name}${wo.customer.storeNumber ? ` (#${wo.customer.storeNumber.replace(/^#+/, '')})` : ''}`,
        date: jobDate || new Date().toISOString(),
        storeType: getStoreTypeForFiltering(wo),
        storeNumber: wo.customer.storeNumber?.replace(/^#+/, '') || undefined,
        visitNumber: extractVisitNumber(wo) === 'N/A' ? undefined : extractVisitNumber(wo),
        dispensers: wo.dispensers,
        instructions: wo.instructions,
        services: wo.services,
      };
    });
  }, [filteredWorkOrders]);

  // Calculate stats with safety checks
  const calculateScheduleStats = (): ScheduleStats => {
    if (!filteredWorkOrders || !Array.isArray(filteredWorkOrders)) {
      console.warn('calculateScheduleStats: filteredWorkOrders is not an array', filteredWorkOrders);
      return {
        currentWeekJobCount: 0,
        nextWeekJobCount: 0,
        storeDistributionForCurrentWeek: {},
        storeDistributionForNextWeek: {}
      };
    }
    
    const currentWeekJobCount = filteredWorkOrders.filter(order => {
      try {
        const orderDateStr = order?.visits?.nextVisit?.date || order?.nextVisitDate || order?.visitDate || order?.date;
        if (!orderDateStr) return false;
        const orderDate = new Date(orderDateStr);
        if (isNaN(orderDate.getTime())) return false;
        orderDate.setHours(0,0,0,0);
        return orderDate >= workWeekDates.currentWeekStart && orderDate <= workWeekDates.currentWeekEnd;
      } catch (error) {
        console.error('Error processing order for current week count:', error);
        return false;
      }
    }).length;

    const nextWeekJobCount = filteredWorkOrders.filter(order => {
      try {
        const orderDateStr = order?.visits?.nextVisit?.date || order?.nextVisitDate || order?.visitDate || order?.date;
        if (!orderDateStr) return false;
        const orderDate = new Date(orderDateStr);
        if (isNaN(orderDate.getTime())) return false;
        orderDate.setHours(0,0,0,0);
        return orderDate >= workWeekDates.nextWeekStart && orderDate <= workWeekDates.nextWeekEnd;
      } catch (error) {
        console.error('Error processing order for next week count:', error);
        return false;
      }
    }).length;

    const storeDistributionForCurrentWeek: Record<string, number> = {};
    const storeDistributionForNextWeek: Record<string, number> = {};
    
    filteredWorkOrders.forEach((order, index) => {
      try {
        const orderDateStr = order?.visits?.nextVisit?.date || order?.nextVisitDate || order?.visitDate || order?.date;
        if (!orderDateStr) return;
        const orderDate = new Date(orderDateStr);
        if (isNaN(orderDate.getTime())) return;
        orderDate.setHours(0,0,0,0);

        const storeType = getStoreTypeForFiltering(order);
        
        if (orderDate >= workWeekDates.currentWeekStart && orderDate <= workWeekDates.currentWeekEnd) {
          storeDistributionForCurrentWeek[storeType] = (storeDistributionForCurrentWeek[storeType] || 0) + 1;
        }
        
        if (orderDate >= workWeekDates.nextWeekStart && orderDate <= workWeekDates.nextWeekEnd) {
          storeDistributionForNextWeek[storeType] = (storeDistributionForNextWeek[storeType] || 0) + 1;
        }
      } catch (error) {
        console.error(`Error processing order at index ${index} for distribution:`, error);
      }
    });

    return { currentWeekJobCount, nextWeekJobCount, storeDistributionForCurrentWeek, storeDistributionForNextWeek };
  };

  // Handlers
  const goToCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  const handleToggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const openWorkFossaWithLogin = async (targetUrl: string = 'https://app.workfossa.com') => {
    try {
      const activeUserId = localStorage.getItem('activeUserId');
      
      if (!activeUserId) {
        addToast('warning', 'No active user selected. Please select a user from the User Management page.');
        throw new Error('No active user found. Please select a user first.');
      }
      
      const response = await fetch(`/api/users/${activeUserId}/credentials`);
      
      if (!response.ok) {
        addToast('error', 'Could not fetch user credentials. Ensure a user is selected and credentials are set.');
        throw new Error('Failed to get active user credentials');
      }
      
      const credentials = await response.json();
      
      if (!credentials.email || !credentials.password) {
        addToast('error', 'User credentials incomplete. Please update them in User Management.');
        throw new Error('Active user has incomplete credentials');
      }
      
      // @ts-ignore
      const result = await window.electron.openUrlWithActiveUser({
        url: targetUrl,
        email: credentials.email,
        password: credentials.password
      });
      
      if (!result.success) {
        addToast('error', result.message || 'Failed to open WorkFossa. Check console for details.');
        throw new Error(result.message || 'Failed to open WorkFossa');
      }
      
      addToast('info', 'Opening WorkFossa with active user credentials...');
    } catch (error) {
      console.error('Error opening WorkFossa:', error);
    }
  };

  const handleForceRescrapeDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: true}));
    addToast('info', 'Starting dispenser data rescrape...');
    try {
      await forceRescrapeDispenserData(orderId);
      addToast('success', 'Dispenser rescrape initiated.');
    } catch (error) {
      addToast('error', 'Failed to force rescrape dispenser data.', 3000);
      console.error('Error forcing rescrape:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`rescrape-${orderId}`]: false}));
    }
  };

  const handleClearDispenserData = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOperationLoading(prev => ({...prev, [`clear-${orderId}`]: true}));
    try {
      await clearDispenserData(orderId);
      addToast('success', 'Dispenser data cleared successfully.');
      await loadDispenserData(true, true); 
    } catch (error) { 
      addToast('error', 'Failed to clear dispenser data.');
      console.error('Error clearing dispenser data:', error);
    } finally {
      setOperationLoading(prev => ({...prev, [`clear-${orderId}`]: false}));
    }
  };

  const handleViewInstructions = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    setSelectedInstructions(order.instructions || 'No instructions available');
    setSelectedOrderName(order.customer.name);
    setIsInstructionsModalOpen(true);
  };

  const handleViewDispenserData = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
    const currentDispensers = (order.dispensers && order.dispensers.length > 0) 
      ? order.dispensers 
      : (contextDispensers && contextDispensers.length > 0 ? contextDispensers : []);
    
    setSelectedDispensers(currentDispensers);
    setSelectedOrderIdModal(order.id);
    setSelectedVisitNumberModal(extractVisitNumber(order));
    setSelectedStoreNumberModal(order.customer?.storeNumber || '');
    setShowDispenserModal(true);
  };

  const handleOpenFilterModal = (order: WorkOrder) => {
    const contextDispensers = dispenserData?.dispenserData?.[order.id]?.dispensers;
    if (!order.dispensers?.length && contextDispensers?.length) {
      const orderWithDispensers = {
        ...order,
        dispensers: contextDispensers
      };
      setSelectedOrderForModal(orderWithDispensers);
    } else {
      setSelectedOrderForModal(order);
    }
    setIsFilterModalOpen(true);
  };

  const handleCalendarEventClick = (event: CalendarEvent) => {
    const originalOrder = filteredWorkOrders.find(wo => wo.id === event.id);
    if (originalOrder) {
      const orderContextDispensers = dispenserData?.dispenserData?.[originalOrder.id]?.dispensers;
      const orderHasDispenserData = (originalOrder.dispensers && originalOrder.dispensers.length > 0) || (orderContextDispensers && orderContextDispensers.length > 0);

      if (orderHasDispenserData) {
        let dispensersToShowOnClick = originalOrder.dispensers && originalOrder.dispensers.length > 0
          ? originalOrder.dispensers
          : (orderContextDispensers && orderContextDispensers.length > 0 ? orderContextDispensers : []);
        setSelectedDispensers(dispensersToShowOnClick);
        setSelectedOrderIdModal(originalOrder.id);
        setSelectedVisitNumberModal(extractVisitNumber(originalOrder));
        setSelectedStoreNumberModal(originalOrder.customer?.storeNumber || '');
        setShowDispenserModal(true);
      } else {
        setSelectedDispensers([]);
        setSelectedOrderIdModal(originalOrder.id);
        setSelectedVisitNumberModal(extractVisitNumber(originalOrder));
        setSelectedStoreNumberModal(originalOrder.customer?.storeNumber || '');
        setShowDispenserModal(true);
        addToast('info', 'No dispenser data available for this job.', 2000);
      }
      
      if (!originalOrder.dispensers?.length && orderContextDispensers?.length) {
        const orderWithDispensers = {
          ...originalOrder,
          dispensers: orderContextDispensers
        };
        setSelectedOrderForModal(orderWithDispensers);
      } else {
        setSelectedOrderForModal(originalOrder);
      }
    }
  };

  const SkeletonJobsList = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, idx) => <Skeleton key={idx} height="80px" className="rounded-lg" />)}
    </div>
  );

  return (
    <div className="animate-fadeIn space-y-4">
      <ScheduleHeader stats={calculateScheduleStats()} isLoading={isLoading} workOrders={filteredWorkOrders} workWeekDates={workWeekDates} dispenserData={dispenserData} />
      
      {isLoading && (
        <div className="py-10 text-center">
          <SkeletonJobsList />
          <p className="mt-2 text-gray-500 dark:text-gray-400">Loading schedule...</p>
        </div>
      )}
      
      {!isLoading && (
        <Panel className="mb-6">
          <WeekNavigator
            workWeekDates={workWeekDates}
            onNavigate={setSelectedDate}
            onGoToCurrentWeek={goToCurrentWeek}
          />
          
          <StoreFilterComponent
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          
          <ViewSelector
            activeView={activeView}
            onViewChange={setActiveView}
          />
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeView === 'weekly' && (
              <WeeklyView
                grouped={groupedWorkOrders}
                dispenserData={dispenserData}
                expandedSections={expandedSections}
                onToggleSection={handleToggleSection}
                onOpenWorkFossa={openWorkFossaWithLogin}
                onViewInstructions={handleViewInstructions}
                onViewDispenserData={handleViewDispenserData}
                onOpenFilterModal={handleOpenFilterModal}
                onForceRescrape={handleForceRescrapeDispenserData}
                onClearData={handleClearDispenserData}
                onToast={addToast}
                operationLoading={operationLoading}
              />
            )}
            
            {activeView === 'calendar' && (
              <CalendarView 
                events={calendarEvents}
                onEventClick={handleCalendarEventClick}
              />
            )}
            
            {activeView === 'compact' && (
              <CompactView
                groupedWorkOrders={groupedWorkOrders}
                workWeekDates={workWeekDates}
                dispenserData={dispenserData}
                expandedSections={expandedSections}
                onToggleSection={handleToggleSection}
                onViewInstructions={handleViewInstructions}
                onViewDispenserData={handleViewDispenserData}
                onOpenFilterModal={handleOpenFilterModal}
                onNavigate={setSelectedDate}
                onGoToCurrentWeek={goToCurrentWeek}
              />
            )}
          </div>
        </Panel>
      )}
      
      {/* Modals */}
      <DispenserModal
        isOpen={showDispenserModal}
        dispensers={selectedDispensers}
        orderId={selectedOrderIdModal}
        visitNumber={selectedVisitNumberModal}
        storeNumber={selectedStoreNumberModal}
        onClose={() => setShowDispenserModal(false)}
      />
      
      {selectedOrderForModal && (
        <StoreFilterNeedsModal
          isOpen={isFilterModalOpen}
          workOrder={selectedOrderForModal}
          onClose={() => setIsFilterModalOpen(false)}
        />
      )}
      
      <InstructionsModal 
        isOpen={isInstructionsModalOpen}
        instructions={selectedInstructions}
        title={selectedOrderName}
        onClose={() => setIsInstructionsModalOpen(false)}
      />
    </div>
  );
};

export default ScheduleContent;