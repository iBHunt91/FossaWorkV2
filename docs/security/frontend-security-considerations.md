# Frontend Security Considerations for FossaWork V2

## Overview

This guide helps frontend developers work effectively with the security headers implementation, particularly Content Security Policy (CSP).

## Working with CSP

### React and CSP Compatibility

The current CSP configuration allows:
- ✅ `'unsafe-inline'` for styles (required by React)
- ✅ `data:` URLs for images (screenshots)
- ✅ `blob:` URLs for dynamic content
- ❌ Inline scripts (blocked in production)
- ❌ External scripts from unauthorized domains

### Best Practices

#### 1. Avoid Inline Event Handlers
❌ **Don't do this:**
```jsx
<button onClick="alert('clicked')">Click me</button>
<div onMouseOver="this.style.color='red'">Hover me</div>
```

✅ **Do this instead:**
```jsx
<button onClick={() => alert('clicked')}>Click me</button>
<div onMouseOver={(e) => e.target.style.color = 'red'}>Hover me</div>
```

#### 2. Avoid `eval()` and Similar Functions
❌ **Don't do this:**
```javascript
eval('console.log("hello")');
new Function('return true')();
setTimeout('alert("hello")', 1000);
```

✅ **Do this instead:**
```javascript
console.log("hello");
const myFunc = () => true;
setTimeout(() => alert("hello"), 1000);
```

#### 3. Use Proper Image Sources
✅ **Allowed image sources:**
```jsx
// Local images
<img src="/images/logo.png" />

// Data URLs (for small images/icons)
<img src="data:image/svg+xml;base64,..." />

// Blob URLs (for dynamic content)
<img src={URL.createObjectURL(blob)} />
```

❌ **Blocked sources (in production):**
```jsx
// External images
<img src="https://external-site.com/image.jpg" />
```

#### 4. API Calls and WebSocket Connections
The CSP allows connections to:
- Same origin (`'self'`)
- Backend API (localhost:8000 in dev)
- WorkFossa API (https://app.workfossa.com)
- WebSocket connections (for real-time features)

```javascript
// ✅ Allowed
await fetch('http://localhost:8000/api/users');
await fetch('https://app.workfossa.com/api/data');
const ws = new WebSocket('ws://localhost:8000/ws');

// ❌ Blocked (unless whitelisted)
await fetch('https://random-api.com/data');
```

## Security Headers and React Components

### Custom Dialogs Instead of Browser Dialogs

❌ **Never use browser native dialogs:**
```javascript
// These show "localhost says" or domain in title
confirm('Are you sure?');
alert('Success!');
prompt('Enter value:');
```

✅ **Use React components:**
```jsx
import { Modal, notification, message } from 'antd';
// or your UI library of choice

// Confirmation dialog
Modal.confirm({
  title: 'Are you sure?',
  onOk() { /* handle confirm */ }
});

// Success message
message.success('Operation completed!');

// Input dialog
<InputModal 
  visible={showInput}
  onSubmit={(value) => handleValue(value)}
/>
```

### Handling External Resources

If you need to load external resources (CDNs, fonts, etc.), they must be whitelisted in the CSP configuration:

1. Add the domain to the appropriate CSP directive in `security_config.py`
2. For production, minimize external dependencies
3. Consider self-hosting critical resources

## Development vs Production

### Development Environment
- `unsafe-eval` allowed (for HMR and dev tools)
- Relaxed CSP for faster development
- HTTP connections allowed

### Production Environment
- Strict CSP enforcement
- HTTPS required (HSTS enabled)
- External resources minimized
- Consider implementing CSP nonces for any required inline scripts

## Testing Security Headers

### Browser Developer Tools
1. Open DevTools (F12)
2. Network tab → Select request → Headers tab
3. Look for security headers in Response Headers
4. Console tab shows CSP violations

### Test Page
Access `/security-test.html` to test CSP behavior:
```bash
http://localhost:5173/security-test.html
```

### Common CSP Violations and Solutions

| Violation | Cause | Solution |
|-----------|-------|----------|
| `script-src` | Inline script or unauthorized external script | Move to external file or use event listeners |
| `style-src` | Inline styles (if not using unsafe-inline) | Use CSS classes or styled-components |
| `img-src` | External image | Proxy through backend or whitelist domain |
| `connect-src` | Unauthorized API call | Add domain to CSP config |
| `frame-ancestors` | Page being iframed | This is intentional - prevents clickjacking |

## Security Checklist for Frontend Development

- [ ] No inline event handlers in HTML
- [ ] No use of `eval()` or `Function()` constructor
- [ ] No browser native dialogs (`alert`, `confirm`, `prompt`)
- [ ] External resources minimized and whitelisted
- [ ] Sensitive data not stored in localStorage
- [ ] API calls use proper authentication headers
- [ ] User input properly sanitized before display
- [ ] File uploads validated on both client and server
- [ ] No hardcoded secrets or API keys in frontend code
- [ ] HTTPS used in production

## Reporting Security Issues

If you encounter security-related issues:
1. Check browser console for CSP violations
2. Verify the environment (`ENVIRONMENT` variable)
3. Check if the resource needs to be whitelisted
4. Consult with the security team before modifying CSP

## Future Enhancements

### CSP Nonces (Planned)
Future implementation will support nonces for inline scripts:
```jsx
<script nonce={cspNonce}>
  // Inline script with proper nonce
</script>
```

### Subresource Integrity (SRI)
For any CDN resources:
```html
<script 
  src="https://cdn.example.com/lib.js" 
  integrity="sha384-..." 
  crossorigin="anonymous">
</script>
```

### Trusted Types (Future)
Prevention of DOM XSS vulnerabilities through type enforcement.