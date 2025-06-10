#!/usr/bin/env python3
"""
Comprehensive, well-formatted viewer for all work order data
"""

import sqlite3
import json
from datetime import datetime
from textwrap import fill
import re

class WorkOrderViewer:
    def __init__(self, db_path="fossawork_v2.db"):
        self.db_path = db_path
        self.conn = None
        
    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        
    def disconnect(self):
        """Disconnect from database"""
        if self.conn:
            self.conn.close()
    
    def clean_address(self, address):
        """Clean and format address for better readability"""
        if not address:
            return "No address available"
        
        # Remove excessive whitespace and normalize
        cleaned = re.sub(r'\s+', ' ', address.strip())
        
        # Try to extract key components
        lines = []
        
        # Look for store number pattern
        store_match = re.search(r'#(\d+)', cleaned)
        store_num = f"Store #{store_match.group(1)}" if store_match else ""
        
        # Look for street address
        street_match = re.search(r'(\d+[^,\n]*(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Highway|Hwy|Drive|Dr)[^,\n]*)', cleaned)
        street = street_match.group(1).strip() if street_match else ""
        
        # Look for city, state, zip
        city_state_match = re.search(r'([A-Za-z\s]+)\s+(FL|Florida)\s+(\d{5})', cleaned)
        city_state = f"{city_state_match.group(1).strip()}, {city_state_match.group(2)} {city_state_match.group(3)}" if city_state_match else ""
        
        # Look for county
        county_match = re.search(r'([A-Za-z\s]+)\s+County', cleaned)
        county = f"{county_match.group(1).strip()} County" if county_match else ""
        
        # Format the cleaned address
        if street and city_state:
            result = f"{street}\n    {city_state}"
            if county:
                result += f"\n    {county}"
            if store_num:
                result = f"{store_num}\n    {result}"
        else:
            # Fallback: just clean up the original
            result = cleaned
        
        return result
    
    def extract_brand_info(self, site_name, address):
        """Extract brand and store information"""
        brand = "Unknown"
        store_info = ""
        
        # Brand detection
        if "Wawa" in site_name or "Wawa" in address:
            brand = "Wawa"
            # Extract Wawa store number
            wawa_match = re.search(r'#(\d+)', address)
            if wawa_match:
                store_info = f"Store #{wawa_match.group(1)}"
        elif "7-Eleven" in site_name or "Eleven Store" in site_name:
            brand = "7-Eleven"
            # Extract 7-Eleven store number
            seven_match = re.search(r'#(\d+)', address)
            if seven_match:
                store_info = f"Store #{seven_match.group(1)}"
        elif "Circle K" in site_name or "Circle K" in address:
            brand = "Circle K"
            # Extract Circle K store number
            ck_match = re.search(r'#(\d+)', address)
            if ck_match:
                store_info = f"Store #{ck_match.group(1)}"
        elif "Shell" in site_name or "Shell" in address:
            brand = "Shell"
        elif "Speedway" in address:
            brand = "Speedway"
        
        return brand, store_info
    
    def format_datetime(self, dt_string):
        """Format datetime string for display"""
        if not dt_string:
            return "Not set"
        try:
            dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            return dt_string
    
    def print_header(self, title, char="=", width=80):
        """Print a formatted header"""
        print(f"\n{char * width}")
        print(f"{title:^{width}}")
        print(f"{char * width}")
    
    def print_section(self, title, char="-", width=60):
        """Print a section header"""
        print(f"\n{char * width}")
        print(f" {title}")
        print(f"{char * width}")
    
    def view_summary(self):
        """Display comprehensive summary"""
        cursor = self.conn.cursor()
        
        self.print_header("🎯 FOSSAWORK V2 COMPREHENSIVE DATA SUMMARY")
        
        # Basic counts
        cursor.execute("SELECT COUNT(*) FROM work_orders")
        wo_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM dispensers")
        disp_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM user_credentials WHERE is_active = 1")
        cred_count = cursor.fetchone()[0]
        
        print(f"""
[DATA] SYSTEM OVERVIEW
{'-' * 40}
📋 Work Orders:      {wo_count:>6}
🔧 Dispensers:       {disp_count:>6}
👥 Users:            {user_count:>6}
🔐 Credentials:      {cred_count:>6}
        """)
        
        # Brand analysis
        cursor.execute("SELECT site_name, address FROM work_orders")
        locations = cursor.fetchall()
        
        brand_data = {}
        for loc in locations:
            brand, store_info = self.extract_brand_info(loc[0], loc[1])
            if brand not in brand_data:
                brand_data[brand] = []
            brand_data[brand].append(store_info)
        
        self.print_section("🏪 BRAND BREAKDOWN")
        for brand, stores in sorted(brand_data.items(), key=lambda x: len(x[1]), reverse=True):
            unique_stores = len(set(stores))
            total_locations = len(stores)
            print(f"{brand:15} {total_locations:>3} locations ({unique_stores:>3} unique stores)")
        
        # Geographic analysis
        cursor.execute("SELECT address FROM work_orders WHERE address IS NOT NULL")
        addresses = [row[0] for row in cursor.fetchall()]
        
        counties = {}
        cities = {}
        
        for addr in addresses:
            # County extraction
            county_match = re.search(r'([A-Za-z\s]+)\s+County', addr)
            if county_match:
                county = county_match.group(1).strip()
                counties[county] = counties.get(county, 0) + 1
            
            # City extraction
            city_match = re.search(r'([A-Za-z\s]+)\s+FL\s+\d{5}', addr)
            if city_match:
                city = city_match.group(1).strip()
                cities[city] = cities.get(city, 0) + 1
        
        self.print_section("📍 GEOGRAPHIC DISTRIBUTION")
        print("Counties:")
        for county, count in sorted(counties.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {county:20} {count:>3} locations")
        
        print("\nTop Cities:")
        for city, count in sorted(cities.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {city:20} {count:>3} locations")
        
        # Status breakdown
        cursor.execute("SELECT status, COUNT(*) FROM work_orders GROUP BY status ORDER BY COUNT(*) DESC")
        statuses = cursor.fetchall()
        
        self.print_section("⚡ STATUS BREAKDOWN")
        for status, count in statuses:
            print(f"{status:15} {count:>3} orders")
        
        # Recent activity
        cursor.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM work_orders 
            GROUP BY DATE(created_at) 
            ORDER BY date DESC 
            LIMIT 7
        """)
        activity = cursor.fetchall()
        
        self.print_section("📅 RECENT ACTIVITY")
        for row in activity:
            print(f"{row[0]:12} {row[1]:>3} work orders")
    
    def view_detailed_list(self, limit=None, brand_filter=None, county_filter=None):
        """Display detailed work order list"""
        cursor = self.conn.cursor()
        
        # Build query with filters
        query = """
            SELECT wo.*, u.username 
            FROM work_orders wo
            LEFT JOIN users u ON wo.user_id = u.id
        """
        
        conditions = []
        params = []
        
        if brand_filter:
            conditions.append("(wo.site_name LIKE ? OR wo.address LIKE ?)")
            params.extend([f"%{brand_filter}%", f"%{brand_filter}%"])
        
        if county_filter:
            conditions.append("wo.address LIKE ?")
            params.append(f"%{county_filter} County%")
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY wo.created_at DESC"
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query, params)
        work_orders = cursor.fetchall()
        
        title = "🗂️ DETAILED WORK ORDER LIST"
        if brand_filter:
            title += f" - {brand_filter.upper()}"
        if county_filter:
            title += f" - {county_filter} County"
        if limit:
            title += f" (First {limit})"
        
        self.print_header(title)
        
        for i, wo in enumerate(work_orders, 1):
            # Get dispensers for this work order
            cursor.execute("SELECT * FROM dispensers WHERE work_order_id = ?", (wo['id'],))
            dispensers = cursor.fetchall()
            
            brand, store_info = self.extract_brand_info(wo['site_name'], wo['address'])
            cleaned_address = self.clean_address(wo['address'])
            
            print(f"\n{'=' * 80}")
            print(f"#{i:>3} | {wo['external_id']} | {brand}")
            print(f"{'=' * 80}")
            
            print(f"""
🏪 LOCATION DETAILS
    Site Name:    {wo['site_name'][:60]}
    Brand:        {brand}
    Store Info:   {store_info or 'Not specified'}
    
📍 ADDRESS
    {cleaned_address}

📋 WORK ORDER INFO
    External ID:  {wo['external_id']}
    Internal ID:  {wo['id'][:8]}...
    Status:       {wo['status'].upper()}
    User:         {wo['username'] or 'Unknown'}
    
📅 TIMESTAMPS
    Created:      {self.format_datetime(wo['created_at'])}
    Updated:      {self.format_datetime(wo['updated_at'])}
    Scheduled:    {self.format_datetime(wo['scheduled_date']) if wo['scheduled_date'] else 'Not scheduled'}
            """)
            
            if wo['notes']:
                print(f"[LOG] NOTES\n    {fill(wo['notes'], width=76, initial_indent='    ', subsequent_indent='    ')}")
            
            # Dispenser information
            if dispensers:
                print(f"\n🔧 DISPENSERS ({len(dispensers)})")
                for j, disp in enumerate(dispensers, 1):
                    fuel_grades = json.loads(disp['fuel_grades']) if disp['fuel_grades'] else {}
                    fuel_info = ", ".join([f"{grade}({info.get('octane', 'N/A')})" for grade, info in fuel_grades.items()])
                    
                    print(f"""    Dispenser #{disp['dispenser_number']}:
        Type:         {disp['dispenser_type']}
        Fuel Grades:  {fuel_info or 'Not specified'}
        Status:       {disp['status']}
        Progress:     {disp['progress_percentage']:.1f}%
        Completed:    {'Yes' if disp['automation_completed'] else 'No'}""")
            
            # Add separator for readability
            if i < len(work_orders):
                print("\n" + "─" * 80)
    
    def view_by_brand(self, brand):
        """View work orders filtered by brand"""
        self.view_detailed_list(brand_filter=brand)
    
    def view_by_county(self, county):
        """View work orders filtered by county"""
        self.view_detailed_list(county_filter=county)
    
    def interactive_menu(self):
        """Interactive menu for viewing data"""
        while True:
            self.print_header("🎯 FOSSAWORK V2 DATA VIEWER")
            print("""
Choose viewing option:

1. [DATA] Summary Overview
2. 🗂️ All Work Orders (Detailed)
3. 🗂️ Recent Work Orders (Last 10)
4. 🏪 Filter by Brand
5. 📍 Filter by County
6. 📤 Export to JSON
7. 🚪 Exit

            """)
            
            choice = input("Enter your choice (1-7): ").strip()
            
            if choice == '1':
                self.view_summary()
            elif choice == '2':
                self.view_detailed_list()
            elif choice == '3':
                self.view_detailed_list(limit=10)
            elif choice == '4':
                print("\nAvailable brands: Wawa, 7-Eleven, Circle K, Shell, Speedway")
                brand = input("Enter brand name: ").strip()
                if brand:
                    self.view_by_brand(brand)
            elif choice == '5':
                print("\nExample counties: Hillsborough, Pinellas, Polk, Pasco")
                county = input("Enter county name: ").strip()
                if county:
                    self.view_by_county(county)
            elif choice == '6':
                self.export_to_json()
            elif choice == '7':
                print("\n👋 Goodbye!")
                break
            else:
                print("\n[ERROR] Invalid choice. Please try again.")
            
            if choice in ['1', '2', '3', '4', '5']:
                input("\nPress Enter to continue...")
    
    def export_to_json(self, filename=None):
        """Export data to JSON with timestamp"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"work_orders_export_{timestamp}.json"
        
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT wo.*, u.username 
            FROM work_orders wo
            LEFT JOIN users u ON wo.user_id = u.id
            ORDER BY wo.created_at DESC
        """)
        work_orders = cursor.fetchall()
        
        export_data = {
            "export_info": {
                "timestamp": datetime.now().isoformat(),
                "total_work_orders": len(work_orders),
                "exported_by": "FossaWork V2 Data Viewer"
            },
            "work_orders": []
        }
        
        for wo in work_orders:
            cursor.execute("SELECT * FROM dispensers WHERE work_order_id = ?", (wo['id'],))
            dispensers = cursor.fetchall()
            
            brand, store_info = self.extract_brand_info(wo['site_name'], wo['address'])
            
            work_order_data = {
                "basic_info": {
                    "id": wo['id'],
                    "external_id": wo['external_id'],
                    "brand": brand,
                    "store_info": store_info
                },
                "location": {
                    "site_name": wo['site_name'],
                    "address": self.clean_address(wo['address'])
                },
                "scheduling": {
                    "scheduled_date": wo['scheduled_date'],
                    "status": wo['status']
                },
                "metadata": {
                    "user_id": wo['user_id'],
                    "username": wo['username'],
                    "notes": wo['notes'],
                    "created_at": wo['created_at'],
                    "updated_at": wo['updated_at']
                },
                "dispensers": [
                    {
                        "id": d['id'],
                        "number": d['dispenser_number'],
                        "type": d['dispenser_type'],
                        "fuel_grades": json.loads(d['fuel_grades']) if d['fuel_grades'] else {},
                        "status": d['status'],
                        "progress_percentage": d['progress_percentage'],
                        "automation_completed": bool(d['automation_completed']),
                        "timestamps": {
                            "created_at": d['created_at'],
                            "updated_at": d['updated_at']
                        }
                    }
                    for d in dispensers
                ]
            }
            export_data["work_orders"].append(work_order_data)
        
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        print(f"\n[OK] Successfully exported {len(work_orders)} work orders to '{filename}'")
        print(f"[FILE] File size: {len(json.dumps(export_data))} bytes")

def main():
    """Main function"""
    viewer = WorkOrderViewer()
    
    try:
        viewer.connect()
        viewer.interactive_menu()
    except FileNotFoundError:
        print("[ERROR] Database file not found. Make sure 'fossawork_v2.db' exists in the current directory.")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()