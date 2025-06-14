# Dispenser Information Scraping System

## Overview
The dispenser scraping system automatically extracts detailed equipment information from WorkFossa work orders, including dispenser specifications, fuel grades, and custom fields.

## Architecture

### Components
1. **DispenserScraper** (`dispenser_scraper.py`) - Enhanced scraping logic
2. **WorkFossaScraper Integration** - Automatic dispenser detection
3. **API Endpoints** - Manual and automatic triggering
4. **Data Models** - Dispenser storage and relationships

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

### 1. Navigation
- Navigate to work order visit URL
- Click Equipment tab
- Expand Dispenser section

### 2. Element Detection
The scraper uses multiple strategies to find dispenser information:

```javascript
// Primary V1 method
const dispenserSection = Array.from(document.querySelectorAll('.mt-4')).find(el => 
    el.querySelector('.bold')?.textContent.trim().startsWith('Dispenser')
);

// Fallback selectors
'.dispenser-item'
'.equipment-item:has-text("Dispenser")'
'.px-2:has(.custom-fields-view)'
'[data-equipment-type="dispenser"]'
```

### 3. Data Extraction
For each dispenser found:
- Extract title from `.flex.align-start > div`
- Parse serial number from `.muted.text-tiny`
- Get make/model from `.text-tiny div` elements
- Extract all custom fields from `.custom-fields-view .row > div`

### 4. Fuel Grade Parsing
The system intelligently parses fuel grade information from custom fields:
- Detects common patterns: regular, plus, premium, diesel
- Extracts octane ratings when available
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
- If Equipment tab not found → Returns empty list
- If Dispenser section not found → Captures page HTML for debugging
- If extraction fails → Logs error and continues

### Logging
Comprehensive logging with emojis for clarity:
- 🔧 Starting dispenser scrape
- ✅ Success messages
- ❌ Error indicators
- 📸 Screenshot captures

## Testing

### Test Script
`/backend/scripts/test_dispenser_scraping.py`

Features:
- Tests login and navigation
- Finds work orders with dispenser service codes
- Attempts dispenser scraping
- Displays detailed results
- Tests multiple work orders

### Manual Testing
1. Run test script: `python scripts/test_dispenser_scraping.py`
2. Browser opens (non-headless)
3. Watch automation progress
4. Review extracted data in console

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

## Future Enhancements

1. **Selective Batch Processing**: Choose specific work orders for dispenser scraping
2. **Change Detection**: Compare with previous scrapes
3. **Field Mapping**: Standardize custom field names
4. **Image Capture**: Screenshot individual dispensers
5. **Validation**: Verify required fields are present
6. **Scheduling**: Automatic periodic dispenser data updates