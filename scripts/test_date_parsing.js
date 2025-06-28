#!/usr/bin/env node
/**
 * Test JavaScript date parsing with the formats returned by the API
 */

console.log("Testing JavaScript Date Parsing");
console.log("=" + "=".repeat(59));

// Test dates from the API
const testDates = [
  "2025-06-19T14:30:00Z",
  "2025-06-19T14:30:00+00:00",
  "2025-06-19T14:30:00",
  null,
  undefined,
  "",
  "invalid date"
];

testDates.forEach(dateStr => {
  console.log(`\nTesting: ${JSON.stringify(dateStr)}`);
  
  try {
    if (!dateStr) {
      console.log("  ❌ Empty/null value");
      return;
    }
    
    const date = new Date(dateStr);
    console.log(`  Parsed: ${date}`);
    console.log(`  Valid: ${!isNaN(date.getTime())}`);
    console.log(`  ISO String: ${date.toISOString()}`);
    console.log(`  Local String: ${date.toLocaleString()}`);
    
    if (isNaN(date.getTime())) {
      console.log("  ❌ Invalid date");
    } else {
      console.log("  ✅ Valid date");
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
});

// Test the date-fns library functions that the component uses
console.log("\n\nTesting with date-fns (if available):");
try {
  const { formatDistanceToNow, format } = require('date-fns');
  
  const validDate = "2025-06-19T14:30:00Z";
  const date = new Date(validDate);
  
  console.log(`\nDate: ${validDate}`);
  console.log(`formatDistanceToNow: ${formatDistanceToNow(date, { addSuffix: true })}`);
  console.log(`format (h:mm a): ${format(date, 'h:mm a')}`);
} catch (error) {
  console.log("date-fns not available in this context");
}