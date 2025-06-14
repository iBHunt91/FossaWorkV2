#!/usr/bin/env python3
from pathlib import Path
"""
Check and display formatted dispenser scraping results
"""
import sys
from datetime import datetime
from sqlalchemy import desc

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder, Dispenser

def format_dispenser_results():
    """Display formatted dispenser scraping results"""
    
    print("\n📊 DISPENSER SCRAPING RESULTS")
    print("="*80)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    db = SessionLocal()
    
    try:
        # Get work orders with dispenser service codes, ordered by most recent
        dispenser_codes = ["2861", "2862", "3146", "3002"]
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(dispenser_codes)
        ).order_by(desc(WorkOrder.updated_at)).limit(10).all()
        
        if not work_orders:
            print("\n❌ No work orders found with dispenser service codes")
            return
        
        print(f"\n📋 Showing {len(work_orders)} most recent work orders with dispenser services:\n")
        
        total_dispensers = 0
        successful_scrapes = 0
        
        for i, wo in enumerate(work_orders, 1):
            print(f"\n{i}. WORK ORDER: {wo.external_id}")
            print("-" * 60)
            print(f"   📍 Site: {wo.site_name}")
            print(f"   🏪 Store #: {wo.store_number or 'N/A'}")
            print(f"   🛠️  Service: {wo.service_code} - {wo.service_description}")
            print(f"   📅 Scheduled: {wo.scheduled_date.strftime('%Y-%m-%d') if wo.scheduled_date else 'Not scheduled'}")
            print(f"   🔄 Status: {wo.status}")
            
            # Check for customer URL
            customer_url = None
            if wo.scraped_data:
                customer_url = wo.scraped_data.get('customer_url')
                print(f"   🔗 Customer URL: {'✅ Yes' if customer_url else '❌ No'}")
                if customer_url:
                    print(f"      {customer_url}")
                
                # Check address
                if wo.scraped_data.get('address_components'):
                    addr = wo.scraped_data['address_components']
                    street = addr.get('street', '')
                    if street and 'Meter' not in street:
                        print(f"   📍 Address: {street}")
                    elif street and 'Meter' in street:
                        print(f"   📍 Address: ⚠️  {street} (incorrect extraction)")
            
            # Get dispensers
            dispensers = db.query(Dispenser).filter(
                Dispenser.work_order_id == wo.id
            ).order_by(Dispenser.dispenser_number).all()
            
            print(f"\n   ⛽ DISPENSERS: {len(dispensers)}")
            
            if dispensers:
                total_dispensers += len(dispensers)
                
                # Check if these are real dispensers or defaults
                is_default = all(d.dispenser_type == 'Wayne 300' for d in dispensers)
                if not is_default and customer_url:
                    successful_scrapes += 1
                
                for d in dispensers:
                    status_icon = "✅" if d.automation_completed else "⏳"
                    print(f"      {status_icon} Dispenser #{d.dispenser_number}")
                    print(f"         Type: {d.dispenser_type}")
                    
                    if d.fuel_grades:
                        grades = []
                        for grade, info in d.fuel_grades.items():
                            octane = info.get('octane', 'N/A') if isinstance(info, dict) else 'N/A'
                            grades.append(f"{grade.title()} ({octane})")
                        print(f"         Fuels: {', '.join(grades)}")
                    
                    print(f"         Status: {d.status}")
                    if d.progress_percentage > 0:
                        print(f"         Progress: {d.progress_percentage}%")
                
                if is_default:
                    print("\n      ⚠️  These appear to be default placeholder dispensers")
                    if not customer_url:
                        print("      💡 No customer URL found - dispenser details couldn't be scraped")
            else:
                print("      ❌ No dispensers found")
            
            # Check if dispenser scraping was attempted
            if wo.scraped_data and wo.scraped_data.get('dispenser_scrape_date'):
                scrape_date = wo.scraped_data['dispenser_scrape_date']
                print(f"\n   🕒 Last dispenser scrape: {scrape_date}")
        
        # Summary statistics
        print("\n\n" + "="*80)
        print("📈 SUMMARY STATISTICS")
        print("="*80)
        
        # Get total counts
        total_wo_count = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(dispenser_codes)
        ).count()
        
        wo_with_customer_url = 0
        wo_with_real_dispensers = 0
        
        all_work_orders = db.query(WorkOrder).filter(
            WorkOrder.service_code.in_(dispenser_codes)
        ).all()
        
        for wo in all_work_orders:
            if wo.scraped_data and wo.scraped_data.get('customer_url'):
                wo_with_customer_url += 1
            
            dispensers = db.query(Dispenser).filter(
                Dispenser.work_order_id == wo.id
            ).all()
            
            if dispensers and not all(d.dispenser_type == 'Wayne 300' for d in dispensers):
                wo_with_real_dispensers += 1
        
        print(f"   Total work orders with dispenser services: {total_wo_count}")
        print(f"   Work orders with customer URLs: {wo_with_customer_url} ({wo_with_customer_url/total_wo_count*100:.1f}%)")
        print(f"   Work orders with real dispenser data: {wo_with_real_dispensers} ({wo_with_real_dispensers/total_wo_count*100:.1f}%)")
        print(f"   Total dispensers in sample: {total_dispensers}")
        
        # Recommendations
        print("\n\n💡 RECOMMENDATIONS")
        print("="*80)
        
        if wo_with_customer_url == 0:
            print("❌ No customer URLs found in any work orders")
            print("   → Run a fresh work order scrape with the updated code")
            print("   → Command: curl -X POST 'http://localhost:8000/api/v1/work-orders/scrape?user_id=YOUR_USER_ID'")
        elif wo_with_customer_url < total_wo_count:
            print(f"⚠️  Only {wo_with_customer_url}/{total_wo_count} work orders have customer URLs")
            print("   → Some work orders were scraped before the fix")
            print("   → Clear and re-scrape all work orders for best results")
        
        if wo_with_real_dispensers == 0:
            print("\n❌ No real dispenser data found")
            print("   → After getting customer URLs, run batch dispenser scraping")
            print("   → Command: curl -X POST 'http://localhost:8000/api/v1/work-orders/scrape-dispensers-batch?user_id=YOUR_USER_ID'")
        elif wo_with_real_dispensers < wo_with_customer_url:
            print(f"\n⚠️  Dispenser scraping incomplete ({wo_with_real_dispensers}/{wo_with_customer_url} with URLs)")
            print("   → Re-run batch dispenser scraping to complete")
        
        if wo_with_real_dispensers > 0:
            print("\n✅ Some dispensers successfully scraped!")
            print("   → Continue monitoring and running batch scraping as needed")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    format_dispenser_results()