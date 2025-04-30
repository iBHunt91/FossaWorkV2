from Definitions import *
from Forms import *

start_time = time.time()

Metered300WayneForm()
click_following_iteration(driver)

Plus300WayneForm1_5Grade_wDiesel()
click_following_iteration(driver)

Additional300WayneBlendForm1_5Grade_wDiesel()
click_following_iteration(driver)

Additional300Wayne2ndBlendForm1_5Grade_wDiesel()
click_following_iteration(driver)

Metered300WayneForm()
click_following_iteration(driver)

Metered300WayneForm()
click_following_iteration(driver)




Metered300WayneForm()
click_following_iteration(driver)

Plus300WayneForm2_5Grade_wDiesel()
click_following_iteration(driver)  

Additional300WayneBlendForm2_5Grade_wDiesel()
click_following_iteration(driver)

Additional300Wayne2ndBlendForm2_5Grade_wDiesel()
click_following_iteration(driver)

Metered300WayneForm()
click_following_iteration(driver)

Metered300WayneForm()
save()



end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 177.6878137588501 seconds