import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiCalendar, FiFilter, FiCheck, FiX } from 'react-icons/fi';

interface DateFilterProps {
  filterType: 'day' | 'week' | 'month' | 'all';
  setFilterType: (type: 'day' | 'week' | 'month' | 'all') => void;
  customDateRange: [Date | null, Date | null];
  setCustomDateRange: (dateRange: [Date | null, Date | null]) => void;
  statusFilter: string[];
  setStatusFilter: (statuses: string[]) => void;
  serviceTypeFilter: string[];
  setServiceTypeFilter: (types: string[]) => void;
  availableServiceTypes: string[];
}

const DateFilter: React.FC<DateFilterProps> = ({
  filterType,
  setFilterType,
  customDateRange,
  setCustomDateRange,
  statusFilter,
  setStatusFilter,
  serviceTypeFilter,
  setServiceTypeFilter,
  availableServiceTypes
}) => {
  // All possible status options
  const statusOptions = ['scheduled', 'in-progress', 'completed', 'cancelled'];
  
  // Toggle status in filter
  const toggleStatus = (status: string) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };
  
  // Toggle service type in filter
  const toggleServiceType = (type: string) => {
    if (serviceTypeFilter.includes(type)) {
      setServiceTypeFilter(serviceTypeFilter.filter(t => t !== type));
    } else {
      setServiceTypeFilter([...serviceTypeFilter, type]);
    }
  };
  
  // Clear all service type filters
  const clearServiceTypeFilters = () => {
    setServiceTypeFilter([]);
  };
  
  // Select all service types
  const selectAllServiceTypes = () => {
    setServiceTypeFilter([...availableServiceTypes]);
  };
  
  return (
    <div className="date-filter">
      <h3 className="filter-heading">Filter Jobs</h3>
      
      {/* Date filter section */}
      <div className="filter-section">
        <h4 className="filter-section-title">
          <FiCalendar className="filter-icon" />
          Date Range
        </h4>
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
      
      {/* Status filter section */}
      <div className="filter-section">
        <h4 className="filter-section-title">
          <FiFilter className="filter-icon" />
          Job Status
        </h4>
        <div className="status-filter">
          {statusOptions.map(status => (
            <div 
              key={status}
              className={`status-filter-item ${statusFilter.includes(status) ? 'active' : ''}`}
              onClick={() => toggleStatus(status)}
            >
              <div className={`status-checkbox ${statusFilter.includes(status) ? 'checked' : ''}`}>
                {statusFilter.includes(status) && <FiCheck className="status-check-icon" />}
              </div>
              <span className="status-label">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Service type filter section */}
      {availableServiceTypes.length > 0 && (
        <div className="filter-section">
          <h4 className="filter-section-title">
            <FiFilter className="filter-icon" />
            Service Type
            <div className="service-type-actions">
              <button 
                className="service-type-action-btn"
                onClick={selectAllServiceTypes}
                disabled={serviceTypeFilter.length === availableServiceTypes.length}
              >
                All
              </button>
              <button 
                className="service-type-action-btn"
                onClick={clearServiceTypeFilters}
                disabled={serviceTypeFilter.length === 0}
              >
                Clear
              </button>
            </div>
          </h4>
          <div className="service-type-filter">
            {availableServiceTypes.map(type => (
              <div 
                key={type}
                className={`service-type-filter-item ${serviceTypeFilter.includes(type) ? 'active' : ''}`}
                onClick={() => toggleServiceType(type)}
              >
                <div className={`service-type-checkbox ${serviceTypeFilter.includes(type) ? 'checked' : ''}`}>
                  {serviceTypeFilter.includes(type) && <FiCheck className="service-type-check-icon" />}
                </div>
                <span className="service-type-label">{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateFilter; 