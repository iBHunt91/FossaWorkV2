#!/usr/bin/env python3
"""
Monitor database changes in real-time
"""

import sys
import time
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.scraping_models import ScrapingSchedule

def monitor_schedule():
    print("🔍 Monitoring Schedule Database Changes")
    print("=" * 50)
    print("Press Ctrl+C to stop monitoring\n")
    
    last_state = None
    
    while True:
        try:
            db = SessionLocal()
            try:
                schedule = db.query(ScrapingSchedule).filter(
                    ScrapingSchedule.user_id == "7bea3bdb7e8e303eacaba442bd824004",
                    ScrapingSchedule.schedule_type == "work_orders"
                ).first()
                
                if schedule:
                    current_state = {
                        'interval_hours': schedule.interval_hours,
                        'active_hours': schedule.active_hours,
                        'enabled': schedule.enabled,
                        'updated_at': schedule.updated_at
                    }
                    
                    if last_state is None:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Initial state:")
                        print(f"  Interval: {current_state['interval_hours']}")
                        print(f"  Active Hours: {current_state['active_hours']}")
                        print(f"  Enabled: {current_state['enabled']}")
                        print()
                    elif current_state != last_state:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  CHANGE DETECTED!")
                        if last_state['interval_hours'] != current_state['interval_hours']:
                            print(f"  Interval: {last_state['interval_hours']} → {current_state['interval_hours']}")
                        if last_state['active_hours'] != current_state['active_hours']:
                            print(f"  Active Hours: {last_state['active_hours']} → {current_state['active_hours']}")
                        if last_state['enabled'] != current_state['enabled']:
                            print(f"  Enabled: {last_state['enabled']} → {current_state['enabled']}")
                        print(f"  Updated at: {current_state['updated_at']}")
                        print()
                    
                    last_state = current_state.copy()
                    
            finally:
                db.close()
                
            time.sleep(1)  # Check every second
            
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped.")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    monitor_schedule()