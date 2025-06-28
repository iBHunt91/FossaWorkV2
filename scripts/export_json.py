#!/usr/bin/env python3
"""
Export all data to JSON
"""

from formatted_viewer import WorkOrderViewer

def main():
    viewer = WorkOrderViewer()
    try:
        viewer.connect()
        viewer.export_to_json()
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()