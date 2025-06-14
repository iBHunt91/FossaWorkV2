# WorkFossa Scraping Test Scripts

This directory contains test scripts for the WorkFossa scraping functionality.

## Setup

1. **Install dependencies:**
   ```bash
   cd /path/to/FossaWorkV2/backend
   pip install -r requirements.txt
   playwright install chromium
   ```

2. **Create credentials file:**
   Create `/backend/data/credentials/test_credentials.json`:
   ```json
   {
     "username": "your_workfossa_email@example.com",
     "password": "your_workfossa_password"
   }
   ```

## Test Scripts

### test_scraping_final.py
Complete end-to-end test of the scraping workflow:
- Login to WorkFossa
- Navigate to work orders
- Scrape work orders
- Extract customer URLs
- Scrape dispensers (if customer URLs found)

**Usage:**
```bash
cd /path/to/FossaWorkV2/backend
python scripts/testing/test_scraping_final.py
```

### test_dispenser_scraping.py
Focused test for dispenser scraping functionality.

**Usage:**
```bash
cd /path/to/FossaWorkV2/backend
python scripts/testing/test_dispenser_scraping.py
```

### test_customer_url_extraction.py
Debug script for customer URL extraction issues.

**Usage:**
```bash
cd /path/to/FossaWorkV2/backend
python scripts/testing/test_customer_url_extraction.py
```

## Troubleshooting

### No customer URLs found
If the tests report no customer URLs found:
1. Check that work orders have linked customer locations in WorkFossa
2. The page structure may have changed - check debug screenshots
3. Update selectors in `workfossa_scraper.py` `_extract_customer_url` method

### Login failures
1. Verify credentials are correct
2. Check that WorkFossa hasn't changed their login flow
3. Try with `headless=False` to see what's happening

### AttributeError: 'BrowserAutomationService' object has no attribute 'pages'
This has been fixed in the latest version. The scraper now properly checks for the pages attribute.

## Debug Output

The scripts create debug screenshots when errors occur:
- `debug_work_orders_page.png` - Work orders page screenshot
- `debug_no_work_orders.png` - When no work orders found
- `debug_error_TIMESTAMP.png` - Error screenshots

## Notes

- The scraping is optimized for speed with reduced timeouts
- Customer URLs are extracted from links containing '/customers/locations/'
- Dispenser scraping requires valid customer URLs from work orders