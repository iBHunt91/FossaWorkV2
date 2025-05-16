/**
 * Logger utility for the Fossa Monitor application
 * Provides consistent logging across the application
 */

// Detect environment 
const isWindows = process.platform === 'win32';
let useColors = !isWindows; // Disable colors on Windows by default
let useSimpleFormat = isWindows; // Use simple format on Windows by default

// Get color code based on current settings
const getColor = (code) => useColors ? code : '';

// ANSI color codes - getter functions that respect current settings
const colors = {
  get reset() { return getColor('\x1b[0m'); },
  get bright() { return getColor('\x1b[1m'); },
  get dim() { return getColor('\x1b[2m'); },
  get underscore() { return getColor('\x1b[4m'); },
  get blink() { return getColor('\x1b[5m'); },
  get reverse() { return getColor('\x1b[7m'); },
  get hidden() { return getColor('\x1b[8m'); },
  
  fg: {
    get black() { return getColor('\x1b[30m'); },
    get red() { return getColor('\x1b[31m'); },
    get green() { return getColor('\x1b[32m'); },
    get yellow() { return getColor('\x1b[33m'); },
    get blue() { return getColor('\x1b[34m'); },
    get magenta() { return getColor('\x1b[35m'); },
    get cyan() { return getColor('\x1b[36m'); },
    get white() { return getColor('\x1b[37m'); },
    get crimson() { return getColor('\x1b[38m'); }
  },
  
  bg: {
    get black() { return getColor('\x1b[40m'); },
    get red() { return getColor('\x1b[41m'); },
    get green() { return getColor('\x1b[42m'); },
    get yellow() { return getColor('\x1b[43m'); },
    get blue() { return getColor('\x1b[44m'); },
    get magenta() { return getColor('\x1b[45m'); },
    get cyan() { return getColor('\x1b[46m'); },
    get white() { return getColor('\x1b[47m'); },
    get crimson() { return getColor('\x1b[48m'); }
  }
};

// Calculate terminal width
const getTerminalWidth = () => {
  try {
    return process.stdout.columns || 80;
  } catch (e) {
    return 80;
  }
};

// Get timestamp for logs
const getTimestamp = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Print a simple formatted message for compatibility mode
 */
function printSimple(title, content, type = 'info') {
  const timestamp = getTimestamp();
  let prefix = '';
  
  // Set prefix based on message type
  if (type === 'error') {
    prefix = '[ERROR] ';
  } else if (type === 'warning') {
    prefix = '[WARN] ';
  } else if (type === 'success') {
    prefix = '[OK] ';
  } else {
    prefix = '[INFO] ';
  }
  
  // Start with timestamp, prefix, and title on a single line
  console.log(`[${timestamp}] ${prefix}${title || ''}`);
  
  // Print content with consistent left indentation
  const indent = '  ';
  if (Array.isArray(content)) {
    content.forEach(line => {
      if (line !== undefined && line !== null) {
        // Ensure string conversion and strict left alignment
        console.log(`${indent}${String(line).trim()}`);
      }
    });
  } else if (content !== undefined && content !== null) {
    console.log(`${indent}${String(content).trim()}`);
  }
  
  // Add a separator line after each message
  console.log('-'.repeat(50));
}

/**
 * Print a formatted box with a title and content
 * @param {string} title - The title of the box
 * @param {string|string[]} content - The content to display in the box
 * @param {string} type - The type of message (info, success, warning, error)
 */
function printBox(title, content, type = 'info') {
  // Use simple format if configured for this environment
  if (useSimpleFormat) {
    printSimple(title, content, type);
    return;
  }
  
  const width = getTerminalWidth();
  const boxWidth = Math.min(width - 4, 76); // Keep box reasonable size
  
  // Set prefix and color based on message type
  let prefix = '';
  let color = colors.reset;
  
  if (type === 'error') {
    prefix = '[ERROR] ';
    color = colors.fg.red;
  } else if (type === 'warning') {
    prefix = '[WARN] ';
    color = colors.fg.yellow;
  } else if (type === 'success') {
    prefix = '[OK] ';
    color = colors.fg.green;
  } else {
    color = colors.fg.cyan;
  }
  
  // Create box elements using ASCII characters
  const horizontalLine = '-'.repeat(boxWidth - 2);
  
  // Print box - top line
  console.log(`${color}+${horizontalLine}+${colors.reset}`);
  
  // Print title if provided
  if (title) {
    const fullTitle = prefix + title;
    const leftPadding = Math.floor((boxWidth - 2 - fullTitle.length) / 2);
    const rightPadding = boxWidth - 2 - fullTitle.length - leftPadding;
    
    // Center the title in the box
    console.log(`${color}|${' '.repeat(leftPadding)}${fullTitle}${' '.repeat(rightPadding)}|${colors.reset}`);
    console.log(`${color}+${horizontalLine}+${colors.reset}`);
  }
  
  // Left-align content with proper padding
  const contentPadding = 2; // Standard padding between content and box borders
  const maxContentWidth = boxWidth - (contentPadding * 2); // Max width for content
  
  // Process and print content
  if (Array.isArray(content)) {
    content.forEach(line => {
      printContentLine(line, color, boxWidth, contentPadding);
    });
  } else if (content !== undefined && content !== null) {
    printContentLine(content, color, boxWidth, contentPadding);
  } else {
    // Print an empty line if no content
    console.log(`${color}|${' '.repeat(boxWidth - 2)}|${colors.reset}`);
  }
  
  // Print box - bottom line
  console.log(`${color}+${horizontalLine}+${colors.reset}`);
}

/**
 * Helper function to print a line of content with proper wrapping and alignment
 */
function printContentLine(line, color, boxWidth, padding) {
  if (line === undefined || line === null) {
    return; // Skip undefined/null lines
  }
  
  const lineStr = String(line);
  const maxContentWidth = boxWidth - (padding * 2);
  
  // If line fits within the box
  if (lineStr.length <= maxContentWidth) {
    // Simple case - print with left alignment and fixed width
    console.log(`${color}|${' '.repeat(padding)}${lineStr}${' '.repeat(maxContentWidth - lineStr.length)}${' '.repeat(padding)}|${colors.reset}`);
  } else {
    // Split long content into multiple lines
    let remaining = lineStr;
    let isFirstLine = true;
    
    while (remaining.length > 0) {
      // For the first line, take the maximum width minus 2 for continuation marker
      // For subsequent lines, use standard indentation but keep left alignment
      const chunkSize = isFirstLine ? maxContentWidth - 2 : maxContentWidth - 4;
      let chunk = remaining.substring(0, chunkSize);
      remaining = remaining.substring(chunkSize);
      
      let displayLine = chunk;
      
      // Add continuation marker if there's more content
      if (remaining.length > 0) {
        displayLine += '->';
      }
      
      // Add indentation for wrapped lines (except first)
      if (!isFirstLine) {
        // Use consistent indentation of 2 spaces for wrapped lines
        displayLine = '  ' + displayLine;
      }
      
      // Ensure the display line doesn't exceed maxContentWidth
      if (displayLine.length > maxContentWidth) {
        displayLine = displayLine.substring(0, maxContentWidth);
      }
      
      // Print line with left alignment
      console.log(`${color}|${' '.repeat(padding)}${displayLine}${' '.repeat(maxContentWidth - displayLine.length)}${' '.repeat(padding)}|${colors.reset}`);
      
      isFirstLine = false;
    }
  }
}

/**
 * Simple logger function for routine messages
 * @param {string} message - The message to log
 */
function log(message, ...args) {
  const timestamp = getTimestamp();
  
  // Simple one-line log for routine messages
  if (args.length === 0 && typeof message === 'string' && !message.includes('\n')) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }
  
  // For objects and arrays or multi-line content, use the box format
  let title = null;
  let content;
  
  if (typeof message === 'string' && message.includes(':')) {
    const parts = message.split(':', 2);
    title = parts[0].trim();
    content = parts[1].trim();
    
    // Add any additional args
    if (args.length > 0) {
      if (Array.isArray(content)) {
        content = [content, ...args.map(arg => String(arg))];
      } else {
        content = [content, ...args.map(arg => String(arg))];
      }
    }
  } else {
    content = [message, ...args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    })];
  }
  
  printBox(title, content);
}

/**
 * Log an info message
 * @param {string} title - The title of the message
 * @param {string|string[]} content - The content to log
 */
function info(title, content) {
  printBox(title, content, 'info');
}

/**
 * Log a success message
 * @param {string} title - The title of the message
 * @param {string|string[]} content - The content to log
 */
function success(title, content) {
  printBox(title, content, 'success');
}

/**
 * Log a warning message
 * @param {string} title - The title of the message
 * @param {string|string[]} content - The content to log
 */
function warn(title, content) {
  printBox(title, content, 'warning');
}

/**
 * Log an error message
 * @param {string} title - The title of the message
 * @param {*} error - The error to log
 */
function error(title, error) {
  let errorInfo = [];
  if (error) {
    errorInfo.push(String(error.message || error));
    
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      errorInfo = [...errorInfo, ...stackLines];
    }
  }
  
  printBox(title, errorInfo.length > 0 ? errorInfo : 'An error occurred', 'error');
}

/**
 * Print a section header
 * @param {string} title - The section title
 */
function section(title) {
  if (useSimpleFormat) {
    console.log('\n' + '='.repeat(50));
    console.log(`${title.toUpperCase()}`);
    console.log('='.repeat(50));
    return;
  }
  
  if (useColors) {
    console.log(`\n${colors.bright}${colors.fg.blue}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}${colors.fg.blue}${title.toUpperCase()}${colors.reset}`);
    console.log(`${colors.bright}${colors.fg.blue}${'='.repeat(50)}${colors.reset}`);
  } else {
    console.log('\n' + '='.repeat(50));
    console.log(`${title.toUpperCase()}`);
    console.log('='.repeat(50));
  }
}

/**
 * Print a simple divider line
 */
function divider() {
  console.log('-'.repeat(50));
}

/**
 * Configure logger options
 * @param {Object} options - Logger configuration options
 * @param {boolean} options.useColors - Whether to use ANSI colors
 * @param {boolean} options.useSimpleFormat - Whether to use simple formatting
 */
function configure(options = {}) {
  if (typeof options.useColors === 'boolean') {
    useColors = options.useColors;
  }
  
  if (typeof options.useSimpleFormat === 'boolean') {
    useSimpleFormat = options.useSimpleFormat;
  }
}

// Export all logging functions
export {
  log,
  info,
  success,
  warn,
  error,
  printBox,
  section,
  divider,
  getTimestamp,
  configure
};