from Definitions import *
from Forms import *



start_time = time.time()

Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Wawa_Plus_Form1_4Grade_Gas()
click_following_iteration(driver)

Wawa_Premium_Form1_4Grade_Gas()
click_following_iteration(driver)




Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

Wawa_Plus_Form2_4Grade_Gas()
click_following_iteration(driver)

Wawa_Premium_Form2_4Grade_Gas()
save()



end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 106.36853122711182 seconds