#!/usr/bin/env python3
"""
Enhanced logging system for dispenser scraping debugging
"""
import logging
import sys
import os
from datetime import datetime
from pathlib import Path

class EnhancedLogger:
    """Enhanced logger that writes to both console and file"""
    
    def __init__(self, name="DispenseScrapingTest", log_dir=None):
        self.name = name
        self.log_dir = log_dir or Path("/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/logs")
        self.log_dir.mkdir(exist_ok=True)
        
        # Create log file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"dispenser_scraping_{timestamp}.log"
        
        # Set up logging
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Console handler with color support
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)
        
        # File handler with detailed logging
        file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        self.logger.addHandler(file_handler)
        
        # Log initialization
        self.logger.info(f"🚀 Enhanced logging initialized")
        self.logger.info(f"📄 Log file: {self.log_file}")
    
    def get_logger(self):
        return self.logger
    
    def read_recent_logs(self, lines=50):
        """Read recent log entries"""
        if self.log_file.exists():
            with open(self.log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()
                return all_lines[-lines:]
        return []
    
    def search_logs(self, pattern):
        """Search logs for a pattern"""
        matching_lines = []
        if self.log_file.exists():
            with open(self.log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if pattern.lower() in line.lower():
                        matching_lines.append(line.strip())
        return matching_lines
    
    def get_log_summary(self):
        """Get a summary of log contents"""
        if not self.log_file.exists():
            return "No log file found"
        
        with open(self.log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        errors = [l for l in lines if 'ERROR' in l]
        warnings = [l for l in lines if 'WARNING' in l]
        customer_urls = [l for l in lines if 'customer_url' in l.lower()]
        dispensers = [l for l in lines if 'dispenser' in l.lower() and 'found' in l.lower()]
        
        summary = f"""
📊 Log Summary for {self.log_file.name}
{'='*60}
Total lines: {len(lines)}
Errors: {len(errors)}
Warnings: {len(warnings)}
Customer URL mentions: {len(customer_urls)}
Dispenser mentions: {len(dispensers)}

📍 Recent Errors (last 5):
{chr(10).join(errors[-5:]) if errors else 'No errors found'}

⚠️ Recent Warnings (last 5):
{chr(10).join(warnings[-5:]) if warnings else 'No warnings found'}

🔗 Customer URL Findings (last 5):
{chr(10).join(customer_urls[-5:]) if customer_urls else 'No customer URL logs found'}

⛽ Dispenser Findings (last 5):
{chr(10).join(dispensers[-5:]) if dispensers else 'No dispenser logs found'}
"""
        return summary

# Global logger instance
enhanced_logger = EnhancedLogger()

def setup_logging_for_module(module_name):
    """Set up enhanced logging for a specific module"""
    module_logger = logging.getLogger(module_name)
    module_logger.setLevel(logging.DEBUG)
    
    # Add our file handler to the module logger
    if enhanced_logger.logger.handlers:
        for handler in enhanced_logger.logger.handlers:
            if isinstance(handler, logging.FileHandler):
                module_logger.addHandler(handler)
    
    return module_logger

# Configure logging for key modules
modules_to_log = [
    'app.services.workfossa_scraper',
    'app.services.workfossa_automation',
    'app.services.dispenser_scraper',
    'app.services.browser_automation',
    'app.routes.work_orders'
]

for module in modules_to_log:
    setup_logging_for_module(module)

if __name__ == "__main__":
    # Test the enhanced logger
    logger = enhanced_logger.get_logger()
    
    logger.info("✅ Enhanced logging system is active")
    logger.debug("🔍 Debug messages are captured in the log file")
    logger.warning("⚠️ Warning messages are highlighted")
    logger.error("❌ Error messages are prominently displayed")
    
    print("\n" + enhanced_logger.get_log_summary())