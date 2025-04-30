import re
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
import customtkinter as ctk
import time
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
import subprocess
from Definitions import *
from Forms import *
import threading
import sys
import queue

# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Add ChromeDriver setup with error handling
def setup_chromedriver():
    try:
        # First try using the bundled chromedriver
        base_dir = os.path.dirname(os.path.abspath(__file__))
        chromedriver_path = os.path.join(base_dir, "chromedriver.exe")
        
        # If bundled chromedriver doesn't exist or fails, try auto-updating
        if not os.path.exists(chromedriver_path):
            from tools.update_chromedriver import update_chromedriver
            update_chromedriver(base_dir)
            
            # Clean up unnecessary files
            for file in ["LICENSE.chromedriver", "THIRD_PARTY_NOTICES.chromedriver"]:
                file_path = os.path.join(base_dir, file)
                if os.path.exists(file_path):
                    os.remove(file_path)
    except Exception as e:
        print(f"Warning: ChromeDriver setup failed: {e}")

# Initialize ChromeDriver
setup_chromedriver()

# Set the debugging address of the existing Chrome browser
chrome_options = Options()
chrome_options.debugger_address = "localhost:9222"

# Connect to the existing browser
driver = webdriver.Chrome(options=chrome_options)
wait = WebDriverWait(driver, 10)

def extract_numeric_segments(url):
    # Use regular expression to find all numeric segments in the URL
    numeric_segments = re.findall(r'\d+', url)
    # Assuming the work number is the first numeric segment and the visit number is the second
    if len(numeric_segments) >= 2:
        work_number = numeric_segments[0]
        visit_number = numeric_segments[1]
        return work_number, visit_number
    else:
        return None, None

class MyFrame(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.current_form_entry_title = None  
        self.script_associations = {}
        self.executed_scripts = set()

        # Initialize StringVar variables first
        self.category_combobox_var = ctk.StringVar(value="Choose Category")
        self.script_combobox_var = ctk.StringVar(value="Choose Script")

        # Define category options
        self.category_options = [
            "Gilbarco 300/Wayne",
            "Gilbarco 500/700",
            "Wawa",
            "Circle K (Open Neck Only)",
            "Circle K (Accumeasure)",
            "Costco",
        ]

        # Add script options dictionary
        self.script_options = {
            "Gilbarco 300/Wayne": {
                "3 Grade Gas (M+M)": "scripts/300_Wayne_3_Grade_No_Diesel_MMB.py",
                "3 Grade W/ Diesel (M+MM)": "scripts/300_Wayne_3_Grade_Diesel_MBMM.py",
                "3 Grade Gas (MM+)": "scripts/300_Wayne_3_Grade_No_Diesel_MMB.py",
                "3 Grade W/ Diesel (MM+M)": "scripts/300_Wayne_3_Grade_Diesel_MMBM.py",
                "4 Grade Gas (M++M)": "scripts/300_Wayne_4_Grade_No_Diesel_MBBM.py",
                "4 Grade W/ Diesel (M++MM)": "scripts/300_Wayne_4_Grade_Diesel_MBBMM.py",
                "4 Grade Gas (MM++)": "scripts/300_Wayne_4_Grade_No_Diesel_MMBB.py",
                "4 Grade W/ Diesel (MM+M)": "scripts/300_Wayne_4_Grade_Diesel_MMBBM.py",
                "5 Grade Gas (M+++M)": "scripts/300_Wayne_5_Grade_No_Diesel_MBBBM.py",
                "5 Grade W/ Diesel (M+++MM)": "scripts/300_Wayne_5_Grade_Diesel_MBBBM.py",
                "Diesel Standalone (MM)": "scripts/300_Wayne_Diesel_Standalone_MM.py",
            },
            "Gilbarco 500/700": {
                "3 Grade Gas (M+M)": "scripts/700_3_Grade_No_Diesel_MBM.py",
                "3 Grade W/ Diesel (M+MM)": "scripts/700_3_Grade_Diesel_MBMM.py",
                "3 Grade Gas (MM+)": "scripts/700_3_Grade_No_Diesel_MMB.py",
                "3 Grade W/ Diesel (MM+M)": "scripts/700_3_Grade_Diesel_MMBM.py",
                "3 Grade W/ Diesel (MMM+)": "scripts/700_3_Grade_Diesel_MMMB.py",
                "4 Grade Gas (M++M)": "scripts/700_4_Grade_No_Diesel_MBBM.py",
                "4 Grade W/ Diesel (M++MM)": "scripts/700_4_Grade_Diesel_MBBMM.py",
                "4 Grade Gas (MM++)": "scripts/700_4_Grade_No_Diesel_MMBB.py",
                "4 Grade W/ Diesel (MM+M)": "scripts/700_4_Grade_Diesel_MMBBM.py",
                "Diesel Standalone (MM)": "scripts/700_Diesel_Standalone_MM.py",
                "Diesel Standalone (M)": "scripts/700_Diesel_Standalone_M.py",
                "3 Grade All Metered (MMM)": "scripts/700_3_Grade_All Metered.py",
            },
            "Wawa": {
                "3 Grade W/ Ethanol + Diesel": "scripts/Wawa_3_Grade_Ethanol_Diesel.py",
                "4 Grade W/ Diesel": "scripts/Wawa_4_Grade_Diesel.py",
                "4 Grade - Gas Only": "scripts/Wawa_4_Grade_Gas.py",
            },
            "Circle K (Open Neck Only)": {
                "3 Grade Gas (M+M)": "scripts/CK_3_Grade_No_Diesel_MBM.py",
                "3 Grade W/ Diesel (M+MM)": "scripts/CK_3_Grade_Diesel_MBMM.py",
                "3 Grade W/ Diesel + Non Eth (M+MMM)": "scripts/CK_3_Grade_Diesel_NonEth_MBMMM.py",
                "3 Grade Gas (MM+)": "scripts/CK_3_Grade_No_Diesel_MMB.py",
                "3 Grade W/ Diesel (MM+M)": "scripts/CK_3_Grade_Diesel_MMBM.py",
                "3 Grade W/ Diesel + Non Eth (MM+MM)": "scripts/CK_3_Grade_Diesel_NonEth_MMBMM.py",
                "Diesel Standalone (MM)": "scripts/CK_Diesel_Standalone_MM.py",
            },
            "Circle K (Accumeasure)": {
                "3 Grade Gas (M+M)": "scripts/700_3_Grade_No_Diesel_MBM.py",
                "3 Grade W/ Diesel (M+MM)": "scripts/700_3_Grade_Diesel_MBMM.py",
                "3 Grade W/ Ethanol + Diesel": "scripts/CK_AM_3_Grade_Ethanol_Diesel.py",
                "Standalone (MM)": "scripts/700_Diesel_Standalone_MM.py",
            },
            "Costco": {
                "Costco": "scripts/Costco.py"
            }
        }

        # Configure the dark theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        # Create main content frame with shadow effect
        content_frame = ctk.CTkFrame(
            self, 
            fg_color="transparent",
        )
        content_frame.grid(row=0, column=0, padx=20, pady=(10, 5), sticky="nsew")
        
        # Define color scheme
        self.colors = {
            'bg_dark': "#1A1A1A",        # Darkest background
            'bg_main': "#242424",        # Main background
            'bg_light': "#2B2B2B",       # Lighter background
            'accent': "#FF6B2C",         # Main accent (orange)
            'accent_hover': "#FF8F55",   # Accent hover
            'text_primary': "#FFFFFF",    # White text
            'text_secondary': "#E0E0E0",  # Light gray text
            'text_accent': "#90CAF9",     # Blue accent text
            'border': "#3B3B3B",         # Border color
            'success': "#4CAF50",        # Success green
            'warning': "#FFC107",        # Warning yellow
            'error': "#F44336"           # Error red
        }

        # Header section with improved styling
        header_frame = ctk.CTkFrame(
            content_frame, 
            fg_color=self.colors['bg_main'], 
            corner_radius=12,
            border_width=1,
            border_color=self.colors['border']
        )
        header_frame.pack(fill="x", pady=(0, 8))  # Reduced padding
        
        # Header layout with improved organization
        header_content = ctk.CTkFrame(
            header_frame,
            fg_color="transparent"
        )
        header_content.pack(fill="x", padx=15, pady=(10, 5))
        
        # Title section with icon - centered
        title_frame = ctk.CTkFrame(
            header_content,
            fg_color="transparent"
        )
        title_frame.pack(fill="x")
        
        # Center the title content
        title_content = ctk.CTkFrame(
            title_frame,
            fg_color="transparent"
        )
        title_content.pack(expand=True)
        
        wrench_icon = ctk.CTkLabel(
            title_content,
            text="🔧",
            font=("Segoe UI Emoji", 24),
            text_color="#FF9F45"
        )
        wrench_icon.pack(side="left", padx=(0, 10))
        
        self.current_dispenser_label = ctk.CTkLabel(
            title_content,
            text="CURRENT DISPENSER",
            font=("Roboto", 18, "bold"),
            text_color="#FF9F45"
        )
        self.current_dispenser_label.pack(side="left")

        # Dispenser info with background
        self.info_frame = ctk.CTkFrame(  # Store as instance variable
            header_frame,
            fg_color="#242424",
            corner_radius=8
        )
        self.info_frame.pack(fill="x", padx=15, pady=(4, 8))

        # Center the dispenser info label with dynamic text handling
        self.dispenser_info_label = ctk.CTkLabel(
            self.info_frame,
            text="",
            font=("Roboto", 14),
            text_color="#FFC288",
            wraplength=300,  # Initial wraplength
            justify="center",
            anchor="center"
        )
        self.dispenser_info_label.pack(fill="x", padx=10, pady=8)

        # Skip button frame (replacing status frame)
        skip_frame = ctk.CTkFrame(
            header_frame,
            fg_color="#242424",
            corner_radius=6,
            height=25
        )
        skip_frame.pack(fill="x", padx=15, pady=(0, 8))  # Reduced padding

        # Create a frame for buttons
        button_container = ctk.CTkFrame(
            skip_frame,
            fg_color="transparent"
        )
        button_container.pack(expand=True)

        # Add Skip button
        self.skip_button = ctk.CTkButton(
            button_container,
            text="Skip",
            command=lambda: self.quick_skip_dispenser(),
            width=80,
            height=25,
            corner_radius=6,
            font=("Roboto", 11, "bold"),
            fg_color=self.colors['bg_light'],
            hover_color=self.colors['accent_hover'],
            text_color=self.colors['accent'],
            border_width=1,
            border_color=self.colors['accent']
        )
        self.skip_button.pack(side="left", pady=2, padx=5)

        # Add Reset button
        self.reset_button = ctk.CTkButton(
            button_container,
            text="Reset",
            command=self.reset_dispensers,
            width=80,
            height=25,
            corner_radius=6,
            font=("Roboto", 11, "bold"),
            fg_color=self.colors['bg_light'],
            hover_color="#FF4B4B",  # Red hover color
            text_color="#FF4B4B",   # Red text color
            border_width=1,
            border_color="#FF4B4B"  # Red border
        )
        self.reset_button.pack(side="left", pady=2, padx=5)

        # Selection section with improved visuals
        selection_frame = ctk.CTkFrame(
            content_frame, 
            fg_color="#1E1E1E", 
            corner_radius=12,
            border_width=1,
            border_color="#3b3b3b"  # Changed from #FF9F45 to more subtle color
        )
        selection_frame.pack(fill="x", pady=(0, 8))  # Reduced padding

        # Section title with improved layout
        section_title = ctk.CTkFrame(
            selection_frame,
            fg_color="transparent"
        )
        section_title.pack(fill="x", padx=15, pady=(10, 5))
        
        # Center the title content
        title_content = ctk.CTkFrame(
            section_title,
            fg_color="transparent"
        )
        title_content.pack(expand=True)
        
        gear_icon = ctk.CTkLabel(
            title_content,
            text="⚙️",
            font=("Segoe UI Emoji", 18),
            text_color="#FF9F45"
        )
        gear_icon.pack(side="left", padx=(0, 10))
        
        title_label = ctk.CTkLabel(
            title_content,
            text="SELECT OPTIONS",
            font=("Roboto", 16, "bold"),
            text_color="#FF9F45"
        )
        title_label.pack(side="left")

        # Improved dropdown styling
        dropdown_style = {
            "width": 280,
            "height": 32,
            "corner_radius": 6,
            "font": ("Roboto", 13),
            "fg_color": self.colors['bg_light'],
            "button_color": self.colors['accent'],
            "button_hover_color": self.colors['accent_hover'],
            "dropdown_fg_color": self.colors['bg_light'],
            "dropdown_hover_color": self.colors['bg_main'],
            "dropdown_text_color": self.colors['text_primary'],
            "text_color": self.colors['text_primary'],
            "anchor": "center"
        }

        # Button styling
        button_style = {
            "width": 280,
            "height": 40,  # Increased height
            "corner_radius": 8,  # Increased corner radius
            "font": ("Roboto", 14, "bold"),  # Larger font
            "fg_color": self.colors['accent'],
            "hover_color": self.colors['accent_hover'],
            "text_color": "#000000",  # Black text for better contrast on orange
            "border_width": 0
        }

        # Center the dropdown containers
        dropdown_frame = ctk.CTkFrame(
            selection_frame,
            fg_color="transparent"
        )
        dropdown_frame.pack(fill="x", padx=20)

        # Category dropdown with placeholder text
        self.category_combobox = ctk.CTkOptionMenu(
            dropdown_frame,
            dynamic_resizing=False,
            variable=self.category_combobox_var,
            values=self.category_options,
            **dropdown_style
        )
        self.category_combobox.pack(pady=8)  # Reduced padding

        # Script dropdown with placeholder text
        self.script_combobox = ctk.CTkOptionMenu(
            dropdown_frame,
            dynamic_resizing=False,
            values=[],
            variable=self.script_combobox_var,
            **dropdown_style
        )
        self.script_combobox.pack(pady=(0, 35))  # Increased bottom padding from 25 to 35

        # Action buttons with adjusted spacing
        button_frame = ctk.CTkFrame(
            content_frame,
            fg_color="transparent"
        )
        button_frame.pack(fill="x", pady=(10, 0), expand=True)  # Added top padding of 10

        # Continue button with adjusted spacing
        self.next_button = ctk.CTkButton(
            button_frame,
            text="CONTINUE",
            command=self.associate_script_with_form_entry,
            **button_style
        )
        self.next_button.pack(pady=(0, 8))

        # Execute button with adjusted spacing and disabled state styling
        self.execute_button = ctk.CTkButton(
            button_frame,
            text="EXECUTE",
            command=self.execute_action,
            state="disabled",
            fg_color="#404040",  # Grayed out color
            hover_color="#404040",  # Same as fg_color to prevent hover effect when disabled
            text_color="#808080",  # Lighter gray for text
            **{k: v for k, v in button_style.items() if k not in ['fg_color', 'hover_color', 'text_color']}
        )
        self.execute_button.pack(pady=(0, 0))

        # Add bottom padding frame
        bottom_padding = ctk.CTkFrame(
            content_frame,
            fg_color="transparent",
            height=20  # Adjust this value as needed
        )
        bottom_padding.pack(fill="x", pady=(10, 0))

        # Configure script options trace
        self.category_combobox_var.trace_add("write", self.update_script_options)

        # Configure grid weights
        self.grid_columnconfigure(0, weight=1)
        content_frame.grid_columnconfigure(0, weight=1)

    def get_zoom_level(self):
        # Execute JavaScript to get the current zoom level
        zoom_level = driver.execute_script("return document.body.style.zoom;")
        return zoom_level

    def execute_action(self):
        self.execute_button.configure(state="disabled", text="EXECUTING...")
        self.update_status("Executing script...", "#FFC107")
        execution_thread = threading.Thread(target=self._execute_action_thread_wrapper)
        execution_thread.daemon = True
        execution_thread.start()

    def _execute_action_thread_wrapper(self):
        try:
            total_entries = len(self.script_associations)
            self.update_status(f"Executing Script\n0 of {total_entries}", "#FFC107")
            self._execute_action_thread()
            self.update_status("Execution complete", "#4CAF50")
        except Exception as e:
            self.update_status(f"Error: {str(e)}", "#F44336")
        finally:
            self.execute_button.configure(state="normal", text="EXECUTE")

    def _execute_action_thread(self):
        current_zoom_level = self.get_zoom_level()
        print(f"Current Zoom Level: {current_zoom_level}")

        total_entries = len(self.script_associations)
        current_entry = 0

        for form_entry_title, (form_entry_id, selected_script_name, category) in self.script_associations.items():
            current_entry += 1
            self.update_status(f"Executing Script\n{current_entry} of {total_entries}", "#FFC107")
            
            work_number, visit_number = extract_numeric_segments(driver.current_url)
            if work_number and visit_number:
                form_entry_url = self.construct_form_entry_url(form_entry_id, work_number, visit_number, category)
                print(f"Navigating to URL for '{form_entry_title}': {form_entry_url}")
                try:
                    driver.get(form_entry_url)
                    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.TAG_NAME, "body")))
                    
                    selected_script = self.get_selected_script(selected_script_name, category)
                    if selected_script:
                        if not self.is_script_executed(form_entry_title):
                            print(f"Executing script: {selected_script}")
                            self.execute_script(selected_script)
                            try:
                                WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Variance field is required.')]")))
                                self.mark_script_executed(form_entry_title)
                            except Exception as e:
                                print(f"Warning: Expected element not found after script execution: {e}")
                        else:
                            print(f"Script for '{form_entry_title}' has already been executed.")
                    else:
                        print(f"No script found for '{selected_script_name}' in category '{category}'")
                except Exception as e:
                    print(f"An error occurred while processing '{form_entry_title}': {e}")
            else:
                print("Work number and visit number could not be extracted from the URL.")

    def execute_script(self, script_name):
        # Construct the full path to the script file
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_name)
        
        if not os.path.exists(script_path):
            print(f"Error: Script file '{script_name}' not found at '{script_path}'")
            return

        try:
            print(f"Attempting to execute script: {script_path}")
            # Get the AutoFossa directory path for PYTHONPATH
            autofossa_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Set up the environment with the correct PYTHONPATH
            env = os.environ.copy()
            if 'PYTHONPATH' in env:
                env['PYTHONPATH'] = f"{autofossa_dir}{os.pathsep}{env['PYTHONPATH']}"
            else:
                env['PYTHONPATH'] = autofossa_dir

            # Run the script in a subprocess with the modified environment
            process = subprocess.Popen(
                ["python", script_path],
                                    stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                env=env,
                cwd=os.path.dirname(script_path)  # Set working directory to script directory
            )
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                print(f"Error executing script {script_name}: {stderr.decode()}")
            else:
                print(f"Script output: {stdout.decode()}")
                
        except Exception as e:
            print(f"Unexpected error occurred while executing script {script_name}: {e}")

    def is_script_executed(self, form_entry_title):
        # Check if the script for the given form entry title has already been executed
        return form_entry_title in self.executed_scripts

    def mark_script_executed(self, form_entry_title):
        # Mark the script for the given form entry title as executed
        self.executed_scripts.add(form_entry_title)

    def get_selected_script(self, selected_script_name, category):
        # Look up the selected script name in the script options dictionary
        if category in self.script_options and selected_script_name in self.script_options[category]:
            return self.script_options[category][selected_script_name]
        return None

    def set_zoom_level(self, zoom_level):
        # Execute JavaScript to set the zoom level
        driver.execute_script(f"document.body.style.zoom = '{zoom_level}';")

    def associate_script_with_form_entry(self):
        """Optimized script association"""
        selected_script = self.script_combobox_var.get()
        current_title = self.dispenser_info_label.cget("text")
        category = self.category_combobox_var.get()
        
        if not current_title:
            return

        work_number, visit_number = extract_numeric_segments(driver.current_url)
        if not (work_number and visit_number):
            return

        form_entry_info = self.get_form_entry_info(work_number, visit_number)
        form_entry_id = next((entry[0] for entry in form_entry_info if entry[1] == current_title), None)
        
        if form_entry_id:
            self.script_associations[current_title] = (form_entry_id, selected_script, category)
            self.master.master.add_to_sidebar(current_title, selected_script)
            # Update execute button appearance when enabled
            self.execute_button.configure(
                state="normal",
                fg_color="#FF6B2C",  # Original orange color
                hover_color="#FF8F55",  # Original hover color
                text_color="#000000"  # Black text
            )
            self.update_dispenser_info(work_number, visit_number)

    def update_dispenser_info(self, work_number, visit_number):
        form_entry_info = self.get_form_entry_info(work_number, visit_number)
        current_title = self.dispenser_info_label.cget("text")
        current_index = None
        if current_title:
            for i, (_, title, _) in enumerate(form_entry_info):
                if title == current_title:
                    current_index = i
                    break

        if form_entry_info:
            if current_index is not None:
                next_index = current_index + 1
                if next_index < len(form_entry_info):
                    next_title = form_entry_info[next_index][1]
                    self.update_label_text(next_title)
                else:
                    self.update_label_text("All Form Entries Completed")
                    self.next_button.configure(state="disabled", fg_color="grey", text_color="black", hover_color="dark grey")
                    self.skip_button.pack_forget()
            else:
                self.update_label_text(form_entry_info[0][1])
        else:
            self.update_label_text("All Form Entries Completed")
            self.next_button.configure(state="disabled")
            self.skip_button.pack_forget()

    def get_form_entry_info(self, work_number, visit_number):
        html_content = driver.page_source
        soup = BeautifulSoup(html_content, "html.parser")
        form_entries = soup.find_all("a", class_="none")
        form_entry_info = []  # This list gets created fresh each time
        
        # Create a set to track unique form entry IDs to prevent duplicates
        seen_entry_ids = set()
        
        for entry in form_entries:
            href = entry.get("href")
            if href and "form-entries" in href:
                form_entry_id = href.split("/")[-1]
                # Only process if we haven't seen this ID before
                if form_entry_id not in seen_entry_ids:
                    seen_entry_ids.add(form_entry_id)
                    title_div = entry.find_next("div", class_="ellipsis")
                    if title_div:
                        title = title_div.get_text(strip=True)
                        title = title.replace("Gilbarco", "")
                        # Construct URL for this form entry
                        form_entry_url = self.construct_form_entry_url(form_entry_id, work_number, visit_number, self.category_combobox_var.get())
                        form_entry_info.append((form_entry_id, title, form_entry_url))

        return form_entry_info

    def construct_form_entry_url(self, form_entry_id, work_number, visit_number, category):
        base_url = "https://app.workfossa.com/app/work"
        if category == "Circle K (Open Neck Only)":
            url = f"{base_url}/{work_number}/visits/{visit_number}/form-entries/{form_entry_id}/sections/571"
        else:
            url = f"{base_url}/{work_number}/visits/{visit_number}/form-entries/{form_entry_id}/sections/537"
        return url

    def reset_dispensers(self):
        """Reset the dispenser list and clear existing associations"""
        try:
            # Clear existing associations and executed scripts
            self.script_associations = {}
            self.executed_scripts = set()
            self.current_form_entry_title = None

            # Reset the execute button state and appearance
            self.execute_button.configure(
                state="disabled",
                fg_color="#404040",
                hover_color="#404040",
                text_color="#808080"
            )

            # Reset the category and script dropdowns
            self.category_combobox_var.set("Choose Category")
            self.script_combobox_var.set("Choose Script")

            # Reset next button state and appearance
            self.next_button.configure(
                state="normal", 
                fg_color="#FF6B2C", 
                text_color="#000000", 
                hover_color="#FF8F55"
            )

            # Show skip button again if it was hidden
            self.skip_button.pack(side="left", pady=2, padx=5)

            # Get fresh dispenser info - same as launch behavior
            work_number, visit_number = extract_numeric_segments(driver.current_url)
            if work_number and visit_number:
                # Call the same method used at launch to get and display form entries
                self.master.master.get_and_display_form_entry_info(work_number, visit_number)
            
        except Exception as e:
            print(f"Error during reset: {e}")
            self.update_status("Reset failed", "#F44336")

    def update_script_options(self, *args):
        category = self.category_combobox_var.get()
        if category and category in self.script_options and category != "Choose Category":
            self.script_combobox.configure(
                values=list(self.script_options[category].keys())
            )
            self.script_combobox_var.set(
                list(self.script_options[category].keys())[0]
            )
        else:
            self.script_combobox.configure(values=["Choose Script"])
            self.script_combobox_var.set("Choose Script")

    def update_status(self, text, color="#4CAF50"):
        """Update the status indicator with support for multiline text"""
        self.update_label_text(text)
        self.dispenser_info_label.configure(text_color=color)
        # Ensure proper text alignment for multiline text
        self.dispenser_info_label.configure(justify="center")

    def quick_skip_dispenser(self):
        """Quick function to skip current dispenser"""
        # Store current selections
        current_category = self.category_combobox_var.get()
        current_script = self.script_combobox_var.get()
        
        # Temporarily set to Skip and trigger continue action
        self.category_combobox_var.set("Skip")
        self.associate_script_with_form_entry()
        
        # Restore previous selections
        self.category_combobox_var.set(current_category)
        if current_category in self.script_options:
            self.script_combobox.configure(values=list(self.script_options[current_category].keys()))
            if current_script in self.script_options[current_category]:
                self.script_combobox_var.set(current_script)

    def update_label_text(self, text):
        """Update label text with dynamic sizing and multiline support"""
        # Calculate text width in pixels (approximate)
        lines = text.split('\n')
        max_line_length = max(len(line) for line in lines)
        char_width = 8  # Approximate width per character in pixels
        text_width = max_line_length * char_width
        
        # Set wraplength based on text length
        if text_width > 280:  # If text would be wider than 280px
            self.dispenser_info_label.configure(
                text=text,
                wraplength=280,
                justify="center",
                font=("Roboto", 14)
            )
        else:
            self.dispenser_info_label.configure(
                text=text,
                wraplength=0,
                justify="center",
                font=("Roboto", 14)
            )

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Auto Fossa")
        self.geometry("400x500")  # Initial window size
        self.sidebar_open = False
        
        # Configure window appearance
        self.configure(fg_color="#1a1a1a")
        
        # Configure grid weights for responsive resizing
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # Create main container with responsive width
        self.main_container = ctk.CTkFrame(
            self, 
            fg_color="transparent"
        )
        self.main_container.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_rowconfigure(0, weight=1)

        # Main frame with responsive layout
        self.my_frame = MyFrame(master=self.main_container)
        self.my_frame.grid(row=0, column=0, sticky="nsew", padx=20, pady=(5, 5))
        self.my_frame.grid_columnconfigure(0, weight=1)
        self.my_frame.grid_rowconfigure(0, weight=1)

        # Bind window resize event
        self.bind('<Configure>', self.on_window_resize)

    def on_window_resize(self, event):
        """Handle window resize events"""
        if event.widget == self:
            # Update main container size
            self.main_container.configure(width=event.width - 40)  # Account for padding
            self.main_container.configure(height=event.height - 40)
            
            # Update dispenser info label wraplength based on new width
            if hasattr(self.my_frame, 'dispenser_info_label'):
                new_wraplength = max(200, event.width - 100)  # Minimum 200px, account for padding
                self.my_frame.dispenser_info_label.configure(wraplength=new_wraplength)

    def setup_sidebar(self):
        """Pre-configure sidebar for better performance"""
        self.sidebar = ctk.CTkFrame(
            self,
            fg_color="#242424",
            width=300,
            height=500,
            corner_radius=0
        )
        self.sidebar.pack_propagate(False)

        # Title section
        title_frame = ctk.CTkFrame(
            self.sidebar,
            fg_color="transparent",
            height=50
        )
        title_frame.pack(fill="x", pady=(15, 5))
        title_frame.pack_propagate(False)

        self.sidebar_title = ctk.CTkLabel(
            title_frame,
            text="SCRIPT ASSOCIATIONS",
            font=("Roboto", 16, "bold"),
            text_color="#FF6B2C"
        )
        self.sidebar_title.pack(expand=True)

        # Content section
        self.sidebar_content = ctk.CTkScrollableFrame(
            self.sidebar,
            fg_color="transparent",
            width=280,
            height=450,
            corner_radius=0
        )
        self.sidebar_content.pack(fill="both", expand=True, padx=10, pady=10)

        # Initially hide sidebar
        self.sidebar.place_forget()

    def _process_updates(self):
        """Background thread to process sidebar updates"""
        while True:
            try:
                # Get next update from queue
                update_data = self.update_queue.get()
                if update_data is None:  # Exit signal
                    break
                    
                form_entry_title, script_title = update_data
                
                # Create entry frame in background
                entry_frame, content = self._create_entry_frame(form_entry_title, script_title)
                
                # Update UI in main thread
                self.after(0, lambda: self._add_entry_to_sidebar(entry_frame))
                
            except queue.Empty:
                time.sleep(0.1)  # Prevent busy waiting
            except Exception as e:
                print(f"Error processing sidebar update: {e}")

    def add_to_sidebar(self, form_entry_title, script_title):
        """Add new entry to sidebar"""
        if self.sidebar_open:
            self._refresh_sidebar()

    def _create_entry_frame(self, form_entry_title, script_title):
        """Create entry frame in background thread"""
        entry_frame = ctk.CTkFrame(
            self.sidebar_content,
            fg_color="#2B2B2B",
            corner_radius=8,
            width=280  # Set fixed width for entry frame
        )
        entry_frame.pack_propagate(False)  # Prevent frame from shrinking

        # Create widgets
        content = {
            'dispenser_frame': ctk.CTkFrame(entry_frame, fg_color="transparent", width=260),
            'script_frame': ctk.CTkFrame(entry_frame, fg_color="transparent", width=260),
            'pump_icon': ctk.CTkLabel(
                None,
                text="⛽",
                font=("Segoe UI Emoji", 14),
                text_color="#FF6B2C",
                width=20  # Fixed width for icon
            ),
            'title_label': ctk.CTkLabel(
                None,
                text=form_entry_title,
                font=("Roboto", 12, "bold"),
                text_color="#FF6B2C",
                wraplength=210,  # Increased wraplength
                justify="left",
                anchor="w",  # Align text to the left
                width=210  # Fixed width for text
            ),
            'script_icon': ctk.CTkLabel(
                None,
                text="📝",
                font=("Segoe UI Emoji", 12),
                text_color="#90CAF9",
                width=20  # Fixed width for icon
            ),
            'script_label': ctk.CTkLabel(
                None,
                text=script_title,
                font=("Roboto", 11),
                text_color="#90CAF9",
                wraplength=190,  # Increased wraplength
                justify="left",
                anchor="w",  # Align text to the left
                width=190  # Fixed width for text
            )
        }

        # Configure frame heights to accommodate wrapped text
        content['dispenser_frame'].configure(height=45)
        content['script_frame'].configure(height=35)
        content['dispenser_frame'].pack_propagate(False)
        content['script_frame'].pack_propagate(False)
        
        return entry_frame, content

    def _add_entry_to_sidebar(self, entry_data):
        """Add entry to sidebar in main thread"""
        entry_frame, content = entry_data
        
        # Configure frames
        content['dispenser_frame'].pack(fill="x", padx=10, pady=5)
        content['script_frame'].pack(fill="x", padx=10, pady=(0, 5))
        
        # Set parents and pack widgets
        content['pump_icon'].configure(master=content['dispenser_frame'])
        content['title_label'].configure(master=content['dispenser_frame'])
        content['script_icon'].configure(master=content['script_frame'])
        content['script_label'].configure(master=content['script_frame'])
        
        content['pump_icon'].pack(side="left", padx=(0, 5))
        content['title_label'].pack(side="left")
        content['script_icon'].pack(side="left", padx=(20, 0))
        content['script_label'].pack(side="left")
        
        # Add to sidebar
        entry_frame.pack(fill="x", pady=5, padx=5)

    def toggle_sidebar(self):
        """Toggle sidebar without affecting main window"""
        if self.sidebar_open:
            self.sidebar.place_forget()
            self.geometry("400x500")
        else:
            self.geometry("700x500")
            # Place sidebar at fixed position without specifying width/height
            self.sidebar.place(x=400, y=0)
            self._refresh_sidebar()
        self.sidebar_open = not self.sidebar_open

    def _refresh_sidebar(self):
        """Refresh sidebar content"""
        # Clear existing entries
        for widget in self.sidebar_content.winfo_children():
            widget.destroy()
            
        # Re-add all entries from script associations
        for form_entry_title, (_, script_title, _) in self.my_frame.script_associations.items():
            entry_frame = ctk.CTkFrame(
                self.sidebar_content,
                fg_color="#2B2B2B",
                corner_radius=8
            )
            
            # Dispenser info
            dispenser_frame = ctk.CTkFrame(entry_frame, fg_color="transparent")
            dispenser_frame.pack(fill="x", padx=10, pady=5)
            
            pump_icon = ctk.CTkLabel(
                dispenser_frame,
                text="⛽",
                font=("Segoe UI Emoji", 14),
                text_color="#FF6B2C"
            )
            pump_icon.pack(side="left", padx=(0, 5))
            
            title_label = ctk.CTkLabel(
                dispenser_frame,
                text=form_entry_title,
                font=("Roboto", 12, "bold"),
                text_color="#FF6B2C"
            )
            title_label.pack(side="left", fill="x", expand=True)
            
            # Script info
            script_frame = ctk.CTkFrame(entry_frame, fg_color="transparent")
            script_frame.pack(fill="x", padx=10, pady=(0, 5))
            
            script_icon = ctk.CTkLabel(
                script_frame,
                text="📝",
                font=("Segoe UI Emoji", 12),
                text_color="#90CAF9"
            )
            script_icon.pack(side="left", padx=(20, 0))
            
            script_label = ctk.CTkLabel(
                script_frame,
                text=script_title,
                font=("Roboto", 11),
                text_color="#90CAF9",
                wraplength=200
            )
            script_label.pack(side="left", fill="x", expand=True)
            
            # Add to sidebar
            entry_frame.pack(fill="x", pady=2, padx=5)

    def get_and_display_form_entry_info(self, work_number, visit_number):
        form_entry_info = self.my_frame.get_form_entry_info(work_number, visit_number)
        form_entry_ids = []  # Initialize an empty list to store form entry IDs
        for entry in form_entry_info:
            form_entry_id, title = entry[:2]  # Unpack the first two values
            form_entry_ids.append(form_entry_id)  # Add the form entry ID to the list
            print(f"Form Entry ID: {form_entry_id}, Title: {title}")

        if form_entry_info:
            first_entry = form_entry_info[0]
            form_entry_id, title = first_entry[:2]  # Unpack the first two values
            label_text = f"{title}"
        else:
            label_text = "No form entries found"
        self.my_frame.dispenser_info_label.configure(text=label_text)

    def main(self):
        work_number, visit_number = extract_numeric_segments(driver.current_url)
        if work_number and visit_number:
            self.get_and_display_form_entry_info(work_number, visit_number)
            self.mainloop()
        else:
            print("Work number and visit number could not be extracted from the URL.")

    def destroy(self):
        driver.quit()
        super().destroy()

if __name__ == "__main__":
    app = App()
    app.main()