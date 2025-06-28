#!/usr/bin/env python3
"""Start backend in development mode"""
import os
import subprocess

# Set development mode
os.environ['WORKFOSSA_DEV_MODE'] = 'true'

# Run the backend
subprocess.run(['python', 'start_backend.py'])