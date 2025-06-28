#!/usr/bin/env python3
"""
Show recent work orders in detail
"""

from formatted_viewer import WorkOrderViewer

def main():
    viewer = WorkOrderViewer()
    try:
        viewer.connect()
        viewer.view_detailed_list(limit=5)  # Show first 5 for demo
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()