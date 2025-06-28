#!/usr/bin/env python3
"""
Show Wawa locations only
"""

from formatted_viewer import WorkOrderViewer

def main():
    viewer = WorkOrderViewer()
    try:
        viewer.connect()
        viewer.view_by_brand("Wawa")
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()