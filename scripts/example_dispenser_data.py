#!/usr/bin/env python3
"""
Example of dispenser information gathered by the scraping system
"""

import json
from datetime import datetime
from dataclasses import asdict

# Add the backend directory to the Python path
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.dispenser_scraper import DispenserInfo

def create_example_dispenser_data():
    """Create realistic example data showing what gets scraped"""
    
    print("🔧 Example Dispenser Information Gathered from WorkFossa")
    print("=" * 80)
    
    # Example 1: Wayne Ovation Dispenser
    dispenser_1 = DispenserInfo(
        dispenser_id="D001",
        title="Dispenser 1 - Wayne Ovation",
        serial_number="WO2024123456",
        make="Wayne",
        model="Ovation",
        dispenser_number="1",
        location="Island A - Position 1",
        fuel_grades={
            "regular": {
                "name": "Regular 87",
                "octane": 87,
                "status": "Active",
                "price": 3.29,
                "capacity": "10000 gallons"
            },
            "plus": {
                "name": "Plus 89",
                "octane": 89,
                "status": "Active", 
                "price": 3.59,
                "capacity": "8000 gallons"
            },
            "premium": {
                "name": "Premium 91",
                "octane": 91,
                "status": "Active",
                "price": 3.89,
                "capacity": "6000 gallons"
            }
        },
        custom_fields={
            "Last Calibration": "2024-05-15",
            "Calibration Due": "2025-05-15",
            "Flow Rate": "10 GPM",
            "Meter Type": "AccuMeasure Pro",
            "Installation Date": "2022-08-15",
            "Maintenance Schedule": "Quarterly",
            "Accuracy Standard": "±0.3%",
            "Temperature Compensation": "Enabled",
            "Vapor Recovery": "Stage II",
            "Certification Number": "CA-2024-WO-001",
            "Inspector": "John Smith, Certified Tech",
            "Last Inspection": "2024-11-20",
            "Next Inspection": "2025-02-20",
            "Compliance Status": "Compliant",
            "Nozzle Count": "6",
            "Hose Length": "18 feet",
            "Breakaway Valve": "Installed",
            "Shear Valve": "Installed",
            "Emergency Shutoff": "Functional"
        },
        last_updated=datetime.now()
    )
    
    # Example 2: Gilbarco Encore Dispenser
    dispenser_2 = DispenserInfo(
        dispenser_id="D002", 
        title="Dispenser 2 - Gilbarco Encore 700S",
        serial_number="GE2024789012",
        make="Gilbarco",
        model="Encore 700S",
        dispenser_number="2",
        location="Island A - Position 2",
        fuel_grades={
            "regular": {
                "name": "Regular 87",
                "octane": 87,
                "status": "Active",
                "price": 3.29,
                "capacity": "10000 gallons"
            },
            "plus": {
                "name": "Plus 89", 
                "octane": 89,
                "status": "Active",
                "price": 3.59,
                "capacity": "8000 gallons"
            },
            "premium": {
                "name": "Premium 91",
                "octane": 91,
                "status": "Active",
                "price": 3.89,
                "capacity": "6000 gallons"
            },
            "diesel": {
                "name": "Ultra Low Sulfur Diesel",
                "octane": None,
                "status": "Active",
                "price": 3.49,
                "capacity": "5000 gallons"
            }
        },
        custom_fields={
            "Last Calibration": "2024-06-10",
            "Calibration Due": "2025-06-10", 
            "Flow Rate": "12 GPM",
            "Meter Type": "Gilbarco T-Series",
            "Installation Date": "2023-03-20",
            "Maintenance Schedule": "Bi-Annual",
            "Accuracy Standard": "±0.2%",
            "Temperature Compensation": "Enabled",
            "Vapor Recovery": "Stage II Enhanced",
            "Certification Number": "CA-2024-GE-002",
            "Inspector": "Sarah Johnson, Lead Inspector",
            "Last Inspection": "2024-12-01",
            "Next Inspection": "2025-03-01", 
            "Compliance Status": "Compliant",
            "Nozzle Count": "8",
            "Hose Length": "20 feet",
            "Card Reader": "EMV Chip + Contactless",
            "Display Type": "15.6\" Color LCD",
            "Software Version": "E700S-v2.1.4"
        },
        last_updated=datetime.now()
    )
    
    # Example 3: Dresser Dispenser with Issues
    dispenser_3 = DispenserInfo(
        dispenser_id="D003",
        title="Dispenser 3 - Dresser Wayne Nucleus",
        serial_number="DW2023456789", 
        make="Dresser Wayne",
        model="Nucleus",
        dispenser_number="3",
        location="Island B - Position 1",
        fuel_grades={
            "regular": {
                "name": "Regular 87",
                "octane": 87,
                "status": "Active",
                "price": 3.29,
                "capacity": "10000 gallons"
            },
            "plus": {
                "name": "Plus 89",
                "octane": 89,
                "status": "Maintenance Required",
                "price": 3.59,
                "capacity": "8000 gallons"
            },
            "premium": {
                "name": "Premium 91",
                "octane": 91,
                "status": "Active",
                "price": 3.89,
                "capacity": "6000 gallons"
            }
        },
        custom_fields={
            "Last Calibration": "2024-04-20",
            "Calibration Due": "2025-04-20",
            "Flow Rate": "8 GPM",
            "Meter Type": "Dresser TechniFlow",
            "Installation Date": "2021-11-10",
            "Maintenance Schedule": "Quarterly",
            "Accuracy Standard": "±0.5%",
            "Temperature Compensation": "Manual",
            "Vapor Recovery": "Stage I Only",
            "Certification Number": "CA-2024-DW-003",
            "Inspector": "Mike Rodriguez, Field Tech",
            "Last Inspection": "2024-10-15", 
            "Next Inspection": "2025-01-15",
            "Compliance Status": "Conditional - Plus Grade Issue",
            "Nozzle Count": "4",
            "Hose Length": "16 feet",
            "Known Issues": "Plus grade meter drift detected",
            "Repair Scheduled": "2024-12-20",
            "Technician Assigned": "Advanced Fuel Systems Inc."
        },
        last_updated=datetime.now()
    )
    
    dispensers = [dispenser_1, dispenser_2, dispenser_3]
    
    # Display formatted examples
    for i, dispenser in enumerate(dispensers, 1):
        print(f"\n🔧 DISPENSER {i} - {dispenser.make} {dispenser.model}")
        print("─" * 60)
        print(f"📋 Basic Information:")
        print(f"  • Title: {dispenser.title}")
        print(f"  • Serial Number: {dispenser.serial_number}")
        print(f"  • Location: {dispenser.location}")
        print(f"  • Dispenser Number: {dispenser.dispenser_number}")
        
        print(f"\n⛽ Fuel Grades ({len(dispenser.fuel_grades)} types):")
        for grade_key, grade_info in dispenser.fuel_grades.items():
            status_emoji = "✅" if grade_info.get("status") == "Active" else "⚠️"
            octane_text = f"Octane: {grade_info['octane']}" if grade_info.get("octane") else "Diesel"
            price_text = f"${grade_info.get('price', 'N/A')}" if grade_info.get('price') else ""
            print(f"  {status_emoji} {grade_info.get('name', grade_key.title())}")
            print(f"     └─ {octane_text} | {price_text} | Status: {grade_info.get('status', 'Unknown')}")
        
        print(f"\n🔧 Technical Details ({len(dispenser.custom_fields)} fields):")
        
        # Group custom fields by category
        calibration_fields = {}
        technical_fields = {}
        compliance_fields = {}
        maintenance_fields = {}
        other_fields = {}
        
        for field, value in dispenser.custom_fields.items():
            field_lower = field.lower()
            if any(keyword in field_lower for keyword in ['calibration', 'accuracy', 'meter']):
                calibration_fields[field] = value
            elif any(keyword in field_lower for keyword in ['flow', 'temperature', 'vapor', 'nozzle', 'hose']):
                technical_fields[field] = value
            elif any(keyword in field_lower for keyword in ['compliance', 'certification', 'inspector']):
                compliance_fields[field] = value
            elif any(keyword in field_lower for keyword in ['maintenance', 'inspection', 'repair', 'due']):
                maintenance_fields[field] = value
            else:
                other_fields[field] = value
        
        if calibration_fields:
            print("  📊 Calibration & Accuracy:")
            for field, value in calibration_fields.items():
                print(f"     • {field}: {value}")
        
        if technical_fields:
            print("  ⚙️  Technical Specifications:")
            for field, value in technical_fields.items():
                print(f"     • {field}: {value}")
                
        if maintenance_fields:
            print("  🛠️  Maintenance & Inspections:")
            for field, value in maintenance_fields.items():
                print(f"     • {field}: {value}")
                
        if compliance_fields:
            print("  📋 Compliance & Certification:")
            for field, value in compliance_fields.items():
                print(f"     • {field}: {value}")
                
        if other_fields:
            print("  📦 Additional Information:")
            for field, value in other_fields.items():
                print(f"     • {field}: {value}")
        
        print(f"\n🕒 Last Updated: {dispenser.last_updated.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Show example JSON output
    print(f"\n" + "=" * 80)
    print("📄 EXAMPLE JSON OUTPUT (for API responses):")
    print("=" * 80)
    
    example_dispenser = asdict(dispensers[0])
    example_dispenser['last_updated'] = dispensers[0].last_updated.isoformat()
    
    print(json.dumps(example_dispenser, indent=2))
    
    # Show work order integration example
    print(f"\n" + "=" * 80)
    print("🔗 WORK ORDER INTEGRATION EXAMPLE:")
    print("=" * 80)
    
    work_order_example = {
        "id": "wo_12345",
        "external_id": "W-789123",
        "site_name": "7-Eleven #1234",
        "service_code": "2861",
        "service_description": "All Dispensers AccuMeasure Test",
        "scraped_data": {
            "dispensers": [asdict(d) for d in dispensers],
            "dispenser_count": len(dispensers),
            "dispenser_scrape_date": datetime.now().isoformat(),
            "scraping_summary": {
                "total_dispensers": len(dispensers),
                "active_dispensers": sum(1 for d in dispensers if all(g.get("status") == "Active" for g in d.fuel_grades.values())),
                "dispensers_with_issues": sum(1 for d in dispensers if any(g.get("status") != "Active" for g in d.fuel_grades.values())),
                "fuel_grade_types": list(set().union(*(d.fuel_grades.keys() for d in dispensers))),
                "manufacturer_breakdown": {d.make: dispensers.count(d) for d in dispensers}
            }
        }
    }
    
    print(json.dumps(work_order_example, indent=2, default=str))
    
    print(f"\n✅ Example complete! This shows the comprehensive dispenser data")
    print(f"   that gets extracted from WorkFossa during batch scraping.")

if __name__ == "__main__":
    create_example_dispenser_data()