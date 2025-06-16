# Visit URL Extraction Fix

## Problem
The WorkFossa scraper was storing incorrect visit URLs in the database. Instead of the proper format with `/visits/` pattern, it was storing work order URLs:

- **Incorrect:** `https://app.workfossa.com/app/work/129651/`
- **Correct:** `https://app.workfossa.com/app/work/129651/visits/131650/`

## Root Cause Analysis

### Issue 1: Premature Fallback Evaluation
In `workfossa_scraper.py` line 815:
```python
# BEFORE (incorrect):
visit_url = visit_info.get("url", await self._extract_visit_url(element, work_order_id))
```

The problem: Python evaluates the default value (second argument) even if the key exists in the dictionary. This means `_extract_visit_url()` was being called unnecessarily, wasting resources.

### Issue 2: Incorrect Fallback URL Generation
The `_extract_visit_url()` method was generating incorrect URLs when no visit URL was found:
```python
# BEFORE (incorrect):
return self.url_generator.generate_visit_url(mock_work_order)
```

This was generating URLs like `/app/work/{id}/` instead of returning `None` when no visit URL exists.

## Solution

### Fix 1: Conditional Fallback
Changed to only call the fallback when actually needed:
```python
# AFTER (correct):
visit_url = visit_info.get("url")
if not visit_url:
    logger.warning(f"No visit URL found for {work_order_id}, using fallback")
    visit_url = await self._extract_visit_url(element, work_order_id)
else:
    logger.info(f"✅ Using visit URL from _extract_visit_info: {visit_url}")
```

### Fix 2: Return None for Missing Visit URLs
Changed the fallback to return `None` instead of generating fake URLs:
```python
# AFTER (correct):
# If no visit URL found, return None
# We should NOT generate a fake URL that doesn't actually lead to a visit
logger.info(f"⚠️ [VISIT_URL] No visit URL found for work order {work_order_id}")
return None
```

## Impact
- Visit URLs will now be correctly extracted when present
- When no visit URL exists, the field will be `None` instead of an incorrect URL
- Visit numbers will be properly extracted from the visit URLs
- No unnecessary fallback calls, improving performance

## Verification
After the fix, newly scraped work orders should have:
- `visit_url` containing `/visits/` pattern when available
- `visit_number` populated with the visit ID
- `None` values when no visit exists (instead of fake URLs)

## Database Cleanup Required
Existing work orders in the database have incorrect visit URLs and need to be re-scraped:
- 58 work orders have `/work/` URLs without `/visits/`
- All have `visit_number = None`
- Re-scraping will populate correct visit URLs and numbers