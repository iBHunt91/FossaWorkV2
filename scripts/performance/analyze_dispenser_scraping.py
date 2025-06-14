#!/usr/bin/env python3
"""
Analyze Dispenser Scraping Performance
=====================================

This script analyzes the performance bottlenecks in the dispenser scraping process
and provides recommendations for optimization.

Current Performance Analysis:
- Average time per work order: ~9 seconds
- Total time for 40 work orders: ~6 minutes

Identified Wait Times in Dispenser Scraping:
1. Navigation to customer page: wait_until="networkidle", timeout=30s
2. Page stabilization wait: 3000ms (3s)
3. Equipment tab click wait: 3000ms (3s)
4. Dispenser section expand wait: 3000ms (3s)
5. Between work orders delay: 500ms (0.5s)

Total fixed wait time per dispenser scrape: ~9.5s + navigation time
"""

import json
from datetime import datetime

class DispenserScrapingAnalyzer:
    def __init__(self):
        self.wait_times = {
            "navigation_to_customer_page": {
                "current_ms": 30000,  # networkidle can take up to timeout
                "optimized_ms": 5000,  # domcontentloaded instead
                "description": "Navigation to customer page",
                "optimization": "Change wait_until from 'networkidle' to 'domcontentloaded'"
            },
            "page_stabilization": {
                "current_ms": 3000,
                "optimized_ms": 500,
                "description": "Wait for page to stabilize after navigation",
                "optimization": "Reduce to 500ms with smart selector waiting"
            },
            "equipment_tab_wait": {
                "current_ms": 3000,
                "optimized_ms": 1000,
                "description": "Wait after clicking Equipment tab",
                "optimization": "Use wait_for_selector for tab content instead of fixed wait"
            },
            "dispenser_section_wait": {
                "current_ms": 3000,
                "optimized_ms": 1000,
                "description": "Wait for Dispenser section to expand",
                "optimization": "Use wait_for_selector for dispenser elements"
            },
            "between_work_orders": {
                "current_ms": 500,
                "optimized_ms": 0,
                "description": "Delay between processing work orders",
                "optimization": "Remove delay - not needed for customer page navigation"
            }
        }
        
        self.parallel_opportunities = [
            {
                "task": "Screenshot capture",
                "current": "Sequential during scraping",
                "optimization": "Move to background task or skip in production"
            },
            {
                "task": "Progress updates",
                "current": "Synchronous emit during scraping",
                "optimization": "Batch updates or use background queue"
            }
        ]

    def calculate_time_savings(self):
        """Calculate potential time savings from optimizations"""
        current_total = sum(wt["current_ms"] for wt in self.wait_times.values())
        optimized_total = sum(wt["optimized_ms"] for wt in self.wait_times.values())
        
        savings_ms = current_total - optimized_total
        savings_percent = (savings_ms / current_total) * 100
        
        return {
            "current_total_ms": current_total,
            "optimized_total_ms": optimized_total,
            "savings_ms": savings_ms,
            "savings_percent": savings_percent,
            "time_per_work_order": {
                "current_seconds": current_total / 1000,
                "optimized_seconds": optimized_total / 1000
            },
            "time_for_40_work_orders": {
                "current_minutes": (current_total * 40) / 1000 / 60,
                "optimized_minutes": (optimized_total * 40) / 1000 / 60
            }
        }

    def generate_optimization_code(self):
        """Generate optimized code snippets"""
        optimizations = {
            "navigation_optimization": '''
# BEFORE:
await page.goto(customer_url, wait_until="networkidle", timeout=30000)

# AFTER:
await page.goto(customer_url, wait_until="domcontentloaded", timeout=15000)
# Then wait for specific content
try:
    await page.wait_for_selector(".equipment-tab, [data-tab='equipment']", timeout=5000)
except:
    # Fallback if selector not found
    await page.wait_for_timeout(500)
''',
            "smart_waiting": '''
# BEFORE:
await page.wait_for_timeout(3000)

# AFTER:
async def smart_wait_for_content(page, selectors, timeout=5000):
    """Wait for any of the selectors to appear"""
    try:
        await page.wait_for_selector(
            ", ".join(selectors),
            timeout=timeout,
            state="visible"
        )
    except:
        # Minimal fallback wait
        await page.wait_for_timeout(500)

# Usage:
await smart_wait_for_content(page, [
    ".dispenser-list",
    "[data-equipment-type='dispenser']",
    ".equipment-item:has-text('Dispenser')"
])
''',
            "remove_unnecessary_delays": '''
# Remove delay between work orders when navigating to different pages
# BEFORE:
await asyncio.sleep(self.config['delay_between_pages'] / 1000)

# AFTER:
# Only add delay if staying on same page (rate limiting)
if not navigating_to_new_page:
    await asyncio.sleep(self.config['delay_between_pages'] / 1000)
''',
            "batch_progress_updates": '''
# Batch progress updates instead of emitting for each work order
progress_queue = []

# During scraping:
progress_queue.append(progress_data)

# Emit in batches every N items or X seconds
if len(progress_queue) >= 5 or time_since_last_emit > 2:
    await self._emit_batch_progress(progress_queue)
    progress_queue.clear()
'''
        }
        
        return optimizations

    def generate_report(self):
        """Generate a comprehensive optimization report"""
        savings = self.calculate_time_savings()
        optimizations = self.generate_optimization_code()
        
        report = f"""
DISPENSER SCRAPING PERFORMANCE OPTIMIZATION REPORT
================================================

CURRENT PERFORMANCE
------------------
- Time per work order: {savings['time_per_work_order']['current_seconds']:.1f} seconds
- Time for 40 work orders: {savings['time_for_40_work_orders']['current_minutes']:.1f} minutes
- Total wait time per scrape: {savings['current_total_ms']}ms

OPTIMIZED PERFORMANCE
--------------------
- Time per work order: {savings['time_per_work_order']['optimized_seconds']:.1f} seconds
- Time for 40 work orders: {savings['time_for_40_work_orders']['optimized_minutes']:.1f} minutes
- Total wait time per scrape: {savings['optimized_total_ms']}ms

POTENTIAL SAVINGS
----------------
- Time saved per work order: {savings['savings_ms']/1000:.1f} seconds ({savings['savings_percent']:.0f}%)
- Time saved for 40 work orders: {(savings['savings_ms'] * 40)/1000/60:.1f} minutes

OPTIMIZATION BREAKDOWN
---------------------
"""
        for key, wait_time in self.wait_times.items():
            report += f"\n{wait_time['description']}:"
            report += f"\n  Current: {wait_time['current_ms']}ms"
            report += f"\n  Optimized: {wait_time['optimized_ms']}ms"
            report += f"\n  Savings: {wait_time['current_ms'] - wait_time['optimized_ms']}ms"
            report += f"\n  How: {wait_time['optimization']}\n"

        report += "\nPARALLELIZATION OPPORTUNITIES\n"
        report += "-----------------------------\n"
        for opp in self.parallel_opportunities:
            report += f"\n{opp['task']}:"
            report += f"\n  Current: {opp['current']}"
            report += f"\n  Optimization: {opp['optimization']}\n"

        report += "\nIMPLEMENTATION PRIORITY\n"
        report += "----------------------\n"
        report += "1. Change navigation wait_until strategy (saves ~25s per scrape)\n"
        report += "2. Replace fixed timeouts with smart selector waiting (saves ~6s)\n"
        report += "3. Remove unnecessary delays between work orders (saves ~0.5s)\n"
        report += "4. Implement batch progress updates (reduces overhead)\n"
        report += "5. Make screenshots optional/async (reduces I/O blocking)\n"

        return report

    def save_optimization_plan(self):
        """Save the optimization plan to a file"""
        plan = {
            "generated_at": datetime.now().isoformat(),
            "current_performance": self.calculate_time_savings(),
            "optimizations": [
                {
                    "name": key,
                    "details": value,
                    "priority": i + 1
                }
                for i, (key, value) in enumerate(self.wait_times.items())
            ],
            "code_changes": self.generate_optimization_code()
        }
        
        with open("dispenser_scraping_optimization_plan.json", "w") as f:
            json.dump(plan, f, indent=2)
        
        return plan


def main():
    analyzer = DispenserScrapingAnalyzer()
    
    # Generate and print report
    report = analyzer.generate_report()
    print(report)
    
    # Save optimization plan
    plan = analyzer.save_optimization_plan()
    print(f"\nOptimization plan saved to: dispenser_scraping_optimization_plan.json")
    
    # Print quick implementation guide
    print("\nQUICK IMPLEMENTATION GUIDE")
    print("=========================")
    print("1. Open app/services/workfossa_scraper.py")
    print("2. Search for 'networkidle' and replace with 'domcontentloaded'")
    print("3. Search for 'wait_for_timeout(3000)' and reduce to 1000ms or use smart waits")
    print("4. Add conditional logic for delay_between_pages")
    print("5. Test with a small batch to verify stability")


if __name__ == "__main__":
    main()