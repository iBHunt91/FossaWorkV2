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
    subgraph UserInterface [User Interface (React)]
        direction LR
        UI_Dashboard[Dashboard]
        UI_FormPrep[Form Prep (FormPrep.tsx)]
        UI_AutoFossa[Auto Fossa Controls]
        UI_History[History]
        UI_Settings[Settings]
        UI_Toast[Toast Notification System]
    end

    subgraph ElectronMainProcess [Electron Main Process]
        direction TB
        EM_Lifecycle[App Lifecycle]
        EM_SystemTray[System Tray]
        EM_IPC_Host[IPC Host]
        EM_Scheduler[Task Scheduler]
    end

    subgraph BackendServices [Backend Services & Automation]
        direction TB
        BS_Server[Server Component (server/server.js)]
        
        subgraph MonitoringSystem [Monitoring System]
            direction TB
            MS_Scraper[Automated Scraper (Playwright, scripts/automated_scrape.js)]
            MS_Comparator[Schedule Comparator (scripts/utils/scheduleComparator.js)]
            MS_Notifier[Notification Service (scripts/notifications/notificationService.js)]
            subgraph NotificationChannels [Notification Channels]
                direction LR
                NC_Email[Email]
                NC_Pushover[Pushover]
                NC_SystemTray[System Tray Notifier]
            end
        end

        subgraph FormAutomationSystem [Form Automation System]
            direction TB
            FA_BrowserEngine[Browser Automation Engine (Playwright, electron/automation/browserHandler.js)]
            FA_StatusMonitor[Status Monitoring]
        end
    end

    %% UI Interactions
    UI_FormPrep -- Automation Commands --> EM_IPC_Host
    EM_IPC_Host -- Automation Commands --> FA_BrowserEngine
    FA_BrowserEngine -- Status Updates --> EM_IPC_Host
    EM_IPC_Host -- Status Updates --> UI_FormPrep
    FA_StatusMonitor -- Updates --> UI_FormPrep

    UI_Dashboard -- Views Data From --> BS_Server
    UI_Settings -- Configures --> BS_Server
    UI_Toast -- Shows Notifications For --> UserInterface


    %% Backend Interactions
    EM_Lifecycle -- Manages --> BS_Server
    EM_Scheduler -- Triggers --> MS_Scraper

    BS_Server -- Coordinates --> MonitoringSystem
    BS_Server -- Stores/Retrieves Credentials --> External_Fossa[(Fossa System)]
    
    MS_Scraper -- Scrapes Data From --> External_Fossa
    MS_Scraper -- Raw Data --> MS_Comparator
    MS_Comparator -- Change Report --> MS_Notifier
    MS_Notifier -- Triggers --> NotificationChannels
    NotificationChannels -- Alerts --> User((User))
    
    %% Electron Main to Backend/UI
    EM_IPC_Host -- Relays Comms --> BS_Server
    EM_SystemTray -- Interacts With --> MS_Notifier % For local system tray notifications

    %% Form Automation Flow
    UI_FormPrep -- User Selects Work Order --> FA_BrowserEngine
    FA_BrowserEngine -- Fills Forms In --> External_Fossa

    classDef react fill:#61DAFB,stroke:#333,stroke-width:2px,color:#000;
    classDef electron fill:#9FEAF9,stroke:#333,stroke-width:2px,color:#000;
    classDef services fill:#ECECEC,stroke:#333,stroke-width:2px,color:#000;
    classDef playwright fill:#45B345,stroke:#333,stroke-width:2px,color:#000;

    class UserInterface,UI_Dashboard,UI_FormPrep,UI_AutoFossa,UI_History,UI_Settings,UI_Toast react;
    class ElectronMainProcess,EM_Lifecycle,EM_SystemTray,EM_IPC_Host,EM_Scheduler electron;
    class BackendServices,BS_Server,MonitoringSystem,FormAutomationSystem,FA_StatusMonitor services;
    class MS_Scraper,FA_BrowserEngine playwright;
    class NotificationChannels,NC_Email,NC_Pushover,NC_SystemTray services;


end
``` 