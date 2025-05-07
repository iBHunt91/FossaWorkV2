# Application Architecture Overview

## High-Level Overview

The application is a desktop tool built with Electron and React, designed to automate and monitor tasks related to "work orders," likely in a system called "Fossa."

**Core Functionalities:**

*   **Work Order Monitoring:**
    *   Periodically scrapes work order information from "Fossa" using a headless browser (Playwright).
    *   Compares new scrapes with previous ones to detect changes (added, removed, replaced, date-changed jobs).
    *   Categorizes these changes by severity and notifies the user through various channels (email, Pushover, system tray notifications).
*   **Form Automation:**
    *   Provides a UI (likely `FormPrep.tsx`) for users to select work orders.
    *   Automates filling forms related to these work orders, again using Playwright for browser control.
    *   Provides real-time status updates on the automation progress.
*   **User Interface:**
    *   The application features a modern UI with sections like a Dashboard, Form Preparation, Automation Controls, History, and Settings.
    *   Includes a Toast Notification system for providing feedback to the user.

**Key Technical Components:**

*   **Electron:** Serves as the main application shell, managing background processes and native OS interactions (like system tray).
*   **React:** Used for building the user interface.
*   **Playwright:** Powers the browser automation for both scraping work orders and filling forms.
*   **IPC (Inter-Process Communication):** Facilitates communication between the React frontend and Electron's main/background processes.
*   **Server Component (`server/server.js`):** Seems to handle backend logic, API endpoints, and coordination of monitoring tasks.

## Mermaid Diagram

```mermaid
graph TD
    %% External Systems & Data
    External_Fossa[(Fossa System)]
    User((User))
    ProverPrefsJson[("data/prover_preferences.json")]
    WorkOrderTs[("src/types/workOrder.ts")]

    subgraph UserInterface [User Interface (React)]
        direction TB
        UI_Dashboard[Dashboard]
        
        subgraph FormPrepModule [Form Preparation & Automation UI]
            direction TB
            UI_FormPrep[FormPrep.tsx (UI for Work Order Selection & Status)]
            Hook_UseFormAutomation[useFormAutomation.ts (React Hook)]
        end

        UI_AutoFossa[Auto Fossa Controls]
        UI_History[History]
        UI_Settings[Settings]

        subgraph ToastNotificationSystemUI [Toast Notification System (UI)]
            direction TB
            Hook_UseToastNotification[useToastNotification.ts]
            ToastContext[ToastContext.tsx (Manages Toast State)]
            ToastComponent[Toast Components (Render UI)]
        end
        
        UI_Dashboard -- Loads Data From --> BS_Server
        UI_FormPrep -- Selects Work Orders & Views Status --> Hook_UseFormAutomation
        Hook_UseFormAutomation -- Sends Commands/Receives Status via IPC --> EM_IPC_Automation
        Hook_UseFormAutomation -- Uses --> WorkOrderTs
        
        %% Any component can use toasts
        UserInterface -- Triggers Notifications --> Hook_UseToastNotification
        Hook_UseToastNotification -- Interacts With --> ToastContext
        ToastContext -- Manages & Updates --> ToastComponent
    end

    subgraph ElectronMainProcess [Electron Main Process (electron/main.js)]
        direction TB
        EM_Lifecycle[App Lifecycle Management]
        EM_SystemTray[System Tray Icon & Menu]
        EM_IPC_Automation[IPC for Automation (electron/ipc/automationIpc.js)]
        EM_IPC_General[General IPC Host]
        EM_Scheduler[Scheduled Task Runner (for Monitoring)]
        
        EM_Lifecycle -- Initializes --> UserInterface
        EM_Lifecycle -- Manages --> BS_Server
        EM_Scheduler -- Triggers --> MS_Scraper
        EM_SystemTray -- Shows System Notifications from --> MS_Notifier_SystemTray
    end

    subgraph BackendServices [Backend Services & Automation Logic]
        direction TB
        BS_Server[Server Component (server/server.js - API, Coordination, Credentials)]
        
        subgraph MonitoringSystem [Work Order Monitoring System]
            direction TB
            MS_Scraper[Automated Scraper (scripts/automated_scrape.js - Playwright)]
            MS_DataManager[Data Manager (scripts/utils/dataManager.js - Handles Schedule Files)]
            MS_Comparator[Schedule Comparator (scripts/utils/scheduleComparator.js)]
            
            subgraph NotificationService [Notification Service (scripts/notifications/notificationService.js)]
                direction TB
                MS_Notifier_Email[Email Service (scripts/email/emailService.js)]
                MS_Notifier_Pushover[Pushover Service (scripts/notifications/pushoverService.js)]
                MS_Notifier_SystemTray[System Tray Notification Logic]
            end
        end

        subgraph FormAutomationSystem [Form Automation Engine]
            direction TB
            FAS_Service[Form Service (src/services/formService.ts - Backend Logic)]
            FAS_BrowserHandler[Browser Handler (electron/automation/browserHandler.js - Playwright)]
            FAS_StatusMonitor[Status Monitoring & Timeout Detection]
            FAS_ProverInfo[Prover Info Utility (scripts/utils/prover_info.js)]
        end
        
        Util_Logger[Logger (scripts/utils/logger.js)]
        Util_Backup[Backup System (scripts/backup.js)]
    end

    %% Form Automation Flow
    EM_IPC_Automation -- Sends Automation Commands --> FAS_Service
    FAS_Service -- Interacts With --> FAS_BrowserHandler
    FAS_Service -- Uses --> WorkOrderTs
    FAS_Service -- Uses --> FAS_ProverInfo
    FAS_ProverInfo -- Reads --> ProverPrefsJson
    FAS_BrowserHandler -- Controls Browser for Form Filling --> External_Fossa
    FAS_BrowserHandler -- Sends Status Back --> FAS_StatusMonitor
    FAS_StatusMonitor -- Reports Status via IPC --> EM_IPC_Automation
    EM_IPC_Automation -- Forwards Status --> Hook_UseFormAutomation

    %% Monitoring System Flow
    BS_Server -- Coordinates --> MS_Scraper
    BS_Server -- Manages Credentials For --> External_Fossa
    MS_Scraper -- Logs In & Navigates --> External_Fossa
    MS_Scraper -- Extracts Job Info --> MS_DataManager
    MS_DataManager -- Provides Current/Previous Schedules --> MS_Comparator
    MS_Comparator -- Generates Change Report --> NotificationService
    NotificationService -- Dispatches Notifications --> MS_Notifier_Email
    NotificationService -- Dispatches Notifications --> MS_Notifier_Pushover
    NotificationService -- Dispatches System Notifications --> MS_Notifier_SystemTray
    
    MS_Notifier_Email -- Sends Email --> User
    MS_Notifier_Pushover -- Sends Pushover Alert --> User
    MS_Notifier_SystemTray -- Shows Notification --> EM_SystemTray

    %% General Connections
    BS_Server -- API for --> UserInterface
    BackendServices -- Uses --> Util_Logger
    BackendServices -- Uses --> Util_Backup

    %% Styling Classes (optional, for better visualization if supported by renderer)
    classDef react fill:#61DAFB,stroke:#333,stroke-width:2px,color:#000;
    classDef electron fill:#9FEAF9,stroke:#333,stroke-width:2px,color:#000;
    classDef services fill:#ECECEC,stroke:#333,stroke-width:2px,color:#000;
    classDef playwright fill:#45B345,stroke:#333,stroke-width:2px,color:#000;
    classDef data fill:#FFF2CC,stroke:#D6B656,stroke-width:2px,color:#000;
    classDef utility fill:#E1D5E7,stroke:#9673A6,stroke-width:2px,color:#000;

    class UserInterface,UI_Dashboard,UI_FormPrep,UI_AutoFossa,UI_History,UI_Settings,ToastNotificationSystemUI,Hook_UseFormAutomation,Hook_UseToastNotification,ToastContext,ToastComponent react;
    class ElectronMainProcess,EM_Lifecycle,EM_SystemTray,EM_IPC_Automation,EM_IPC_General,EM_Scheduler electron;
    class BackendServices,BS_Server,MonitoringSystem,FormAutomationSystem,FAS_StatusMonitor,NotificationService,MS_Notifier_Email,MS_Notifier_Pushover,MS_Notifier_SystemTray, FAS_Service services;
    class MS_Scraper,FAS_BrowserHandler playwright;
    class ProverPrefsJson,WorkOrderTs data;
    class MS_DataManager,MS_Comparator,FAS_ProverInfo,Util_Logger,Util_Backup utility;
end
``` 