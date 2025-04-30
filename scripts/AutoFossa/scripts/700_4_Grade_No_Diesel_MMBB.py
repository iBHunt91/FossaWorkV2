from Definitions import *
from Forms import *

start_time = time.time()

Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

PlusLAST700Form1_4Grade()
click_following_iteration(driver)

AdditionalLAST700BlendForm1_4Grade()
click_following_iteration(driver)



Metered700Form()
click_following_iteration(driver)

Metered700Form()
click_following_iteration(driver)

PlusLAST700Form2_4Grade()
click_following_iteration(driver)  

AdditionalLAST700BlendForm2_4Grade()
save()



end_time = time.time()
execution_time = end_time - start_time

print(f"Total execution time: {execution_time} seconds")

#Total execution time: 147.5742268562317 seconds