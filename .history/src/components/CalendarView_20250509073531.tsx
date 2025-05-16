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
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

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
          text: 'text-green-800 dark:text-green-300',
          dot: 'bg-green-500 dark:bg-green-400'
        };
      case 'circle-k':
        return {
          badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-300',
          dot: 'bg-red-500 dark:bg-red-400'
        };
      case 'wawa':
        return {
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-800 dark:text-purple-300',
          dot: 'bg-purple-500 dark:bg-purple-400'
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-800 dark:text-blue-300',
          dot: 'bg-blue-500 dark:bg-blue-400'
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
    
    // Function to calculate modal position for optimal viewing
    const getModalPosition = (dayIndex: number): string => {
      // Determine which column in the 7-column grid
      const columnPosition = (dayIndex + firstDayOfMonth) % 7;
      
      // Left align if in the last 2 columns, right align if in the first 2 columns, center otherwise
      if (columnPosition >= 5) { // Last 2 columns
        return "right-0 left-auto";
      } else if (columnPosition <= 1) { // First 2 columns
        return "left-0 right-auto";
      } else {
        return "left-1/2 -translate-x-1/2"; // Center for middle columns
      }
    };

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
      
      // State key for this specific day's expansion state
      const dayKey = `${currentYear}-${currentMonth}-${i}`;
      // Determine if this day's events are expanded
      const isExpanded = expandedDays[dayKey] || false;
      
      // Group events by store type for color-coded indicators
      const eventsByType = eventsOnDay.reduce((acc, event) => {
        const type = event.storeType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(event);
        return acc;
      }, {} as Record<string, Event[]>);
      
      // Calculate modal position based on day index
      const modalPosition = getModalPosition(i - 1);
      
      days.push(
        <div 
          key={`day-${i}`}
          className={`min-h-28 p-1 border rounded-md transition-colors overflow-visible relative ${
            isToday 
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
              : isWeekend
                ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            {/* Day number - left side */}
            <span className={`text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center ${
              isToday 
                ? 'bg-blue-500 text-white' 
                : isWeekend
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-700 dark:text-gray-300'
            }`}>
              {i}
            </span>
            
            {/* Job count badge - right side */}
            {eventsOnDay.length > 0 && (
              <button
                onClick={() => toggleDayExpansion(dayKey)} 
                className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  isToday 
                    ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300' 
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                } hover:brightness-95 transition-all`}
                title={isExpanded ? "Collapse jobs" : "Show all jobs"}
              >
                {eventsOnDay.length}
              </button>
            )}
          </div>
          
          {/* Job visualization - store distribution card style */}
          <div className="flex flex-col space-y-1 overflow-y-auto" style={{ maxHeight: "94px" }}>
            {/* Show store distribution with counts when events exist */}
            {eventsOnDay.length > 0 && !isExpanded && (
              <div className="flex flex-col gap-1">
                {Object.entries(eventsByType).map(([type, events]) => {
                  const storeStyle = getStoreStyle(type);
                  const storeDisplayName = type === 'circle-k' ? 'Circle K' : 
                                          type === '7-eleven' ? '7-Eleven' : 
                                          type === 'wawa' ? 'Wawa' : type;
                  
                  return (
                    <div 
                      key={type} 
                      className={`flex items-center justify-between px-2 py-1 rounded-md cursor-pointer hover:brightness-95 ${storeStyle.bg}`}
                      onClick={() => toggleDayExpansion(dayKey)}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${storeStyle.dot}`}></div>
                        <span className={`text-xs font-medium ${storeStyle.text}`}>
                          {storeDisplayName}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${storeStyle.text}`}>
                        {events.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Expanded panel with details */}
            {isExpanded && (
              <>
                {/* Modal backdrop for better focus */}
                <div 
                  className="fixed inset-0 bg-black/10 dark:bg-black/30 z-10"
                  onClick={() => toggleDayExpansion(dayKey)}
                ></div>
                
                <div 
                  className={`absolute z-20 ${modalPosition} bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-600 p-3 mt-1 max-h-[350px] overflow-y-auto origin-top animate-scale-in`} 
                  style={{ width: '280px', maxWidth: 'calc(100vw - 2rem)' }}
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {currentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                    </span>
                    <button 
                      onClick={() => toggleDayExpansion(dayKey)}
                      className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Store type summary */}
                  <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {eventsOnDay.length} Job{eventsOnDay.length !== 1 ? 's' : ''} by store:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(eventsByType).map(([type, events]) => {
                        const storeStyle = getStoreStyle(type);
                        const storeDisplayName = type === 'circle-k' ? 'Circle K' : 
                                               type === '7-eleven' ? '7-Eleven' : 
                                               type === 'wawa' ? 'Wawa' : type;
                        
                        return (
                          <div 
                            key={type} 
                            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${storeStyle.badge}`}
                          >
                            <span className="text-xs font-medium">{storeDisplayName}</span>
                            <span className="text-xs font-bold">{events.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {eventsOnDay.map((event, idx) => {
                      const storeStyle = getStoreStyle(event.storeType);
                      
                      return (
                        <div 
                          key={idx}
                          onClick={() => onEventClick(event)}
                          className="p-2 rounded-md border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${storeStyle.dot}`}></div>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{event.title}</span>
                          </div>
                          
                          {event.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate pl-3.5">
                              {event.description}
                            </div>
                          )}
                          
                          {/* Extra details like dispensers count, etc */}
                          {((event.dispensers && event.dispensers.length > 0) || (event.services && event.services.length > 0)) && (
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
                              {event.dispensers && event.dispensers.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <FiTool className="w-3 h-3" />
                                  <span>{event.dispensers.length}</span>
                                </div>
                              )}
                              
                              {event.services && event.services.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <FiFileText className="w-3 h-3" />
                                  <span>{event.services.length}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
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

  // Function to toggle expansion state of a specific day
  const toggleDayExpansion = (dayKey: string) => {
    // First close any other open panels
    const updatedExpandedDays = { ...expandedDays };
    
    // Toggle the requested day
    updatedExpandedDays[dayKey] = !updatedExpandedDays[dayKey];
    
    setExpandedDays(updatedExpandedDays);
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