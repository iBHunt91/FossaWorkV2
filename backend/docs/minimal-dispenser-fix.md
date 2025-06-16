# Minimal Dispenser Scraper Fix

## What's Actually Broken
The scraper tries to extract data before the page loads. That's it.

## Essential Fixes Only

### 1. Timing (✅ Already Done)
- Wait 3 seconds after navigation
- Wait 3 seconds after Equipment tab click
- Wait 2 seconds before checking for modals

### 2. Simplify Extraction
Replace the complex extraction methods with the simple one that works:

```python
async def _extract_dispensers_simple(self, page, work_order_id):
    """Just extract what we can see - don't overthink it"""
    
    # Give the page a moment to settle
    await page.wait_for_timeout(1000)
    
    # Use the selector that works in the interactive script
    dispensers = await page.query_selector_all('div.py-1\\.5')
    
    result = []
    for dispenser in dispensers:
        text = await dispenser.text_content()
        if text and 'Dispenser' in text:
            # Extract the basics
            info = {
                'dispenser_id': f"{work_order_id}_{len(result)+1}",
                'title': text.split('\n')[0].strip(),
                'raw_text': text,
                'serial_number': re.search(r'S/N[:\s]+([A-Z0-9-]+)', text).group(1) if re.search(r'S/N[:\s]+([A-Z0-9-]+)', text) else None,
            }
            result.append(info)
    
    return result
```

### 3. Remove Over-Engineering
Delete or disable:
- Complex wait_for_function calls
- Multiple extraction methods (keep one that works)
- Excessive error handling that hides real issues

## That's It

The interactive script works because it:
1. Waits properly
2. Uses simple selectors
3. Doesn't over-complicate things

The batch scraper fails because it:
1. Rushes through pages
2. Uses complex verification
3. Has too many fallback methods that all fail

## Testing
```bash
# Just run the batch scraper with the timing fixes
python3 scripts/test_dispenser_batch_quick.py
```

If it still fails after the timing fixes, the issue is likely:
- WorkFossa changed their HTML
- Authentication/session issues
- Network problems

But 90% of the time, it's just timing.