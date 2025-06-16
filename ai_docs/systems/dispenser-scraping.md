# Dispenser Information Scraping System

## Overview
The dispenser scraping system automatically extracts detailed equipment information from WorkFossa work orders, including dispenser specifications, fuel grades, and custom fields. The system has been significantly enhanced with content-based waiting strategies and improved click handling for reliable data extraction.

## Architecture

### Components
1. **DispenserScraper** (`dispenser_scraper.py`) - Enhanced scraping logic with smart navigation
2. **ContentBasedWait** (`content_based_wait.py`) - Intelligent wait utilities for dynamic content
3. **WorkFossaScraper Integration** - Automatic dispenser detection
4. **API Endpoints** - Manual and automatic triggering
5. **Data Models** - Dispenser storage and relationships

## Implementation Details

### DispenserScraper Service
Located in `/backend/app/services/dispenser_scraper.py`

#### Key Features:
- **Intelligent Navigation**: Finds and clicks Equipment tab and Dispenser section
- **Flexible Selectors**: Multiple fallback strategies for different page structures
- **Data Extraction**: Captures:
  - Dispenser number and title
  - Serial numbers
  - Make and model
  - Fuel grade configurations
  - Custom fields
  - Raw HTML for debugging

#### DispenserInfo Data Structure:
```python
@dataclass
class DispenserInfo:
    dispenser_id: str
    title: str
    serial_number: Optional[str]
    make: Optional[str]
    model: Optional[str]
    dispenser_number: Optional[str]
    location: Optional[str]
    fuel_grades: Dict[str, Any]
    custom_fields: Dict[str, str]
    raw_html: Optional[str]
    last_updated: datetime
```

### Integration with Work Order Scraping

**Performance Note**: Dispenser scraping has been separated from work order scraping due to performance considerations. Dispenser scraping takes significantly longer than work order scraping, so it's now done as a separate batch operation.

The system identifies work orders that need dispenser scraping based on:
1. Service codes indicating dispensers (2861, 2862, 3146, 3002)
2. Valid visit URL availability

```python
# Previously integrated (now disabled for performance):
# if visit_url and service_info.get("code") in ["2861", "2862", "3146", "3002"]:
#     detailed_dispensers = await self.scrape_dispenser_details(...)

# Now done via separate batch endpoint
dispenser_service_codes = ["2861", "2862", "3146", "3002"]
work_orders = db.query(WorkOrder).filter(
    WorkOrder.user_id == user_id,
    WorkOrder.service_code.in_(dispenser_service_codes)
).all()
```

### API Endpoints

#### Individual Work Order Dispenser Scraping
```
POST /api/v1/work-orders/{work_order_id}/scrape-dispensers
```

Query Parameters:
- `user_id` - User ID to verify ownership

Response:
```json
{
    "status": "scraping_started",
    "message": "Dispenser scraping initiated for work order W-123456",
    "work_order_id": "uuid-here",
    "visit_url": "https://app.workfossa.com/...",
    "timestamp": "2025-06-11T12:00:00"
}
```

#### Batch Dispenser Scraping
```
POST /api/v1/work-orders/scrape-dispensers-batch
```

Query Parameters:
- `user_id` - User ID to scrape dispensers for

Response:
```json
{
    "status": "scraping_started",
    "message": "Batch dispenser scraping initiated for 10 work orders",
    "work_order_count": 10,
    "timestamp": "2025-06-11T12:00:00"
}
```

#### Get Dispenser Scraping Progress
```
GET /api/v1/work-orders/scrape-dispensers/progress/{user_id}
```

Response:
```json
{
    "status": "in_progress",
    "phase": "scraping",
    "percentage": 45,
    "message": "Scraping dispensers for work order 5/10: W-123456",
    "total_work_orders": 10,
    "processed": 4,
    "successful": 3,
    "failed": 1,
    "started_at": "2025-06-11T12:00:00",
    "completed_at": null,
    "error": null
}
```

## Scraping Process

### 1. Enhanced Navigation with Content-Based Waiting
The system now uses intelligent content-based waiting instead of arbitrary timeouts:

1. **Navigate to work order visit URL**
   - Uses `domcontentloaded` for initial page load
   
2. **Wait for Equipment tab**
   - Uses `ContentBasedWait.wait_for_equipment_tab()` to ensure tab is clickable
   - Verifies element visibility and enabled state
   
3. **Click Equipment tab and wait for loader**
   - Clicks the Equipment tab
   - Uses `ContentBasedWait.wait_for_loader_to_disappear()` to wait for content loading
   - Monitors `.loader-line` element for `display: none` state
   
4. **Find and expand Dispenser section**
   - Uses `ContentBasedWait.wait_for_dispenser_toggle()` to find toggle
   - Extracts expected dispenser count from toggle text (e.g., "Dispenser (8)")
   - Uses `ContentBasedWait.click_dispenser_toggle_safely()` for reliable expansion

### 2. Improved Click Handling
The dispenser toggle click now handles the specific WorkFossa HTML structure:

```javascript
// Find the correct link structure
<a href="#" title="Show equipment" class="ml-1">
    <span class="bold">Dispenser</span> (8)
    <svg><!-- chevron icon --></svg>
</a>

// The click method:
1. Finds links with span.bold containing "Dispenser"
2. Verifies the count pattern
3. Locates the content area (next sibling after .group-heading)
4. Manually expands if needed
5. Updates chevron icon state
```

### 3. Element Detection
The scraper uses multiple strategies to find dispenser information:

```javascript
// Primary method - look for py-1.5 containers with dispenser data
const containers = document.querySelectorAll('div.py-1\\.5');
for (const container of containers) {
    const text = container.textContent || '';
    if (text.includes('S/N:') || text.includes('MAKE:') || 
        text.includes('MODEL:') || text.includes('Gilbarco')) {
        // This is a dispenser container
    }
}

// Fallback selectors still available
'.dispenser-item'
'.equipment-item'
'[data-equipment-type="dispenser"]'
```

### 4. Data Extraction
For each dispenser found:
- Extract title from container header
- Parse serial number from S/N: field
- Get make/model from MAKE:/MODEL: fields
- Extract fuel grade configurations
- Capture custom fields
- Store raw HTML for debugging

### 5. Fuel Grade Parsing
The system intelligently parses fuel grade information:
- Detects common patterns: Regular, Plus, Premium, Diesel, Super, Ethanol-Free
- Extracts from container text or custom fields
- Groups by dispenser position (e.g., "1/2", "3/4", "5/6")
- Provides defaults if no fuel grades found

## Data Storage

### Database Schema
Dispensers are stored in the `dispensers` table with:
- Foreign key relationship to work orders
- JSON field for fuel grades
- Progress tracking fields for automation

### Scraped Data
Raw dispenser data is also stored in the work order's `scraped_data` JSON field:
```json
{
    "dispensers": [...],
    "dispenser_count": 2,
    "dispenser_scrape_date": "2025-06-11T12:00:00"
}
```

## Error Handling

### Graceful Degradation
- If Equipment tab not found → Returns empty list with warning
- If loader doesn't disappear → Continues after timeout
- If Dispenser toggle not found → Tries fallback methods
- If content doesn't expand → Checks if already visible
- If extraction fails → Logs error and continues

### Enhanced Logging
Comprehensive logging with emojis for clarity:
- 🔧 Starting dispenser scrape
- ⏳ Waiting for elements
- 👆 Click actions
- ✅ Success messages
- ⚠️ Warning indicators
- ❌ Error indicators
- 📊 Data statistics
- 📸 Screenshot captures

### Content-Based Wait Utilities
The `ContentBasedWait` class provides:
- `wait_for_equipment_tab()` - Ensures Equipment tab is ready
- `wait_for_loader_to_disappear()` - Monitors loader line state
- `wait_for_dispenser_toggle()` - Finds dispenser section with count
- `click_dispenser_toggle_safely()` - Handles specific HTML structure
- `wait_for_dispenser_content()` - Verifies content is visible
- `extract_dispenser_count_from_toggle()` - Gets expected count
- `wait_for_modal_and_close()` - Handles popup modals

## Testing

### Test Scripts
Multiple test scripts for different aspects:

1. **`test_improved_dispenser_click.py`** - Tests the click mechanism
   - Verifies Equipment tab navigation
   - Tests dispenser toggle clicking
   - Validates content expansion
   - Shows sample data extraction

2. **`test_complete_dispenser_workflow.py`** - End-to-end workflow test
   - Tests full scraping process
   - Verifies data extraction
   - Tests multiple locations
   - Validates dispenser counts

3. **`test_dispenser_scraper_updates.py`** - Integration test
   - Tests updated scraper with all improvements
   - Shows real-time progress
   - Displays detailed results
   - Tests batch processing

### Manual Testing
1. Run test script: `python3 scripts/test_improved_dispenser_click.py`
2. Browser opens (non-headless) for visual verification
3. Watch automation progress step by step
4. Review extracted data in console
5. Screenshot saved for debugging

## Batch Processing

### Benefits
1. **Performance**: Single browser session for multiple work orders
2. **Efficiency**: Reuses login session across all scraping operations
3. **Progress Tracking**: Real-time updates on processing status
4. **Error Resilience**: Continues processing even if individual work orders fail

### Frontend Integration
The Work Orders page includes a dedicated "Scrape Dispensers" button that:
- Triggers batch scraping for all eligible work orders
- Shows real-time progress with percentage, processed count, and success/failure stats
- Uses orange/amber color scheme to distinguish from regular work order scraping
- Automatically refreshes work order data upon completion

### Usage
1. Click "Scrape Dispensers" button in Work Orders page
2. Monitor progress in the orange progress card
3. View updated dispenser counts in work order cards
4. Check individual work order details for full dispenser information

## Recent Improvements

### June 2025
1. **Content-Based Waiting**: Replaced arbitrary timeouts with intelligent wait conditions
2. **Loader Detection**: Monitor `.loader-line` element to ensure page is ready
3. **Enhanced Click Handling**: Specific handling for WorkFossa's dispenser toggle structure
4. **Improved Reliability**: Better error handling and fallback strategies
5. **Performance**: Faster scraping with targeted waits instead of fixed delays

### January 2025 - UI/UX Enhancements
1. **Progress Tracking Improvements**:
   - Fixed NaN display issues in progress indicators
   - Improved percentage calculations (30-95% range for actual scraping work)
   - Added dedicated single work order dispenser scraping with real-time progress
   - Implemented polling mechanism for progress updates

2. **User Experience**:
   - Removed all modal dialogs (alert/confirm) for non-blocking interactions
   - Fixed issue where UI showed completion before backend finished
   - Ensured progress bar reaches 100% before showing success message
   - Added 500ms delay for smooth transition from progress to success

3. **Technical Enhancements**:
   - Created `/api/v1/work-orders/{work_order_id}/scrape-dispensers/progress` endpoint
   - Added `singleDispenserProgress` state management in frontend
   - Implemented proper cleanup of polling intervals to prevent memory leaks
   - Separated batch vs single dispenser progress displays

4. **Visual Improvements**:
   - Modern gradient-based progress cards with glow effects
   - Circular progress indicator for batch operations
   - Sleek progress bars with animated transitions
   - Consistent orange/amber color scheme for dispenser operations

## Future Enhancements

1. **Selective Batch Processing**: Choose specific work orders for dispenser scraping
2. **Change Detection**: Compare with previous scrapes
3. **Field Mapping**: Standardize custom field names
4. **Image Capture**: Screenshot individual dispensers
5. **Validation**: Verify required fields are present
6. **Scheduling**: Automatic periodic dispenser data updates
7. **Parallel Processing**: Run multiple browser instances for faster batch operations
8. **Smart Retries**: Automatically retry failed scrapes with exponential backoff