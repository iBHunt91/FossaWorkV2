#!/usr/bin/env node

const helpText = `
===============================================================
        FOSSA MONITOR - APPLICATION STARTUP GUIDE
===============================================================

STANDARD STARTUP COMMANDS:
--------------------------
npm run electron:dev:start     Standard startup that cleans cache first
npm run electron:dev:fast      Faster startup (skips cache cleaning)
npm run electron:dev:safe      Safe startup (force kills processes first)

TROUBLESHOOTING COMMANDS:
------------------------
npm run electron:shutdown      Force kill all app processes
npm run fix-vite-cache         Clean Vite cache only
npm run free-port              Free up ports used by app
npm run cleanup-ports          Alternative port cleanup

USAGE RECOMMENDATIONS:
--------------------
1. NORMAL USE:      npm run electron:dev:start
2. REPEATED USE:    npm run electron:dev:fast (if already started once)
3. IF APP HANGS:    npm run electron:shutdown, then try starting again
4. IF STILL FAILS:  npm run electron:dev:safe (most thorough cleanup)

PROBLEMS & SOLUTIONS:
-------------------
* "Port already in use" errors: Run npm run electron:shutdown first
* App won't start: Run npm run electron:dev:safe
* App crashes: Check logs and restart with npm run electron:dev:start
* App freezes: Use npm run electron:shutdown to force quit

For more information, see project documentation.
===============================================================
`;

// Print help text
console.log(helpText); 