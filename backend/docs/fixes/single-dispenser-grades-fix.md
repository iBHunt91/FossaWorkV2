# Single Dispenser Grades List Fix

## Issue
Single job dispenser scraping was showing non-fuel items in the grades_list display, such as:
- "Stand Alone Code"
- "Number of Nozzles (per side)"
- "HD Meter"

These field labels and values were being mixed with actual fuel grade codes (0126, 0135, 0136).

## Root Cause
The regex pattern in `_extract_dispensers_simple` method (line 1220) was too broad:
```regex
Grade\s*\n((?:[^\n]+\n?)+?)(?=(?:STAND|METER|Electronic|NUMBER|$))
```

This pattern captured ALL text between "Grade" and the next field keyword, including field labels.

## Fix Applied
Updated the grade extraction logic in `dispenser_scraper.py` to:

1. **Primary Pattern**: Look for GRADE field in custom field format:
   ```regex
   GRADE\s*\n\s*([^\n]+?)(?:\n|$)
   ```

2. **Fallback Pattern**: Extract only 4-digit fuel codes from Grade section:
   - Search Grade section for any text
   - Extract only 4-digit codes using `\b\d{4}\b`
   - Ignore field labels and other text

3. **Code Decoding**: Automatically decode fuel codes (0126 → Regular, etc.)

4. **Validation**: Filter out any non-fuel items that might slip through

## Code Changes
File: `/backend/app/services/dispenser_scraper.py`

Lines changed: 1218-1280
- Replaced broad regex with targeted extraction
- Added fuel code detection and decoding
- Added validation to filter non-fuel items

## Result
- ✅ Dispenser numbers display correctly (1/2, 3/4)
- ✅ Only actual fuel grades shown (Regular, Plus, Premium, Diesel)
- ✅ No field labels or values in grades_list
- ✅ Single job scraping now identical to batch scraping

## Testing
Created test scripts to verify:
- `/backend/scripts/testing/test_grade_extraction_fix.py`
- `/backend/scripts/testing/verify_final_fix.py`

The fix handles both clean and messy HTML structures from WorkFossa.