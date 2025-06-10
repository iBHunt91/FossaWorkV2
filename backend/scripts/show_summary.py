#!/usr/bin/env python3
"""
Show comprehensive summary
"""

from formatted_viewer import WorkOrderViewer

def main():
    viewer = WorkOrderViewer()
    try:
        viewer.connect()
        viewer.view_summary()
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()