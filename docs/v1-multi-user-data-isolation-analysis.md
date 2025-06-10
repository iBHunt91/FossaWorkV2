# V1 Multi-User Data Isolation System - Complete Analysis

## Overview

The V1 FossaWork system implements a comprehensive multi-user data isolation architecture using MD5-based user IDs and file-system segregation. This document provides a complete technical analysis for translating this system to V2's PostgreSQL database architecture.

## 1. User ID Generation Algorithm

### Core Implementation
```javascript
// Location: V1-Archive-2025-01-07/server/utils/userManager.js:21-23
function getUserId(email) {
  return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
}
```

### Key Characteristics:
- **Algorithm**: MD5 hash of normalized email
- **Input Normalization**: Email converted to lowercase and trimmed
- **Output Format**: 32-character hexadecimal string
- **Examples**:
  - `bruce.hunt@owlservices.com` → `7bea3bdb7e8e303eacaba442bd824004`
  - `robert.hunt@owlservices.com` → `c816bd155f7747524492e431040ad8ce`

### V2 Database Translation:
```sql
-- PostgreSQL equivalent using MD5 function
CREATE OR REPLACE FUNCTION generate_user_id(email_input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN MD5(LOWER(TRIM(email_input)));
END;
$$ LANGUAGE plpgsql;
```

## 2. Directory Structure & Data Isolation

### Base Directory Structure
```
data/
├── settings.json                 # Global settings with activeUserId
├── users/
│   ├── users.json               # Master user list
│   ├── {md5_hash}/             # Individual user directories
│   │   ├── activity_log.json
│   │   ├── prover_preferences.json
│   │   ├── email_settings.json
│   │   ├── pushover_settings.json
│   │   ├── dispenser_store.json
│   │   ├── scraped_content.json
│   │   ├── completed_jobs.json
│   │   ├── schedule_changes.txt
│   │   ├── batch_history.json
│   │   ├── change_history.json
│   │   ├── metadata.json
│   │   ├── archive/             # Historical data
│   │   └── changes_archive/     # Change tracking
│   └── tutorial/               # Tutorial user (special case)
```

### Directory Creation Logic
```javascript
// Location: V1-Archive-2025-01-07/server/utils/userManager.js:26-40
function getUserDir(email) {
  const userId = getUserId(email);
  const userDir = path.join(usersDir, userId);
  
  // Create user directory if it doesn't exist
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    
    // Create subdirectories
    fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
  }
  
  return userDir;
}
```

## 3. User Data Types & Storage Patterns

### 3.1 User Master Record
**File**: `data/users/users.json`
```javascript
{
  "id": "7bea3bdb7e8e303eacaba442bd824004",
  "email": "bruce.hunt@owlservices.com",
  "password": "Crompco0511",              // Stored in plaintext
  "label": "Bruce Hunt",                  // Display name
  "lastUsed": "2025-06-07T02:53:55.405Z",
  "friendlyName": "Bruce",               // Optional short name
  "configuredEmail": "bruce.hunt@owlservices.com", // Notification email
  "notificationSettings": {
    "enabled": true,
    "email": {
      "enabled": true,
      "frequency": "immediate",
      "deliveryTime": "15:40"
    },
    "pushover": {
      "enabled": true
    }
  }
}
```

### 3.2 Prover Preferences
**File**: `{user_id}/prover_preferences.json`
```javascript
{
  "provers": [
    {
      "prover_id": "21-65435-04",
      "serial": "21-65435-04",
      "make": "Seraphin Prover",
      "preferred_fuel_type": "Ethanol-Free Gasoline Plus",
      "preferred_fuel_types": ["Ethanol-Free Gasoline Plus", "Ethanol-Free", "Race Fuel"],
      "priority": 1
    }
  ],
  "workWeekPreference": {
    "startDay": 1,
    "endDay": 5,
    "timezone": "America/New_York",
    "enableRolloverNotifications": true
  }
}
```

### 3.3 Email Settings
**File**: `{user_id}/email_settings.json`
```javascript
{
  "recipientEmail": "bruce.hunt@owlservices.com",
  "showJobId": true,
  "showStoreNumber": true,
  "showStoreName": true,
  "showLocation": true,
  "showDate": true,
  "showDispensers": true,
  "lastUpdated": "2025-06-07T03:08:14.945Z"
}
```

### 3.4 Pushover Settings
**File**: `{user_id}/pushover_settings.json`
```javascript
{
  "appToken": "ayxnbk5eim41c11524492e431040ad8ce",
  "userKey": "u3h8ajytntb1pu3p6qtmpjy6pgaou2",
  "preferences": {
    "showJobId": true,
    "showStoreNumber": true,
    "showStoreName": true,
    "showLocation": true,
    "showDate": true,
    "showDispensers": true,
    "enabled": true
  },
  "lastUpdated": "2025-05-21T01:03:18.800Z"
}
```

### 3.5 Activity Tracking
**File**: `{user_id}/activity_log.json`
```javascript
[
  {
    "userId": "7bea3bdb7e8e303eacaba442bd824004",
    "username": "bruce.hunt@owlservices.com",
    "activityType": "settings_change",
    "timestamp": "2025-06-07T03:07:11.708Z",
    "details": {
      "action": "update_work_week_preference",
      "previousSettings": {...},
      "newSettings": {...},
      "result": "success"
    }
  }
]
```

### 3.6 Dispenser Data Storage
**File**: `{user_id}/dispenser_store.json`
```javascript
{
  "dispenserData": {
    "W-110450": {                    // Work order ID
      "visitId": "VISIT-112351",
      "dispensers": [
        {
          "title": "1/2 - Regular, Plus, Premium, Diesel, Super - Gilbarco",
          "serial": "LCEN328286",
          "make": "",
          "model": "",
          "fields": {
            "Grade": "Regular, Plus, Premium, Diesel, Super",
            "Stand Alone Code": "0128",
            "Number of Nozzles (per side)": "2",
            "Meter Type": "Electronic"
          }
        }
      ]
    }
  }
}
```

## 4. User Switching Mechanisms

### 4.1 Active User Storage
**File**: `data/settings.json`
```javascript
{
  "activeUserId": "7bea3bdb7e8e303eacaba442bd824004"
}
```

### 4.2 User Switching Implementation
```javascript
// Location: V1-Archive-2025-01-07/server/utils/userManager.js:214-307
function setActiveUser(userId) {
  // Read existing settings
  let settings = {};
  if (fs.existsSync(settingsFile)) {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  }
  
  // Update active user
  settings.activeUserId = userId;
  
  // Atomic write with temp file
  const tempFile = `${settingsFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(settings, null, 2), 'utf8');
  fs.renameSync(tempFile, settingsFile);
  
  // Update environment variables
  const user = getUserCredentials(userId);
  if (user) {
    process.env.FOSSA_EMAIL = user.email;
    process.env.FOSSA_PASSWORD = user.password;
  }
  
  // Update last used timestamp
  updateUserLastUsed(userId);
  
  return true;
}
```

### 4.3 File Path Resolution
```javascript
// Location: V1-Archive-2025-01-07/server/utils/userManager.js:310-333
function resolveUserFilePath(relativePath, userId) {
  // If userId is not provided, use the active user
  const activeUserId = userId || getActiveUser();
  
  // If no active user, fallback to root data directory
  if (!activeUserId) {
    return path.join(projectRoot, 'data', relativePath);
  }
  
  // Create user-specific path
  const userDir = path.join(usersDir, activeUserId);
  
  // Ensure the user directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    fs.mkdirSync(path.join(userDir, 'archive'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'changes_archive'), { recursive: true });
  }
  
  return path.join(userDir, relativePath);
}
```

## 5. Session Management & Persistence

### 5.1 Session Context
```javascript
// Environment variables updated per user switch
process.env.FOSSA_EMAIL = activeUser.email;
process.env.FOSSA_PASSWORD = activeUser.password;

// Global cache clearing
global.userDataCache = {};
global.activeUserId = userId;
```

### 5.2 Last Used Tracking
```javascript
// Location: V1-Archive-2025-01-07/server/utils/userManager.js:112-125
function updateUserLastUsed(userId) {
  const users = listUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex].lastUsed = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(usersDir, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
  }
}
```

## 6. Tutorial User Implementation

### 6.1 Special Tutorial User
- **Directory**: `data/users/tutorial/`
- **Purpose**: Demo account with pre-configured data
- **Characteristics**: 
  - No actual credentials needed
  - Pre-populated example data
  - Separate from MD5-hashed users

## 7. User Data Migration Patterns

### 7.1 Archive Conversion (Removed Feature)
Original system had archive conversion utilities but were deprecated:
```javascript
// Placeholder functions in V1-Archive-2025-01-07/scripts/data_management/convert-user-archives.js
export async function convertUserArchives(userId) {
  return {
    success: false,
    message: "Archive conversion functionality has been removed"
  };
}
```

### 7.2 Change History Tracking
**File**: `{user_id}/change_history.json`
- Tracks all modifications to user data
- Includes before/after snapshots
- Timestamped entries with user context

## 8. V2 Database Translation Strategy

### 8.1 Core Tables

```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT generate_user_id(email), -- MD5 hash
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- Use bcrypt instead of plaintext
    label TEXT,
    friendly_name TEXT,
    configured_email TEXT,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions/active user tracking
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_active_user UNIQUE (is_active) DEFERRABLE INITIALLY DEFERRED
);

-- User preferences (replaces multiple JSON files)
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'email', 'pushover', 'prover', 'work_week'
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

-- Activity log
CREATE TABLE user_activities (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispenser data (per user)
CREATE TABLE user_dispenser_data (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    work_order_id TEXT NOT NULL,
    visit_id TEXT,
    dispenser_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, work_order_id)
);

-- Scraped content (per user)
CREATE TABLE user_scraped_content (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'dispenser', 'work_order', etc.
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 API Endpoints Translation

```typescript
// V2 User Management API Endpoints
interface UserAPI {
    // Core user management
    GET    /api/users                     // List all users
    POST   /api/users                     // Create user
    GET    /api/users/{id}                // Get user details
    PUT    /api/users/{id}                // Update user
    DELETE /api/users/{id}                // Delete user
    
    // Session management
    GET    /api/users/active              // Get active user
    POST   /api/users/active              // Set active user
    
    // User preferences
    GET    /api/users/{id}/preferences/{category}
    PUT    /api/users/{id}/preferences/{category}
    
    // User data
    GET    /api/users/{id}/dispenser-data
    POST   /api/users/{id}/dispenser-data
    GET    /api/users/{id}/activities
    POST   /api/users/{id}/activities
    
    // Credential verification
    POST   /api/users/verify-credentials
}
```

### 8.3 Migration Functions

```typescript
// Migration utility to convert V1 file structure to V2 database
interface V1MigrationService {
    migrateUser(userId: string): Promise<void>;
    migrateUserPreferences(userId: string): Promise<void>;
    migrateUserActivities(userId: string): Promise<void>;
    migrateDispenserData(userId: string): Promise<void>;
    validateMigration(userId: string): Promise<boolean>;
}
```

## 9. Security Considerations

### 9.1 V1 Security Issues
- **Plaintext passwords** stored in `users.json`
- **Credentials exposed** in archive files
- **No encryption** for sensitive data

### 9.2 V2 Security Improvements
```sql
-- Password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;
```

## 10. Implementation Priority

### Phase 1: Core User Management
1. User table with MD5 ID generation
2. Active user session management
3. Basic CRUD operations

### Phase 2: Preferences & Settings
1. User preferences table with JSONB storage
2. Migration of email/pushover settings
3. Work week preferences

### Phase 3: Data Isolation
1. User-specific dispenser data
2. Activity tracking
3. Scraped content isolation

### Phase 4: Migration Tools
1. V1 to V2 data migration scripts
2. Validation and testing utilities
3. Rollback mechanisms

This comprehensive analysis provides all the necessary implementation patterns to recreate the V1 multi-user data isolation system in the V2 PostgreSQL-based architecture while improving security and maintainability.