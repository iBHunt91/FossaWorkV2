#!/usr/bin/env python3
"""
FossaWork Environment Checker
Quick validation of system requirements before setup.
"""

import sys
import subprocess
import platform
import shutil
from pathlib import Path

# ANSI color codes
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def check_item(name: str, success: bool, message: str = ""):
    """Print check result with color coding"""
    status = f"{Colors.GREEN}✓{Colors.END}" if success else f"{Colors.RED}✗{Colors.END}"
    msg = f" - {message}" if message else ""
    print(f"{status} {name}{msg}")
    return success

def main():
    """Check environment and provide setup guidance"""
    print(f"\n{Colors.BOLD}FossaWork Environment Checker{Colors.END}")
    print("=" * 40)
    
    all_good = True
    system = platform.system()
    
    print(f"\nOperating System: {system}")
    
    # Check Python
    python_cmd = None
    for cmd in ['python3', 'python', 'py']:
        if shutil.which(cmd):
            try:
                result = subprocess.run([cmd, '--version'], capture_output=True, text=True)
                version = result.stdout.strip()
                if 'Python 3' in version:
                    parts = version.split()[1].split('.')
                    if int(parts[0]) == 3 and int(parts[1]) >= 7:
                        python_cmd = cmd
                        break
            except:
                continue
    
    python_ok = check_item("Python 3.7+", python_cmd is not None, 
                          f"found {python_cmd}" if python_cmd else "not found")
    all_good &= python_ok
    
    # Check venv capability - try to actually create a test venv
    venv_ok = True
    if python_cmd:
        try:
            # Try to create a temporary venv to verify it works
            import tempfile
            with tempfile.TemporaryDirectory() as tmpdir:
                test_venv = Path(tmpdir) / 'test_venv'
                result = subprocess.run([python_cmd, '-m', 'venv', str(test_venv)], 
                                      capture_output=True, timeout=10)
                venv_ok = result.returncode == 0
        except:
            venv_ok = False
    
    venv_msg = "working" if venv_ok else "install python3-venv or virtualenv"
    check_item("Virtual Environment Support", venv_ok, venv_msg)
    all_good &= venv_ok
    
    # Check Node.js
    node_cmd = shutil.which('node') or shutil.which('node.exe')
    node_ok = check_item("Node.js", node_cmd is not None,
                        "found" if node_cmd else "not found")
    all_good &= node_ok
    
    # Check npm
    npm_ok = shutil.which('npm') is not None
    check_item("npm", npm_ok, "found" if npm_ok else "not found")
    all_good &= npm_ok
    
    # Check build tools (Linux)
    if system == "Linux":
        build_tools = shutil.which('gcc') or shutil.which('clang')
        build_ok = check_item("Build Tools", build_tools is not None,
                             "found" if build_tools else "install build-essential")
        all_good &= build_ok
    
    # Check project structure
    script_path = Path(__file__).resolve()
    project_root = script_path.parent.parent
    
    backend_ok = (project_root / 'backend').exists()
    check_item("Backend Directory", backend_ok)
    all_good &= backend_ok
    
    frontend_ok = (project_root / 'frontend').exists()
    check_item("Frontend Directory", frontend_ok)
    all_good &= frontend_ok
    
    reqs_ok = (project_root / 'backend' / 'requirements.txt').exists()
    check_item("Requirements File", reqs_ok)
    all_good &= reqs_ok
    
    package_ok = (project_root / 'frontend' / 'package.json').exists()
    check_item("Package.json", package_ok)
    all_good &= package_ok
    
    # Results
    print("\n" + "=" * 40)
    if all_good:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ All checks passed! Ready to start FossaWork.{Colors.END}")
        print(f"\nNext steps:")
        print(f"  python3 tools/start-system.py")
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ Some requirements are missing.{Colors.END}")
        print(f"\n{Colors.YELLOW}Installation suggestions:{Colors.END}")
        
        if not python_ok:
            print(f"  • Install Python 3.7+: https://python.org/downloads/")
        
        if not venv_ok and system == "Linux":
            print(f"  • Install venv: sudo apt install python3-venv")
        
        if not node_ok or not npm_ok:
            print(f"  • Install Node.js (includes npm): https://nodejs.org/")
        
        if system == "Linux" and not build_tools:
            print(f"  • Install build tools: sudo apt install build-essential")
    
    return 0 if all_good else 1

if __name__ == "__main__":
    sys.exit(main())