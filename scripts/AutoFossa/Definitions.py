from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoSuchElementException
from bs4 import BeautifulSoup
from selenium.webdriver.common.action_chains import ActionChains
import time
import os

# Set the debugging address of the existing Chrome browser
chrome_options = Options()
chrome_options.debugger_address = "localhost:9222"

# Connect to the existing browser
driver = webdriver.Chrome(options=chrome_options)
wait = WebDriverWait(driver, 10)

XPATH_FIELD_3_INPUT = "//div[@id='field-3']//input[@name='field_0']"
XPATH_FIELD_6_INPUT = "//div[@id='field-6']//input[@name='field_0']"
XPATH_FIELD_8_INPUT = "//div[@id='field-8']//input[@name='field_0']"
XPATH_FIELD_9_INPUT = "//div[@id='field-9']//input[@name='field_0']"

XPATHS_DELETE_ITEM = [
    "//div[@class='panel-header list-panel-header flex jc-between align-center inactive alt-background']//button[@title='Delete item']//span[@class='button-label']//span//*[name()='svg']",
    "//div[@class='panel-header list-panel-header flex jc-between align-center inactive']//button[@title='Delete item']//span[@class='button-label']//span//*[name()='svg']"
]

def send_keys(xpath, value):
    wait.until(EC.element_to_be_clickable((By.XPATH, xpath))).send_keys(value)

def click(xpath):
    wait.until(EC.element_to_be_clickable((By.XPATH, xpath))).click()

def click_by_menu_item(menu_item):
    xpath = f"//li[normalize-space()='{menu_item}']"
    click(xpath)

def delete_item(iteration_id):
    xpaths = [
        "//div[contains(@id, 'iteration-')]//div[contains(@class, 'panel-header') and contains(@class, 'list-panel-header')]//div//button[@title='Delete item']//span[@class='button-label']//span//*[name()='svg']"
    ]

    for xpath in xpaths:
        try:
            click(xpath.replace("iteration-", f"iteration-{iteration_id}"))
            time.sleep(1)  # Wait for one second
            click("//span[contains(text(),'Remove')]")
            time.sleep(1)  # Wait for one second
            return
        except NoSuchElementException:
            pass

def temp():
    time.sleep(1) 
# Wait until the input field is visible
    wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_FIELD_3_INPUT)))

    # Wait until the input field is clickable
    wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_FIELD_3_INPUT)))

    # Perform the action on the input field
    send_keys(XPATH_FIELD_3_INPUT, "0")

def gpm():
    send_keys(XPATH_FIELD_6_INPUT, "3")

def meniscus():
    send_keys(XPATH_FIELD_8_INPUT, "0")

def end():
    send_keys(XPATH_FIELD_9_INPUT, ".0001")

def fast():

    time.sleep(1)

    # Find the radio button using its value attribute
    radio_button_locator = (By.CSS_SELECTOR, 'input[name="field[4866]"][value="1"]')
    radio_button = wait.until(EC.element_to_be_clickable(radio_button_locator))
    
    # Click the radio button using JavaScript
    driver.execute_script("arguments[0].click();", radio_button)

def ck_fast():

    time.sleep(1)

    # Find the radio button using its value attribute
    radio_button_locator = (By.CSS_SELECTOR, 'input[name="field[5471]"][value="1"]')
    radio_button = wait.until(EC.element_to_be_clickable(radio_button_locator))
    
    # Click the radio button using JavaScript
    driver.execute_script("arguments[0].click();", radio_button)

def slow():

    time.sleep(1)

    # Find the radio button using its value attribute
    radio_button_locator = (By.CSS_SELECTOR, 'input[name="field[4866]"][value="2"]')
    radio_button = wait.until(EC.element_to_be_clickable(radio_button_locator))
    

    # Click the radio button using JavaScript
    driver.execute_script("arguments[0].click();", radio_button)

def start():
    send_keys("//div[@id='field-7']//input[@name='field_0']", "0")

def procedure():
    click("//div[contains(text(),'- Procedure -')]")

def add_reading():
    click("//span[contains(text(),'+ Add Reading')]")
    time.sleep(1)  # Wait for one second

def save():
    click("//span[contains(text(),'Save')]")

def wetdown():
    click_by_menu_item("Wet Down")

def firstrun():
    click_by_menu_item("First Run")

def calibrate():
    click_by_menu_item("Calibrate")

def calibrationretest():
    click_by_menu_item("Calibration Retest")

def retest():
    click_by_menu_item("Retest")

def slowrun():
    click_by_menu_item("Meter Sealed")

def click_following_iteration(driver):

    time.sleep(1)

    # Get the page source
    html = driver.page_source

    # Parse the HTML using BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')

    # Find the active iteration based on the presence of the specified HTML element
    active_iteration = soup.find('div', class_='label')
    if active_iteration:
        parent_div = active_iteration.find_parent('div', class_='form-entry-section')
        if parent_div and 'inactive' not in parent_div['class']:
            iteration_number = parent_div['id'].split('-')[1]
            following_iteration_number = int(iteration_number) + 1
            following_iteration_id = f"iteration-{following_iteration_number}"

            # Wait for the following iteration element to be clickable and click it
            try:
                following_iteration_element = driver.find_element(By.ID, following_iteration_id)
                following_iteration_element.click()
            except:
                pass
        else:
            pass
    else:
        pass

#Loading Element
LOADING = "//div[@class='ks-spin-loading loader-small']"
# Maximum number of attempts to check for the element's appearance or disappearance
MAX_ATTEMPTS = 20  # Adjusted for 0.2-second intervals

# Function to check if the element is visible
def is_element_visible(driver, xpath):
    elements = driver.find_elements(By.XPATH, xpath)
    return len(elements) > 0

# Main script logic
def handle_loading_element(driver, LOADING):
    while True:
        try:
            # Initialize the counter
            attempts = 0

            # Continuously check for the element's appearance at 0.2-second intervals
            while not is_element_visible(driver, LOADING):
                time.sleep(0.2)  # Updated interval
                attempts += 1

                # If the element is still not present after MAX_ATTEMPTS, break the loop
                if attempts >= MAX_ATTEMPTS:
                    print("Element not detected after maximum attempts.")
                    return

            print("Element detected. Pausing the script...")

            # Reset the counter
            attempts = 0

            # Continuously check for the element's disappearance at 0.2-second intervals
            while is_element_visible(driver, LOADING):
                time.sleep(0.2)  # Updated interval
                attempts += 1

                # If the element is still present after MAX_ATTEMPTS, break the loop
                if attempts >= MAX_ATTEMPTS:
                    print("Element still visible after maximum attempts.")
                    return

            print("Element is gone. Resuming the script...")

        except Exception as e:
            print("An error occurred:", str(e))
            break

# Call the function when the module is imported
print("Current working directory:", os.getcwd())
