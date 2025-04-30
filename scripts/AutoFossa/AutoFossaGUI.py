import customtkinter as ctk
import os
import sys
import subprocess
from threading import Thread
import time
from Definitions import *
from Forms import *

# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class ScriptButton(ctk.CTkButton):
    def __init__(self, master, text, script, **kwargs):
        super().__init__(master, text=text, **kwargs)
        self.script = script
        self.script_process = None
        self.configure(command=self.on_clicked)
        self.update_button_style()

    def update_button_style(self):
        if self.script_process is None:
            self.configure(fg_color="#FF8C00", hover_color="#FFA500")
        else:
            self.configure(fg_color="#32CD32", hover_color="#228B22")

    def on_clicked(self):
        if not self.cget("state") == "normal":
            return
        
        if self.script_process is None:
            self.run_script()
        else:
            self.stop_script()
        self.update_button_style()

    def run_script(self):
        try:
            if not os.path.exists(self.script):
                print(f"Error: Script file not found: {self.script}")
                return

            script_parent_dir = os.path.dirname(os.path.dirname(self.script))
            env = os.environ.copy()
            if 'PYTHONPATH' in env:
                env['PYTHONPATH'] = f"{script_parent_dir}{os.pathsep}{env['PYTHONPATH']}"
            else:
                env['PYTHONPATH'] = script_parent_dir

            if self.script.endswith(".cmd"):
                self.script_process = subprocess.Popen(["cmd.exe", "/c", self.script])
            else:
                self.script_process = subprocess.Popen(["python", self.script], env=env)
            
            print(f"Running: {self.cget('text')}")
            self.update_button_style()

            monitor_thread = Thread(target=self.monitor_script_process)
            monitor_thread.start()

        except Exception as e:
            print(f"Failed to run script: {self.cget('text')}. Error: {e}")

    def stop_script(self):
        if self.script_process:
            self.script_process.terminate()
            self.script_process = None
            print(f"Stopped: {self.cget('text')}")
            self.update_button_style()

    def monitor_script_process(self):
        while self.script_process and self.script_process.poll() is None:
            time.sleep(0.1)
        self.script_process = None
        self.update_button_style()

class AutoFossaApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Configure window
        self.title("AutoFossa")
        self.geometry("1200x800")
        
        # Configure grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Create main container
        self.main_container = ctk.CTkFrame(self)
        self.main_container.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_rowconfigure(1, weight=1)

        # Create header
        self.header = ctk.CTkFrame(self.main_container)
        self.header.grid(row=0, column=0, sticky="ew", pady=(0, 20))
        
        self.title_label = ctk.CTkLabel(
            self.header, 
            text="AutoFossa Script Manager",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        self.title_label.pack(pady=10)

        # Create script categories
        self.categories = {
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
                "3 Grade Gas": "scripts/500_700_3_Grade_No_Diesel.py",
                "3 Grade W/ Diesel": "scripts/500_700_3_Grade_Diesel.py",
                "4 Grade Gas": "scripts/500_700_4_Grade_No_Diesel.py",
                "4 Grade W/ Diesel": "scripts/500_700_4_Grade_Diesel.py",
                "5 Grade Gas": "scripts/500_700_5_Grade_No_Diesel.py",
                "5 Grade W/ Diesel": "scripts/500_700_5_Grade_Diesel.py",
            },
            "Wawa": {
                "Standard Test": "scripts/Wawa_Standard_Test.py",
            },
            "Circle K (Open Neck Only)": {
                "Standard Test": "scripts/CircleK_OpenNeck_Standard_Test.py",
            },
            "Circle K (Accumeasure)": {
                "Standard Test": "scripts/CircleK_Accumeasure_Standard_Test.py",
            },
            "Costco": {
                "Standard Test": "scripts/Costco_Standard_Test.py",
            }
        }

        # Create category selector
        self.category_var = ctk.StringVar(value="Select Category")
        self.category_selector = ctk.CTkOptionMenu(
            self.main_container,
            values=list(self.categories.keys()),
            variable=self.category_var,
            command=self.update_script_buttons
        )
        self.category_selector.grid(row=1, column=0, sticky="ew", pady=(0, 20))

        # Create script buttons container
        self.script_buttons_frame = ctk.CTkScrollableFrame(self.main_container)
        self.script_buttons_frame.grid(row=2, column=0, sticky="nsew")
        self.script_buttons_frame.grid_columnconfigure(0, weight=1)

        # Create status bar
        self.status_bar = ctk.CTkLabel(
            self.main_container,
            text="Ready",
            anchor="w"
        )
        self.status_bar.grid(row=3, column=0, sticky="ew", pady=(20, 0))

    def update_script_buttons(self, category):
        # Clear existing buttons
        for widget in self.script_buttons_frame.winfo_children():
            widget.destroy()

        # Create new buttons for selected category
        if category in self.categories:
            for script_name, script_path in self.categories[category].items():
                button = ScriptButton(
                    self.script_buttons_frame,
                    text=script_name,
                    script=script_path,
                    height=40
                )
                button.pack(fill="x", pady=5)

    def update_status(self, message):
        self.status_bar.configure(text=message)

if __name__ == "__main__":
    app = AutoFossaApp()
    app.mainloop() 