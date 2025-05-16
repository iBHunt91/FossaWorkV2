import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DateFilterProps {
  filterType: 'day' | 'week' | 'month' | 'all';
  setFilterType: (type: 'day' | 'week' | 'month' | 'all') => void;
  customDateRange: [Date | null, Date | null];
  setCustomDateRange: (dateRange: [Date | null, Date | null]) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({
  filterType,
  setFilterType,
  customDateRange,
  setCustomDateRange
}) => {
  return (
    <div className="date-filter">
      <div className="filter-buttons">
        <button 
          onClick={() => setFilterType('day')}
          className={`filter-btn ${filterType === 'day' ? 'active' : ''}`}
        >
          Today
        </button>
        <button 
          onClick={() => setFilterType('week')}
          className={`filter-btn ${filterType === 'week' ? 'active' : ''}`}
        >
          This Week
        </button>
        <button 
          onClick={() => setFilterType('month')}
          className={`filter-btn ${filterType === 'month' ? 'active' : ''}`}
        >
          This Month
        </button>
        <button 
          onClick={() => setFilterType('all')}
          className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
        >
          All Jobs
        </button>
      </div>
      
      <div className="custom-date-range">
        <label>Custom Date Range:</label>
        <DatePicker
          selectsRange={true}
          startDate={customDateRange[0]}
          endDate={customDateRange[1]}
          onChange={(update: [Date | null, Date | null]) => {
            setCustomDateRange(update);
            // Only change filter type to 'all' if both dates are selected
            if (update[0] && update[1]) {
              setFilterType('all');
            }
          }}
          isClearable={true}
          placeholderText="Select date range"
          className="date-picker"
        />
      </div>
    </div>
  );
};

export default DateFilter; 