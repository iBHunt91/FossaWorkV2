# Browser Visibility Toggle Guide

## Overview

The Browser Visibility Toggle feature allows you to control whether the browser window is visible during web scraping and automation tasks. This is particularly useful for debugging and troubleshooting.

## How to Access

1. Navigate to **Settings** in the application
2. Click on the **Advanced** tab
3. Find the **Browser Settings** section
4. Toggle **Browser Visibility** on/off

## Features

### Browser Visibility Toggle
- **OFF (Default)**: Browser runs in headless mode (invisible)
  - Faster performance
  - Less resource intensive
  - Normal production operation
  
- **ON**: Browser window is visible
  - See exactly what the automation is doing
  - Debug scraping issues
  - Watch form filling in real-time
  - Troubleshoot login problems

### Additional Browser Settings

1. **Browser Type**
   - Chromium (Recommended)
   - Firefox
   - WebKit (Safari)

2. **Viewport Size**
   - Width: 800-3840 pixels
   - Height: 600-2160 pixels

3. **Performance Options**
   - Capture screenshots on errors
   - Disable image loading (faster scraping)
   - Clear browser cache on startup
   - Enable debug logging

## When to Use Browser Visibility

### Enable Browser Visibility When:
- Debugging scraping failures
- Troubleshooting login issues
- Verifying form automation steps
- Training new users
- Recording demonstration videos

### Keep Browser Hidden When:
- Running production automation
- Processing large batches
- Running on servers/headless systems
- Maximizing performance

## Technical Implementation

### Backend Changes
1. **WorkFossaAutomationService** now accepts user browser settings
2. Settings are loaded from `data/users/{userId}/settings/browser_settings.json`
3. Browser visibility preference is respected during:
   - Work order scraping
   - Dispenser scraping
   - Form automation
   - Credential verification

### Frontend Changes
1. Added **Browser Settings** section to Advanced settings tab
2. Settings are persisted per user
3. Changes take effect on next scraping operation

### Settings Storage Format
```json
{
  "headless": false,
  "browser_type": "chromium",
  "viewport_width": 1280,
  "viewport_height": 720,
  "enable_screenshots": true,
  "disable_images": false,
  "clear_cache_on_start": true,
  "enable_debug_mode": false
}
```

## Troubleshooting

### Browser Window Not Showing
1. Ensure "Browser Visibility" is toggled ON
2. Save settings after making changes
3. Start a new scraping operation
4. Check if your system allows popup windows

### Performance Issues with Visible Browser
- Visible browser uses more resources
- Consider disabling image loading
- Reduce viewport size if needed
- Use headless mode for batch operations

### Environment Variable Override
For developers/testing, you can override browser visibility:
```bash
export BROWSER_VISIBLE=true
```

## Best Practices

1. **Development**: Keep browser visible for easier debugging
2. **Production**: Use headless mode for better performance
3. **Troubleshooting**: Temporarily enable visibility to diagnose issues
4. **Batch Operations**: Always use headless mode
5. **Screenshots**: Enable screenshot capture for error debugging even in headless mode

## Security Considerations

- Browser visibility does not affect security
- Credentials are never displayed in the browser
- Screenshots are stored locally only
- Debug logs may contain sensitive URLs (handle with care)

## FAQ

**Q: Does browser visibility affect scraping success rate?**
A: No, the scraping logic is identical. Visibility only affects whether you can see the process.

**Q: Can I change browser visibility during an active scraping session?**
A: No, settings take effect on the next scraping operation.

**Q: Will visible browser work on a server without display?**
A: No, visible browser requires a display. Use headless mode on servers.

**Q: Does browser visibility affect automation speed?**
A: Yes, visible browser is slightly slower due to rendering overhead.

## Related Documentation

- [Work Order Scraping Guide](./work-order-scraping.md)
- [Settings Configuration](./settings-configuration.md)
- [Troubleshooting Guide](./troubleshooting.md)