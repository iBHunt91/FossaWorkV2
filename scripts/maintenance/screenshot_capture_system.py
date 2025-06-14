#!/usr/bin/env python3
"""
Screenshot capture system for dispenser scraping debugging
"""
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from playwright.async_api import async_playwright, Page

class ScreenshotCapture:
    """Capture and manage screenshots during scraping"""
    
    def __init__(self, screenshot_dir=None):
        self.screenshot_dir = screenshot_dir or Path("/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/screenshots")
        self.screenshot_dir.mkdir(exist_ok=True)
        
        # Create subdirectory for this session
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_dir = self.screenshot_dir / f"session_{timestamp}"
        self.session_dir.mkdir(exist_ok=True)
        
        self.screenshot_index = []
        print(f"📸 Screenshot session initialized: {self.session_dir}")
    
    async def capture(self, page: Page, name: str, description: str = "") -> str:
        """Capture a screenshot with metadata"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        filename = f"{timestamp}_{name.replace(' ', '_').lower()}.png"
        filepath = self.session_dir / filename
        
        try:
            # Capture full page screenshot
            await page.screenshot(path=str(filepath), full_page=True)
            
            # Add to index
            self.screenshot_index.append({
                'timestamp': datetime.now().isoformat(),
                'filename': filename,
                'name': name,
                'description': description,
                'url': page.url,
                'title': await page.title()
            })
            
            print(f"   📸 Captured: {name}")
            return str(filepath)
            
        except Exception as e:
            print(f"   ❌ Screenshot failed: {e}")
            return ""
    
    async def capture_element(self, page: Page, selector: str, name: str, description: str = "") -> str:
        """Capture a specific element"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        filename = f"{timestamp}_{name.replace(' ', '_').lower()}_element.png"
        filepath = self.session_dir / filename
        
        try:
            element = await page.query_selector(selector)
            if element:
                await element.screenshot(path=str(filepath))
                
                self.screenshot_index.append({
                    'timestamp': datetime.now().isoformat(),
                    'filename': filename,
                    'name': f"{name} (element)",
                    'description': f"Selector: {selector}. {description}",
                    'url': page.url,
                    'selector': selector
                })
                
                print(f"   📸 Captured element: {name}")
                return str(filepath)
            else:
                print(f"   ⚠️ Element not found: {selector}")
                return ""
                
        except Exception as e:
            print(f"   ❌ Element screenshot failed: {e}")
            return ""
    
    def save_index(self):
        """Save screenshot index as HTML for easy viewing"""
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Screenshot Index - {self.session_dir.name}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        h1 {{
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }}
        .screenshot {{
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .screenshot img {{
            max-width: 100%;
            border: 1px solid #ddd;
            cursor: pointer;
        }}
        .screenshot img:hover {{
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
        }}
        .metadata {{
            margin-top: 10px;
            font-size: 14px;
            color: #666;
        }}
        .metadata strong {{
            color: #333;
        }}
        .timestamp {{
            color: #999;
            font-size: 12px;
        }}
    </style>
    <script>
        function openFullSize(img) {{
            window.open(img.src, '_blank');
        }}
    </script>
</head>
<body>
    <h1>📸 Screenshot Index - {self.session_dir.name}</h1>
    <p>Total screenshots: {len(self.screenshot_index)}</p>
"""
        
        for i, screenshot in enumerate(self.screenshot_index, 1):
            html_content += f"""
    <div class="screenshot">
        <h3>{i}. {screenshot['name']}</h3>
        <img src="{screenshot['filename']}" alt="{screenshot['name']}" onclick="openFullSize(this)" />
        <div class="metadata">
            <div class="timestamp">{screenshot['timestamp']}</div>
            <div><strong>URL:</strong> {screenshot['url']}</div>
            <div><strong>Page Title:</strong> {screenshot.get('title', 'N/A')}</div>
            {f"<div><strong>Description:</strong> {screenshot['description']}</div>" if screenshot['description'] else ""}
            {f"<div><strong>Selector:</strong> <code>{screenshot['selector']}</code></div>" if screenshot.get('selector') else ""}
        </div>
    </div>
"""
        
        html_content += """
</body>
</html>
"""
        
        index_path = self.session_dir / "index.html"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"\n📄 Screenshot index saved: {index_path}")
        print(f"🌐 Open in browser: file://{index_path}")
        
        return str(index_path)

# Example usage for testing
async def test_screenshot_system():
    """Test the screenshot capture system"""
    capture = ScreenshotCapture()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Test captures
        await page.goto("https://example.com")
        await capture.capture(page, "Example Homepage", "Initial page load")
        
        await browser.close()
    
    # Save index
    capture.save_index()

if __name__ == "__main__":
    asyncio.run(test_screenshot_system())