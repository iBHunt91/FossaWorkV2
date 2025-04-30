import re
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
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

# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.update_chromedriver import update_chromedriver

# Add ChromeDriver update before browser setup
try:
    # Get the directory where AUTOTEST.py is located
    base_dir = os.path.dirname(os.path.abspath(__file__))
    update_chromedriver(base_dir)
except Exception as e:
    print(f"Warning: Failed to update chromedriver: {e}")

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
        self.executed_scripts = set()  # Initialize executed_scripts attribute

        ctk.set_appearance_mode("dark")

        self.current_dispenser_label = ctk.CTkLabel(
            self,
            text="CURRENT DISPENSER",
            anchor="center",
            fg_color="transparent",
            text_color="white",
            font=("Roboto", 20, "bold", "underline")
        )
        self.current_dispenser_label.grid(
            row=0, column=0, padx=75, pady=10, columnspan=1
        )

        self.dispenser_info_label = ctk.CTkLabel(
            self,
            text="",
            anchor="center",
            fg_color="transparent",
            text_color="orange",
            font=("Roboto", 14),
            wraplength=300,
        )
        self.dispenser_info_label.grid(row=1, column=0, padx=20, pady=0)

        category_options = [
            "Gilbarco 300/Wayne",
            "Gilbarco 500/700",
            "Wawa",
            "Circle K (Open Neck Only)",
            "Circle K (Accumeasure)",
            "Costco",
            "Skip",
        ]
        self.category_combobox_var = ctk.StringVar(value=category_options[0])
        self.category_combobox = ctk.CTkOptionMenu(
            self,
            variable=self.category_combobox_var,
            values=category_options,
            width=200,
            height=25,
            corner_radius=16,
            font=("Roboto", 14),
            anchor="center",
        )
        self.category_combobox_var.set("Choose Category")
        self.category_combobox.grid(row=2, column=0, padx=20, pady=20)

        # SCRIPT DROPDOWN
        self.script_options = {
            "Gilbarco 300/Wayne": {
                "3 Grade Gas (M+M)": "scripts/300_Wayne_3_Grade_No_Diesel_MBM.py",
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
                "3 Grade Gas (M+M) (1 Side)": "scripts/700_3_Grade_No_Diesel_MBM (1 Side).py",
                "All Metered": "scripts/700_3_Grade_All Metered.py",
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
            "Costco": {"Costco": "scripts/Costco.py"},
            "Skip": {
                "Skip" : None,
            }
        }

        self.script_combobox_var = ctk.StringVar()
        self.script_combobox = ctk.CTkOptionMenu(
            self,
            values=[],
            variable=self.script_combobox_var,
            width=200,
            height=25,
            corner_radius=16,
            font=("Roboto", 14),
            anchor="center",
        )
        
        self.script_combobox_var.set("Choose Script")
        self.script_combobox.grid(row=3, column=0, padx=20, pady=10)

        def update_script_options(*args):
            category = self.category_combobox_var.get()
            if category:
                self.script_combobox.configure(
                    values=list(self.script_options[category].keys())
                )
                self.script_combobox_var.set(
                    list(self.script_options[category].keys())[0]
                )
            else:
                self.script_combobox.configure(values=[])

        self.category_combobox_var.trace_add("write", update_script_options)

        # Add a horizontal frame for buttons
        button_frame = ctk.CTkFrame(self)
        button_frame.grid(row=4, column=0, padx=20, pady=10)

        # Add the execute button to the button frame
        self.execute_button = ctk.CTkButton(
            button_frame, text="EXECUTE", command=self.execute_action
        )
        self.execute_button.configure(
            fg_color="orange", text_color="black", hover_color="dark orange",
            font=("Roboto", 14, "bold")
        )
        self.execute_button.grid(row=0, column=0, padx=10)
        self.execute_button.configure(state="disabled")

        # Add the continue button
        self.next_button = ctk.CTkButton(
            self, text="CONTINUE", command=self.associate_script_with_form_entry
        )
        self.next_button.configure(
            fg_color="orange", text_color="black", hover_color="dark orange",
            font=("Roboto", 14, "bold")
        )
        self.next_button.grid(row=5, column=0, padx=20, pady=10)    

        # Add the reset button last
        self.reset_button = ctk.CTkButton(
            self, text="RESET", command=self.reset_dispensers
        )
        self.reset_button.configure(
            fg_color="orange", text_color="black", hover_color="dark orange",
            font=("Roboto", 14, "bold")
        )
        self.reset_button.grid(row=6, column=0, padx=20, pady=10)

    def get_zoom_level(self):
        # Execute JavaScript to get the current zoom level
        zoom_level = driver.execute_script("return document.body.style.zoom;")
        return zoom_level

    def execute_action(self):
        # Disable execute button and change text to show processing
        self.execute_button.configure(state="disabled", text="EXECUTING...")
        
        # Create and start execution thread
        execution_thread = threading.Thread(target=self._execute_action_thread_wrapper)
        execution_thread.daemon = True
        execution_thread.start()

    def _execute_action_thread_wrapper(self):
        try:
            self._execute_action_thread()
        finally:
            # Re-enable button and restore text when execution completes
            self.execute_button.configure(state="normal", text="EXECUTE")

    def _execute_action_thread(self):
        current_zoom_level = self.get_zoom_level()
        print(f"Current Zoom Level: {current_zoom_level}")

        for form_entry_title, (form_entry_id, selected_script_name, category) in self.script_associations.items():
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
        selected_script = self.script_combobox_var.get()
        current_title = self.dispenser_info_label.cget("text")
        category = self.category_combobox_var.get()
        if current_title:
            self.current_form_entry_title = current_title
            work_number, visit_number = extract_numeric_segments(driver.current_url)
            if work_number and visit_number:
                form_entry_info = self.get_form_entry_info(work_number, visit_number)
                
                form_entry_id = None
                for entry in form_entry_info:
                    entry_title = entry[1]
                    if entry_title == current_title:
                        form_entry_id = entry[0]
                        break
                
                if form_entry_id:
                    # Store the category along with the script name
                    self.script_associations[current_title] = (form_entry_id, selected_script, category)
                    print(f"Script ({selected_script}) associated with '{current_title}' in category '{category}'")
                    selected_script_title = selected_script
                    self.master.scrollframe.add_entry(current_title, selected_script_title)
                    self.execute_button.configure(state="normal")
                    self.update_dispenser_info(work_number, visit_number)
                else:
                    print("Form entry ID not found for the current title")
            else:
                print("Work number and visit number could not be extracted from the URL.")
        else:
            print("No current form entry title")

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
                    self.dispenser_info_label.configure(
                        text=next_title, wraplength=300
                    )
                else:
                    self.dispenser_info_label.configure(text="All Form Entries Completed")
                    self.next_button.configure(state="disabled", fg_color="grey", text_color="black", hover_color="dark grey")
            else:
                self.dispenser_info_label.configure(
                    text=form_entry_info[0][1], wraplength=300
                )
        else:
            self.dispenser_info_label.configure(text="All Form Entries Completed")
            self.next_button.configure(state="disabled")

    def get_form_entry_info(self, work_number, visit_number):
        html_content = driver.page_source
        soup = BeautifulSoup(html_content, "html.parser")
        form_entries = soup.find_all("a", class_="none")
        form_entry_info = []
        for entry in form_entries:
            href = entry.get("href")
            if href and "form-entries" in href:
                form_entry_id = href.split("/")[-1]
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
        # Clear existing associations and executed scripts
        self.script_associations = {}
        self.executed_scripts = set()
        self.current_form_entry_title = None

        # Clear the scrollframe entries
        self.master.scrollframe.clear_entries()

        # Reset the execute button state
        self.execute_button.configure(state="disabled")

        # Reset the category and script dropdowns
        self.category_combobox_var.set("Choose Category")
        self.script_combobox_var.set("Choose Script")

        # Refresh the dispenser info
        work_number, visit_number = extract_numeric_segments(driver.current_url)
        if work_number and visit_number:
            self.master.get_and_display_form_entry_info(work_number, visit_number)
        else:
            print("Work number and visit number could not be extracted from the URL.")


class scrollframe(ctk.CTkScrollableFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.entry_labels = {}

    def add_entry(self, form_entry_title, script_title):
        entry_frame = ctk.CTkFrame(self)
        entry_frame.pack(anchor="w")

        form_entry_label = ctk.CTkLabel(entry_frame, text="• " + form_entry_title, font=("Roboto", 10), text_color="orange", padx=5, pady=2)
        form_entry_label.pack(anchor="w")

        script_label = ctk.CTkLabel(entry_frame, text="    └ " + script_title, font=("Roboto", 10), text_color="light blue", padx=5, pady=2)
        script_label.pack(anchor="w")

        self.entry_labels[form_entry_title] = entry_frame

    def remove_entry(self, form_entry_title):
        if form_entry_title in self.entry_labels:
            entry_frame = self.entry_labels.pop(form_entry_title)
            entry_frame.destroy()

    def clear_entries(self):
        """Remove all entries from the scrollframe"""
        for entry_frame in self.entry_labels.values():
            entry_frame.destroy()
        self.entry_labels = {}


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Auto Fossa")
        self.geometry("400x700")
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=10)
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self.my_frame = MyFrame(master=self)
        self.my_frame.grid(row=0, column=0, padx=20, pady=10, sticky="ew")

        self.scrollframe = scrollframe(master=self)
        self.scrollframe.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")

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