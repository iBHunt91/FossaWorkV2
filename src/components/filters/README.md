# Filters Components Documentation

This directory contains the components used for the Filters page of the Fossa Monitor application. These components work together to provide comprehensive filter management, visualization, and analysis functionality.

## Component Overview

### FiltersContent.tsx
The main container component that orchestrates the filters page layout and functionality.

**Key Features:**
- Loads and processes work order and filter data from API endpoints
- Manages search, date selection, and filter type filters with real-time updates
- Coordinates data refreshing with configurable intervals (default: 5 minutes)
- Provides visualization toggle functionality with persistent user preferences
- Manages dispenser modal interactions with detailed equipment information
- Renders all filter panels in a responsive layout supporting mobile and desktop views
- Implements error handling for failed data fetches with appropriate user feedback

**State Management:**
- `workOrders`: Array of work orders retrieved from the API
- `filterNeeds`: Calculated filter inventory requirements
- `filterWarnings`: Detected issues with filter inventory or scheduling
- `searchTerm`: Current user search input
- `currentWeek`: Selected week for date filtering
- `selectedFilterType`: Currently active filter category
- `showVisualization`: Boolean toggle for chart display
- `isLoading`: Loading state during data operations
- `isDispenserModalOpen`: Controls dispenser detail modal visibility

**Lifecycle:**
- On mount: Fetches initial work order data and calculates filter needs
- On interval: Refreshes data based on configured refresh rate (5 minutes)
- On unmount: Cleans up intervals and pending requests

### FilterTypes.ts
Type definitions for all filter-related components.

**Key Types:**
- `WorkWeekDateRanges`: Interface for date filtering and calculations
  ```typescript
  interface WorkWeekDateRanges {
    startDate: Date;
    endDate: Date;
    displayRange: string;
    weekNumber: number;
  }
  ```

- `FilterDataType`: Data structure for filter inventory items
  ```typescript
  interface FilterDataType {
    partNumber: string;
    description: string;
    filterType: string;
    quantity: number;
    jobId: string;
    storeId: string;
    storeName: string;
    storeType: string;
    visitDate: Date;
    boxQuantity: number;
    dispensers: Dispenser[];
  }
  ```

- `ExtendedFilterNeed`: Enhanced filter need with order/store information
  ```typescript
  interface ExtendedFilterNeed extends FilterDataType {
    orderStatus: string;
    isUrgent: boolean;
    lastUpdated: Date;
    technicianId: string;
    technicianName: string;
  }
  ```

- `ExtendedFilterWarning`: Enhanced filter warning with additional metadata
  ```typescript
  interface ExtendedFilterWarning {
    warningId: string;
    jobId: string;
    storeId: string;
    storeName: string;
    filterType: string;
    partNumber: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }
  ```

- `CSVFilterSummary`: Format for CSV exports
  ```typescript
  interface CSVFilterSummary {
    filterType: string;
    partNumber: string;
    description: string;
    totalQuantity: number;
    boxesNeeded: number;
    storeCount: number;
  }
  ```

- `Dispenser`: Structure for dispenser information
  ```typescript
  interface Dispenser {
    id: string;
    serialNumber: string;
    model: string;
    manufacturer: string;
    lastService: Date;
    filterHistory: {
      partNumber: string;
      installDate: Date;
      replacementDate: Date | null;
    }[];
    location: string;
    status: 'active' | 'inactive' | 'maintenance';
  }
  ```

- `SortConfig`: Configuration for table sorting
  ```typescript
  interface SortConfig {
    key: string;
    direction: 'ascending' | 'descending';
  }
  ```

### FilterUtils.ts
A utility module that provides data processing functions for the Filters components.

**Key Functions:**
- `getWorkWeekDateRanges(date: Date, weeksToShow: number = 12): WorkWeekDateRanges[]`
  Calculates and returns an array of work week date ranges based on the input date.
  Supports configurable number of weeks to show forward and backward.

- `extractVisitNumber(jobId: string): number | null`
  Parses job ID strings to extract visit sequence numbers with regex pattern matching.
  Format expected: "JOB-XXXX-VN" where N is the visit number.

- `getDisplayName(storeName: string, storeId: string): string`
  Formats store names for display with consistent formatting.
  Handles special cases like removing corporate prefixes and standardizing capitalization.

- `filterWorkOrders(workOrders: WorkOrder[], searchTerm: string, dateRange: WorkWeekDateRanges): WorkOrder[]`
  Filters work orders based on:
    - Text search matching store name, ID, or technician name (case-insensitive)
    - Date range filtering for scheduled visits
    - Support for advanced search syntax with quotes for exact matches

- `checkForSpecialFuelTypes(workOrder: WorkOrder): boolean`
  Identifies special fuel types that require specific filter handling.
  Checks for E85, biodiesel, aviation fuel, and other non-standard formulations.

- `calculateFiltersSafely(workOrders: WorkOrder[]): { filterNeeds: ExtendedFilterNeed[], warnings: Map<string, ExtendedFilterWarning[]> }`
  Performs filter calculations with error handling to prevent calculation failures.
  Uses try/catch blocks around individual calculations to ensure partial results on error.

- `generateFilterNeeds(workOrders: WorkOrder[]): ExtendedFilterNeed[]`
  Creates comprehensive filter inventory needs by:
    - Aggregating similar filter types across work orders
    - Applying business rules for minimum quantities and safety margins
    - Calculating urgency based on scheduled visit dates
    - Associating equipment information with specific filter requirements

- `generateFilterWarnings(workOrders: WorkOrder[], filterNeeds: ExtendedFilterNeed[]): Map<string, ExtendedFilterWarning[]>`
  Produces filter warnings by analyzing:
    - Inventory shortages for upcoming work orders
    - Scheduling conflicts for filter replacements
    - Overdue filter replacements based on manufacturer recommendations
    - Unusual filter consumption patterns indicating potential equipment issues

- `formatDateRange(startDate: Date, endDate: Date, format: string = 'MMM d, yyyy'): string`
  Formats date ranges with consistent presentation, supporting multiple format options.
  Handles same-month ranges with simplified output (e.g., "May 10-15, 2025").

- `calculateBoxesNeeded(quantity: number, boxQuantity: number): { full: number, partial: number }`
  Calculates full and partial boxes needed based on required quantity and standard box size.
  Accounts for minimum order quantities and optimizes for minimal waste.

- `exportFilterDataToCSV(filterNeeds: ExtendedFilterNeed[]): void`
  Generates and triggers download of CSV file containing filter summary data.
  Includes comprehensive metadata and formats dates consistently.

- `groupFiltersByAttribute(filterNeeds: ExtendedFilterNeed[], attribute: keyof ExtendedFilterNeed): Record<string, ExtendedFilterNeed[]>`
  Groups filter data by specified attribute for visualization and analysis.

### Panel.tsx
A reusable collapsible panel component for consistent UI layout.

**Props:**
- `id`: String identifier for the panel
- `title`: Display title for the panel header
- `icon`: React node for the panel icon
- `expanded`: Boolean to control expanded state (default: true)
- `onToggle`: Function callback for expansion toggle
- `children`: Content to render inside the panel
- `className`: Optional CSS class names for styling
- `headerClassName`: Optional CSS class names for header styling
- `bodyClassName`: Optional CSS class names for body styling

**Features:**
- Provides standardized header with toggle functionality and accessibility attributes
- Maintains consistent styling across filter panels with customization options
- Supports nested content via children props
- Implements smooth animation transitions for expand/collapse
- Persists expanded state in localStorage for user preference retention
- Provides keyboard navigation support for accessibility

**Implementation:**
```typescript
const Panel: React.FC<PanelProps> = ({
  id,
  title,
  icon,
  expanded = true,
  onToggle,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = ''
}) => {
  // Animation and state handling logic
  
  return (
    <div className={`border rounded-lg shadow-sm overflow-hidden ${className}`}>
      <button
        className={`w-full px-4 py-3 flex items-center justify-between ${headerClassName}`}
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={`panel-${id}-content`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary-600">{icon}</span>}
          <h2 className="font-medium text-lg">{title}</h2>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>
      
      <AnimateHeight height={expanded ? 'auto' : 0}>
        <div 
          id={`panel-${id}-content`}
          className={`p-4 ${bodyClassName}`}
        >
          {children}
        </div>
      </AnimateHeight>
    </div>
  );
};
```

### DateSelector.tsx
Component for selecting and navigating dates.

**Props:**
- `currentWeek`: Currently selected week date (Date object)
- `setCurrentWeek`: Function to update selected week
- `dateRanges`: Calculated date ranges for display
- `disabled`: Optional boolean to disable interaction (default: false)
- `compact`: Optional boolean for space-efficient layout (default: false)

**Features:**
- Allows selection of specific dates with a dropdown calendar
- Provides navigation between weeks with previous/next buttons
- Displays formatted date range information with week number
- Supports keyboard navigation for accessibility
- Implements responsive design with compact mode for mobile
- Highlights current week with visual indicator

**Event Handlers:**
- `handlePreviousWeek`: Navigates to previous week
- `handleNextWeek`: Navigates to next week
- `handleSelectWeek`: Updates selected week from dropdown

### SearchBar.tsx
A search input component with clear functionality.

**Props:**
- `searchTerm`: Current search text
- `setSearchTerm`: Function to update search text
- `placeholder`: Optional custom placeholder text (default: 'Search stores...')
- `debounceMs`: Optional debounce delay in milliseconds (default: 300)
- `className`: Optional CSS class names for styling

**Features:**
- Provides text input for searching store names with debounced input
- Includes clear button functionality that appears when text is present
- Styled for both light and dark themes with appropriate contrast
- Implements auto-focus on component mount for improved UX
- Displays search icon for visual affordance
- Supports keyboard shortcuts for clearing (Escape key)
- Maintains responsive design with consistent sizing

### FilterSummaryPanel.tsx
Displays summary information about filter inventory needs.

**Props:**
- `filterNeeds`: Array of filter need objects
- `isLoading`: Boolean indicating loading state
- `selectedFilterType`: Currently selected filter type
- `onFilterTypeChange`: Callback for filter type changes
- `onExport`: Optional callback for export functionality

**Features:**
- Summarizes filter quantities by type with collapsible sections
- Calculates boxes needed for inventory with full/partial breakdown
- Provides CSV export functionality with configurable options
- Allows filtering by filter type with interactive selectors
- Displays total filter counts and box requirements
- Shows filter distribution across store types
- Implements skeleton loading states for improved UX
- Provides tooltips for additional information

**Key Calculations:**
- Groups filters by type, calculating subtotals
- Determines box quantities based on standard packaging
- Calculates percentage distributions
- Estimates delivery requirements

### FilterWarningsPanel.tsx
Displays filter-related warnings grouped by severity.

**Props:**
- `filterWarnings`: Map of order IDs to warning arrays
- `isLoading`: Boolean indicating loading state
- `onResolve`: Optional callback for resolving warnings
- `onFilter`: Optional callback for filtering work orders based on warnings

**Features:**
- Groups warnings by severity (high, medium, low) with color-coding
- Displays warning details with part information and timestamp
- Provides visual indicators for severity levels with appropriate icons
- Implements collapsible sections for each severity level
- Supports warning resolution with status tracking
- Enables filtering work orders by affected stores
- Shows empty states when no warnings exist
- Implements skeleton loading for improved UX

**Warning Categories:**
- Inventory shortages (high severity)
- Scheduling conflicts (medium severity)
- Unusual consumption patterns (medium severity)
- Overdue replacements (medium/high based on timeframe)
- Missing specifications (low severity)

### FilterDetailsPanel.tsx
Displays detailed filter information in a paginated table.

**Props:**
- `filterNeeds`: Array of filter need objects
- `workOrders`: Array of work orders
- `isLoading`: Boolean indicating loading state
- `selectedFilterType`: Currently selected filter type
- `sortConfig`: Current sort configuration
- `setSortConfig`: Function to update sort configuration
- `currentPage`: Current page for pagination
- `setCurrentPage`: Function to update current page
- `itemsPerPage`: Number of items to show per page (default: 10)
- `onOpenDispenserModal`: Callback for viewing dispensers
- `onQuantityChange`: Optional callback for quantity edits
- `showEditControls`: Boolean to toggle edit functionality (default: true)

**Features:**
- Displays filterable and sortable table of filter needs with multiple columns
- Provides quantity editing functionality with validation
- Includes pagination controls with configurable items per page
- Offers dispenser viewing functionality with detailed modals
- Supports sorting by clicking column headers
- Implements row highlighting for urgent items
- Shows equipment details on hover
- Provides export to CSV/Excel functionality
- Displays metadata including last updated timestamp
- Implements responsive design with horizontal scrolling for mobile

**Table Columns:**
- Part Number - Sortable, with copy to clipboard
- Description - Sortable, with truncation for long text
- Filter Type - Sortable, with category color indicators
- Quantity - Editable, with validation
- Store - Sortable, with location details on hover
- Visit Date - Sortable, with relative time display
- Boxes - Calculated, showing full and partial boxes
- Actions - Contextual buttons for dispenser details and editing

### FilterVisualization.tsx
Provides visual representations of filter data.

**Props:**
- `filterNeeds`: Array of filter need objects
- `workOrders`: Array of work orders
- `isLoading`: Boolean indicating loading state
- `height`: Optional height specification (default: 400px)
- `className`: Optional CSS class names
- `showControls`: Boolean to toggle visibility of chart controls (default: true)

**Features:**
- Visualizes filter type distribution with interactive pie/bar charts
- Shows filter usage by store type with stacked bar charts
- Provides box requirements summary with visual breakdown
- Displays work order statistics with trend analysis
- Implements responsive charts that resize with viewport
- Supports chart type switching (pie/bar/line)
- Provides interactive tooltips with detailed information
- Enables drill-down capability for detailed analysis
- Implements print-friendly rendering
- Supports data export to various formats
- Shows color-coded legends with consistent palette

**Chart Types:**
- Filter Distribution by Type (pie/bar)
- Filter Usage by Store Type (stacked bar)
- Filters Over Time (line chart with trend)
- Box Requirements (horizontal bar)
- Technician Workload (heatmap)

### DispenserModal.tsx
Modal component for displaying detailed dispenser information.

**Props:**
- `isOpen`: Boolean controlling modal visibility
- `onClose`: Callback for closing the modal
- `dispenser`: Dispenser object with equipment details
- `relatedFilters`: Array of related filter objects

**Features:**
- Displays comprehensive equipment specifications
- Shows maintenance history with timeline visualization
- Lists filter replacement history with dates
- Provides technical documents with download links
- Shows equipment location with visual indicator
- Enables printing of equipment details
- Supports service scheduling functionality
- Implements responsive design for all screen sizes

## Component Relationships

The component hierarchy is as follows:

- **Filters** (page component)
  - PersistentView
    - **FiltersContent** (main container)
      - TopControls
        - SearchBar (searchTerm → filterWorkOrders)
        - DateSelector (currentWeek → filterWorkOrders)
        - FilterTypeSelector (selectedFilterType → filterData)
        - VisualizationToggle (showVisualization → conditionalRender)
      - Panel (Visualization - conditional)
        - FilterVisualization (filterNeeds + workOrders → charts)
      - Panel (Summary)
        - FilterSummaryPanel (filterNeeds → summaryStats)
          - FilterTypeButtons (selectedFilterType → onFilterTypeChange)
          - BoxCalculations (filterNeeds → boxesNeeded)
          - ExportButton (filterNeeds → csvExport)
      - Panel (Warnings)
        - FilterWarningsPanel (filterWarnings → warningGroups)
          - SeveritySection (warnings → groupedDisplay)
          - WarningItem (warning → detailedInfo)
          - ResolveButton (warningId → onResolve)
      - Panel (Details)
        - FilterDetailsPanel (filterNeeds + workOrders → paginatedTable)
          - SortableTable (sortConfig → sortedData)
          - QuantityEditor (quantity → onQuantityChange)
          - ViewDispenserButton (dispenserId → onOpenDispenserModal)
          - Pagination (currentPage → pageNavigation)
      - DispenserModal (conditional)
        - DispenserDetails (dispenser → specificationsDisplay)
        - MaintenanceHistory (dispenser → timelineDisplay)
        - FilterHistory (dispenser → replacementHistory)
        - LocationIndicator (dispenser → locationDisplay)

## Data Flow

1. FiltersContent loads work order data from the API endpoint
   ```javascript
   useEffect(() => {
     const fetchData = async () => {
       setIsLoading(true);
       try {
         const response = await api.get('/work-orders', {
           params: { includeFilters: true, includeDispensers: true }
         });
         setWorkOrders(response.data);
         // Process filter data
         const { filterNeeds, warnings } = calculateFiltersSafely(response.data);
         setFilterNeeds(filterNeeds);
         setFilterWarnings(warnings);
       } catch (error) {
         console.error('Error fetching work order data:', error);
         setError('Failed to load filter data. Please try again later.');
       } finally {
         setIsLoading(false);
       }
     };
     
     fetchData();
     
     // Set up refresh interval
     const intervalId = setInterval(fetchData, REFRESH_INTERVAL);
     return () => clearInterval(intervalId);
   }, []);
   ```

2. FilterUtils processes the raw data into structured formats
   ```javascript
   // In FilterUtils.ts
   export function calculateFiltersSafely(workOrders) {
     try {
       const filterNeeds = generateFilterNeeds(workOrders);
       const warnings = generateFilterWarnings(workOrders, filterNeeds);
       return { filterNeeds, warnings };
     } catch (error) {
       console.error('Error calculating filters:', error);
       return { filterNeeds: [], warnings: new Map() };
     }
   }
   ```

3. Data is filtered based on search term and date range
   ```javascript
   const filteredWorkOrders = useMemo(() => {
     return filterWorkOrders(workOrders, searchTerm, dateRanges[currentWeekIndex]);
   }, [workOrders, searchTerm, currentWeekIndex, dateRanges]);
   ```

4. Filter needs and warnings are generated from filtered work orders
   ```javascript
   const displayedFilterNeeds = useMemo(() => {
     if (selectedFilterType === 'all') {
       return filterNeeds;
     }
     return filterNeeds.filter(need => need.filterType === selectedFilterType);
   }, [filterNeeds, selectedFilterType]);
   ```

5. Data is passed to individual panel components for display
   ```javascript
   <FilterSummaryPanel
     filterNeeds={filterNeeds}
     isLoading={isLoading}
     selectedFilterType={selectedFilterType}
     onFilterTypeChange={setSelectedFilterType}
     onExport={() => exportFilterDataToCSV(filterNeeds)}
   />
   ```

6. User interactions trigger state updates which flow back to FiltersContent
   ```javascript
   const handleQuantityChange = (partNumber, jobId, newQuantity) => {
     setFilterNeeds(prev => prev.map(need => {
       if (need.partNumber === partNumber && need.jobId === jobId) {
         return { ...need, quantity: newQuantity };
       }
       return need;
     }));
     
     // Update backend
     api.patch(`/work-orders/${jobId}/filters/${partNumber}`, {
       quantity: newQuantity
     });
   };
   ```

## State Management

The FiltersContent component manages most of the application state, including:

- Work order data with loading and error states
  ```typescript
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  ```

- Filter needs and warnings derived from work orders
  ```typescript
  const [filterNeeds, setFilterNeeds] = useState<ExtendedFilterNeed[]>([]);
  const [filterWarnings, setFilterWarnings] = useState<Map<string, ExtendedFilterWarning[]>>(new Map());
  ```

- User interaction state for search, dates, and filtering
  ```typescript
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedFilterType, setSelectedFilterType] = useState<string>('all');
  ```

- UI state for panels, visualization, and modals
  ```typescript
  const [showVisualization, setShowVisualization] = useState<boolean>(() => {
    const saved = localStorage.getItem('filters_show_visualization');
    return saved ? JSON.parse(saved) : true;
  });
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    summary: true,
    warnings: true,
    details: true,
    visualization: true
  });
  const [isDispenserModalOpen, setIsDispenserModalOpen] = useState<boolean>(false);
  const [selectedDispenser, setSelectedDispenser] = useState<Dispenser | null>(null);
  ```

- Pagination and sorting for data tables
  ```typescript
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'visitDate',
    direction: 'ascending'
  });
  ```

## Styling

Components use a combination of:
- Tailwind CSS for responsive layout and styling with consistent design system
- React icons for iconography with accessibility support
- Dark/light mode support via theme context for user preference
- CSS animations for smooth transitions and loading states
- Custom design tokens for consistent branding
- Media queries for responsive behavior across devices
- Print stylesheets for report generation

## Performance Optimizations

- Memoized calculations for filtered and derived data
  ```typescript
  const filteredWorkOrders = useMemo(() => 
    filterWorkOrders(workOrders, searchTerm, dateRanges[currentWeekIndex]),
    [workOrders, searchTerm, currentWeekIndex, dateRanges]
  );
  ```

- Virtualized lists for large data sets
  ```typescript
  <VirtualizedList
    data={displayedFilterNeeds}
    rowHeight={60}
    overscan={5}
    renderRow={renderFilterRow}
  />
  ```

- Debounced search input to prevent excessive re-renders
  ```typescript
  const debouncedSearch = useDebounce(searchTerm, 300);
  ```

- Pagination for large datasets to minimize DOM size
- Code splitting for lazy-loaded components
- Optimized re-rendering with React.memo for pure components
- useCallback for stable function references

## Accessibility Features

- Semantic HTML with appropriate ARIA attributes
- Keyboard navigation for all interactive elements
- Focus management for modals and popups
- Screen reader support with descriptive labels
- Sufficient color contrast for all text elements
- Responsive design for various screen sizes and zoom levels
- Reduced motion support for animations

## Error Handling

- Graceful degradation for API failures
- Retry logic for transient network issues
- Fallback UI for missing or incomplete data
- Detailed error messaging with actionable instructions
- Error boundaries to prevent cascading failures

## Testing

- Unit tests for utility functions with Jest
- Component tests with React Testing Library
- Integration tests for component interactions
- End-to-end tests for critical user flows
- Accessibility tests with axe-core
- Performance testing for rendering optimization

## Last Updated

Last updated: May 15, 2025

## Contributors

- Bruce Wayne - Lead Developer
- Clark Kent - UI/UX Design
- Diana Prince - Quality Assurance
- Barry Allen - Performance Optimization

## Upcoming Features

- Enhanced visualization options with custom date ranges
- Filter inventory forecasting based on historical data
- Integration with inventory management system
- Mobile application support with offline capabilities
- Automated warning resolution suggestions
- AI-powered anomaly detection for filter usage patterns