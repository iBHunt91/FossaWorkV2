#!/usr/bin/env python3
"""
Show the HTML patterns and extraction logic used for real dispenser scraping
"""

def show_html_patterns():
    print("🔍 REAL WORKFOSSA HTML PATTERNS THAT GET SCRAPED")
    print("=" * 80)
    print()
    
    print("📋 V1 DISPENSER SECTION STRUCTURE:")
    print("-" * 50)
    print()
    
    # This is based on the actual V1 patterns found in the scraper
    sample_html = '''
    <div class="mt-4">
        <div class="bold">Dispenser Section</div>
        
        <!-- Dispenser 1 -->
        <div class="px-2 flex align-start">
            <div>Dispenser 1 - Wayne Ovation iX</div>
        </div>
        <div class="muted text-tiny">Serial: WO2024ABC123</div>
        <div class="text-tiny">
            <div>Wayne</div>
            <div>Ovation iX</div>
        </div>
        
        <!-- Custom Fields Section -->
        <div class="custom-fields-view">
            <div class="row">
                <div>Last Calibration</div>
                <div>2024-05-15</div>
            </div>
            <div class="row">
                <div>Calibration Due</div>
                <div>2025-05-15</div>
            </div>
            <div class="row">
                <div>Flow Rate</div>
                <div>10 GPM</div>
            </div>
            <div class="row">
                <div>Meter Type</div>
                <div>AccuMeasure Pro</div>
            </div>
            <div class="row">
                <div>Accuracy Standard</div>
                <div>±0.3%</div>
            </div>
            <div class="row">
                <div>Temperature Compensation</div>
                <div>Enabled</div>
            </div>
            <div class="row">
                <div>Vapor Recovery</div>
                <div>Stage II</div>
            </div>
            <div class="row">
                <div>Regular 87</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Plus 89</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Premium 91</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Nozzle Count</div>
                <div>6</div>
            </div>
            <div class="row">
                <div>Hose Length</div>
                <div>18 feet</div>
            </div>
        </div>
        
        <!-- Dispenser 2 -->
        <div class="px-2 flex align-start">
            <div>Dispenser 2 - Gilbarco Encore 700S</div>
        </div>
        <div class="muted text-tiny">Serial: GE2024XYZ789</div>
        <div class="text-tiny">
            <div>Gilbarco</div>
            <div>Encore 700S</div>
        </div>
        
        <div class="custom-fields-view">
            <div class="row">
                <div>Last Calibration</div>
                <div>2024-06-10</div>
            </div>
            <div class="row">
                <div>Flow Rate</div>
                <div>12 GPM</div>
            </div>
            <div class="row">
                <div>Meter Type</div>
                <div>Gilbarco T-Series</div>
            </div>
            <div class="row">
                <div>Regular 87</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Plus 89</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Premium 91</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Diesel</div>
                <div>Active</div>
            </div>
            <div class="row">
                <div>Card Reader</div>
                <div>EMV Chip + Contactless</div>
            </div>
        </div>
    </div>
    '''
    
    print("💻 SAMPLE HTML STRUCTURE:")
    print(sample_html)
    print()
    
    print("🔧 EXTRACTION PATTERNS USED:")
    print("-" * 50)
    print()
    
    extraction_patterns = {
        "Dispenser Section Detection": [
            "Array.from(document.querySelectorAll('.mt-4')).find(el => el.querySelector('.bold')?.textContent.trim().startsWith('Dispenser'))",
            "Looks for div with class 'mt-4' containing 'Dispenser Section' header"
        ],
        
        "Individual Dispensers": [
            ".px-2.flex.align-start > div",
            "Extracts dispenser titles like 'Dispenser 1 - Wayne Ovation iX'"
        ],
        
        "Serial Numbers": [
            ".muted.text-tiny",
            "Finds text like 'Serial: WO2024ABC123' and extracts the serial number"
        ],
        
        "Make/Model": [
            ".text-tiny div",
            "Extracts manufacturer and model from consecutive div elements"
        ],
        
        "Custom Fields": [
            ".custom-fields-view .row > div",
            "Pairs field names with values from the custom fields section"
        ],
        
        "Fuel Grades": [
            "Fields containing octane numbers (87, 89, 91) or 'Diesel'",
            "Automatically detects and categorizes fuel types with their status"
        ]
    }
    
    for pattern_name, (selector, description) in extraction_patterns.items():
        print(f"📍 {pattern_name}:")
        print(f"   Selector: {selector}")
        print(f"   Purpose: {description}")
        print()
    
    print("⚙️ INTELLIGENT PROCESSING:")
    print("-" * 50)
    print()
    
    processing_features = [
        "🔍 Flexible Selectors: Multiple fallback strategies for different page structures",
        "🏗️ Structured Parsing: Converts flat custom fields into categorized data",
        "⛽ Fuel Grade Detection: Automatically identifies regular, plus, premium, diesel",
        "🔢 Data Type Conversion: Converts text to appropriate data types (numbers, dates)",
        "📊 Status Tracking: Monitors active vs. maintenance required states",
        "🛡️ Error Handling: Graceful degradation when fields are missing",
        "📝 Field Mapping: Standardizes field names across different dispenser types",
        "🔗 Relationship Building: Links dispensers to their parent work orders"
    ]
    
    for feature in processing_features:
        print(f"   {feature}")
    print()
    
    print("🚀 REAL-TIME SCRAPING PROCESS:")
    print("-" * 50)
    print()
    
    process_steps = [
        "1. 🌐 Navigate to WorkFossa work order page",
        "2. 🔍 Click 'Equipment' tab to reveal dispenser information", 
        "3. 📂 Expand 'Dispenser Section' if collapsed",
        "4. 🔧 Detect all dispenser entries using V1 patterns",
        "5. 📊 Extract basic info: title, serial, make, model",
        "6. ⛽ Parse fuel grade configurations and status",
        "7. 🔧 Extract all custom fields (calibration, flow rate, etc.)",
        "8. 💾 Structure data into DispenserInfo objects",
        "9. 🗄️ Store in database with work order relationships",
        "10. ✅ Update progress and continue to next work order"
    ]
    
    for step in process_steps:
        print(f"   {step}")
    print()
    
    print("📈 PERFORMANCE OPTIMIZATIONS:")
    print("-" * 50)
    print()
    
    optimizations = [
        "🔄 Single Browser Session: Reuses login across all work orders",
        "⚡ Batch Processing: Processes multiple work orders efficiently",
        "🎯 Selective Scraping: Only targets work orders with dispenser service codes",
        "🛡️ Error Recovery: Continues processing even if individual items fail",
        "📊 Progress Tracking: Real-time updates with detailed statistics",
        "💾 Smart Caching: Avoids re-scraping recently updated dispensers",
        "🔀 Async Processing: Non-blocking background task execution"
    ]
    
    for optimization in optimizations:
        print(f"   {optimization}")
    print()
    
    print("✅ TO SEE REAL DATA:")
    print("-" * 50)
    print()
    print("1. Follow the manual test guide above")
    print("2. Run the application with both backend and frontend")
    print("3. Use the 'Scrape Dispensers' button in the Work Orders page")
    print("4. Monitor the orange progress tracker for real-time updates")
    print("5. Check work order details for the extracted dispenser information")
    print()
    print("🎯 The system will extract real data matching the patterns shown above!")

if __name__ == "__main__":
    show_html_patterns()