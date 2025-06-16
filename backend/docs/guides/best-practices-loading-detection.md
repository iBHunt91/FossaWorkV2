# Best Practices for Page Loading Detection

## Overview

When automating web scraping, especially for dynamic content like the WorkFossa dispenser information, proper loading detection is critical. This guide outlines the best approaches based on our testing and implementation.

## The Problem

Traditional approaches like `wait_for_load_state('networkidle')` or arbitrary timeouts (`wait_for_timeout(2000)`) are either:
- **Too slow**: Network idle can wait unnecessarily long
- **Too unreliable**: Fixed timeouts may be too short or too long
- **Too simple**: They don't account for JavaScript rendering, animations, or dynamic content

## Best Practices by Scenario

### 1. Initial Page Load

```python
# Good: Combine network idle with specific element
await page.goto(url, wait_until="domcontentloaded")
await page.wait_for_load_state('networkidle')
await page.wait_for_selector('text="Equipment"', state='visible')
```

### 2. Tab/Section Clicks (e.g., Equipment Tab)

```python
# Good: Wait for DOM stability after click
await page.click('text="Equipment"')
await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=500)

# Also check for the expected content
toggle_ready = await EnhancedSmartWait.wait_for_element_ready(
    page,
    'a:has-text("Dispenser")',
    checks={'visible': True, 'stable': True}
)
```

### 3. Expandable Content (e.g., Dispenser Toggle)

```python
# Best: Monitor container count changes
initial_count = await page.locator('div.py-1\\.5').count()
await page.click('a:has-text("Dispenser")')

new_count = await EnhancedSmartWait.wait_for_container_expansion(
    page,
    'div.py-1\\.5',
    timeout=5000
)

if new_count > initial_count:
    # Content expanded successfully
    await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=300)
```

### 4. Preventing Page Reloads

```python
# Inject handler before clicking problematic links
await page.evaluate("""
    () => {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.href.includes('#')) {
                e.preventDefault();
                // Handle the toggle manually
                const targetId = link.href.split('#')[1];
                const target = document.getElementById(targetId);
                if (target) {
                    target.style.display = 'block';
                    target.classList.remove('collapse');
                    target.classList.add('show');
                }
            }
        }, true);
    }
""")
```

## The Enhanced Smart Wait Approach

The `EnhancedSmartWait` class provides several methods:

### 1. `wait_for_page_stable()`
- Monitors DOM mutations
- Considers page stable when no changes for specified time (default 300ms)
- Has max timeout to prevent infinite waits

### 2. `wait_for_container_expansion()`
- Counts elements before and after an action
- Perfect for expandable sections
- Returns new count or -1 on timeout

### 3. `wait_for_element_ready()`
- Comprehensive element checks:
  - Visible
  - Stable position
  - Clickable
  - Contains expected text
- More reliable than simple `wait_for_selector()`

### 4. `wait_for_content_contains()`
- Waits for specific text to appear
- Useful for confirming content loaded
- Can search within specific elements

## Recommended Workflow for Dispenser Scraping

```python
# 1. Navigate and wait for initial load
await page.goto(customer_url, wait_until="domcontentloaded")
await page.wait_for_load_state('networkidle')

# 2. Click Equipment tab with stability check
await page.click('text="Equipment"')
await EnhancedSmartWait.wait_for_page_stable(page)

# 3. Handle modals if present
try:
    cancel = await page.query_selector('button:has-text("Cancel")')
    if cancel:
        await cancel.click()
        await page.wait_for_timeout(300)  # Brief wait for modal animation
except:
    pass

# 4. Expand dispenser section with container monitoring
initial_count = await page.locator('div.py-1\\.5').count()

# Inject reload prevention
await page.evaluate("""...""")  # See code above

await page.click('a:has-text("Dispenser")')

new_count = await EnhancedSmartWait.wait_for_container_expansion(
    page, 'div.py-1\\.5', timeout=5000
)

# 5. Final stability check before extraction
if new_count > initial_count:
    await EnhancedSmartWait.wait_for_page_stable(page, stability_timeout=300)
    # Now safe to extract dispenser data
```

## Key Principles

1. **Never rely on single signals** - Combine multiple indicators
2. **Monitor what actually changes** - Container counts, DOM mutations, specific content
3. **Set reasonable timeouts** - Not too short (misses content) or too long (wastes time)
4. **Handle edge cases** - Content might already be visible, or might never appear
5. **Prevent unwanted behaviors** - Like page reloads from hash links

## Performance Considerations

- **DOM Stability**: 300-500ms without changes is usually sufficient
- **Container Expansion**: Should happen within 1-2 seconds
- **Network Idle**: Use sparingly, can add 2-3 seconds unnecessarily
- **Combined Approach**: Usually completes in 1-3 seconds total

## Debugging Tips

1. **Log container counts** before and after actions
2. **Monitor DOM mutations** to understand page behavior
3. **Check for specific content** rather than generic elements
4. **Use visible browser** (`headless=False`) during development
5. **Add intermediate logging** to identify where delays occur

## Common Pitfalls to Avoid

1. **Using only `wait_for_timeout()`** - Unreliable and slow
2. **Waiting for network idle everywhere** - Often unnecessary
3. **Not handling already-expanded content** - Check before clicking
4. **Ignoring page reloads** - Can reset your progress
5. **Too aggressive timeouts** - Balance speed vs reliability