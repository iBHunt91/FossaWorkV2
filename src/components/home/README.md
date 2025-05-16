# Home Components Documentation

This directory contains the components used for the Home/Dashboard page of the Fossa Monitor application. These components work together to provide a comprehensive overview of work orders, filter needs, verifications, and changes.

## Component Overview

### HomeContent.tsx
The main container component that orchestrates the dashboard layout and functionality.

**Key Features:**
- Loads and processes work order data
- Manages panel expansion states
- Handles global search functionality
- Coordinates data scraping operations
- Manages alert messaging system
- Renders all dashboard panels in a responsive layout

**Props:** None (standalone component)

### HomeUtils.ts
A utility module that provides data processing functions for the Home components.

**Key Functions:**
- `getWorkWeekDateRanges`: Calculates work week date ranges
- `calculateCategoryCounts`: Counts work orders by time period
- `calculateDistribution`: Produces data for distribution charts
- `getMeterType`: Determines the meter type for a work order
- `processInstructions`: Parses work order instructions
- `getDisplayName`: Formats store names for display
- `formatChangeHistory`: Processes change history data
- `generateRealWarnings`: Creates filter warning objects

### Panel.tsx
A reusable panel component with collapsible functionality.

**Props:**
- `id`: String identifier for the panel
- `title`: Display title
- `icon`: React node for the panel icon
- `expanded`: Boolean to control expanded state
- `onToggle`: Function callback for expansion toggle
- `children`: Content to render inside the panel

### SearchBar.tsx
A search input component with clear functionality.

**Props:**
- `searchQuery`: Current search text
- `setSearchQuery`: Function to update search text

### FilterBreakdownPanel.tsx
Displays filter inventory needs across work orders.

**Props:**
- `filterNeeds`: Array of filter need objects
- `loading`: Boolean indicating loading state

**Features:**
- Summarizes filter quantities by type
- Calculates boxes needed for inventory
- Provides detailed table of filter requirements

### VerificationPanel.tsx
Displays verification warnings related to filter installations.

**Props:**
- `warnings`: Array of filter warning objects
- `loading`: Boolean indicating loading state

**Features:**
- Groups warnings by severity
- Shows detailed warning information with store context

### ChangesPanel.tsx
Displays recent schedule changes and modifications.

**Props:**
- `changes`: Array of change record objects
- `loading`: Boolean indicating loading state
- `formatChangeItem`: Function to format change items for display

**Features:**
- Shows chronological list of schedule changes
- Categorizes changes by severity
- Provides summary statistics of change types

### OverviewPanel.tsx
Provides high-level statistics and distribution charts.

**Props:**
- `loading`: Boolean indicating loading state
- `workWeekDateRanges`: Date ranges for work week calculations
- `selectedDate`: Currently selected date
- `setSelectedDate`: Function to update selected date
- `categoryCounts`: Count of work orders by category
- `storeDistribution`: Distribution of stores by type
- `dailyDistribution`: Distribution of work by day
- `goToCurrentWeek`: Function to reset to current week
- `formatDateRange`: Function to format date ranges

### ToolsPanel.tsx
Provides data management tools and scraping controls.

**Props:**
- `isScrapingWorkOrders`: Boolean indicating if work order scraping is in progress
- `isScrapingDispensers`: Boolean indicating if dispenser scraping is in progress
- `scrapeWorkOrdersProgress`: Progress percentage for work order scraping
- `scrapeDispensersProgress`: Progress percentage for dispenser scraping
- `scrapeWorkOrdersMessage`: Status message for work order scraping
- `scrapeDispensersMessage`: Status message for dispenser scraping
- `handleScrapeWorkOrders`: Function to initiate work order scraping
- `handleScrapeDispenserData`: Function to initiate dispenser scraping
- `openWorkFossaWithLogin`: Function to open Work Fossa in browser
- `consoleHeight`: Current height of console section
- `setConsoleHeight`: Function to update console height

## Component Relationships

The component hierarchy is as follows:

- **HomeContent**
  - SearchBar
  - Panel (Overview)
    - OverviewPanel
  - Panel (Tools)
    - ToolsPanel
  - Panel (Filters)
    - FilterBreakdownPanel
  - Panel (Verification)
    - VerificationPanel
  - Panel (Changes)
    - ChangesPanel
  - DispenserModal (conditional)
  - InstructionsModal (conditional)

## Data Flow

1. HomeContent loads work order data via API calls
2. HomeUtils processes the raw data into structured formats
3. Data is passed to individual panel components for display
4. User interactions trigger updates which flow back up to HomeContent
5. HomeContent orchestrates data refreshes and state updates

## State Management

The HomeContent component manages most of the application state, including:

- Work order data
- Filter needs
- Verification warnings
- Change history
- UI states (panel expansion, search, alerts)
- Modal visibility and data

## Styling

Components use a combination of:
- Tailwind CSS for responsive layout and styling
- React icons for iconography
- Dark/light mode support via theme context

## Last Updated

Last updated: May 14, 2025
