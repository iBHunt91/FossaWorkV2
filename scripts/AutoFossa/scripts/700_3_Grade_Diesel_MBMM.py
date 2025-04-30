from Definitions import *
from Forms import *


start_time = time.time()

Metered700Form()
click_following_iteration(driver)

Plus700Form1_wDiesel()
click_following_iteration(driver) 

Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Plus700Form2_wDiesel()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Metered700Form()
save()

end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 120.9679536819458 seconds