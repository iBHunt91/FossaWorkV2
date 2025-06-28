# Testing Scripts

This directory contains testing scripts and utilities for the FossaWork V2 application.

## Test Categories

### Backend Tests
- Database connection and operations
- API endpoint functionality
- Authentication and authorization
- Data processing and validation

### Frontend Tests
- Component rendering and functionality
- User interface interactions
- Form validation and submission
- State management

### Integration Tests
- End-to-end workflows
- Cross-component interactions
- API integration testing
- User journey validation

### Performance Tests
- Load testing and benchmarks
- Memory usage analysis
- Response time measurements
- Scalability assessments

### UI/UX Tests
- Settings page comprehensive testing
- Responsive design validation
- Console error detection
- Form functionality verification

## New Test Scripts

### Settings Page Tests

#### Comprehensive Automated Test
**File:** `test_settings_page_comprehensive.py`
**Purpose:** Complete automated testing of the Settings page UI functionality

**Features:**
- Tests all 5 settings tabs (Appearance, Notifications, Automation, Filters & Data, Technical)
- Verifies tab accessibility and content loading
- Tests form elements and interactions
- Responsive design testing at multiple viewport sizes
- Console error capture (excluding expected CORS/auth errors)
- Performance metrics collection
- Search functionality testing
- Collapsible section testing
- Detailed JSON report generation

**Usage:**
```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/test_settings_page_comprehensive.py
```

**Output:**
- Detailed console report with color-coded results
- JSON file: `settings_page_test_results.json`
- Performance metrics and error analysis

#### Interactive Manual Test
**File:** `interactive_settings_page_test.py`
**Purpose:** Step-by-step manual testing with user control

**Features:**
- Visible browser window for real-time observation
- Step-by-step progression with user prompts
- Manual inspection opportunities between test steps
- Detailed error capture and immediate reporting
- Responsive design testing with user observation
- Form element testing with detailed feedback

**Usage:**
```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/interactive_settings_page_test.py
```

**Best For:**
- Debugging UI issues
- Visual verification of functionality
- Training and demonstration
- Detailed problem analysis

### When to Use Each Test

**Use Comprehensive Test When:**
- Validating after code changes
- Running CI/CD pipeline checks
- Getting overall health assessment
- Generating detailed reports

**Use Interactive Test When:**
- Debugging specific issues
- Need visual confirmation
- Training new developers
- Investigating UI behavior

## Existing Scripts

- `check_*.py` - Scripts that check various aspects of the system
- `test_*.py` - Standalone test scripts not part of the test suite
- `clear_users.py` - Utility to clear test user data

## Running Tests

### Prerequisites
```bash
# Backend dependencies
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend dependencies
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2/frontend
npm install

# Install Playwright browsers (if not already installed)
playwright install
```

### Frontend Server Requirements
Both Settings page tests require the frontend development server to be running:

```bash
# Terminal 1: Start frontend server
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2
npm run dev  # Runs on http://localhost:5173

# Terminal 2: Run tests
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/test_settings_page_comprehensive.py
```

### Individual Test Scripts
```bash
# Run specific test (example)
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/test_dispenser_extraction.py
```

### Interactive Tests
Interactive tests are available in the `interactive/` subdirectory. These tests allow step-by-step execution with user control and are perfect for debugging and manual verification.

## Test Results

### Settings Page Test Results
The comprehensive test generates detailed results including:

- **Tab Functionality:** Accessibility, content loading, form interactions
- **Responsive Design:** Layout integrity across viewport sizes
- **Console Errors:** JavaScript errors (filtered to exclude auth/CORS)
- **Performance Metrics:** Load times, paint metrics
- **Search Functionality:** Input testing and responsiveness
- **Overall Assessment:** Pass/fail with specific recommendations

### Error Classification
Tests automatically filter and categorize errors:
- **Excluded:** Expected CORS, authentication, network errors
- **Included:** React/JSX errors, UI functionality issues, JavaScript runtime errors
- **Severity Levels:** Critical (blocking), Warning (needs attention), Info (minor)

## Test Organization

- **Never place test files in root directories**
- Use descriptive names following the pattern: `test_[component]_[functionality].py`
- Include error handling and clear output messages
- Document test purpose and expected outcomes
- Create both automated and interactive versions for UI tests

## Usage

Run from the backend directory (for backend tests):

```bash
cd backend
python ../scripts/testing/check_dispenser_results.py
```

Run from project root (for frontend tests):

```bash
python3 /Users/ibhunt/Documents/GitHub/FossaWorkV2/scripts/testing/test_settings_page_comprehensive.py
```

## Purpose

These scripts are for:
- Validating data integrity
- Checking system state
- Quick testing of specific features
- Data inspection and reporting
- UI functionality validation
- Responsive design testing
- Performance monitoring

## Contributing

When adding new tests:
1. Place in appropriate subdirectory
2. Follow naming conventions
3. Include clear documentation
4. Add error handling
5. Update this README with new test information
6. For UI tests, create both automated and interactive versions
7. Use color-coded output for better readability