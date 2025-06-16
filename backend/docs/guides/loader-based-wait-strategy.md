# Loader-Based Wait Strategy

## The Problem

When automating WorkFossa, we discovered that clicking the Equipment tab triggers a loading process. If we try to interact with elements (like the Dispenser toggle) before the loader disappears, our clicks either:
1. Don't register at all
2. Register but don't have the expected effect
3. Get intercepted by the loading overlay

## The Solution: Monitor the Loader Line

WorkFossa uses a loader line element that indicates when content is loading:

```html
<!-- Active loader (content is loading) -->
<div style="height: 5px;">
    <div class="loader-line" style="height: 5px; z-index: 1;"></div>
</div>

<!-- Inactive loader (content has loaded) -->
<div style="height: 5px;">
    <div class="loader-line" style="height: 5px; z-index: 1; display: none;"></div>
</div>
```

The key indicator is the `display: none` style on the `.loader-line` element.

## Implementation

### 1. Wait for Loader to Disappear

```python
async def wait_for_loader_to_disappear(page: Page, timeout: int = 10000) -> bool:
    """
    Wait for the loader line to disappear (display: none)
    """
    try:
        # Wait for loader to have display: none
        await page.wait_for_function(
            """
            () => {
                const loader = document.querySelector('.loader-line');
                if (!loader) return true; // If loader doesn't exist, we're good
                
                // Check both inline style and computed style
                const inlineDisplay = loader.style.display;
                const computedDisplay = window.getComputedStyle(loader).display;
                
                return inlineDisplay === 'none' || computedDisplay === 'none';
            }
            """,
            timeout=timeout
        )
        return True
    except:
        return False
```

### 2. Correct Workflow

The proper sequence when interacting with the Equipment tab:

```python
# 1. Navigate to customer page
await page.goto(customer_url, wait_until="domcontentloaded")

# 2. Wait for Equipment tab to be clickable
await ContentBasedWait.wait_for_equipment_tab(page)

# 3. Click Equipment tab
await page.click('text="Equipment"')

# 4. CRITICAL: Wait for loader to disappear
await ContentBasedWait.wait_for_loader_to_disappear(page)

# 5. Now safe to interact with content
toggle_text = await ContentBasedWait.wait_for_dispenser_toggle(page)

# 6. Close modal if present
await ContentBasedWait.wait_for_modal_and_close(page)

# 7. Click Dispenser toggle
await ContentBasedWait.click_dispenser_toggle_safely(page)

# 8. Wait for dispenser content
success, count = await ContentBasedWait.wait_for_dispenser_content(page)
```

## Why This Works

1. **Prevents Premature Clicks**: By waiting for the loader to disappear, we ensure the page is ready for interaction
2. **Reliable Indicator**: The loader line is a consistent indicator across all WorkFossa pages
3. **No Arbitrary Waits**: Instead of `wait_for_timeout(2000)`, we wait for an actual condition
4. **Handles Variable Load Times**: Works whether the page loads in 500ms or 5000ms

## Common Pitfalls

### ❌ Wrong: Click Without Waiting for Loader
```python
await page.click('text="Equipment"')
await page.click('text="Dispenser"')  # May fail or not register
```

### ❌ Wrong: Use Arbitrary Timeout
```python
await page.click('text="Equipment"')
await page.wait_for_timeout(2000)  # May be too short or unnecessarily long
```

### ✅ Correct: Wait for Loader to Disappear
```python
await page.click('text="Equipment"')
await ContentBasedWait.wait_for_loader_to_disappear(page)
await page.click('text="Dispenser"')  # Safe to click now
```

## Monitoring Loader States

For debugging, you can monitor loader state changes:

```javascript
// Inject monitoring code
await page.evaluate("""
    () => {
        window.__loaderStates = [];
        
        const checkLoader = () => {
            const loader = document.querySelector('.loader-line');
            if (loader) {
                const display = window.getComputedStyle(loader).display;
                window.__loaderStates.push({
                    time: new Date().toISOString(),
                    display: display,
                    visible: display !== 'none'
                });
            }
        };
        
        // Check every 100ms
        setInterval(checkLoader, 100);
    }
""")
```

## Performance Considerations

- **Typical Wait Time**: 0.5-2 seconds after clicking Equipment tab
- **Timeout**: Set to 10 seconds to handle slow connections
- **Polling Interval**: The browser checks the loader state continuously
- **CPU Impact**: Minimal, as it's just checking a CSS property

## Integration with Content-Based Waiting

The loader check complements our content-based approach:

1. **Loader Check**: Ensures the page has finished loading
2. **Content Check**: Ensures the specific elements we need are present
3. **Combined**: Most reliable approach for dynamic pages

```python
# Complete content-based wait with loader check
async def wait_for_equipment_content_ready(page):
    # 1. Click Equipment tab
    await page.click('text="Equipment"')
    
    # 2. Wait for loader to disappear
    if not await wait_for_loader_to_disappear(page):
        return False
    
    # 3. Wait for specific content
    if not await wait_for_dispenser_toggle(page):
        return False
    
    # 4. Close any modals
    await wait_for_modal_and_close(page)
    
    return True
```

## Summary

By monitoring the `.loader-line` element's display property, we can reliably determine when WorkFossa has finished loading content after tab switches or other navigation actions. This approach is:

- **More reliable** than arbitrary timeouts
- **Faster** than network idle waits
- **Specific** to the actual loading state
- **Consistent** across all WorkFossa pages

Always wait for the loader to disappear before attempting to interact with dynamically loaded content.