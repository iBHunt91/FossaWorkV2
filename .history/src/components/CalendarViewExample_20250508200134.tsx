import React, { useState } from 'react';
import {
  FiCalendar,
  FiTool,
  FiFileText,
} from 'react-icons/fi';

type CalendarViewType = 'month' | 'week';
type StoreFilter = 'all' | '7-eleven' | 'circle-k' | 'wawa' | 'other' | string;

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  storeType: string;
  dispensers?: any[];
  services?: any[];
  instructions?: string;
}

interface CalendarViewProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  initialFilter?: StoreFilter;
}

/**
 * Enhanced CalendarView Component
 * 
 * This component provides an improved calendar view with:
 * - Month/week view toggle
 * - Better visualization of events
 * - Interactive events that display more information
 * - Filtering capabilities
 * 
 * To use in Home.tsx:
 * 
 * 1. Import this component:
 *    import CalendarView from '../components/CalendarView';
 * 
 * 2. In the Calendar section of Home.tsx, replace the current calendar with:
 *    {activeView === 'calendar' && (
 *      <CalendarView 
 *        events={filteredWorkOrders.map(order => ({
 *          id: order.id,
 *          title: order.customer?.name || 'Unknown Store',
 *          description: order.services?.[0]?.description || 'Service visit',
 *          date: order.visits?.nextVisit?.date || order.nextVisitDate || order.visitDate || order.date || new Date().toISOString(),
 *          storeType: getStoreTypeForFiltering(order),
 *          dispensers: order.dispensers || [],
 *          services: order.services || [],
 *          instructions: order.instructions
 *        }))}
 *        onEventClick={(event) => {
 *          setSelectedOrderId(event.id);
 *          const order = filteredWorkOrders.find(o => o.id === event.id);
 *          if (order) {
 *            setSelectedVisitNumber(extractVisitNumber(order));
 *            setSelectedInstructions(order.instructions || 'No instructions provided');
 *            setSelectedJobTitle(order.customer?.name || 'Unknown Store');
 *            setShowInstructionsModal(true);
 *          }
 *        }}
 *        initialFilter={activeFilter}
 *      />
 *    )}
 */
const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, 
  onEventClick, 
  initialFilter = 'all' 
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [filter, setFilter] = useState<StoreFilter>(initialFilter);

  // Filter events based on the selected store type
  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(event => event.storeType === filter);

  // Determine style based on store type
  const getStoreStyle = (storeType: string) => {
    switch (storeType.toLowerCase()) {
      case '7-eleven':
        return {
          badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-800 dark:text-green-300'
        };
      case 'circle-k':
        return {
          badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-300'
        };
      case 'wawa':
        return {
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-800 dark:text-purple-300'
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-800 dark:text-blue-300'
        };
    }
  };

  // Helper function to group events by date
  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Render month view
  const renderMonthView = () => {
    const days = [];
    const date = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = date.getDay();
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-28 p-1 border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-md" />
      );
    }
    
    // Add cells for each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(currentYear, currentMonth, i);
      const isToday = currentDate.getDate() === today.getDate() && 
                       currentDate.getMonth() === today.getMonth() && 
                       currentDate.getFullYear() === today.getFullYear();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      // Get events for this day
      const eventsOnDay = getEventsForDate(currentDate);
      
      days.push(
        <div 
          key={`day-${i}`}
          className={`min-h-28 p-1 border rounded-md transition-colors ${
            isToday 
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
              : isWeekend
                ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center ${
              isToday 
                ? 'bg-blue-500 text-white' 
                : isWeekend
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-700 dark:text-gray-300'
            }`}>
              {i}
            </span>
            
            {eventsOnDay.length > 0 && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {eventsOnDay.length}
              </span>
            )}
          </div>
          
          {/* Event cards */}
          <div className="mt-1 space-y-1 overflow-y-auto" style={{ maxHeight: "96px" }}>
            {eventsOnDay.slice(0, 3).map((event, idx) => {
              const storeStyle = getStoreStyle(event.storeType);
              
              return (
                <div 
                  key={idx}
                  className={`text-xs p-1.5 rounded-md cursor-pointer transform transition-all hover:scale-[1.02] ${storeStyle.badge} flex flex-col`}
                  onClick={() => onEventClick(event)}
                >
                  <div className="font-medium truncate">{event.title}</div>
                  {event.description && (
                    <div className="text-xs opacity-80 truncate">{event.description}</div>
                  )}
                  {event.dispensers && event.dispensers.length > 0 && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-75">
                      <FiTool className="h-2.5 w-2.5" />
                      <span>{event.dispensers.length} Dispensers</span>
                    </div>
                  )}
                </div>
              );
            })}
            
            {eventsOnDay.length > 3 && (
              <div className="text-xs text-center p-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
                +{eventsOnDay.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };
  
  // Render week view
  const renderWeekView = () => {
    const days = [];
    const currentWeekStart = new Date();
    const dayOfWeek = currentWeekStart.getDay();
    currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const isToday = date.getDate() === today.getDate() && 
                      date.getMonth() === today.getMonth() && 
                      date.getFullYear() === today.getFullYear();
      const isCurrentMonth = date.getMonth() === currentMonth;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      // Get events for this day
      const eventsOnDay = getEventsForDate(date);
      
      days.push(
        <div key={`day-${i}`} className="flex flex-col">
          {/* Day header */}
          <div className={`text-center py-2 text-sm font-medium border-b ${
            isWeekend 
              ? 'text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'
              : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
          }`}>
            <div>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}</div>
            <div className={`text-lg font-bold ${
              isToday 
                ? 'text-blue-600 dark:text-blue-400' 
                : !isCurrentMonth
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-800 dark:text-gray-200'
            }`}>
              {date.getDate()}
            </div>
          </div>
          
          {/* Events container */}
          <div className={`flex-1 p-2 min-h-[300px] ${
            isToday
              ? 'bg-blue-50 dark:bg-blue-900/10'
              : isWeekend
                ? 'bg-gray-50 dark:bg-gray-800/30'
                : ''
          }`}>
            {eventsOnDay.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm italic">
                No events
              </div>
            ) : (
              <div className="space-y-2">
                {eventsOnDay.map((event, idx) => {
                  const storeStyle = getStoreStyle(event.storeType);
                  
                  return (
                    <div 
                      key={idx}
                      className={`p-2 rounded-md cursor-pointer transform transition-all hover:scale-[1.02] shadow-sm ${storeStyle.bg} ${storeStyle.text}`}
                      onClick={() => onEventClick(event)}
                    >
                      <div className="font-medium">{event.title}</div>
                      {event.description && (
                        <div className="text-xs mt-1 opacity-90">{event.description}</div>
                      )}
                      {event.services && event.services.length > 0 && (
                        <div className="mt-1 text-xs flex items-center gap-1">
                          <FiFileText className="h-3 w-3" />
                          <span>{event.services.length} service(s)</span>
                        </div>
                      )}
                      {event.dispensers && event.dispensers.length > 0 && (
                        <div className="mt-1 text-xs flex items-center gap-1">
                          <FiTool className="h-3 w-3" />
                          <span>{event.dispensers.length} dispensers</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {viewType === 'week' 
              ? `Week of ${new Date(currentYear, currentMonth, 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-md p-1 flex">
            <button
              onClick={() => setViewType('month')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewType === 'month'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewType === 'week'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Week
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11);
                  setCurrentYear(currentYear - 1);
                } else {
                  setCurrentMonth(currentMonth - 1);
                }
              }}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today.getMonth());
                setCurrentYear(today.getFullYear());
              }}
              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium"
            >
              Today
            </button>
            <button 
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0);
                  setCurrentYear(currentYear + 1);
                } else {
                  setCurrentMonth(currentMonth + 1);
                }
              }}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <select
              className="bg-gray-100 dark:bg-gray-700 border-0 rounded-md text-sm p-2 text-gray-700 dark:text-gray-300"
              value={filter}
              onChange={(e) => setFilter(e.target.value as StoreFilter)}
              aria-label="Filter by store type"
            >
              <option value="all">All Stores</option>
              <option value="7-eleven">7-Eleven</option>
              <option value="circle-k">Circle K</option>
              <option value="wawa">Wawa</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Calendar grid */}
      <div className="p-4">
        {viewType === 'month' ? (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div key={i} className={`text-center py-2 text-xs font-medium ${
                  i === 0 || i === 6
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {renderMonthView()}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {renderWeekView()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView; 