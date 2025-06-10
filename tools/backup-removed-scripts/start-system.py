#!/usr/bin/env python3
"""
FossaWork Intelligent Startup Script
A robust cross-platform startup solution that handles all scenarios gracefully.
"""

import sys
import os
import subprocess
import time
import json
import signal
import platform
import shutil
import threading
import socket
from pathlib import Path
from typing import Optional, List, Tuple, Dict

# Configuration
BACKEND_PORT = 8000
FRONTEND_PORT = 5173
STARTUP_TIMEOUT = 30
HEALTH_CHECK_RETRIES = 10
HEALTH_CHECK_INTERVAL = 2

# ANSI color codes for pretty output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(msg: str):
    """Print a formatted header message"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{msg.center(60)}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}\n")

def print_status(msg: str, status: str = "INFO"):
    """Print a status message with color coding"""
    colors = {
        "INFO": Colors.BLUE,
        "SUCCESS": Colors.GREEN,
        "WARNING": Colors.WARNING,
        "ERROR": Colors.FAIL,
        "RUNNING": Colors.CYAN
    }
    color = colors.get(status, Colors.BLUE)
    timestamp = time.strftime("%H:%M:%S")
    try:
        print(f"[{timestamp}] {color}[{status}]{Colors.END} {msg}")
    except UnicodeEncodeError:
        # Fallback for Windows console that can't handle Unicode
        print(f"[{timestamp}] [{status}] {msg}")

def check_port(port: int) -> Optional[int]:
    """Check if a port is in use and return the PID if found"""
    system = platform.system()
    
    try:
        if system == "Windows":
            cmd = f"netstat -ano | findstr :{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.split()
                        return int(parts[-1])
        else:  # Linux/Mac
            cmd = f"lsof -t -i:{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            if result.stdout:
                return int(result.stdout.strip())
    except Exception as e:
        print_status(f"Error checking port {port}: {e}", "WARNING")
    
    return None

def kill_process(pid: int):
    """Kill a process by PID"""
    system = platform.system()
    
    try:
        if system == "Windows":
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, check=True)
        else:
            os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            # Force kill if still running
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        print_status(f"Killed process {pid}", "SUCCESS")
    except Exception as e:
        print_status(f"Failed to kill process {pid}: {e}", "WARNING")

def find_python() -> Optional[str]:
    """Find the best Python executable"""
    # Try different Python commands
    for cmd in ['python3', 'python', 'py']:
        if shutil.which(cmd):
            # Verify it's Python 3.7+
            try:
                result = subprocess.run([cmd, '--version'], capture_output=True, text=True)
                version = result.stdout.strip()
                if 'Python 3' in version:
                    parts = version.split()[1].split('.')
                    if int(parts[0]) == 3 and int(parts[1]) >= 7:
                        return cmd
            except:
                continue
    
    return None

def find_node() -> Optional[str]:
    """Find Node.js executable"""
    for cmd in ['node', 'node.exe']:
        if shutil.which(cmd):
            return cmd
    return None

def check_system_requirements() -> List[str]:
    """Check system requirements and return list of missing items"""
    missing = []
    system = platform.system()
    
    # Check for venv capability on Linux
    if system == "Linux":
        # Try to check if venv is available
        result = subprocess.run(['python3', '-m', 'venv', '--help'], 
                              capture_output=True, timeout=5)
        if result.returncode != 0:
            missing.append("python3-venv package (install with: sudo apt install python3-venv)")
    
    # Check for npm
    if not shutil.which('npm'):
        missing.append("npm (install Node.js from https://nodejs.org)")
    
    # Check for basic build tools on Linux
    if system == "Linux":
        if not shutil.which('gcc') and not shutil.which('clang'):
            missing.append("build tools (install with: sudo apt install build-essential)")
    
    return missing

def check_backend_deps(project_root: Path) -> bool:
    """Check if backend dependencies are installed"""
    venv_path = project_root / 'backend' / 'venv'
    
    if not venv_path.exists():
        return False
    
    # Check if key packages are installed
    if platform.system() == "Windows":
        python_venv = str(venv_path / 'Scripts' / 'python.exe')
    else:
        python_venv = str(venv_path / 'bin' / 'python')
    
    if not os.path.exists(python_venv):
        return False
    
    try:
        # Try to import fastapi using the venv python
        result = subprocess.run([python_venv, '-c', 'import fastapi'], 
                              capture_output=True, timeout=10)
        return result.returncode == 0
    except:
        return False

def install_backend_deps(project_root: Path, python_cmd: str):
    """Install backend dependencies"""
    print_status("Installing backend dependencies...", "INFO")
    backend_dir = project_root / 'backend'
    venv_path = backend_dir / 'venv'
    
    # Get paths for venv executables
    if platform.system() == "Windows":
        pip_cmd = str(venv_path / 'Scripts' / 'pip.exe')
        python_venv = str(venv_path / 'Scripts' / 'python.exe')
    else:
        pip_cmd = str(venv_path / 'bin' / 'pip')
        python_venv = str(venv_path / 'bin' / 'python')
    
    # If venv exists and has a working python, just install/update packages
    if venv_path.exists() and os.path.exists(python_venv):
        print_status("Using existing virtual environment...", "INFO")
    else:
        # Remove broken venv if it exists
        if venv_path.exists():
            print_status("Removing broken virtual environment...", "INFO")
            shutil.rmtree(venv_path, ignore_errors=True)
    
        # Create fresh virtual environment
        print_status("Creating virtual environment...", "INFO")
        try:
            subprocess.run([python_cmd, '-m', 'venv', str(venv_path)], check=True)
        except subprocess.CalledProcessError as e:
            print_status("Standard venv failed, trying virtualenv...", "WARNING")
            
            # Try using virtualenv as fallback
            try:
                # First try to install virtualenv
                subprocess.run([python_cmd, '-m', 'pip', 'install', '--user', 'virtualenv'], 
                              check=True, capture_output=True)
                # Then create venv with virtualenv
                subprocess.run([python_cmd, '-m', 'virtualenv', str(venv_path)], check=True)
                print_status("Successfully created virtual environment with virtualenv", "SUCCESS")
            except subprocess.CalledProcessError:
                print_status("Failed to create virtual environment!", "ERROR")
                print_status("Please install python3-venv or virtualenv manually:", "ERROR")
                
                system = platform.system()
                if system == "Linux":
                    print_status("  sudo apt install python3-venv  # For Ubuntu/Debian", "INFO")
                    print_status("  sudo yum install python3-venv  # For CentOS/RHEL", "INFO")
                elif system == "Windows":
                    print_status("  Ensure Python was installed with 'Add to PATH'", "INFO")
                    
                print_status("  OR: pip install --user virtualenv", "INFO")
                raise e
    
    # Ensure pip is available and working
    print_status("Ensuring pip is installed...", "INFO")
    try:
        subprocess.run([python_venv, '-m', 'ensurepip', '--default-pip'], check=False)
    except:
        pass  # ensurepip may not be available in all installations
    
    # Upgrade pip
    print_status("Upgrading pip...", "INFO")
    try:
        subprocess.run([python_venv, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True)
    except subprocess.CalledProcessError:
        # If pip upgrade fails, try to install pip via get-pip.py
        print_status("Pip upgrade failed, trying alternative method...", "WARNING")
        import urllib.request
        get_pip_url = "https://bootstrap.pypa.io/get-pip.py"
        get_pip_path = venv_path / 'get-pip.py'
        
        urllib.request.urlretrieve(get_pip_url, str(get_pip_path))
        subprocess.run([python_venv, str(get_pip_path)], check=True)
        get_pip_path.unlink()  # Clean up
    
    print_status("Installing requirements...", "INFO")
    subprocess.run([pip_cmd, 'install', '-r', str(backend_dir / 'requirements.txt')], check=True)
    
    print_status("Backend dependencies installed", "SUCCESS")

def check_frontend_deps(project_root: Path) -> bool:
    """Check if frontend dependencies are installed"""
    node_modules = project_root / 'frontend' / 'node_modules'
    return node_modules.exists() and (node_modules / '.bin').exists()

def install_frontend_deps(project_root: Path):
    """Install frontend dependencies"""
    print_status("Installing frontend dependencies...", "INFO")
    frontend_dir = project_root / 'frontend'
    
    # Clean install to avoid conflicts
    node_modules = frontend_dir / 'node_modules'
    if node_modules.exists():
        print_status("Cleaning existing node_modules...", "INFO")
        shutil.rmtree(node_modules, ignore_errors=True)
    
    # Install with npm
    if platform.system() == "Windows":
        subprocess.run('npm install', cwd=str(frontend_dir), shell=True, check=True)
    else:
        subprocess.run(['npm', 'install'], cwd=str(frontend_dir), check=True)
    print_status("Frontend dependencies installed", "SUCCESS")

def health_check(url: str, name: str) -> bool:
    """Check if a service is healthy"""
    import urllib.request
    import urllib.error
    
    try:
        response = urllib.request.urlopen(url, timeout=5)
        return response.status in [200, 404]  # 404 is ok for API root
    except urllib.error.URLError:
        return False
    except Exception:
        return False

def wait_for_service(url: str, name: str, timeout: int = STARTUP_TIMEOUT) -> bool:
    """Wait for a service to become healthy"""
    print_status(f"Waiting for {name} to start...", "INFO")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        if health_check(url, name):
            print_status(f"{name} is ready!", "SUCCESS")
            return True
        time.sleep(HEALTH_CHECK_INTERVAL)
        print(".", end="", flush=True)
    
    print()  # New line after dots
    return False

def start_backend(project_root: Path) -> subprocess.Popen:
    """Start the backend server"""
    backend_dir = project_root / 'backend'
    
    if platform.system() == "Windows":
        python_cmd = str(backend_dir / 'venv' / 'Scripts' / 'python.exe')
    else:
        python_cmd = str(backend_dir / 'venv' / 'bin' / 'python')
    
    # Set environment variables
    env = os.environ.copy()
    env['PYTHONPATH'] = str(backend_dir)
    
    # Start the server
    cmd = [python_cmd, '-m', 'uvicorn', 'app.main_simple:app', '--host', '0.0.0.0', '--port', str(BACKEND_PORT)]
    
    print_status(f"Starting backend on port {BACKEND_PORT}...", "RUNNING")
    return subprocess.Popen(cmd, cwd=str(backend_dir), env=env)

def start_frontend(project_root: Path) -> subprocess.Popen:
    """Start the frontend server"""
    frontend_dir = project_root / 'frontend'
    
    print_status(f"Starting frontend on port {FRONTEND_PORT}...", "RUNNING")
    
    # Use npm run dev - with platform-specific approach
    if platform.system() == "Windows":
        # Try Windows-specific script first, fallback to simple
        try:
            return subprocess.Popen('npm run dev:win', cwd=str(frontend_dir), shell=True)
        except:
            return subprocess.Popen('npm run dev:simple', cwd=str(frontend_dir), shell=True)
    else:
        return subprocess.Popen(['npm', 'run', 'dev'], cwd=str(frontend_dir))

def cleanup_processes(processes: List[subprocess.Popen]):
    """Clean up started processes"""
    for proc in processes:
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except:
                try:
                    proc.kill()
                except:
                    pass

def main():
    """Main startup logic"""
    print_header("FossaWork Intelligent Startup")
    
    # Check for command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="Start FossaWork backend and frontend")
    parser.add_argument('--check-only', action='store_true', 
                       help='Only check dependencies, don\'t start services')
    parser.add_argument('--force-reinstall', action='store_true',
                       help='Force reinstall of all dependencies')
    args = parser.parse_args()
    
    # Determine project root
    script_path = Path(__file__).resolve()
    project_root = script_path.parent.parent
    
    print_status(f"Project root: {project_root}", "INFO")
    
    # Check system
    system = platform.system()
    print_status(f"Operating System: {system}", "INFO")
    
    # Check Python
    python_cmd = find_python()
    if not python_cmd:
        print_status("Python 3.7+ not found!", "ERROR")
        print_status("Please install Python 3.7 or higher", "ERROR")
        return 1
    
    print_status(f"Using Python: {python_cmd}", "SUCCESS")
    
    # Check Node.js
    node_cmd = find_node()
    if not node_cmd:
        print_status("Node.js not found!", "ERROR")
        print_status("Please install Node.js 14 or higher", "ERROR")
        return 1
    
    print_status(f"Using Node.js: {node_cmd}", "SUCCESS")
    
    # Check system requirements
    print_status("Checking system requirements...", "INFO")
    missing_reqs = check_system_requirements()
    if missing_reqs:
        print_status("Missing system requirements:", "ERROR")
        for req in missing_reqs:
            print_status(f"  - {req}", "ERROR")
        print_status("Please install missing requirements and try again", "ERROR")
        return 1
    
    print_status("System requirements OK", "SUCCESS")
    
    # Check and kill existing processes
    print_status("Checking for existing processes...", "INFO")
    
    backend_pid = check_port(BACKEND_PORT)
    if backend_pid:
        print_status(f"Found backend process on port {BACKEND_PORT} (PID: {backend_pid})", "WARNING")
        kill_process(backend_pid)
        time.sleep(2)
    
    frontend_pid = check_port(FRONTEND_PORT)
    if frontend_pid:
        print_status(f"Found frontend process on port {FRONTEND_PORT} (PID: {frontend_pid})", "WARNING")
        kill_process(frontend_pid)
        time.sleep(2)
    
    # Check and install dependencies
    backend_deps_ok = check_backend_deps(project_root)
    frontend_deps_ok = check_frontend_deps(project_root)
    
    if args.force_reinstall or not backend_deps_ok:
        if args.force_reinstall:
            print_status("Force reinstalling backend dependencies", "INFO")
        else:
            print_status("Backend dependencies not found", "WARNING")
        install_backend_deps(project_root, python_cmd)
    else:
        print_status("Backend dependencies OK", "SUCCESS")
    
    if args.force_reinstall or not frontend_deps_ok:
        if args.force_reinstall:
            print_status("Force reinstalling frontend dependencies", "INFO")
        else:
            print_status("Frontend dependencies not found", "WARNING")
        install_frontend_deps(project_root)
    else:
        print_status("Frontend dependencies OK", "SUCCESS")
    
    # If check-only mode, exit here
    if args.check_only:
        print_header("Dependency Check Complete")
        print_status("All dependencies are installed and ready", "SUCCESS")
        return 0
    
    # Start services
    processes = []
    
    try:
        # Start backend
        backend_proc = start_backend(project_root)
        processes.append(backend_proc)
        
        # Wait for backend to be ready (use root endpoint which doesn't need DB)
        if not wait_for_service(f"http://localhost:{BACKEND_PORT}/", "Backend"):
            print_status("Backend failed to start!", "ERROR")
            print_status("Check logs for errors", "ERROR")
            cleanup_processes(processes)
            return 1
        
        # Start frontend
        frontend_proc = start_frontend(project_root)
        processes.append(frontend_proc)
        
        # Wait for frontend to be ready
        if not wait_for_service(f"http://localhost:{FRONTEND_PORT}", "Frontend"):
            print_status("Frontend failed to start!", "ERROR")
            print_status("Check logs for errors", "ERROR")
            cleanup_processes(processes)
            return 1
        
        # Success!
        print_header("System Started Successfully!")
        print_status(f"Backend: http://localhost:{BACKEND_PORT}", "SUCCESS")
        print_status(f"Frontend: http://localhost:{FRONTEND_PORT}", "SUCCESS")
        print_status(f"API Docs: http://localhost:{BACKEND_PORT}/docs", "SUCCESS")
        print()
        print_status("Press Ctrl+C to stop all services", "INFO")
        
        # Keep running
        while True:
            # Check if processes are still running
            if backend_proc.poll() is not None:
                print_status("Backend stopped unexpectedly!", "ERROR")
                break
            if frontend_proc.poll() is not None:
                print_status("Frontend stopped unexpectedly!", "ERROR")
                break
            time.sleep(1)
    
    except KeyboardInterrupt:
        print()
        print_status("Shutting down services...", "INFO")
    except Exception as e:
        print_status(f"Unexpected error: {e}", "ERROR")
    finally:
        cleanup_processes(processes)
        print_status("All services stopped", "SUCCESS")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())