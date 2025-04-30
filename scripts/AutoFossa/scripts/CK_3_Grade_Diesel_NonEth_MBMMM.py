from Definitions import *
from Forms import *

start_time = time.time()

CK_Metered_Form()
click_following_iteration(driver)

CK_Blend_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Blend_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Metered_Form()
click_following_iteration(driver)

CK_Metered_Form()
save()



end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 76.16286873817444 seconds