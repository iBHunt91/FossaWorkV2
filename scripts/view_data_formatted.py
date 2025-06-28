#!/usr/bin/env python3
"""
Command-line interface for viewing formatted work order data
Usage: python3 view_data_formatted.py [option]
"""

import sys
from formatted_viewer import WorkOrderViewer

def show_help():
    """Show help information"""
    print("""
🎯 FOSSAWORK V2 FORMATTED DATA VIEWER

Usage: python3 view_data_formatted.py [option]

Options:
    summary         Show comprehensive summary overview
    recent          Show recent 10 work orders (detailed)
    all             Show all work orders (detailed) 
    wawa            Show only Wawa locations
    7eleven         Show only 7-Eleven locations
    circlek         Show only Circle K locations
    hillsborough    Show only Hillsborough County locations
    pinellas        Show only Pinellas County locations
    export          Export all data to JSON file
    help            Show this help message

Examples:
    python3 view_data_formatted.py summary
    python3 view_data_formatted.py recent
    python3 view_data_formatted.py wawa
    python3 view_data_formatted.py hillsborough
    python3 view_data_formatted.py export

No option = summary view
    """)

def main():
    """Main function"""
    if len(sys.argv) > 1:
        option = sys.argv[1].lower()
    else:
        option = "summary"
    
    if option in ["help", "-h", "--help"]:
        show_help()
        return
    
    # Change to parent directory to find database
    import os
    os.chdir('..')
    
    viewer = WorkOrderViewer()
    
    try:
        viewer.connect()
        
        if option == "summary":
            viewer.view_summary()
        elif option == "recent":
            viewer.view_detailed_list(limit=10)
        elif option == "all":
            viewer.view_detailed_list()
        elif option == "wawa":
            viewer.view_by_brand("Wawa")
        elif option in ["7eleven", "seven", "7-eleven"]:
            viewer.view_by_brand("7-Eleven")
        elif option in ["circlek", "circle"]:
            viewer.view_by_brand("Circle K")
        elif option == "shell":
            viewer.view_by_brand("Shell")
        elif option in ["hillsborough", "hillsborough-county"]:
            viewer.view_by_county("Hillsborough")
        elif option in ["pinellas", "pinellas-county"]:
            viewer.view_by_county("Pinellas")
        elif option in ["polk", "polk-county"]:
            viewer.view_by_county("Polk")
        elif option in ["pasco", "pasco-county"]:
            viewer.view_by_county("Pasco")
        elif option == "export":
            viewer.export_to_json()
        else:
            print(f"[ERROR] Unknown option: {option}")
            print("Use 'help' for available options.")
            return
            
    except FileNotFoundError:
        print("[ERROR] Database file not found. Make sure 'fossawork_v2.db' exists in the current directory.")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
    finally:
        viewer.disconnect()

if __name__ == "__main__":
    main()