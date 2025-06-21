# Settings Page Collapsible Sections

## Overview
Converted all settings sections to use collapsible panels, making the settings page much cleaner and easier to navigate. All sections are collapsed by default and automatically expand when navigating directly to them.

## Key Improvements

### 1. **Collapsible Sections Throughout**
Every tab now uses CollapsibleSection components:
- **Profile**: Profile Information
- **Appearance**: Theme Settings
- **Notifications**: Email, Pushover, and Notification Preferences
- **Security**: Password Settings, WorkFossa Credentials
- **System**: Automation Settings, Data Management, Work Week Configuration
- **Scraping**: Work Order Sync Schedule
- **Advanced**: SMTP, Filters, Delays, Browser, Display settings

### 2. **Smart Navigation**
When clicking from Work Order Sync status:
- Navigates to correct tab (`?tab=scraping`)
- Automatically expands the relevant section (`?section=scraping-schedule`)
- All other sections remain collapsed for clean view

### 3. **Improved Organization**
- Related settings grouped together
- Clear section titles and descriptions
- Icons for visual context
- Smooth expand/collapse animations

## Visual Before & After

### Before:
```
Settings Page - Notifications Tab
├── [Long Email Settings Form - Always Visible]
├── [Long Pushover Form - Always Visible]
└── [Long Preferences List - Always Visible]
Total: Very long scrolling page
```

### After:
```
Settings Page - Notifications Tab
├── ▶ Email Notifications (click to expand)
├── ▶ Pushover Notifications (click to expand)
└── ▶ Notification Preferences (click to expand)
Total: Clean, organized view
```

## User Benefits

1. **Reduced Cognitive Load**
   - Only see settings you're working with
   - No overwhelming long forms
   - Clear visual hierarchy

2. **Faster Navigation**
   - Direct links work perfectly
   - Auto-expand relevant sections
   - Less scrolling required

3. **Better Mobile Experience**
   - Sections fit better on small screens
   - Touch-friendly expand/collapse
   - Reduced vertical scrolling

## Implementation Details

### CollapsibleSection Component
```typescript
<CollapsibleSection
  id="unique-section-id"
  title="Section Title"
  description="Brief description"
  icon={IconComponent}
  isExpanded={expandedSections.has('unique-section-id')}
  onToggle={() => toggleSection('unique-section-id')}
>
  {/* Section content */}
</CollapsibleSection>
```

### URL Parameter Handling
```typescript
// Handle URL parameters on mount
useEffect(() => {
  const tabParam = searchParams.get('tab')
  const sectionParam = searchParams.get('section')
  
  if (tabParam) {
    setActiveTab(tabParam)
    if (sectionParam) {
      setExpandedSections(new Set([sectionParam]))
    }
  }
}, [searchParams])
```

### Section IDs Reference
- `profile-info` - Profile settings
- `theme-settings` - Appearance settings
- `email-notifications` - Email configuration
- `pushover-notifications` - Pushover setup
- `notification-preferences` - Notification types
- `password-settings` - Password management
- `workfossa-credentials` - WorkFossa login
- `automation-settings` - Automation options
- `data-management` - Data retention
- `work-week` - Working days
- `scraping-schedule` - Hourly scraping
- `smtp-settings` - SMTP server
- `filter-settings` - Work order filters
- `automation-delays` - Timing settings
- `browser-settings` - Browser config
- `notification-display` - Display options

## Usage Examples

### Direct Navigation
```typescript
// Navigate to specific section
navigate('/settings?tab=notifications&section=pushover-notifications')

// Navigate to scraping settings
navigate('/settings?tab=scraping&section=scraping-schedule')
```

### Manual Toggle
Click any section header to expand/collapse it. Only one or multiple sections can be open at once based on user preference.

## Future Enhancements

1. **Remember State**
   - Save expanded sections in user preferences
   - Restore on next visit

2. **Search Integration**
   - Search across all sections
   - Auto-expand sections with matches

3. **Keyboard Navigation**
   - Space/Enter to toggle sections
   - Arrow keys to navigate between sections

4. **Bulk Actions**
   - "Expand All" / "Collapse All" buttons
   - Save all sections at once