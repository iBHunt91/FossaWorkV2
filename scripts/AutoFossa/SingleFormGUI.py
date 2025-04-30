import sys
import subprocess
from PyQt5 import QtWidgets
import qdarkstyle
from threading import Thread
import time
import keyboard
import os

# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from Definitions import *
from Forms import *
from tools.update_chromedriver import update_chromedriver


class ScriptButton(QtWidgets.QPushButton):
    def __init__(self, text, script):
        super(ScriptButton, self).__init__(text)
        self.script = script
        self.script_process = None
        self.clicked.connect(self.on_clicked)
        self.update_button_style()

    def update_button_style(self):
        if self.isEnabled():
            color = "#FF8C00" if self.script_process is None else "#32CD32"
        else:
            color = "#BFBFBF"
        self.setStyleSheet(
            f"""
            QPushButton {{
                background-color: {color};
                color: #000000;
            }}
            QPushButton:hover {{
                background-color: #FFA500;
            }}
            """
        )

    def on_clicked(self):
        if not self.isEnabled():
            window.statusBar().showMessage(f"Please enable the checkbox to activate buttons.")
            return
        # Check if any other script is running
        if any(btn.script_process is not None for btn in self.parent().parent().findChildren(ScriptButton)):
            window.statusBar().showMessage(f"Please wait or stop current script")
            return
        if self.script_process is None:  # If the script is not running
            self.run_script()
        else:  # If the script is running
            self.stop_script()
        self.update_button_style()

    def run_script(self):
        try:
            if not os.path.exists(self.script):
                window.statusBar().showMessage(f"Error: Script file not found: {self.script}")
                print(f"Error: Script file not found: {self.script}")
                return

            # Get the parent directory of the script file
            script_parent_dir = os.path.dirname(os.path.dirname(self.script))
            
            # Set up the environment with the correct PYTHONPATH
            env = os.environ.copy()
            if 'PYTHONPATH' in env:
                env['PYTHONPATH'] = f"{script_parent_dir}{os.pathsep}{env['PYTHONPATH']}"
            else:
                env['PYTHONPATH'] = script_parent_dir

            if self.script.endswith(".cmd"):
                self.script_process = subprocess.Popen(["cmd.exe", "/c", self.script])
            else:
                self.script_process = subprocess.Popen(["python", self.script], env=env)
            print(f"Running: {self.text()}")

            # Change button color to green
            self.setStyleSheet("background-color: #32CD32;")
            # Send status message
            window.statusBar().showMessage(f"Running: {self.text()}")

            monitor_thread = Thread(target=self.monitor_script_process)
            monitor_thread.start()

        except Exception as e:
            print(f"Failed to run script: {self.text()}. Error: {e}")
            window.statusBar().showMessage(f"Error running script: {str(e)}")

    def stop_script(self):
        if self.script_process:
            self.script_process.terminate()
            self.script_process = None
            print(f"Stopped: {self.text()}")

        # Reset button color
        self.setStyleSheet("background-color: #FF8C00;")
        # Send status message
        window.statusBar().showMessage(f"Stopped: {self.text()}")

    def monitor_script_process(self):
        while self.script_process is not None and self.script_process.poll() is None:
            time.sleep(0.5)
        self.script_process = None
        self.update_button_style()
        window.statusBar().showMessage(f"Completed: {self.text()}")
        time.sleep(2.0)
        window.statusBar().showMessage("Ready")

class InstructionDialog(QtWidgets.QDialog):
    def __init__(self):
        super(InstructionDialog, self).__init__()

        self.setWindowTitle('Instructions')
        layout = QtWidgets.QVBoxLayout(self)
        instruction_text = " 1. Launch Chrome with provided button. *Scripts will not work otherwise*\n 2. Open dispenser and fill out 'Prover Size' (5 Gallons) on dispenser information screen.\n 3. Continue to form section and select appropriate script on application. *Form must be empty, the script will do the rest*\n\n     *To enable buttons (Orange Background) click the checkbox next to dispenser type*\n\n      Be sure to look at the following or you might choose wrong script\n\n      M = Meter         M+M      (i.e. Regular, Plus, Premium)\n      + = Blend          MM+      (i.e. Regular, Super, Plus)\n\n      'Escape' Hotkey will close application & terminate script\n      'S' Hotkey will only terminate script & keep application open\n\n      *Hotkeys will only work if application is active window*"
        label = QtWidgets.QLabel(instruction_text)
        layout.addWidget(label)
        buttonBox = QtWidgets.QDialogButtonBox(QtWidgets.QDialogButtonBox.Ok)
        buttonBox.accepted.connect(self.accept)
        layout.addWidget(buttonBox)

class MainWindow(QtWidgets.QMainWindow):
    def __init__(self):
        # Get the directory where GUI.py is located
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Update chromedriver before initializing the GUI
        try:
            update_chromedriver(self.base_dir)
        except Exception as e:
            print(f"Warning: Failed to update chromedriver: {e}")

        menu_data = [
            ("Gilbarco 300 / Wayne", [
                ("3 Grade Gas (M+M)", "300_Wayne_3 Grade_No_Diesel_MBM.py"),
                ("3 Grade W/ Diesel (M+MM)", "300_Wayne_3_Grade_Diesel_MBMM.py"),
                ("3 Grade Gas (MM+)", "300_Wayne_3 Grade_No_Diesel_MMB.py"),
                ("3 Grade W/ Diesel (MM+M)", "300_Wayne_3_Grade_Diesel_MMBM.py"),
                ("4 Grade Gas (M++M)", "300_Wayne_4_Grade_No_Diesel_MBBM.py"),
                ("4 Grade W/ Diesel (M++MM)", "300_Wayne_4_Grade - Diesel_MBBMM.py"),
                ("4 Grade Gas (MM++)", "300_Wayne_4_Grade_No_Diesel_MMBB.py"),
                ("4 Grade W/ Diesel (MM++M)", "300_Wayne_4_Grade - Diesel_MMBBM.py"),
                ("5 Grade Gas (M+++M)", "300_Wayne_5_Grade_No_Diesel_MBBBM.py"),
                ("5 Grade W/ Diesel (M+++MM)", "300_Wayne_5_Grade_Diesel_MBBBM.py"),
                ("Diesel Standalone (MM)", "300_Wayne_Diesel_Standalone_MM.py")
            ]),
            ("Gilbarco 700", [
                ("3 Grade Gas (M+M)", "700_3_Grade_No_Diesel_MBM.py"),
                ("3 Grade W/ Diesel (M+MM)", "700_3_Grade_Diesel_MBMM.py"),
                ("3 Grade Gas (MM+)", "700_3_Grade_No_Diesel_MMB.py"),
                ("3 Grade W/ Diesel (MM+M)", "700_3_Grade_Diesel_MMBM.py"),
                ("4 Grade Gas (M++M)", "700_4 Grade_No_Diesel_MBBM.py"),
                ("4 Grade W/ Diesel (M++MM)", "700_4_Grade_Diesel_MBBMM.py"),
                ("4 Grade Gas (MM++)", "700_4_Grade_No_Diesel_MMBB.py"),
                ("4 Grade W/ Diesel (MM++M)", "700_4_Grade_Diesel_MMBBM.py"),
                ("Diesel Standalone (MM)", "700_Diesel_Standalone_MM.py"),
                ("All Metered", "700_3_Grade_All Metered.py")
            ]),
            ("Wawa", [
                ("3 Grade W/ Ethanol + Diesel", "Wawa_3_Grade_Ethanol_Diesel.py"),
                ("4 Grade W/ Diesel", "Wawa_4_Grade_Diesel.py"),
                ("4 Grade - Gas Only", "Wawa_4_Grade_Gas.py")
            ]),
            ("Circle K", [
                ("3 Grade Gas (M+M)", "CK_3_Grade_No_Diesel_MBM.py"),
                ("3 Grade W/ Diesel (M+MM)", "CK_3_Grade_Diesel_MBMM.py"),
                ("3 Grade W/ Diesel + Non Eth (M+MMM)", "CK_3_Grade_Diesel_NonEth_MBMMM.py"),
                ("3 Grade Gas (MM+)", "CK_3_Grade_No_Diesel_MMB.py"),
                ("3 Grade W/ Diesel (MM+M)", "CK_3_Grade_Diesel_MMBM.py"),
                ("3 Grade W/ Diesel + Non Eth (MM+MM)", "CK_3_Grade_Diesel_NonEth_MMBMM.py"),
                ("Diesel Standalone (MM)", "CK_Diesel_Standalone_MM.py")
            ]),        
            ("Costco", [
                ("Regular + Premium", "Costco.py")
            ])
        ]

        super(MainWindow, self).__init__()
        self.setGeometry(0, 0, 250, 200)

        # keyboard.add_hotkey('s', self.terminate_all_scripts)
        keyboard.add_hotkey('esc', self.close_app)

        menuBar = self.menuBar()
        instrAction = QtWidgets.QAction('&INSTRUCTIONS - READ FIRST', self)  # added to the menu bar
        instrAction.setStatusTip('Open the instruction dialog')
        instrAction.triggered.connect(self.show_instructions)  # directly connected
        menuBar.addAction(instrAction)  # added directly to the menu bar

        central_widget = QtWidgets.QWidget(self)
        layout = QtWidgets.QVBoxLayout(central_widget)

        for menu, scripts in menu_data:
            group_box = QtWidgets.QGroupBox(menu)
            group_box.setCheckable(True)
            group_box.toggled.connect(lambda checked, box=group_box: self.on_group_box_toggled(checked, box))
            group_layout = QtWidgets.QVBoxLayout()
            for script_name, script_path in scripts:
                # Create absolute path for the script, including the scripts subdirectory
                full_script_path = os.path.join(self.base_dir, "scripts", script_path)
                script_button = ScriptButton(script_name, full_script_path)
                script_button.setEnabled(False)
                group_layout.addWidget(script_button)
            group_box.setLayout(group_layout)
            layout.addWidget(group_box)

            if menu == "Chrome":
                group_box.setChecked(True)
                self.on_group_box_toggled(True, group_box)
            else:
                group_box.setChecked(False)
                self.on_group_box_toggled(False, group_box)

        self.setCentralWidget(central_widget)
        self.statusBar().showMessage('Welcome to Form Fossa')
        self.setWindowTitle('Form Fossa')
        self.show()
        self.setStyleSheet(qdarkstyle.load_stylesheet_pyqt5())

    def terminate_all_scripts(self):
        for button in self.findChildren(ScriptButton):
            if button.script_process is not None:
                button.stop_script()

    def close_app(self):
        self.terminate_all_scripts()
        self.close()

    def on_group_box_toggled(self, checked, group_box):
        for button in group_box.findChildren(ScriptButton):
            button.setEnabled(checked)
            button.update_button_style()
        if checked:
            self.statusBar().showMessage("Ready")
        else:
            self.statusBar().showMessage("To enable the buttons, toggle the checkbox.")

    def show_instructions(self):
        dialog = InstructionDialog()
        dialog.setStyleSheet(qdarkstyle.load_stylesheet_pyqt5())
        dialog.exec_()

app = QtWidgets.QApplication(sys.argv)
window = MainWindow()
sys.exit(app.exec_())
