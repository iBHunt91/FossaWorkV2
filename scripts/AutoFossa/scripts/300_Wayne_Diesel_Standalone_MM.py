from Definitions import *
from Forms import *

start_time = time.time()
end_time = time.time()
execution_time = end_time - start_time


Metered300WayneForm()
click_following_iteration(driver)

Metered300WayneForm()
save()

print(f"Total execution time: {execution_time} seconds")