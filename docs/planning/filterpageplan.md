# Comprehensive Filter Logic Analysis & Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technical Architecture](#technical-architecture)
4. [Core Components](#core-components)
5. [Filter Calculation Logic](#filter-calculation-logic)
6. [User Interface Sections](#user-interface-sections)
7. [Data Flow & State Management](#data-flow--state-management)
8. [Business Rules & Edge Cases](#business-rules--edge-cases)
9. [Integration Points](#integration-points)
10. [Performance Considerations](#performance-considerations)
11. [Future Enhancements](#future-enhancements)

## Executive Summary

The Filters page is a sophisticated filter management system within the Fossa Monitor application designed to calculate, display, and manage fuel filter requirements for maintenance technicians. It processes work orders to determine the exact number and types of filters needed for weekly fuel dispenser maintenance visits across multiple gas station chains including 7-Eleven, Circle K, Wawa, and others.

### Key Value Propositions
- **Automated Calculation**: Eliminates manual filter counting errors
- **Multi-Chain Support**: Handles different filter requirements by store chain
- **Intelligent Rules Engine**: Applies complex business logic for filter determination
- **Real-time Updates**: Synchronizes with live work order data
- **Audit Trail**: Tracks manual adjustments and provides revert capabilities

## System Overview

### Purpose
The filter management system serves field technicians who perform routine maintenance on fuel dispensers. It analyzes scheduled work orders and calculates the precise number of filters needed based on:
- Fuel grade configurations at each site
- Store chain-specific requirements
- Special handling for multi-day jobs
- Dispenser-specific maintenance tasks

### Core Capabilities
1. **Automated Filter Calculation**
   - Analyzes fuel grades per dispenser
   - Applies chain-specific filter part numbers
   - Handles special cases (DEF, high-flow, ethanol-free)

2. **Data Management**
   - Real-time synchronization with work order system
   - Persistent storage of manual adjustments

3. **Quality Assurance**
   - Warning system for data anomalies
   - Manual override capabilities
   - Audit trail for changes

## Technical Architecture

### Component Hierarchy
```
Filters.tsx (Page Container)
└── FiltersContent.tsx (Main Orchestrator)
    ├── DateSelector.tsx (Week Selection)
    ├── FilterSummaryPanel.tsx (Aggregated View)
    ├── FilterWarningsPanel.tsx (Issue Detection)
    ├── FilterDetailsPanel.tsx (Detailed Table)
    └── FilterVisualization.tsx (Charts/Analytics)
```

### Key Technologies
- **Frontend**: React 18+ with TypeScript
- **State Management**: React Hooks + Context API
- **Styling**: TailwindCSS with custom components
- **Data Fetching**: Custom hooks with caching
- **Real-time Updates**: WebSocket integration

### Data Flow Architecture
```
Work Orders API → JobDataService → useJobData Hook → Components
                         ↓
                 SharedFilterState (Cross-page sync)
                         ↓
                 Local/Session Storage (Persistence)
```

## Core Components

### 1. FiltersContent.tsx
**Primary Responsibilities:**
- Component orchestration
- State management
- Data loading coordination
- Event handling

**Key Features:**
- Work week selection integration
- Auto-refresh capability (60-second intervals)
- Loading state management
- Error boundary integration

### 2. DateSelector.tsx
**Purpose:** Provides intuitive work week selection

**Features:**
- Respects user's work week preferences
- Previous/Next week navigation
- Current week highlighting
- Date range display formatting

**Implementation Details:**
```typescript
// Calculates week boundaries based on user preferences
const getWorkWeekBounds = (date: Date, startDay: number) => {
  // Logic to find week start/end based on configured start day
}
```

### 3. FilterSummaryPanel.tsx
**Purpose:** Aggregated filter view with box calculations

**Key Features:**
- Groups filters by part number
- Calculates box requirements:
  - Standard filters: 12 per box
  - DEF filters: 6 per box
- Interactive filter type selection
- CSV export functionality

**Data Structure:**
```typescript
interface FilterSummary {
  partNumber: string;
  description: string;
  quantity: number;
  boxes: number;
  storeCount: number;
}
```

### 4. FilterWarningsPanel.tsx
**Purpose:** Proactive issue detection and reporting

**Warning Categories:**
1. **Severity 1-3 (Low)**: Informational notices
   - Multi-day job notifications
   - Expected data variations

2. **Severity 4-6 (Medium)**: Attention required
   - Unknown fuel grades
   - Missing dispenser data

3. **Severity 7-10 (High)**: Critical issues
   - Calculation failures
   - Data integrity problems

**Warning Structure:**
```typescript
interface FilterWarning {
  severity: number;
  type: string;
  message: string;
  affectedJobs: string[];
  suggestions?: string[];
}
```

### 5. FilterDetailsPanel.tsx
**Purpose:** Granular view with editing capabilities

**Features:**
- Sortable columns (Visit ID, Store, Date)
- Inline editing with visual indicators
- Pagination (10 items per page)
- Dispenser modal integration
- Revert functionality

**Edit Mode Behavior:**
- Green checkmark indicates edited values
- Changes persist to local storage
- Original values preserved for revert
- Real-time recalculation of totals

### 6. FilterVisualization.tsx
**Purpose:** Visual analytics and insights

**Chart Types:**
1. **Filter Distribution**: Pie chart by part number
2. **Store Analysis**: Bar chart by location
3. **Chain Breakdown**: Grouped analysis

## Filter Calculation Logic

### Core Algorithm
```typescript
function calculateFilters(dispenser: Dispenser, storeType: string): FilterNeeds {
  const filters = {};
  
  // Step 1: Determine store-specific part numbers
  const partNumbers = getPartNumbers(storeType, dispenser.meterType);
  
  // Step 2: Analyze fuel grades
  const fuelGrades = parseFuelGrades(dispenser);
  
  // Step 3: Apply business rules
  for (const grade of fuelGrades) {
    if (requiresFilter(grade, fuelGrades)) {
      filters[grade.type] = partNumbers[grade.type];
    }
  }
  
  return filters;
}
```

### Filter Rules by Fuel Type

#### Standard Rules
| Fuel Type | Filter Required | Conditions |
|-----------|----------------|------------|
| Regular | Always | No exceptions |
| Plus/Midgrade | Never | Blend product |
| Premium | Conditional | Only if no Super/Ultra |
| Super | Always | No exceptions |
| Ultra | Always | No exceptions |
| Diesel | Always | Except Circle K high-flow |
| DEF | Always | 7-Eleven only |
| Ethanol-free | Always | All grades |

#### Special Cases

**1. Premium Filter Logic**
```typescript
// Premium only gets filter if it's the highest grade
if (grade === 'Premium') {
  const hasHigherGrade = grades.some(g => 
    g === 'Super' || g === 'Ultra' || g === 'Supreme'
  );
  return !hasHigherGrade;
}
```

**2. Multi-Day Job Handling**
```typescript
// Only count filters on Day 1
if (job.isMultiDay && job.dayNumber > 1) {
  return { filterCount: 0, reason: 'Multi-day job - Day ' + job.dayNumber };
}
```

**3. Specific Dispenser Jobs (Code 2862)**
```typescript
// Parse instructions for dispenser references
const dispenserRefs = parseDispenserReferences(job.instructions);
// Only calculate for mentioned dispensers
const applicableDispensers = dispensers.filter(d => 
  dispenserRefs.includes(d.number)
);
```

### Part Number Mapping

#### 7-Eleven/Speedway/Marathon
```javascript
const sevenElevenFilters = {
  gas: {
    'Gilbarco': '400348',
    'Gilbarco': '400213',
    'Gilbarco': '400361'
  },
  diesel: '400361',
  dieselHighFlow: '402691'
};
```

#### Wawa
```javascript
const wawaFilters = {
  gas: '400203',
  diesel: '400204'
};
```

#### Circle K
```javascript
const circleKFilters = {
  gas: '400203',
  diesel: '400204',
  dieselHighFlow: null // No filter required
};
```

  Filter System Custom Instructions & Rules

  Core Business Rules

  - Always Receive Filters: Regular, Diesel, Super/Premium, Ultra, Ethanol-Free, E-85, Kerosene
  - Never Get Filters: Plus/Midgrade (considered blend products)
  - Premium Logic: Gets filter UNLESS Super or Ultra exists on same dispenser

  Store-Specific Filter Mappings

  7-Eleven/Speedway/Marathon:
  - GAS: Electronic/HD Meter: 400MB-10, Ecometer: 40510A-AD
  - DIESEL: Electronic/HD Meter: 400HS-10, Ecometer: 40510W-AD
  - DEF: 800HS-30 (6 filters per box)

  Wawa: GAS: 450MB-10, DIESEL: 450MG-10
  Circle K: GAS: 40510D-AD, DIESEL: 40530W-AD

  Special Handling Rules

  - Multi-Day Jobs: Only count filters on Day 1
  - Job Code 2862 (Specific Dispensers): Parse instructions, calculate only for mentioned dispensers
  - DEF/High Flow: Special warnings and filter requirements

## User Interface Sections

### Header Section
**Components:**
- Page title with filter icon
- Action buttons:
  - Toggle Charts (show/hide visualizations)
- Status badges:
  - Job count
  - Total filters needed
  - Active warnings

### Summary Statistics Bar
**Displays:**
- Current work week range
- Total jobs in selection
- Aggregate filter count
- Warning summary

### Panel Layout
**Responsive Design:**
- Desktop: Side-by-side panels
- Tablet: Stacked with priority ordering
- Mobile: Single column with collapsible sections

### Interactive Elements

#### Expandable Panels
- Click header to expand/collapse
- Chevron indicators for state
- Smooth animation transitions
- State persistence across sessions

#### Sort Functionality
**Sortable Columns:**
- Visit ID (numeric)
- Store Name (alphabetic)
- Date (chronological)
- Filter quantities (numeric)

#### Edit Mode
**Visual Indicators:**
- Pencil icon for edit capability
- Green checkmark for edited items
- Yellow highlight on hover
- Red X for revert option

## Data Flow & State Management

### State Architecture

#### Component State
```typescript
// FiltersContent local state
const [selectedWeek, setSelectedWeek] = useState<Date>();
const [filterType, setFilterType] = useState<string>('all');
const [showCharts, setShowCharts] = useState(false);
const [editedValues, setEditedValues] = useState<Record<string, number>>();
```

#### Shared State
```typescript
// SharedFilterState for cross-page synchronization
export const sharedFilterState = {
  lastCalculation: null,
  cachedResults: null,
  isDirty: false,
  
  calculate: async (week: Date) => {
    // Centralized calculation logic
  },
  
  invalidate: () => {
    // Force recalculation
  }
};
```

### Data Loading Strategy

#### Initial Load
1. Check cache validity
2. Load from cache if valid
3. Fetch fresh data if needed
4. Calculate filters
5. Update UI

#### Refresh Patterns
- **Event-based**: WebSocket updates


### Persistence Layers

#### Local Storage
- Edited filter values
- User preferences
- Cache timestamps

#### Session Storage
- UI state (expanded panels)
- Active filters
- Sort preferences

#### Memory Cache
- Calculated results
- API responses
- Intermediate computations

## Business Rules & Edge Cases

### Complex Scenarios

#### 1. Store Chain Transitions
When a store changes ownership:
- Historical data uses old filter types
- New jobs use updated requirements
- Warning generated for transition period

#### 2. Seasonal Variations
- DEF filters increase in winter
- Ethanol-free demand varies by region
- Special event considerations

#### 3. Equipment Upgrades
- Meter type changes affect part numbers
- High-flow diesel conversions
- New fuel grade additions

### Error Handling

#### Data Validation
```typescript
// Validate fuel grade data
if (!isValidFuelGrade(grade)) {
  warnings.push({
    severity: 6,
    message: `Unknown fuel grade: ${grade}`,
    suggestion: 'Review dispenser configuration'
  });
  // Attempt calculation with defaults
}
```

#### Graceful Degradation
1. Missing dispenser data → Use job description
2. Unknown store type → Default to common filters
3. API failures → Use cached data
4. Calculation errors → Show manual entry option

### Special Job Codes

#### AccuMeasure Forms (2861, 3002)
- All dispensers requiring maintenance
- Standard filter calculations apply
- Additional meter reading requirements

#### Specific Dispensers (2862)
- Parse natural language instructions
- Identify dispenser numbers/positions
- Calculate only for specified units

#### Open Neck Prover (3146)
- No filter requirements
- Calibration-only visits
- Excluded from calculations

## Integration Points

### API Endpoints
```typescript
// Primary endpoints
GET /api/users/:userId/work-orders
GET /api/users/:userId/dispensers
POST /api/filters/calculate
PUT /api/filters/overrides
```

### WebSocket Events
```typescript
// Real-time updates
socket.on('workOrderUpdate', (data) => {
  // Trigger recalculation
});

socket.on('dispenserUpdate', (data) => {
  // Update filter needs
});
```

### Export Formats

#### CSV Export
```csv
Part Number,Description,Quantity,Boxes Needed,Stores Affected
400348,7-Eleven Gas Filter,156,13,28
400361,7-Eleven Diesel Filter,89,8,28
402691,7-Eleven DEF Filter,12,2,4
```

#### PDF Report (Future)
- Summary page with totals
- Detailed breakdown by store
- Warning/issue appendix

## Performance Considerations

### Optimization Strategies

#### Memoization
```typescript
// Expensive calculations cached
const filterResults = useMemo(() => 
  calculateAllFilters(workOrders, dispensers),
  [workOrders, dispensers]
);
```

#### Pagination
- 10 items per page in details view
- Virtual scrolling for large datasets
- Lazy loading of chart data

#### Debouncing
- Search input: 300ms delay
- Resize events: 100ms delay
- Scroll position: 50ms delay

### Performance Metrics
- Initial load: < 2 seconds
- Calculation time: < 500ms for 100 jobs
- UI responsiveness: 60 FPS target
- Memory usage: < 50MB active


## Conclusion

The Filters page represents a sophisticated solution to a complex operational challenge. By automating filter calculations while providing flexibility for manual adjustments, it significantly reduces errors and improves efficiency for field technicians. The system's modular architecture and comprehensive business rule engine make it adaptable to future requirements while maintaining high performance and reliability standards.