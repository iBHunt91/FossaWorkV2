from Definitions import *
from Forms import *

start_time = time.time()

Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Plus700_MMPM_Form1()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)



Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Plus700_MMPM_Form2()
click_following_iteration(driver)

Metered700Form()
save()

end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 107.371169090271 seconds