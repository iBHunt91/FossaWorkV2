#!/usr/bin/env python3
"""
Kill processes using a specific port
Usage: python kill_port.py [port]
Default port: 8000
"""

import sys
import subprocess
import os
import platform
import signal

def kill_port_process(port=8000):
    """Kill any process using the specified port"""
    print(f"🔍 Checking for processes using port {port}...")
    
    system = platform.system()
    
    try:
        if system == "Darwin" or system == "Linux":  # macOS or Linux
            # Find the process using the port
            cmd = f"lsof -ti :{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                killed_count = 0
                for pid in pids:
                    if pid:
                        try:
                            # Get process info before killing
                            info_cmd = f"ps -p {pid} -o comm="
                            info_result = subprocess.run(info_cmd, shell=True, capture_output=True, text=True)
                            process_name = info_result.stdout.strip() if info_result.stdout else "unknown"
                            
                            print(f"⚠️  Found process {pid} ({process_name}) using port {port}")
                            
                            # Kill the process
                            os.kill(int(pid), signal.SIGTERM)
                            print(f"✅ Killed process {pid}")
                            killed_count += 1
                        except ProcessLookupError:
                            print(f"⚠️  Process {pid} already terminated")
                        except Exception as e:
                            print(f"❌ Failed to kill process {pid}: {e}")
                            # Try force kill
                            try:
                                os.kill(int(pid), signal.SIGKILL)
                                print(f"✅ Force killed process {pid}")
                                killed_count += 1
                            except:
                                print(f"❌ Could not force kill process {pid}")
                
                if killed_count > 0:
                    print(f"\n✅ Successfully killed {killed_count} process(es)")
                else:
                    print(f"\n⚠️  No processes were killed")
                return True
            else:
                print(f"✅ Port {port} is available - no processes to kill")
                return True
                
        elif system == "Windows":
            # Windows command to find process
            find_cmd = f"netstat -aon | findstr :{port}"
            result = subprocess.run(find_cmd, shell=True, capture_output=True, text=True)
            
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                killed_count = 0
                processed_pids = set()
                
                for line in lines:
                    if "LISTENING" in line:
                        parts = line.split()
                        if parts:
                            pid = parts[-1]
                            if pid not in processed_pids:
                                processed_pids.add(pid)
                                print(f"⚠️  Found process {pid} using port {port}")
                                
                                # Get process name
                                name_cmd = f'tasklist /FI "PID eq {pid}" /FO CSV | findstr /v "Image Name"'
                                name_result = subprocess.run(name_cmd, shell=True, capture_output=True, text=True)
                                process_name = "unknown"
                                if name_result.stdout:
                                    try:
                                        # Parse CSV output
                                        parts = name_result.stdout.strip().split(',')
                                        if parts:
                                            process_name = parts[0].strip('"')
                                    except:
                                        pass
                                
                                print(f"   Process name: {process_name}")
                                
                                # Kill the process
                                kill_cmd = f"taskkill /F /PID {pid}"
                                kill_result = subprocess.run(kill_cmd, shell=True, capture_output=True, text=True)
                                
                                if kill_result.returncode == 0:
                                    print(f"✅ Killed process {pid}")
                                    killed_count += 1
                                else:
                                    print(f"❌ Failed to kill process {pid}")
                
                if killed_count > 0:
                    print(f"\n✅ Successfully killed {killed_count} process(es)")
                else:
                    print(f"\n⚠️  No processes were killed")
                return True
            else:
                print(f"✅ Port {port} is available - no processes to kill")
                return True
                
    except Exception as e:
        print(f"❌ Error checking/killing port process: {e}")
        print("   You may need to manually stop any process using the port")
        print("\n   Manual commands:")
        if system == "Darwin" or system == "Linux":
            print(f"   - Find process: lsof -i :{port}")
            print(f"   - Kill process: kill -9 <PID>")
        else:
            print(f"   - Find process: netstat -aon | findstr :{port}")
            print(f"   - Kill process: taskkill /F /PID <PID>")
        return False

def main():
    """Main function"""
    # Get port from command line or use default
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"❌ Invalid port number: {sys.argv[1]}")
            print("Usage: python kill_port.py [port]")
            sys.exit(1)
    
    print("=" * 60)
    print(f"🎯 Port Killer - Clearing port {port}")
    print("=" * 60)
    
    success = kill_port_process(port)
    
    print("=" * 60)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()