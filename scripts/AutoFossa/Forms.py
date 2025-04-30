from Definitions import *


def Metered700Form():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    handle_loading_element(driver, LOADING)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    calibrationretest()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    add_reading()

    slow()
    start()
    procedure()
    slowrun()

def Metered300WayneForm():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    handle_loading_element(driver, LOADING)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    calibrate()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    calibrationretest()
    add_reading()

    fast()
    start()
    procedure()
    retest()
    add_reading()

    slow()
    start()
    procedure()
    slowrun()

def CK_Metered_Form():
    ck_fast()
    send_keys("//div[@id='field-5']//input[@name='field_0']", "0")
    procedure()
    wetdown()
    add_reading()

    ck_fast()
    send_keys("//div[@id='field-5']//input[@name='field_0']", "0")
    procedure()
    firstrun()
    add_reading()

    ck_fast()
    send_keys("//div[@id='field-5']//input[@name='field_0']", "0")
    procedure()
    retest()


def CK_Blend_Form():

    ck_fast()
    send_keys("//div[@id='field-5']//input[@name='field_0']", "0")
    procedure()
    firstrun()

    


#region M+M (PLUS) Gilbarco 300/Wayne - 3 Grade - No Diesel
def Plus300WayneForm1():
        fast()
        start()
        procedure()
        wetdown()
        click_following_iteration(driver)

        fast()
        start()
        procedure()
        firstrun()
        click_following_iteration(driver)

        fast()
        start()
        procedure()
        retest()
        time.sleep(1)   
        delete_item(9)

def Plus300WayneForm2():
        fast()
        start()
        procedure()
        wetdown()
        click_following_iteration(driver)

        fast()
        start()
        procedure()
        firstrun()
        click_following_iteration(driver)

        fast()
        start()
        procedure()
        retest()
        time.sleep(1)   
        delete_item(24)
#endregion

#region MM+ BLEND LAST (PLUS) Gilbarco 300/Wayne - 3 Grade - No Diesel
def Plus300WayneForm1_BlendLast():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(15)

def Plus300WayneForm2_BlendLast():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(30)
#endregion

#region MM+M BLEND LAST (PLUS) Gilbarco 300/Wayne - 3 Grade - with Diesel
def Plus300WayneForm1_BlendLast_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(15)

def Plus300WayneForm2_BlendLast_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(36)
#endregion

#region M+MM (PLUS) Gilbarco 300/Wayne - 3 Grade - With Diesel
def Plus300WayneForm1_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(9)

def Plus300WayneForm2_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(30)
#endregion

#region M++M (PLUS) Gilbarco 300/Wayne - 4 Grade - No Diesel
def Plus300WayneForm1_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(9)

def Additional300WayneBlendForm1_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(12)

def Plus300WayneForm2_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(27)

def Additional300WayneBlendForm2_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(30)
#endregion

#region M++MM (PLUS) Gilbarco 300/Wayne - 4 Grade - With Diesel
def Plus300WayneForm1_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(9)

def Additional300WayneBlendForm1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(12)

def Plus300WayneForm2_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(33)

def Additional300WayneBlendForm2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(36)
#endregion

#region MM++ (PLUS) Gilbarco 300/Wayne - 4 Grade - No Diesel
def PlusLAST700Form1_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(13)

def AdditionalLAST700BlendForm1_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(16)

def PlusLAST700Form2_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(29)

def AdditionalLAST700BlendForm2_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(32)
#endregion

#region MM++M (PLUS) Gilbarco 300/Wayne - 4 Grade - With Diesel
def PlusLAST700Form1_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(13)

def AdditionalLAST700BlendForm1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(16)

def PlusLAST700Form2_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(34)

def AdditionalLAST700BlendForm2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(37)
#endregion

#region M+++M (PLUS) Gilbarco 300/Wayne - 5 Grade - No Diesel
def Plus300WayneForm1_5Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(9)

def Additional300WayneBlendForm1_5Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(12)

def Additional300Wayne2ndBlendForm1_5Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(15)

def Plus300WayneForm2_5Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(30)

def Additional300WayneBlendForm2_5Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(33)

def Additional300Wayne2ndBlendForm2_5Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(36)
#endregion

#region M+++M (PLUS) Gilbarco 300/Wayne - 5 Grade - With Diesel

def Plus300WayneForm1_5Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(9)

def Additional300WayneBlendForm1_5Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(12)

def Additional300Wayne2ndBlendForm1_5Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(15)

def Plus300WayneForm2_5Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(36)

def Additional300WayneBlendForm2_5Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(39)

def Additional300Wayne2ndBlendForm2_5Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(42)
#endregion

#region Mm++ (PLUS) Gilbarco 300/Wayne - 4 Grade - No Diesel
def PlusLAST300WayneForm1_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(15)

def AdditionalLAST300WayneBlendForm1_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(18)

def PlusLAST300WayneForm2_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(33)

def AdditionalLAST300WayneBlendForm2_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(36)
#endregion

#region MM++M (PLUS) Gilbarco 300/Wayne - 4 Grade - With Diesel

def PlusLAST300WayneForm1_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(15)

def AdditionalLAST300WayneBlendForm1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(18)

def PlusLAST300WayneForm2_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(39)

def AdditionalLAST300WayneBlendForm2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(42)
#endregion

#region MM+M (PLUS) Gilbarco 700 - 3 Grade - With Diesel
def Plus700_MMPM_Form1():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(13)

def Plus700_MMPM_Form2():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(31)
#endregion

#region M+M (PLUS) Gilbarco 700 - 3 Grade - No Diesel
def Plus700Form1():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(8)

def Plus700Form2():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(21)
#endregion

#region M++MM (PLUS) Gilbarco 700 - 3 Grade - with Diesel
def Plus700Form1_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(8)

def Plus700Form2_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(26)
#endregion

#region M++MM (PLUS + BLENDS) Gilbarco 700 - 4 Grade - No Diesel
def AdditionalBlendForm1_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(11)

def AdditionalBlendForm2_4Grade():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(27)

def Plus700Form1_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(8)

def Plus700Form2_4Grade():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(24)

#endregion

#region M++MM (PLUS + BLENDS) Gilbarco 700 - 4 Grade - with Diesel

def AdditionalBlendForm1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(11)

#region (PLUS + BLENDS) Gilbarco 700 - 4 Grade - No Diesel

#endregion
def AdditionalBlendForm2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(32)

def Plus700Form1_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(8)

def Plus700Form2_4Grade_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(29)

#endregion

#region MM+ BLEND LAST (PLUS) Gilbarco 700 - 3 Grade - No Diesel 
def Plus700Form1_BlendLast():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(13)

def Plus700Form2_BlendLast():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(26)
#endregion

#region MM+M BLEND LAST (PLUS) Gilbarco 700 - 3 Grade -  with Diesel 

def Plus700Form1_BlendLast_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(18)

def Plus700Form2_BlendLast_wDiesel():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1)   
    delete_item(36)
#endregion

#region (PLUS + BLENDS) WAWA - 4 Grade - with Diesel
def Wawa_Plus_Form1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(12)
    time.sleep(1) 
    delete_item(12)

def Wawa_Premium_Form1_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(14)
    time.sleep(1) 
    delete_item(14)

def Wawa_Plus_Form2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(31)
    time.sleep(1) 
    delete_item(31)

def Wawa_Premium_Form2_4Grade_wDiesel():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(33)
    time.sleep(1) 
    delete_item(33)

#endregion

def CK_Accumeasure_Plus1_3Grade_wDiesel_wEthanol():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(8)#Change iteration


def CK_Accumeasure_Plus2_3Grade_wDiesel_wEthanol():
    fast()
    start()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    retest()
    time.sleep(1) 
    delete_item(31)#Change iteration


#region (PLUS + BLENDS) WAWA - 3 Grade - with Diesel - with Ethanol
def Wawa_Plus_Form1_3Grade_wDiesel_wEthanol():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(12)
    time.sleep(1) 
    delete_item(12)

def Wawa_Plus_Form2_3Grade_wDiesel_wEthanol():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(34)
    time.sleep(1) 
    delete_item(34)
#endregion

#region (PLUS + BLENDS) WAWA - 4 Grade - Gas

def Wawa_Plus_Form1_4Grade_Gas():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(12)
    time.sleep(1) 
    delete_item(12)

def Wawa_Premium_Form1_4Grade_Gas():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(14)
    time.sleep(1) 
    delete_item(14)

def Wawa_Plus_Form2_4Grade_Gas():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(26)
    time.sleep(1) 
    delete_item(26)

def Wawa_Premium_Form2_4Grade_Gas():
    temp()
    fast()
    gpm()
    start()
    meniscus()
    end()
    procedure()
    wetdown()
    click_following_iteration(driver)

    fast()
    start()
    procedure()
    firstrun()
    time.sleep(1) 
    delete_item(28)
    time.sleep(1) 
    delete_item(28)
#endregion
