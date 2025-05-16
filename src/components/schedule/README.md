# Schedule Components

This directory contains all components related to the Schedule page functionality, organized in a modular structure similar to the filters components.

## Overview

The Schedule components provide a comprehensive work schedule management interface with multiple viewing modes, filtering options, and interactive features for managing gas station service visits.

## Component Structure

```
schedule/
├── ScheduleContent.tsx    # Main container component
├── Panel.tsx             # Reusable panel wrapper
├── ScheduleHeader.tsx    # Header with statistics
├── WeekNavigator.tsx     # Week navigation controls
├── StoreFilter.tsx       # Store type filtering
├── ViewSelector.tsx      # View mode selection
├── JobCard.tsx           # Individual job display
├── WeeklyView.tsx        # Weekly list view
├── CompactView.tsx       # Compact grid view
├── ScheduleTypes.ts      # TypeScript interfaces
├── ScheduleUtils.ts      # Utility functions
├── index.ts              # Barrel exports
└── README.md            # Documentation
```

## Components

### ScheduleContent
The main container component that orchestrates all schedule functionality.

**Props:**
- `workOrders: WorkOrder[]` - Array of work orders to display
- `isLoading: boolean` - Loading state

**Features:**
- State management for filters, views, and modals
- Event handling for all user interactions
- Integration with CalendarView and modals
- Context integration for dispenser data

### Panel
A reusable wrapper component for consistent styling.

**Props:**
- `children: React.ReactNode` - Content to wrap
- `className?: string` - Additional CSS classes
- `title?: string` - Optional panel title
- `icon?: React.ReactNode` - Optional title icon
- `action?: React.ReactNode` - Optional action element

### ScheduleHeader
Displays schedule statistics and store distribution.

**Props:**
- `stats: ScheduleStats` - Calculated statistics
- `isLoading: boolean` - Loading state

**Displays:**
- Current week job count
- Next week job count
- Store distribution breakdown

### WeekNavigator
Navigation controls for moving between weeks.

**Props:**
- `workWeekDates: WorkWeekDates` - Current week dates
- `onNavigate: (date: Date) => void` - Navigation handler
- `onGoToCurrentWeek: () => void` - Today button handler

### StoreFilter
Filter buttons for store types.

**Props:**
- `activeFilter: StoreFilter` - Current filter
- `onFilterChange: (filter: StoreFilter) => void` - Filter change handler

**Filter Options:**
- All
- 7-Eleven
- Circle K
- Wawa
- Other

### ViewSelector
Toggle between different view modes.

**Props:**
- `activeView: ViewMode` - Current view mode
- `onViewChange: (view: ViewMode) => void` - View change handler

**View Modes:**
- Weekly (list view)
- Calendar (calendar grid)
- Compact (condensed grid)

### JobCard
Displays individual work order details with action buttons.

**Props:**
- `order: WorkOrder` - Work order data
- `dispenserData?: any` - Context dispenser data
- Various event handlers for actions

**Features:**
- Store information display
- Visit date and dispenser count
- Action buttons (WorkFossa, filters, form prep, etc.)
- Expandable instructions preview

### WeeklyView
Renders jobs in a weekly list format grouped by date.

**Props:**
- `grouped: GroupedWorkOrders` - Grouped work orders
- `dispenserData?: any` - Context dispenser data
- Various handlers for interactions

**Features:**
- Date grouping with headers
- Same-day indicators
- Expandable sections
- Show more/less functionality

### CompactView
Renders jobs in a compact calendar grid format.

**Props:**
- `groupedWorkOrders: GroupedWorkOrders` - Grouped work orders
- `workWeekDates: WorkWeekDates | null` - Week date boundaries
- Various handlers for interactions

**Features:**
- 5-day work week grid
- Current and next week views
- Compact job cards
- Other scheduled jobs section

## Types

Key TypeScript interfaces defined in `ScheduleTypes.ts`:

- `WorkOrder` - Main work order interface
- `Customer` - Customer information
- `Dispenser` - Dispenser data structure
- `CalendarEvent` - Calendar view event
- `WorkWeekDates` - Week date boundaries
- `GroupedWorkOrders` - Grouped order structure
- `StoreFilter` - Filter type union
- `ViewMode` - View mode union
- `ScheduleStats` - Statistics interface

## Utilities

Key utility functions in `ScheduleUtils.ts`:

- `calculateWorkWeekDates()` - Calculate Monday-Friday work week
- `extractVisitNumber()` - Extract visit number from order
- `getStoreTypeForFiltering()` - Determine store type
- `getStoreStyles()` - Get store-specific styling
- `processInstructions()` - Clean up instructions text
- `groupOrdersByDate()` - Group orders by date

## Usage

```tsx
import { ScheduleContent } from './components/schedule';

function Schedule() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load work orders...
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Work Schedule</h1>
      <ScheduleContent 
        workOrders={workOrders}
        isLoading={isLoading}
      />
    </div>
  );
}
```

## Integration

The schedule components integrate with:

- `DispenserContext` for dispenser data
- `ToastContext` for notifications
- `CalendarView` component
- Various modal components
- Dispenser and form services

## Styling

Components use:
- Tailwind CSS classes
- Dark mode support
- Responsive design
- Store-specific color coding
- Consistent spacing and typography

## Best Practices

1. **Performance**: Use `useMemo` and `useCallback` for expensive calculations
2. **State Management**: Keep state at appropriate levels
3. **Error Handling**: Provide user feedback for all operations
4. **Accessibility**: Include proper ARIA labels and keyboard navigation
5. **Responsiveness**: Ensure all views work on mobile devices