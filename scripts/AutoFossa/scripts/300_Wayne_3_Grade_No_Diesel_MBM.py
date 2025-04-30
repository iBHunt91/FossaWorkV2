from Definitions import *
from Forms import *

start_time = time.time()

Metered300WayneForm()
click_following_iteration(driver)

Plus300WayneForm1()
click_following_iteration(driver)

Metered300WayneForm()
click_following_iteration(driver)

Metered300WayneForm()
click_following_iteration(driver)

Plus300WayneForm2()
click_following_iteration(driver)   

Metered300WayneForm()
save()



end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 84.98418140411377 seconds