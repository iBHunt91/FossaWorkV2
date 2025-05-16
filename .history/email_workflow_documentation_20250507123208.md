# Email Notification Workflow Documentation

This document outlines the entire workflow for how email notifications for schedule changes are configured, processed, and sent to the user.

## 1. User Configures Email Notifications (Frontend - Client-Side)

*   **Files Involved**:
    *   `src/pages/Settings.tsx`: Main settings page component.
    *   `src/components/NotificationSettings.tsx`: Handles tabs for different notification types (Email, Pushover).
    *   `src/components/EmailSettings.tsx`: The UI component where users interact with email-specific settings.
*   **User Actions**:
    1.  The user navigates to the "Settings" page within the application.
    2.  They select the "Email Notifications" tab.
    3.  In the `EmailSettings` component, the user inputs:
        *   Their desired **Recipient Email Address**.
        *   Notification **Frequency**:
            *   "Immediate": Alerts are sent as soon as changes are detected.
            *   "Daily Digest": Alerts are aggregated and sent once a day at a specified **Delivery Time**.
        *   **Job Information to Display**: Toggles for which details of a work order to include in the email (e.g., Job ID, Store Number, Store Name, Location, Date, Dispensers).
    4.  The user saves these preferences.
*   **Data Flow & Storage**:
    *   The frontend sends the saved preferences to the backend (likely via an IPC call to a dedicated API endpoint).
    *   The backend saves these user-specific settings into: `data/users/<user-id>/email_settings.json`.
        *   Example content: `{"recipientEmail": "user@example.com", "showJobId": true, "frequency": "daily", "deliveryTime": "08:00", ...}`

## 2. Global Sender Configuration (Backend/Data - Manual or Admin Setup)

*   **Files Involved**:
    *   `data/email-settings.json`: Contains **default/fallback global sender credentials** and SMTP settings. This includes SMTP server address, port, authentication username (sender's email), authentication password (e.g., Gmail App Password), and sender's display name.
        *   This is the file initially provided by the user: `{"senderName": "Fossa Monitor", "senderEmail": "fossamonitor@gmail.com", ...}`
    *   `data/user-settings.json`: This file can **override** the global settings in `data/email-settings.json` if it contains an `email` object with the sender's SMTP details.
    *   `scripts/email/emailSettings.js`: Contains the `updateEmailSettings(settings)` function, which writes to `data/user-settings.json`.
*   **Action**:
    *   An administrator or an initial setup process configures the application's email sending capabilities.
    *   This involves providing valid SMTP server details and credentials that the application will use to send emails *from*.
    *   This configuration might be done by:
        *   Manually editing `data/email-settings.json` (if `data/user-settings.json` doesn't override it).
        *   Using an (unseen in this trace) admin UI or script that calls `updateEmailSettings` to populate `data/user-settings.json`.
*   **Key Data Points**: Sender's email address, sender's name, SMTP server, SMTP port, SMTP username, SMTP password (app password).

## 3. Schedule Monitoring and Change Detection (Backend - Server-Side)

*   **Files Involved**:
    *   `electron/main.js`: The main Electron process, responsible for scheduling recurring tasks.
    *   `server/server.js`: The backend server that coordinates various operations, including loading the active user's Fossa credentials (for logging into the Fossa platform, *not* email credentials).
    *   `scripts/automated_scrape.js`: This script performs the actual scraping of work order data.
    *   `scripts/utils/scheduleComparator.js`: Compares newly scraped data with previously stored data to find differences.
*   **Process**:
    1.  A scheduled task (e.g., running hourly, configured in `electron/main.js`) initiates the schedule monitoring process for the currently active user.
    2.  `server/server.js` ensures the correct Fossa credentials for the active user are available.
    3.  `scripts/automated_scrape.js` is executed. It:
        *   Logs into the Fossa work order platform using the active user's Fossa credentials.
        *   Navigates to the schedule/work order list.
        *   Extracts all relevant job information.
        *   Saves this raw scraped data to the user-specific file: `data/users/<user-id>/scraped_content.json`.
    4.  `scripts/utils/scheduleComparator.js` is then run. It:
        *   Reads the newly saved `scraped_content.json`.
        *   Reads the version of `scraped_content.json` from the *previous* scrape for that user.
        *   Compares the two datasets to identify:
            *   Added jobs
            *   Removed jobs
            *   Modified jobs (e.g., date changes, swapped jobs)
        *   Generates a structured `changes` object detailing all discrepancies.

## 4. Notification Orchestration (Backend - Server-Side)

*   **File Involved**: `scripts/notifications/notificationService.js`
*   **Key Function**: `sendScheduleChangeNotifications(changes, specificUser = null, ...)`
*   **Process**:
    1.  The `sendScheduleChangeNotifications` function is called, typically with the `changes` object generated by `scheduleComparator.js`.
    2.  **Identify Target Users**:
        *   If `specificUser` is provided, only that user is processed.
        *   Otherwise, it calls `getUsersWithNotificationsEnabled()` (a helper likely reading `data/users.json` and checking individual user notification flags) to get a list of all users who have opted into notifications.
    3.  **Process Each User**: For every user targeted for notification:
        *   **Load User-Specific Settings**:
            *   It retrieves the user's notification preferences (recipient email, content display choices like `showJobId`, `showStoreName`) primarily from `data/users/<user-id>/email_settings.json`. This is often done via helper functions like `getUserNotificationSettings` (from `scripts/user/userService.js`).
            *   It also fetches the user's general notification settings (e.g., email channel `enabled` status, `frequency`) from the same source.
        *   **Load Global Sender Settings**:
            *   It calls `getUserEmailSettings()` (from `scripts/notifications/emailService.js`). This function reads `data/user-settings.json` first, and if no email sender config is found there, it falls back to `data/email-settings.json` to get the SMTP server details and sender credentials.
        *   **Filter Changes**: It calls `filterChangesForUser(changes, userPreferences)` to tailor the raw `changes` object based on what information the specific user wants to see in their notifications.
        *   **Handle Notification Frequency**: It calls `processNotificationByFrequency()` (from `scripts/notifications/notificationScheduler.js`), passing:
            *   The `filteredChanges`.
            *   The `completeUser` object (containing their recipient email, display preferences, and frequency setting).
            *   A reference to the `sendScheduleChangeEmail` function (from `emailService.js`).

## 5. Email Composition and Sending (Backend - Server-Side)

*   **Files Involved**:
    *   `scripts/notifications/notificationScheduler.js`: Manages *when* notifications are sent based on user preferences.
    *   `scripts/notifications/emailService.js`: Handles the actual email creation and dispatch.
*   **Process**:
    1.  **Scheduling (`notificationScheduler.js`)**:
        *   The `processNotificationByFrequency` function checks the user's `frequency` setting:
            *   If "immediate": It directly calls the `sendScheduleChangeEmail` function passed to it, using the current `filteredChanges` and `completeUser` object.
            *   If "daily": It likely queues the `filteredChanges` for the user. A separate scheduled job (or logic within the scheduler) will later aggregate all changes for that user since the last digest and then call `sendScheduleChangeEmail` at the user's specified `deliveryTime`.
    2.  **Email Generation (`emailService.js` - `sendScheduleChangeEmail` function)**:
        *   This function receives the (potentially filtered and/or aggregated) `changes` and the `completeUser` object.
        *   It dynamically constructs the HTML body of the email.
        *   The content of the email is customized based on the `completeUser.preferences` (e.g., if `showJobId` is true, the Job ID is included for each relevant change).
        *   It then calls the lower-level `sendEmail(options)` function within the same `emailService.js` file.
    3.  **Email Dispatch (`emailService.js` - `sendEmail` function)**:
        *   **`options` argument includes**:
            *   `to`: The `completeUser.email` (the recipient's email address).
            *   `subject`: A relevant subject line for the schedule change notification.
            *   `html`: The fully constructed HTML email body.
        *   It uses the global sender credentials and SMTP settings (obtained earlier via `getUserEmailSettings()`) to configure a `nodemailer` transporter object.
        *   The `from` address is set using the configured sender name and email.
        *   The `nodemailer` transporter sends the email to the recipient via the specified SMTP server.

## 6. User Receives Email Notification (User's Email Client)

*   **Outcome**: The user receives an email in their inbox.
*   **Content**: The email contains details of the detected schedule changes, formatted and filtered according to the preferences they set up in Step 1.
*   **Spam/Junk**: The UI (`EmailSettings.tsx`) and documentation (`docs/technical.md`) remind users to check their spam/junk folders and whitelist the sender's email address, especially when first setting up notifications.

This workflow ensures that users receive timely and relevant email notifications about changes to their work schedules, with control over what information they see and how frequently they receive updates. 