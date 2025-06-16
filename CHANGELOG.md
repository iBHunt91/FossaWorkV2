# Changelog

All notable changes to FossaWork V2 will be documented in this file.

## [2025-06-16] - Dispenser Scraping Fixes

### Fixed
- **Single Job Dispenser Scraping**: Fixed fuel grades displaying non-fuel items like "Stand Alone Code", "Number of Nozzles", etc.
  - Updated regex pattern in `dispenser_scraper.py` to only extract fuel codes
  - Added automatic decoding of fuel codes (0126 → Regular, 0135 → Plus, etc.)
  - Added validation to filter out any non-fuel items

- **Dispenser Number Display**: Already working correctly, showing proper format (1/2, 3/4)

- **Fuel Grade Alignment**: Implemented consistent vertical alignment across all dispensers
  - All "Regular" grades now line up vertically
  - All "Plus" grades line up vertically, etc.
  - Added fixed-width columns with placeholders for missing grades
  - Center-aligned badges within columns (not right-aligned)

### Changed
- Backend: Modified `_extract_dispensers_simple` method to use targeted regex patterns
- Frontend: Updated `DispenserInfoModal` to collect all grade types and display in fixed positions

### Technical Details
- Files modified:
  - `/backend/app/services/dispenser_scraper.py` (lines 1218-1280)
  - `/frontend/src/components/DispenserInfoModal.tsx` (lines 164-387)
- Single job and batch dispenser scraping now use identical code paths and produce identical results

## [Previous Changes]
- V1 to V2 migration completed
- Implemented Python/FastAPI backend
- Added SQLite database support
- Enhanced security with JWT authentication
- Improved dispenser scraping with better data extraction