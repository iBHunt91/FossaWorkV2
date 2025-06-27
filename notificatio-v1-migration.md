# Complete Notification System Migration Plan: v1 to v2

## Executive Summary

This comprehensive plan consolidates all aspects of migrating email and pushover notifications from Fossa Monitor v1 to v2. It incorporates user data migration, system integration, frontend updates, and operational procedures into a single authoritative guide.

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Migration Timeline](#3-migration-timeline)
4. [Phase 1: Foundation & Data Migration](#4-phase-1-foundation--data-migration)
5. [Phase 2: Core Backend Services](#5-phase-2-core-backend-services)
6. [Phase 3: Frontend Migration](#6-phase-3-frontend-migration)
7. [Phase 4: System Integration](#7-phase-4-system-integration)
8. [Phase 5: Testing & Validation](#8-phase-5-testing--validation)
9. [Phase 6: Deployment & Monitoring](#9-phase-6-deployment--monitoring)
10. [Rollback Procedures](#10-rollback-procedures)
11. [Post-Migration Activities](#11-post-migration-activities)

---

## 1. Current State Analysis

### 1.1 v1 Architecture Overview

#### File Structure
```
scripts/notifications/
├── notificationService.js      # Main coordinator
├── emailService.js            # Email handling (Gmail SMTP)
├── pushoverService.js         # Pushover API integration
├── notificationScheduler.js   # Daily digest scheduling
└── formatService.js           # Basic formatting

scripts/utils/
├── notificationFormatter.js   # Enhanced formatting
├── analyzeScheduleChanges.js  # Change detection
└── scheduleComparator.js      # Schedule comparison

server/routes/
├── settings.js               # Notification endpoints
└── api.js                    # Main API routes

src/components/
├── NotificationSettings.tsx   # Main settings UI
├── EmailSettings.tsx         # Email configuration
└── PushoverSettings.jsx      # Pushover configuration

data/
├── email-settings.json       # Global email config
└── users/{userId}/
    ├── email_settings.json   # User email preferences
    ├── pushover_settings.json # Pushover credentials
    └── notification_digests/  # Daily digest storage
```

#### Current Features
1. **Email Notifications**
   - Gmail SMTP integration
   - HTML email templates
   - Immediate and daily digest modes
   - Custom display preferences
   - Google Maps integration

2. **Pushover Notifications**
   - API integration with user/app tokens
   - Message batching for size limits
   - Priority levels and sounds
   - Open Client integration for job automation
   - HTML formatting support

3. **Multi-User Support**
   - Per-user notification settings
   - Store/location filtering
   - Severity-based filtering
   - Independent delivery preferences

4. **Change Detection**
   - Schedule change analysis
   - 5 change types: added, removed, modified, swapped, replaced
   - Manual vs automatic scrape logic
   - Cooldown periods to prevent spam

### 1.2 Critical Issues

#### Security Vulnerabilities
- **Hardcoded Credentials**: Email password in code
- **Plain Text Storage**: All credentials unencrypted
- **No API Authentication**: Endpoints exposed
- **No Rate Limiting**: Potential for abuse

#### Technical Debt
- **Mixed JavaScript/TypeScript**: Inconsistent codebase
- **Synchronous Operations**: Performance bottlenecks
- **No Error Recovery**: Failed notifications lost
- **Limited Testing**: Minimal test coverage

#### User Experience Gaps
- **No Desktop Notifications**: Missing native alerts
- **Limited Customization**: Fixed templates
- **No Delivery Tracking**: Unknown if notifications received
- **No Real-time Updates**: Status not synchronized

### 1.3 Data Structures

#### Email Settings (v1)
```json
{
  "recipientEmail": "user@example.com",
  "enabled": true,
  "frequency": "immediate",
  "deliveryTime": "18:00",
  "showJobId": true,
  "showStoreNumber": true,
  "showStoreName": true,
  "showLocation": true,
  "showDate": true,
  "showDispensers": true
}
```

#### Pushover Settings (v1)
```json
{
  "appToken": "azGDORePK8gMaC0QOYAMyEEuzJnyUi",
  "userKey": "uQiRzpo4DXghDmr9QzzfQu27cmVRsG",
  "preferences": {
    "showJobId": true,
    "showStoreNumber": true,
    "showStoreName": true,
    "showLocation": true,
    "showDate": true,
    "showDispensers": true
  }
}
```

---

## 2. Target Architecture

### 2.1 v2 Architecture Design

```
src/services/notifications/
├── NotificationManager.ts        # Central orchestrator
├── channels/
│   ├── BaseChannel.ts           # Abstract channel interface
│   ├── EmailChannel.ts          # Gmail API integration
│   ├── PushoverChannel.ts       # Enhanced Pushover
│   ├── DesktopChannel.ts        # Electron notifications
│   └── MobileChannel.ts         # Future: mobile support
├── formatters/
│   ├── TemplateEngine.ts        # Central template system
│   ├── ScheduleChangeFormatter.ts
│   ├── AlertFormatter.ts
│   └── DigestFormatter.ts
├── security/
│   ├── CredentialVault.ts       # OS keychain integration
│   ├── TokenManager.ts          # JWT authentication
│   └── EncryptionService.ts     # Data encryption
├── scheduling/
│   ├── NotificationScheduler.ts  # Enhanced scheduling
│   ├── DigestManager.ts         # Digest accumulation
│   └── DeliveryQueue.ts         # Queue management
├── tracking/
│   ├── DeliveryTracker.ts       # Delivery confirmation
│   ├── AnalyticsService.ts      # Usage analytics
│   └── AuditLogger.ts           # Security audit trail
└── integrations/
    ├── WebSocketService.ts       # Real-time updates
    ├── FormAutomationHook.ts     # Form system integration
    └── ScrapingEventHandler.ts   # Scraping triggers
```

### 2.2 Key Improvements

#### Security Enhancements
1. **Credential Management**
   - OS keychain integration (Windows Credential Manager)
   - Encrypted storage with machine-specific keys
   - OAuth2 for Gmail (no more passwords)
   - API key rotation support

2. **Authentication & Authorization**
   - JWT-based API authentication
   - Role-based access control
   - Request signing for webhooks
   - Rate limiting per user/channel

#### Performance Optimizations
1. **Asynchronous Architecture**
   - Promise-based operations
   - Parallel channel delivery
   - Redis queue for reliability
   - Connection pooling

2. **Caching Strategy**
   - Template caching
   - User preference caching
   - Delivery status caching
   - Smart deduplication

#### User Experience Enhancements
1. **Rich Notifications**
   - Desktop notifications with actions
   - Template preview system
   - A/B testing capability
   - Multi-language support

2. **Real-time Features**
   - WebSocket status updates
   - Live delivery tracking
   - Instant preference updates
   - Progress indicators

### 2.3 Data Structures (v2)

#### Unified Notification Settings
```typescript
interface NotificationSettingsV2 {
  version: "2.0";
  lastUpdated: string;
  
  preferences: {
    enabled: boolean;
    frequency: "immediate" | "hourly" | "daily" | "weekly";
    deliveryTime?: string;
    quietHours?: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  
  channels: {
    email: EmailChannelSettings;
    pushover: PushoverChannelSettings;
    desktop: DesktopChannelSettings;
  };
  
  filters: {
    stores: string[];
    locations: string[];
    jobCodes?: string[];
    severityLevels: string[];
  };
  
  templates: {
    language: string;
    customization: Record<string, any>;
  };
}
```

---

## 3. Migration Timeline

### Overview: 16-Week Implementation

```
Week 1-3:   Phase 1 - Foundation & Data Migration
Week 4-6:   Phase 2 - Core Backend Services  
Week 7-9:   Phase 3 - Frontend Migration
Week 10-12: Phase 4 - System Integration
Week 13-14: Phase 5 - Testing & Validation
Week 15-16: Phase 6 - Deployment & Monitoring
```

### Resource Requirements
- **Development Team**: 2-3 full-stack developers
- **DevOps**: 1 engineer for infrastructure
- **QA**: 1 tester for validation
- **Project Manager**: Part-time coordination

---

## 4. Phase 1: Foundation & Data Migration (Weeks 1-3)

### 4.1 Week 1: Security Foundation

#### Task 1.1: Credential Management System
```typescript
// src/services/security/CredentialVault.ts
import { safeStorage } from 'electron';
import crypto from 'crypto';

export class CredentialVault {
  private static instance: CredentialVault;
  private cache: Map<string, string> = new Map();
  
  async store(key: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }
    
    const encrypted = safeStorage.encryptString(value);
    await this.saveToFile(key, encrypted);
    this.cache.set(key, value);
  }
  
  async retrieve(key: string): Promise<string | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const encrypted = await this.loadFromFile(key);
    if (!encrypted) return null;
    
    const decrypted = safeStorage.decryptString(encrypted);
    this.cache.set(key, decrypted);
    return decrypted;
  }
  
  async migrate(oldPath: string): Promise<void> {
    // Migrate existing plain text credentials
    const oldData = await fs.readFile(oldPath, 'utf-8');
    const parsed = JSON.parse(oldData);
    
    for (const [key, value] of Object.entries(parsed)) {
      await this.store(key, value as string);
    }
    
    // Backup old file
    await fs.rename(oldPath, `${oldPath}.migrated`);
  }
}
```

#### Task 1.2: API Authentication
```typescript
// src/services/security/TokenManager.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class TokenManager {
  private secret: string;
  private tokens: Map<string, TokenData> = new Map();
  
  constructor(secret: string) {
    this.secret = secret;
  }
  
  generateToken(userId: string, scope: string[]): string {
    const tokenId = uuidv4();
    const payload = {
      sub: userId,
      jti: tokenId,
      scope,
      iat: Date.now(),
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    const token = jwt.sign(payload, this.secret);
    this.tokens.set(tokenId, { userId, scope, createdAt: new Date() });
    
    return token;
  }
  
  async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      
      if (!this.tokens.has(decoded.jti)) {
        return null;
      }
      
      if (decoded.exp < Date.now()) {
        this.tokens.delete(decoded.jti);
        return null;
      }
      
      return decoded;
    } catch {
      return null;
    }
  }
}
```

### 4.2 Week 2: Data Migration Infrastructure

#### Task 2.1: Migration Scripts
```javascript
// migration/01-assess-and-backup.js
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class MigrationAssessment {
  async run() {
    console.log('🔍 Starting migration assessment...');
    
    const assessment = {
      timestamp: new Date().toISOString(),
      users: [],
      globalSettings: {},
      statistics: {
        totalUsers: 0,
        emailEnabled: 0,
        pushoverEnabled: 0,
        dailyDigestUsers: 0
      }
    };
    
    // Analyze users
    const usersDir = path.join(__dirname, '../data/users');
    const userDirs = await fs.readdir(usersDir);
    
    for (const userId of userDirs) {
      const userPath = path.join(usersDir, userId);
      const userInfo = await this.assessUser(userPath, userId);
      assessment.users.push(userInfo);
      
      // Update statistics
      assessment.statistics.totalUsers++;
      if (userInfo.emailEnabled) assessment.statistics.emailEnabled++;
      if (userInfo.pushoverEnabled) assessment.statistics.pushoverEnabled++;
      if (userInfo.emailFrequency === 'daily') assessment.statistics.dailyDigestUsers++;
    }
    
    // Create backup
    await this.createBackup(assessment);
    
    return assessment;
  }
  
  async assessUser(userPath, userId) {
    const emailSettings = await this.readJsonSafe(
      path.join(userPath, 'email_settings.json')
    );
    const pushoverSettings = await this.readJsonSafe(
      path.join(userPath, 'pushover_settings.json')
    );
    
    return {
      userId,
      emailEnabled: emailSettings?.enabled || false,
      emailFrequency: emailSettings?.frequency || 'immediate',
      pushoverEnabled: !!pushoverSettings?.userKey,
      hasDigestData: await fs.pathExists(
        path.join(userPath, '../notification-digests', `${userId}-digest.json`)
      )
    };
  }
  
  async createBackup(assessment) {
    const backupDir = path.join(__dirname, '../backups', 
      `notification-migration-${Date.now()}`);
    await fs.ensureDir(backupDir);
    
    // Copy all notification-related data
    await fs.copy(
      path.join(__dirname, '../data'),
      path.join(backupDir, 'data')
    );
    
    // Save assessment
    await fs.writeJson(
      path.join(backupDir, 'assessment.json'),
      assessment,
      { spaces: 2 }
    );
    
    // Create checksum
    const checksum = await this.createChecksum(backupDir);
    await fs.writeFile(
      path.join(backupDir, 'checksum.txt'),
      checksum
    );
    
    console.log(`✅ Backup created: ${backupDir}`);
  }
}
```

#### Task 2.2: User Data Migration
```javascript
// migration/03-migrate-user-data.js
class UserDataMigration {
  async migrateUser(userId) {
    console.log(`📦 Migrating user: ${userId}`);
    
    const userPath = path.join(__dirname, '../data/users', userId);
    const v1Email = await this.readJsonSafe(
      path.join(userPath, 'email_settings.json')
    );
    const v1Pushover = await this.readJsonSafe(
      path.join(userPath, 'pushover_settings.json')
    );
    
    // Create v2 structure
    const v2Settings = {
      version: "2.0",
      lastUpdated: new Date().toISOString(),
      
      preferences: {
        enabled: v1Email?.enabled || false,
        frequency: v1Email?.frequency || "immediate",
        deliveryTime: v1Email?.deliveryTime,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00"
        }
      },
      
      channels: {
        email: {
          enabled: v1Email?.enabled || false,
          recipientEmail: v1Email?.recipientEmail || "",
          displayOptions: {
            showJobId: v1Email?.showJobId ?? true,
            showStoreNumber: v1Email?.showStoreNumber ?? true,
            showStoreName: v1Email?.showStoreName ?? true,
            showLocation: v1Email?.showLocation ?? true,
            showDate: v1Email?.showDate ?? true,
            showDispensers: v1Email?.showDispensers ?? true,
            showInstructionsPreview: false,
            includeMapLink: true
          }
        },
        
        pushover: {
          enabled: !!v1Pushover?.userKey,
          appToken: v1Pushover?.appToken || "",
          userKey: v1Pushover?.userKey || "",
          priority: "normal",
          sound: "pushover",
          displayOptions: v1Pushover?.preferences || {}
        },
        
        desktop: {
          enabled: true,
          sound: true,
          persistent: false
        }
      },
      
      filters: {
        stores: [],
        locations: [],
        severityLevels: ["high", "medium", "low"]
      },
      
      templates: {
        language: "en",
        customization: {}
      }
    };
    
    // Save v2 settings
    await fs.writeJson(
      path.join(userPath, 'notification_settings_v2.json'),
      v2Settings,
      { spaces: 2 }
    );
    
    // Rename old files
    if (v1Email) {
      await fs.rename(
        path.join(userPath, 'email_settings.json'),
        path.join(userPath, 'email_settings.json.v1_backup')
      );
    }
    
    if (v1Pushover) {
      await fs.rename(
        path.join(userPath, 'pushover_settings.json'),
        path.join(userPath, 'pushover_settings.json.v1_backup')
      );
    }
    
    // Migrate digest data
    await this.migrateDigestData(userId);
    
    console.log(`✅ User ${userId} migrated successfully`);
  }
  
  async migrateDigestData(userId) {
    const digestPath = path.join(__dirname, 
      '../data/notification-digests', `${userId}-digest.json`);
    
    if (await fs.pathExists(digestPath)) {
      const v1Digest = await fs.readJson(digestPath);
      
      const v2Digest = {
        version: "2.0",
        lastProcessed: v1Digest.lastProcessed || new Date().toISOString(),
        pending: v1Digest.pending?.map(item => ({
          id: uuidv4(),
          timestamp: item.timestamp,
          type: "schedule_change",
          priority: "normal",
          data: item,
          expiresAt: null
        })) || []
      };
      
      await fs.writeJson(
        path.join(userPath, 'notification_digest_v2.json'),
        v2Digest,
        { spaces: 2 }
      );
    }
  }
}
```

### 4.3 Week 3: Compatibility Layer

#### Task 3.1: Dual-Mode Operation
```javascript
// migration/compatibility-layer.js
class NotificationCompatibilityLayer {
  constructor() {
    this.v1Active = true;
    this.v2Active = false;
    this.migrationStatus = new Map();
  }
  
  async getUserSettings(userId) {
    // Check if user is migrated
    if (this.migrationStatus.get(userId) === 'complete') {
      return this.getV2Settings(userId);
    }
    
    // Try v2 first
    const v2Path = path.join(this.userPath(userId), 'notification_settings_v2.json');
    if (await fs.pathExists(v2Path)) {
      const settings = await fs.readJson(v2Path);
      if (settings.version === "2.0") {
        this.migrationStatus.set(userId, 'complete');
        return this.transformToV1Format(settings);
      }
    }
    
    // Fall back to v1
    return this.getV1Settings(userId);
  }
  
  async saveUserSettings(userId, settings) {
    // Save to both v1 and v2 during migration
    if (this.v1Active) {
      await this.saveV1Settings(userId, settings);
    }
    
    if (this.v2Active || this.migrationStatus.get(userId) === 'complete') {
      await this.saveV2Settings(userId, settings);
    }
  }
  
  transformToV1Format(v2Settings) {
    return {
      email: {
        enabled: v2Settings.channels.email.enabled,
        recipientEmail: v2Settings.channels.email.recipientEmail,
        frequency: v2Settings.preferences.frequency,
        deliveryTime: v2Settings.preferences.deliveryTime,
        ...v2Settings.channels.email.displayOptions
      },
      pushover: {
        enabled: v2Settings.channels.pushover.enabled,
        appToken: v2Settings.channels.pushover.appToken,
        userKey: v2Settings.channels.pushover.userKey,
        preferences: v2Settings.channels.pushover.displayOptions
      }
    };
  }
}
```

---

## 5. Phase 2: Core Backend Services (Weeks 4-6)

### 5.1 Week 4: Channel Implementation

#### Task 4.1: Email Channel with Gmail API
```typescript
// src/services/notifications/channels/EmailChannel.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BaseChannel } from './BaseChannel';

export class EmailChannel extends BaseChannel {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  
  async initialize() {
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    // Load saved tokens
    const tokens = await this.credentialVault.retrieve('gmail_tokens');
    if (tokens) {
      this.oauth2Client.setCredentials(JSON.parse(tokens));
    }
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }
  
  async send(recipient: string, subject: string, content: string) {
    try {
      const message = this.createMessage(recipient, subject, content);
      
      const result = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });
      
      await this.trackDelivery(result.data.id, 'sent');
      return { success: true, messageId: result.data.id };
      
    } catch (error) {
      if (error.code === 401) {
        // Token expired, refresh
        await this.refreshToken();
        return this.send(recipient, subject, content);
      }
      
      await this.trackDelivery(null, 'failed', error.message);
      throw error;
    }
  }
  
  private createMessage(to: string, subject: string, html: string): string {
    const boundary = `boundary_${Date.now()}`;
    
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      this.htmlToText(html),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
      '',
      `--${boundary}--`
    ].join('\r\n');
    
    return Buffer.from(message).toString('base64url');
  }
}
```

#### Task 4.2: Enhanced Pushover Channel
```typescript
// src/services/notifications/channels/PushoverChannel.ts
export class PushoverChannel extends BaseChannel {
  private rateLimiter: RateLimiter;
  private messageQueue: Queue;
  
  constructor() {
    super();
    this.rateLimiter = new RateLimiter({
      maxRequests: 7500,
      windowMs: 24 * 60 * 60 * 1000 // 24 hours
    });
    this.messageQueue = new Queue('pushover-messages');
  }
  
  async send(config: PushoverConfig, content: PushoverContent) {
    // Check rate limit
    if (!await this.rateLimiter.checkLimit(config.userKey)) {
      await this.messageQueue.add({ config, content });
      return { success: false, queued: true };
    }
    
    // Split long messages
    const messages = this.splitMessage(content);
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const isMultipart = messages.length > 1;
      
      const result = await this.sendSingle({
        token: config.appToken,
        user: config.userKey,
        message: isMultipart 
          ? `(${i + 1}/${messages.length}) ${message}` 
          : message,
        html: 1,
        priority: config.priority || 0,
        sound: config.sound || 'pushover',
        device: config.device
      });
      
      results.push(result);
      
      // Track delivery
      await this.trackDelivery(result.request, result.status === 1 ? 'sent' : 'failed');
    }
    
    return { success: true, results };
  }
  
  private splitMessage(content: PushoverContent): string[] {
    const MAX_LENGTH = 950; // Leave room for multipart prefix
    
    if (content.message.length <= MAX_LENGTH) {
      return [content.message];
    }
    
    // Smart splitting by sections
    const sections = content.message.split(/(?=<b>)/);
    const messages = [];
    let current = '';
    
    for (const section of sections) {
      if (current.length + section.length > MAX_LENGTH) {
        messages.push(current);
        current = section;
      } else {
        current += section;
      }
    }
    
    if (current) {
      messages.push(current);
    }
    
    return messages;
  }
}
```

#### Task 4.3: Desktop Notifications
```typescript
// src/services/notifications/channels/DesktopChannel.ts
import { Notification, nativeImage } from 'electron';

export class DesktopChannel extends BaseChannel {
  async send(config: DesktopConfig) {
    if (!Notification.isSupported()) {
      throw new Error('Desktop notifications not supported');
    }
    
    const notification = new Notification({
      title: config.title,
      body: config.body,
      icon: config.icon || nativeImage.createFromPath('./assets/icon.png'),
      silent: !config.sound,
      urgency: this.mapUrgency(config.priority),
      actions: config.actions || [],
      closeButtonText: 'Dismiss'
    });
    
    // Handle click
    notification.on('click', () => {
      if (config.onClick) {
        config.onClick();
      }
    });
    
    // Handle action clicks
    notification.on('action', (event, index) => {
      if (config.actions?.[index]?.onClick) {
        config.actions[index].onClick();
      }
    });
    
    notification.show();
    
    // Track
    await this.trackDelivery(config.id, 'displayed');
    
    return { success: true, notificationId: config.id };
  }
  
  private mapUrgency(priority?: string): 'low' | 'normal' | 'critical' {
    switch (priority) {
      case 'high':
      case 'emergency':
        return 'critical';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }
}
```

### 5.2 Week 5: Template Engine & Formatting

#### Task 5.1: Template Engine
```typescript
// src/services/notifications/formatters/TemplateEngine.ts
import Handlebars from 'handlebars';
import i18n from 'i18next';

export class TemplateEngine {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private partials: Map<string, string> = new Map();
  
  constructor() {
    this.registerHelpers();
    this.loadPartials();
  }
  
  private registerHelpers() {
    // Internationalization helper
    Handlebars.registerHelper('t', (key: string, options: any) => {
      return i18n.t(key, options.hash);
    });
    
    // Date formatting
    Handlebars.registerHelper('formatDate', (date: string, format: string) => {
      return new Date(date).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });
    
    // Conditional coloring
    Handlebars.registerHelper('changeColor', (type: string) => {
      const colors = {
        added: '#34C759',
        removed: '#FF3B30',
        modified: '#FF9500',
        swapped: '#007AFF',
        replaced: '#AF52DE'
      };
      return colors[type] || '#000000';
    });
    
    // Map URL generator
    Handlebars.registerHelper('mapUrl', (address: string) => {
      return `https://www.google.com/maps/place/${encodeURIComponent(address)}`;
    });
  }
  
  async renderEmail(templateName: string, data: any): Promise<string> {
    const template = await this.getTemplate(`email/${templateName}`);
    
    const html = template({
      ...data,
      config: {
        logoUrl: process.env.LOGO_URL,
        primaryColor: process.env.PRIMARY_COLOR || '#4f46e5',
        year: new Date().getFullYear()
      }
    });
    
    // Inline CSS for better email client support
    return this.inlineCSS(html);
  }
  
  async renderPushover(templateName: string, data: any): Promise<string> {
    const template = await this.getTemplate(`pushover/${templateName}`);
    return template(data);
  }
}
```

#### Task 5.2: Schedule Change Formatter
```typescript
// src/services/notifications/formatters/ScheduleChangeFormatter.ts
export class ScheduleChangeFormatter extends BaseFormatter {
  async format(changes: ScheduleChanges, preferences: UserPreferences): Promise<FormattedContent> {
    const groupedChanges = this.groupChangesByType(changes);
    
    const emailContent = await this.templateEngine.renderEmail('schedule-changes', {
      user: preferences.user,
      summary: this.createSummary(changes),
      changes: groupedChanges,
      preferences: preferences.display,
      totalChanges: changes.allChanges.length
    });
    
    const pushoverContent = await this.formatPushover(groupedChanges, preferences);
    const desktopContent = this.formatDesktop(changes);
    
    return {
      email: {
        subject: this.createSubject(changes),
        html: emailContent
      },
      pushover: {
        message: pushoverContent,
        priority: this.calculatePriority(changes)
      },
      desktop: {
        title: 'Schedule Changes Detected',
        body: desktopContent,
        icon: 'schedule-change'
      }
    };
  }
  
  private groupChangesByType(changes: ScheduleChanges) {
    return {
      removed: changes.allChanges.filter(c => c.type === 'removed'),
      added: changes.allChanges.filter(c => c.type === 'added'),
      modified: changes.allChanges.filter(c => c.type === 'date_changed'),
      swapped: changes.allChanges.filter(c => c.type === 'swap'),
      replaced: changes.allChanges.filter(c => c.type === 'replacement')
    };
  }
  
  private createSubject(changes: ScheduleChanges): string {
    const counts = [];
    
    if (changes.summary.removed > 0) {
      counts.push(`${changes.summary.removed} Removed`);
    }
    if (changes.summary.added > 0) {
      counts.push(`${changes.summary.added} Added`);
    }
    if (changes.summary.modified > 0) {
      counts.push(`${changes.summary.modified} Modified`);
    }
    
    return `Schedule Alert: ${counts.join(', ')}`;
  }
}
```

### 5.3 Week 6: Scheduling & Deduplication

#### Task 6.1: Enhanced Notification Scheduler
```typescript
// src/services/notifications/schedulers/NotificationScheduler.ts
import { CronJob } from 'cron';
import { Queue, Worker } from 'bullmq';

export class NotificationScheduler {
  private digestJobs: Map<string, CronJob> = new Map();
  private notificationQueue: Queue;
  private deduplicationCache: LRUCache<string, boolean>;
  
  constructor() {
    this.notificationQueue = new Queue('notifications', {
      connection: this.redis
    });
    
    this.deduplicationCache = new LRUCache({
      max: 10000,
      ttl: 5 * 60 * 1000 // 5 minutes
    });
    
    this.setupWorker();
  }
  
  async scheduleNotification(notification: NotificationRequest) {
    // Check for duplicates
    const hash = this.createHash(notification);
    if (this.deduplicationCache.has(hash)) {
      console.log(`Duplicate notification prevented: ${hash}`);
      return { duplicate: true };
    }
    
    // Check user preferences
    const preferences = await this.getUserPreferences(notification.userId);
    
    if (preferences.frequency === 'immediate') {
      return this.sendImmediate(notification);
    } else {
      return this.addToDigest(notification, preferences);
    }
  }
  
  private async sendImmediate(notification: NotificationRequest) {
    // Add to deduplication cache
    const hash = this.createHash(notification);
    this.deduplicationCache.set(hash, true);
    
    // Check quiet hours
    if (await this.isQuietHours(notification.userId)) {
      // Delay until quiet hours end
      const delay = this.calculateQuietHoursDelay(notification.userId);
      await this.notificationQueue.add('send', notification, { delay });
      return { queued: true, delay };
    }
    
    // Send immediately
    await this.notificationQueue.add('send', notification);
    return { queued: true };
  }
  
  private async addToDigest(notification: NotificationRequest, preferences: UserPreferences) {
    const digestKey = `digest:${notification.userId}`;
    const digest = await this.redis.get(digestKey) || { pending: [] };
    
    digest.pending.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      notification
    });
    
    await this.redis.set(digestKey, digest, {
      EX: 24 * 60 * 60 // 24 hour expiration
    });
    
    // Schedule digest if not already scheduled
    if (!this.digestJobs.has(notification.userId)) {
      this.scheduleUserDigest(notification.userId, preferences);
    }
    
    return { addedToDigest: true };
  }
  
  private scheduleUserDigest(userId: string, preferences: UserPreferences) {
    const cronTime = this.getCronTime(preferences.deliveryTime || '18:00');
    
    const job = new CronJob(cronTime, async () => {
      await this.sendDigest(userId);
    });
    
    job.start();
    this.digestJobs.set(userId, job);
  }
  
  private createHash(notification: NotificationRequest): string {
    const content = JSON.stringify({
      userId: notification.userId,
      type: notification.type,
      data: notification.data
    });
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

#### Task 6.2: Deduplication Engine
```typescript
// src/services/notifications/DeduplicationEngine.ts
export class DeduplicationEngine {
  private contentCache: LRUCache<string, DedupeEntry>;
  private userCooldowns: Map<string, CooldownEntry>;
  
  constructor() {
    this.contentCache = new LRUCache({
      max: 10000,
      ttl: 5 * 60 * 1000 // 5 minutes
    });
    
    this.userCooldowns = new Map();
  }
  
  async isDuplicate(notification: NotificationRequest): Promise<boolean> {
    // Check content hash
    const contentHash = this.hashContent(notification);
    if (this.contentCache.has(contentHash)) {
      const entry = this.contentCache.get(contentHash)!;
      console.log(`Duplicate detected: ${contentHash}, sent ${entry.count} times`);
      
      // Update count
      entry.count++;
      entry.lastSeen = new Date();
      this.contentCache.set(contentHash, entry);
      
      return true;
    }
    
    // Check user cooldown
    if (this.isUserInCooldown(notification.userId, notification.type)) {
      return true;
    }
    
    // Not a duplicate
    this.contentCache.set(contentHash, {
      firstSeen: new Date(),
      lastSeen: new Date(),
      count: 1,
      notification
    });
    
    this.updateUserCooldown(notification.userId, notification.type);
    
    return false;
  }
  
  private isUserInCooldown(userId: string, type: string): boolean {
    const key = `${userId}:${type}`;
    const cooldown = this.userCooldowns.get(key);
    
    if (!cooldown) return false;
    
    const cooldownPeriod = this.getCooldownPeriod(type);
    const elapsed = Date.now() - cooldown.lastNotification.getTime();
    
    return elapsed < cooldownPeriod;
  }
  
  private getCooldownPeriod(type: string): number {
    const cooldowns = {
      'schedule_change': 10 * 60 * 1000,  // 10 minutes
      'error': 5 * 60 * 1000,             // 5 minutes
      'dispenser_progress': 30 * 60 * 1000, // 30 minutes
      'digest': 24 * 60 * 60 * 1000      // 24 hours
    };
    
    return cooldowns[type] || 5 * 60 * 1000;
  }
}
```

---

## 6. Phase 3: Frontend Migration (Weeks 7-9)

### 6.1 Week 7: Component Architecture

#### Task 7.1: Notification Provider
```typescript
// src/context/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface NotificationContextValue {
  settings: NotificationSettingsV2 | null;
  updateSettings: (settings: Partial<NotificationSettingsV2>) => Promise<void>;
  testChannel: (channel: string) => Promise<TestResult>;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  recentNotifications: NotificationEntry[];
  stats: NotificationStats;
}

export const NotificationContext = createContext<NotificationContextValue>(null!);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<NotificationSettingsV2 | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [recentNotifications, setRecentNotifications] = useState<NotificationEntry[]>([]);
  
  useEffect(() => {
    // Load settings
    loadSettings();
    
    // Setup WebSocket
    const newSocket = io('/notifications', {
      auth: {
        token: localStorage.getItem('authToken')
      }
    });
    
    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Notification WebSocket connected');
    });
    
    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });
    
    newSocket.on('notification:sent', (notification: NotificationEntry) => {
      setRecentNotifications(prev => [notification, ...prev].slice(0, 50));
    });
    
    newSocket.on('settings:updated', (newSettings: NotificationSettingsV2) => {
      setSettings(newSettings);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  const loadSettings = async () => {
    try {
      const response = await api.get('/api/notifications/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };
  
  const updateSettings = async (updates: Partial<NotificationSettingsV2>) => {
    try {
      const response = await api.put('/api/notifications/settings', updates);
      setSettings(response.data);
      
      // Broadcast update
      socket?.emit('settings:update', response.data);
      
      toast.success('Notification settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
      throw error;
    }
  };
  
  const testChannel = async (channel: string): Promise<TestResult> => {
    try {
      const response = await api.post(`/api/notifications/test/${channel}`);
      return response.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
  
  const value = {
    settings,
    updateSettings,
    testChannel,
    connectionStatus,
    recentNotifications,
    stats: calculateStats(recentNotifications)
  };
  
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
```

#### Task 7.2: Enhanced Settings Component
```typescript
// src/components/notifications/NotificationSettings.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailChannel } from './channels/EmailChannel';
import { PushoverChannel } from './channels/PushoverChannel';
import { DesktopChannel } from './channels/DesktopChannel';
import { NotificationPreferences } from './NotificationPreferences';
import { NotificationHistory } from './NotificationHistory';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationSettings: React.FC = () => {
  const { settings, updateSettings, connectionStatus } = useNotifications();
  const [activeTab, setActiveTab] = useState('preferences');
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = async (updates: Partial<NotificationSettingsV2>) => {
    setIsSaving(true);
    try {
      await updateSettings(updates);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!settings) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Notification Settings</h1>
        <div className="flex items-center gap-2">
          <ConnectionIndicator status={connectionStatus} />
          <span className="text-sm text-gray-500">
            Real-time updates {connectionStatus === 'connected' ? 'active' : 'inactive'}
          </span>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="pushover">Pushover</TabsTrigger>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preferences">
          <NotificationPreferences 
            settings={settings}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </TabsContent>
        
        <TabsContent value="email">
          <EmailChannel 
            settings={settings.channels.email}
            onSave={(email) => handleSave({ channels: { ...settings.channels, email } })}
            isSaving={isSaving}
          />
        </TabsContent>
        
        <TabsContent value="pushover">
          <PushoverChannel 
            settings={settings.channels.pushover}
            onSave={(pushover) => handleSave({ channels: { ...settings.channels, pushover } })}
            isSaving={isSaving}
          />
        </TabsContent>
        
        <TabsContent value="desktop">
          <DesktopChannel 
            settings={settings.channels.desktop}
            onSave={(desktop) => handleSave({ channels: { ...settings.channels, desktop } })}
            isSaving={isSaving}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <NotificationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

### 6.2 Week 8: Channel Components

#### Task 8.1: Email Channel Component
```typescript
// src/components/notifications/channels/EmailChannel.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';

export const EmailChannel: React.FC<EmailChannelProps> = ({ settings, onSave, isSaving }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isTestingSending, setIsTestingSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  const handleTest = async () => {
    setIsTestingSending(true);
    setTestResult(null);
    
    try {
      const result = await api.post('/api/notifications/test/email', {
        recipientEmail: localSettings.recipientEmail
      });
      setTestResult(result.data);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTestingSending(false);
    }
  };
  
  const handleSave = () => {
    onSave(localSettings);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Enable Email Notifications</label>
            <p className="text-sm text-gray-500">Receive notifications via email</p>
          </div>
          <Switch
            checked={localSettings.enabled}
            onCheckedChange={(enabled) => 
              setLocalSettings({ ...localSettings, enabled })
            }
          />
        </div>
        
        {/* Recipient Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Email</label>
          <Input
            type="email"
            value={localSettings.recipientEmail}
            onChange={(e) => 
              setLocalSettings({ ...localSettings, recipientEmail: e.target.value })
            }
            placeholder="your-email@example.com"
            disabled={!localSettings.enabled}
          />
        </div>
        
        {/* Display Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Display Options</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(localSettings.displayOptions).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => 
                    setLocalSettings({
                      ...localSettings,
                      displayOptions: {
                        ...localSettings.displayOptions,
                        [key]: e.target.checked
                      }
                    })
                  }
                  disabled={!localSettings.enabled}
                  className="rounded"
                />
                <span className="text-sm">{formatDisplayOption(key)}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Test Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Test Email</h3>
              <p className="text-sm text-gray-500">Send a test notification</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!localSettings.enabled || !localSettings.recipientEmail || isTestingSending}
            >
              {isTestingSending ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
              testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult.success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Test email sent successfully!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Failed: {testResult.error}</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || JSON.stringify(settings) === JSON.stringify(localSettings)}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 6.3 Week 9: Integration & Polish

#### Task 9.1: Real-time Updates
```typescript
// src/hooks/useNotificationWebSocket.ts
export const useNotificationWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<NotificationEntry | null>(null);
  
  useEffect(() => {
    const newSocket = io('/notifications', {
      auth: {
        token: getAuthToken()
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    
    // Connection events
    newSocket.on('connect', () => {
      console.log('Notification WebSocket connected');
      setIsConnected(true);
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('Notification WebSocket disconnected:', reason);
      setIsConnected(false);
    });
    
    // Notification events
    newSocket.on('notification:sent', (notification: NotificationEntry) => {
      setLastNotification(notification);
      
      // Show desktop notification if enabled
      if (notification.channels.includes('desktop')) {
        showDesktopNotification(notification);
      }
    });
    
    newSocket.on('notification:failed', (error: NotificationError) => {
      toast.error(`Notification failed: ${error.message}`);
    });
    
    newSocket.on('digest:scheduled', (digest: DigestInfo) => {
      toast.info(`Daily digest scheduled for ${digest.deliveryTime}`);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  const emit = useCallback((event: string, data: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, [socket]);
  
  return {
    socket,
    isConnected,
    lastNotification,
    emit
  };
};
```

---

## 7. Phase 4: System Integration (Weeks 10-12)

### 7.1 Week 10: Form Automation Integration

#### Task 10.1: Notification Triggers
```typescript
// src/services/integrations/FormAutomationHook.ts
export class FormAutomationHook {
  constructor(
    private notificationManager: NotificationManager,
    private eventBus: EventBus
  ) {
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Listen for form automation events
    this.eventBus.on('formAutomation:started', this.onAutomationStarted.bind(this));
    this.eventBus.on('formAutomation:progress', this.onAutomationProgress.bind(this));
    this.eventBus.on('formAutomation:completed', this.onAutomationCompleted.bind(this));
    this.eventBus.on('formAutomation:failed', this.onAutomationFailed.bind(this));
    
    // Listen for scraping events
    this.eventBus.on('scraping:completed', this.onScrapingCompleted.bind(this));
    this.eventBus.on('scraping:changes', this.onChangesDetected.bind(this));
  }
  
  private async onAutomationStarted(event: AutomationStartedEvent) {
    await this.notificationManager.send({
      userId: event.userId,
      type: 'automation_started',
      channels: ['desktop'],
      data: {
        jobId: event.jobId,
        jobType: event.jobType,
        estimatedTime: event.estimatedTime
      }
    });
  }
  
  private async onAutomationProgress(event: AutomationProgressEvent) {
    // Only send progress notifications at key milestones
    const milestones = [25, 50, 75, 90];
    
    if (milestones.includes(event.percentage)) {
      await this.notificationManager.send({
        userId: event.userId,
        type: 'automation_progress',
        channels: ['desktop'],
        data: {
          jobId: event.jobId,
          percentage: event.percentage,
          currentStep: event.currentStep,
          message: event.message
        }
      });
    }
  }
  
  private async onChangesDetected(event: ChangesDetectedEvent) {
    const { changes, userId, isManual } = event;
    
    // Apply user filters
    const filteredChanges = await this.applyUserFilters(userId, changes);
    
    if (filteredChanges.allChanges.length === 0) {
      console.log(`No changes after filtering for user ${userId}`);
      return;
    }
    
    // Check cooldown for automatic scrapes
    if (!isManual && await this.isInCooldown(userId, 'schedule_changes')) {
      console.log(`User ${userId} in cooldown period, skipping notification`);
      return;
    }
    
    // Send notification
    await this.notificationManager.send({
      userId,
      type: 'schedule_changes',
      channels: await this.getUserChannels(userId, 'schedule_changes'),
      data: filteredChanges,
      metadata: {
        isManual,
        scrapeId: event.scrapeId,
        timestamp: event.timestamp
      }
    });
  }
}
```

#### Task 10.2: Pushover Open Client Integration
```typescript
// src/services/integrations/PushoverOpenClient.ts
export class PushoverOpenClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  
  async connect(deviceId: string, secret: string) {
    const url = `wss://client.pushover.net/push?device_id=${deviceId}&secret=${secret}`;
    
    this.socket = new WebSocket(url);
    
    this.socket.on('open', () => {
      console.log('Pushover Open Client connected');
      this.emit('connected');
    });
    
    this.socket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'message') {
          await this.handleMessage(message);
        } else if (message.type === 'keep-alive') {
          // Send acknowledgment
          this.socket?.send(JSON.stringify({ type: 'ack' }));
        }
      } catch (error) {
        console.error('Error handling Pushover message:', error);
      }
    });
    
    this.socket.on('close', () => {
      console.log('Pushover Open Client disconnected');
      this.scheduleReconnect();
    });
    
    this.socket.on('error', (error) => {
      console.error('Pushover Open Client error:', error);
    });
  }
  
  private async handleMessage(message: PushoverMessage) {
    // Parse message for commands
    const jobMatch = message.message.match(/^JOB:(\d+)$/i);
    
    if (jobMatch) {
      const jobId = jobMatch[1];
      
      // Trigger form automation
      this.eventBus.emit('pushover:jobCommand', {
        jobId,
        userId: message.userId,
        timestamp: new Date()
      });
      
      // Send confirmation
      await this.sendConfirmation(message.userId, `Starting automation for job ${jobId}`);
    }
    
    // Call registered handlers
    for (const handler of this.messageHandlers.values()) {
      await handler(message);
    }
  }
  
  private async sendConfirmation(userId: string, message: string) {
    await this.pushoverChannel.send({
      userKey: userId,
      appToken: process.env.PUSHOVER_APP_TOKEN!,
      priority: 0
    }, {
      message: `✅ ${message}`,
      title: 'Automation Confirmation'
    });
  }
  
  registerHandler(id: string, handler: MessageHandler) {
    this.messageHandlers.set(id, handler);
  }
  
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect Pushover Open Client...');
      this.connect(this.deviceId, this.secret);
    }, 5000);
  }
}
```

### 7.2 Week 11: WebSocket Integration

#### Task 11.1: Real-time Event Broadcasting
```typescript
// server/websocket/NotificationWebSocket.ts
import { Server as SocketIOServer } from 'socket.io';
import { authMiddleware } from '../middleware/auth';

export class NotificationWebSocket {
  private io: SocketIOServer;
  private userSockets: Map<string, Set<string>> = new Map();
  
  constructor(server: http.Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
      }
    });
    
    this.setupNamespace();
  }
  
  private setupNamespace() {
    const notificationNS = this.io.of('/notifications');
    
    // Authentication middleware
    notificationNS.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await authMiddleware.verifyToken(token);
        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
    notificationNS.on('connection', (socket) => {
      const userId = socket.data.user.id;
      console.log(`User ${userId} connected to notifications`);
      
      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);
      
      // Join user room
      socket.join(`user:${userId}`);
      
      // Handle events
      socket.on('settings:update', async (settings) => {
        await this.handleSettingsUpdate(userId, settings);
      });
      
      socket.on('notification:markRead', async (notificationId) => {
        await this.handleMarkRead(userId, notificationId);
      });
      
      socket.on('test:channel', async (channel) => {
        await this.handleTestChannel(userId, channel);
      });
      
      socket.on('disconnect', () => {
        this.userSockets.get(userId)?.delete(socket.id);
        if (this.userSockets.get(userId)?.size === 0) {
          this.userSockets.delete(userId);
        }
      });
    });
  }
  
  // Broadcast to specific user
  async broadcastToUser(userId: string, event: string, data: any) {
    this.io.of('/notifications').to(`user:${userId}`).emit(event, data);
  }
  
  // Broadcast notification sent
  async notificationSent(userId: string, notification: NotificationEntry) {
    await this.broadcastToUser(userId, 'notification:sent', notification);
  }
  
  // Broadcast settings update
  async settingsUpdated(userId: string, settings: NotificationSettingsV2) {
    await this.broadcastToUser(userId, 'settings:updated', settings);
  }
  
  // Get connection status for user
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
```

### 7.3 Week 12: A/B Testing & Monitoring

#### Task 12.1: A/B Testing Framework
```typescript
// src/services/testing/ABTestingService.ts
export class ABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, Assignment> = new Map();
  
  async createExperiment(config: ExperimentConfig): Promise<Experiment> {
    const experiment = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      variants: config.variants,
      allocation: config.allocation,
      startDate: new Date(),
      endDate: config.endDate,
      metrics: config.metrics,
      status: 'active'
    };
    
    this.experiments.set(experiment.id, experiment);
    await this.saveExperiment(experiment);
    
    return experiment;
  }
  
  async assignUserToExperiment(userId: string, experimentId: string): Promise<string> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'active') {
      return 'control'; // Default to control
    }
    
    // Check existing assignment
    const assignmentKey = `${userId}:${experimentId}`;
    if (this.assignments.has(assignmentKey)) {
      return this.assignments.get(assignmentKey)!.variant;
    }
    
    // Random assignment based on allocation
    const variant = this.selectVariant(experiment.allocation);
    
    const assignment = {
      userId,
      experimentId,
      variant,
      assignedAt: new Date()
    };
    
    this.assignments.set(assignmentKey, assignment);
    await this.saveAssignment(assignment);
    
    // Track assignment
    await this.trackEvent('experiment_assigned', {
      userId,
      experimentId,
      variant
    });
    
    return variant;
  }
  
  async getVariant(userId: string, experimentName: string): Promise<string> {
    const experiment = Array.from(this.experiments.values())
      .find(e => e.name === experimentName && e.status === 'active');
    
    if (!experiment) {
      return 'control';
    }
    
    return this.assignUserToExperiment(userId, experiment.id);
  }
  
  // Use in notification service
  async selectTemplate(userId: string, templateType: string): Promise<string> {
    const variant = await this.getVariant(userId, `${templateType}_template_test`);
    
    switch (variant) {
      case 'variant_a':
        return `${templateType}_v2`;
      case 'variant_b':
        return `${templateType}_v2_enhanced`;
      default:
        return templateType; // Original
    }
  }
}
```

#### Task 12.2: Monitoring & Metrics
```typescript
// src/services/monitoring/NotificationMonitor.ts
import { StatsD } from 'node-statsd';
import { Logger } from 'winston';

export class NotificationMonitor {
  private statsd: StatsD;
  private logger: Logger;
  private metrics: Map<string, Metric> = new Map();
  
  constructor() {
    this.statsd = new StatsD({
      host: process.env.STATSD_HOST || 'localhost',
      port: parseInt(process.env.STATSD_PORT || '8125'),
      prefix: 'notifications.'
    });
    
    this.setupMetrics();
  }
  
  private setupMetrics() {
    // Delivery metrics
    this.registerMetric('delivery.success', 'counter');
    this.registerMetric('delivery.failure', 'counter');
    this.registerMetric('delivery.duration', 'histogram');
    
    // Channel metrics
    this.registerMetric('channel.email.sent', 'counter');
    this.registerMetric('channel.pushover.sent', 'counter');
    this.registerMetric('channel.desktop.shown', 'counter');
    
    // User engagement
    this.registerMetric('user.opened', 'counter');
    this.registerMetric('user.clicked', 'counter');
    this.registerMetric('user.unsubscribed', 'counter');
    
    // System health
    this.registerMetric('queue.size', 'gauge');
    this.registerMetric('queue.processing_time', 'histogram');
    this.registerMetric('deduplication.prevented', 'counter');
  }
  
  async trackDelivery(channel: string, success: boolean, duration: number) {
    if (success) {
      this.increment('delivery.success', { channel });
      this.increment(`channel.${channel}.sent`);
    } else {
      this.increment('delivery.failure', { channel });
    }
    
    this.histogram('delivery.duration', duration, { channel });
  }
  
  async trackUserEngagement(type: 'opened' | 'clicked' | 'unsubscribed', metadata: any) {
    this.increment(`user.${type}`, metadata);
    
    // Log for analysis
    this.logger.info(`User engagement: ${type}`, metadata);
  }
  
  async getHealthStatus(): Promise<HealthStatus> {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const recentMetrics = await this.getRecentMetrics(fiveMinutesAgo);
    
    const deliveryRate = recentMetrics.successCount / 
      (recentMetrics.successCount + recentMetrics.failureCount);
    
    const status: HealthStatus = {
      status: deliveryRate > 0.95 ? 'healthy' : deliveryRate > 0.90 ? 'degraded' : 'unhealthy',
      deliveryRate,
      queueSize: await this.getQueueSize(),
      averageDeliveryTime: recentMetrics.averageDeliveryTime,
      errors: recentMetrics.errors
    };
    
    return status;
  }
  
  // Grafana dashboard query support
  async queryMetrics(query: MetricQuery): Promise<MetricResult[]> {
    const results = [];
    
    for (const metric of query.metrics) {
      const data = await this.getMetricData(metric, query.startTime, query.endTime);
      results.push({
        metric,
        datapoints: data
      });
    }
    
    return results;
  }
}
```

---

## 8. Phase 5: Testing & Validation (Weeks 13-14)

### 8.1 Week 13: Comprehensive Testing

#### Task 13.1: Unit Tests
```typescript
// tests/unit/services/NotificationManager.test.ts
describe('NotificationManager', () => {
  let manager: NotificationManager;
  let mockEmailChannel: jest.Mocked<EmailChannel>;
  let mockPushoverChannel: jest.Mocked<PushoverChannel>;
  let mockScheduler: jest.Mocked<NotificationScheduler>;
  
  beforeEach(() => {
    mockEmailChannel = createMockChannel('email');
    mockPushoverChannel = createMockChannel('pushover');
    mockScheduler = createMockScheduler();
    
    manager = new NotificationManager({
      channels: {
        email: mockEmailChannel,
        pushover: mockPushoverChannel
      },
      scheduler: mockScheduler
    });
  });
  
  describe('send', () => {
    it('should send to specified channels', async () => {
      const notification = createTestNotification({
        channels: ['email', 'pushover']
      });
      
      await manager.send(notification);
      
      expect(mockEmailChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: notification.userId,
          content: expect.any(Object)
        })
      );
      
      expect(mockPushoverChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: notification.userId,
          content: expect.any(Object)
        })
      );
    });
    
    it('should respect user preferences', async () => {
      const notification = createTestNotification({
        channels: ['email', 'pushover']
      });
      
      // Mock user has disabled pushover
      mockUserService.getPreferences.mockResolvedValue({
        channels: {
          email: { enabled: true },
          pushover: { enabled: false }
        }
      });
      
      await manager.send(notification);
      
      expect(mockEmailChannel.send).toHaveBeenCalled();
      expect(mockPushoverChannel.send).not.toHaveBeenCalled();
    });
    
    it('should handle deduplication', async () => {
      const notification = createTestNotification();
      
      // Send twice
      await manager.send(notification);
      await manager.send(notification);
      
      // Should only send once
      expect(mockEmailChannel.send).toHaveBeenCalledTimes(1);
    });
  });
});
```

#### Task 13.2: Integration Tests
```typescript
// tests/integration/notification-flow.test.ts
describe('Notification Flow Integration', () => {
  let app: Application;
  let testUser: User;
  
  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUser({
      email: 'test@example.com',
      notificationPreferences: {
        enabled: true,
        frequency: 'immediate'
      }
    });
  });
  
  it('should send notification on schedule change', async () => {
    // Setup spy on email service
    const emailSpy = jest.spyOn(EmailService.prototype, 'send');
    
    // Trigger schedule change
    await request(app)
      .post('/api/scrape/manual')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({
        changes: {
          removed: [{ jobId: 'W-123456', store: '1234' }],
          added: [{ jobId: 'W-789012', store: '5678' }]
        }
      })
      .expect(200);
    
    // Wait for async processing
    await waitFor(() => {
      expect(emailSpy).toHaveBeenCalled();
    });
    
    // Verify email content
    const emailCall = emailSpy.mock.calls[0];
    expect(emailCall[0]).toMatchObject({
      to: 'test@example.com',
      subject: expect.stringContaining('Schedule Alert'),
      html: expect.stringContaining('1 Removed, 1 Added')
    });
  });
  
  it('should respect quiet hours', async () => {
    // Set quiet hours
    await updateUserPreferences(testUser.id, {
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      }
    });
    
    // Mock current time to be in quiet hours
    jest.setSystemTime(new Date('2024-01-01T23:00:00'));
    
    const emailSpy = jest.spyOn(EmailService.prototype, 'send');
    
    // Trigger notification
    await triggerNotification(testUser.id);
    
    // Should not send immediately
    expect(emailSpy).not.toHaveBeenCalled();
    
    // Advance time past quiet hours
    jest.setSystemTime(new Date('2024-01-02T08:01:00'));
    await processScheduledJobs();
    
    // Now should send
    expect(emailSpy).toHaveBeenCalled();
  });
});
```

#### Task 13.3: Performance Tests
```javascript
// tests/performance/notification-load.test.js
import { check } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests under 500ms
    'errors': ['rate<0.01'],            // Error rate under 1%
  },
};

export default function () {
  const payload = JSON.stringify({
    userId: `user_${Math.floor(Math.random() * 1000)}`,
    type: 'schedule_change',
    channels: ['email', 'pushover'],
    data: {
      changes: generateRandomChanges()
    }
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_token'
    },
  };
  
  const response = http.post('http://localhost:3000/api/notifications/send', payload, params);
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'notification queued': (r) => JSON.parse(r.body).queued === true,
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function generateRandomChanges() {
  const types = ['added', 'removed', 'modified'];
  const count = Math.floor(Math.random() * 10) + 1;
  
  return Array.from({ length: count }, (_, i) => ({
    type: types[Math.floor(Math.random() * types.length)],
    jobId: `W-${100000 + i}`,
    store: `${1000 + i}`,
    date: new Date(Date.now() + i * 86400000).toISOString()
  }));
}
```

### 8.2 Week 14: User Acceptance Testing

#### Task 14.1: Beta Testing Program
```typescript
// src/services/testing/BetaTestingService.ts
export class BetaTestingService {
  private betaUsers: Set<string> = new Set();
  private feedbackCollector: FeedbackCollector;
  
  async enrollUser(userId: string, features: string[]) {
    this.betaUsers.add(userId);
    
    // Enable beta features
    await this.featureFlags.setUserFlags(userId, {
      'notifications_v2': true,
      'notifications_v2_email': features.includes('email'),
      'notifications_v2_pushover': features.includes('pushover'),
      'notifications_v2_desktop': features.includes('desktop'),
      'notifications_v2_templates': features.includes('templates')
    });
    
    // Send welcome email
    await this.sendBetaWelcome(userId);
    
    // Setup feedback collection
    this.feedbackCollector.setupForUser(userId);
  }
  
  async collectFeedback(userId: string, feedback: BetaFeedback) {
    await this.feedbackCollector.collect({
      userId,
      timestamp: new Date(),
      feature: feedback.feature,
      rating: feedback.rating,
      comments: feedback.comments,
      issues: feedback.issues,
      suggestions: feedback.suggestions
    });
    
    // Analyze sentiment
    const sentiment = await this.analyzeSentiment(feedback.comments);
    
    // Alert if critical issue
    if (sentiment.score < 0.3 || feedback.rating < 2) {
      await this.alertTeam({
        type: 'critical_feedback',
        userId,
        feedback,
        sentiment
      });
    }
  }
  
  async generateBetaReport(): Promise<BetaReport> {
    const feedback = await this.feedbackCollector.getAll();
    
    return {
      enrolledUsers: this.betaUsers.size,
      totalFeedback: feedback.length,
      averageRating: this.calculateAverageRating(feedback),
      featureRatings: this.groupRatingsByFeature(feedback),
      commonIssues: this.extractCommonIssues(feedback),
      suggestions: this.prioritizeSuggestions(feedback),
      sentiment: await this.overallSentiment(feedback)
    };
  }
}
```

---

## 9. Phase 6: Deployment & Monitoring (Weeks 15-16)

### 9.1 Week 15: Production Deployment

#### Task 15.1: Blue-Green Deployment
```yaml
# kubernetes/notification-service-v2.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-service-v2-blue
  labels:
    app: notification-service
    version: v2
    slot: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-service
      version: v2
      slot: blue
  template:
    metadata:
      labels:
        app: notification-service
        version: v2
        slot: blue
    spec:
      containers:
      - name: notification-service
        image: fossa-monitor/notification-service:v2.0.0
        env:
        - name: SERVICE_VERSION
          value: "v2"
        - name: DEPLOYMENT_SLOT
          value: "blue"
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: notification-service-v2
spec:
  selector:
    app: notification-service
    version: v2
    slot: blue  # Switch to green for cutover
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

#### Task 15.2: Deployment Script
```bash
#!/bin/bash
# deploy-notifications-v2.sh

set -e

echo "🚀 Starting Notification Service v2 Deployment"

# Configuration
ENVIRONMENT=${1:-production}
SLOT=${2:-blue}
VERSION=${3:-v2.0.0}

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."
./scripts/pre-deploy-check.sh $ENVIRONMENT $VERSION

# Backup current state
echo "💾 Creating backup..."
./scripts/backup-notification-data.sh $ENVIRONMENT

# Deploy to inactive slot
echo "🔵 Deploying to $SLOT slot..."
kubectl apply -f kubernetes/notification-service-v2-$SLOT.yaml

# Wait for ready
echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=notification-service,version=v2,slot=$SLOT --timeout=300s

# Run smoke tests
echo "🧪 Running smoke tests..."
./scripts/smoke-test-notifications.sh $SLOT

# Gradual traffic shift
echo "🔄 Starting gradual traffic shift..."
for percent in 10 25 50 75 100; do
  echo "  Shifting $percent% traffic to v2..."
  kubectl patch service notification-service-v2 -p '{"spec":{"selector":{"slot":"'$SLOT'"}}}'
  
  # Monitor for 5 minutes
  sleep 300
  
  # Check health
  HEALTH=$(./scripts/check-health.sh)
  if [ "$HEALTH" != "healthy" ]; then
    echo "❌ Health check failed at $percent%, rolling back..."
    ./scripts/rollback-notifications.sh
    exit 1
  fi
done

echo "✅ Deployment complete!"
```

#### Task 15.3: Rollback Procedure
```typescript
// scripts/rollback-notifications.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class NotificationRollback {
  async execute(reason: string) {
    console.log(`🔄 Starting rollback: ${reason}`);
    
    try {
      // 1. Switch traffic back to v1
      await this.switchTraffic('v1');
      
      // 2. Restore data if needed
      if (await this.hasDataChanges()) {
        await this.restoreData();
      }
      
      // 3. Clear v2 caches
      await this.clearCaches();
      
      // 4. Notify team
      await this.notifyTeam(reason);
      
      // 5. Create incident report
      await this.createIncidentReport(reason);
      
      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      await this.emergencyProcedure();
    }
  }
  
  private async switchTraffic(version: string) {
    console.log(`Switching traffic to ${version}...`);
    
    // Update load balancer
    await execAsync(`kubectl patch service notification-service -p '{"spec":{"selector":{"version":"${version}"}}}'`);
    
    // Update DNS if needed
    if (process.env.USE_DNS_SWITCHING === 'true') {
      await this.updateDNS(version);
    }
  }
  
  private async restoreData() {
    console.log('Restoring data from backup...');
    
    const latestBackup = await this.getLatestBackup();
    
    // Restore user settings
    await execAsync(`./scripts/restore-user-settings.sh ${latestBackup}`);
    
    // Restore notification history
    await execAsync(`./scripts/restore-notification-history.sh ${latestBackup}`);
  }
  
  private async emergencyProcedure() {
    // Last resort: route all traffic to a static maintenance page
    console.error('🚨 EMERGENCY: Routing to maintenance mode');
    await execAsync('kubectl apply -f kubernetes/maintenance-mode.yaml');
    
    // Page on-call
    await this.pageOnCall('Critical: Notification system rollback failed');
  }
}
```

### 9.2 Week 16: Production Monitoring

#### Task 16.1: Grafana Dashboards
```json
{
  "dashboard": {
    "title": "Notification Service v2 Monitoring",
    "panels": [
      {
        "title": "Delivery Success Rate",
        "targets": [
          {
            "expr": "rate(notifications_delivery_success_total[5m]) / (rate(notifications_delivery_success_total[5m]) + rate(notifications_delivery_failure_total[5m]))",
            "legendFormat": "{{channel}}"
          }
        ],
        "alert": {
          "name": "Low Delivery Rate",
          "conditions": [
            {
              "evaluator": {
                "params": [0.95],
                "type": "lt"
              }
            }
          ]
        }
      },
      {
        "title": "Notification Queue Size",
        "targets": [
          {
            "expr": "notifications_queue_size",
            "legendFormat": "Queue Size"
          }
        ]
      },
      {
        "title": "Average Delivery Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(notifications_delivery_duration_bucket[5m]))",
            "legendFormat": "p95 - {{channel}}"
          }
        ]
      },
      {
        "title": "Channel Usage",
        "targets": [
          {
            "expr": "sum(rate(notifications_channel_sent_total[5m])) by (channel)",
            "legendFormat": "{{channel}}"
          }
        ]
      },
      {
        "title": "User Engagement",
        "targets": [
          {
            "expr": "sum(rate(notifications_user_opened_total[1h]))",
            "legendFormat": "Opened"
          },
          {
            "expr": "sum(rate(notifications_user_clicked_total[1h]))",
            "legendFormat": "Clicked"
          }
        ]
      }
    ]
  }
}
```

#### Task 16.2: Alerting Rules
```yaml
# prometheus/alerts/notifications.yaml
groups:
  - name: notifications
    interval: 30s
    rules:
      - alert: NotificationDeliveryFailureHigh
        expr: |
          rate(notifications_delivery_failure_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          service: notifications
        annotations:
          summary: "High notification delivery failure rate"
          description: "Delivery failure rate is {{ $value | humanizePercentage }} for {{ $labels.channel }}"
      
      - alert: NotificationQueueBacklog
        expr: notifications_queue_size > 1000
        for: 10m
        labels:
          severity: warning
          service: notifications
        annotations:
          summary: "Notification queue backlog detected"
          description: "Queue size is {{ $value }}, indicating processing delays"
      
      - alert: EmailServiceDown
        expr: up{job="notification-email-service"} == 0
        for: 1m
        labels:
          severity: critical
          service: notifications
          channel: email
        annotations:
          summary: "Email notification service is down"
          description: "Email service has been down for more than 1 minute"
      
      - alert: PushoverRateLimitApproaching
        expr: |
          sum(rate(notifications_channel_sent_total{channel="pushover"}[1h])) > 6000
        for: 5m
        labels:
          severity: warning
          service: notifications
          channel: pushover
        annotations:
          summary: "Approaching Pushover rate limit"
          description: "Current rate: {{ $value }} messages/hour (limit: 7500)"
```

---

## 10. Rollback Procedures

### 10.1 Immediate Rollback

```bash
#!/bin/bash
# immediate-rollback.sh

# Stop v2 services
kubectl scale deployment notification-service-v2 --replicas=0

# Route all traffic to v1
kubectl patch service notification-service -p '{"spec":{"selector":{"version":"v1"}}}'

# Clear v2 data
redis-cli FLUSHDB

# Notify team
curl -X POST $SLACK_WEBHOOK -d '{"text":"⚠️ Notification v2 rolled back to v1"}'
```

### 10.2 Data Rollback

```javascript
// rollback-user-data.js
const fs = require('fs-extra');
const path = require('path');

async function rollbackUserData(userId, backupPath) {
  const userPath = path.join('./data/users', userId);
  const backupUserPath = path.join(backupPath, 'data/users', userId);
  
  // Restore v1 files
  await fs.copy(
    path.join(backupUserPath, 'email_settings.json.v1_backup'),
    path.join(userPath, 'email_settings.json'),
    { overwrite: true }
  );
  
  await fs.copy(
    path.join(backupUserPath, 'pushover_settings.json.v1_backup'),
    path.join(userPath, 'pushover_settings.json'),
    { overwrite: true }
  );
  
  // Remove v2 files
  await fs.remove(path.join(userPath, 'notification_settings_v2.json'));
  await fs.remove(path.join(userPath, 'notification_history_v2.json'));
  
  console.log(`✅ Rolled back user ${userId}`);
}
```

---

## 11. Post-Migration Activities

### 11.1 Success Metrics

1. **Delivery Metrics**
   - Delivery success rate > 99%
   - Average delivery time < 2 seconds
   - Queue processing time < 5 seconds

2. **User Metrics**
   - Email open rate > 40%
   - Pushover delivery rate > 99.5%
   - Desktop notification click rate > 20%

3. **System Metrics**
   - API response time < 200ms (p95)
   - WebSocket connection stability > 99%
   - Zero data loss during migration

### 11.2 Documentation Updates

1. Update user documentation with v2 features
2. Create API migration guide for integrations
3. Document new security procedures
4. Update troubleshooting guides

### 11.3 Cleanup Tasks

1. Remove v1 code after 30-day stability period
2. Archive migration scripts and logs
3. Clean up unused dependencies
4. Optimize database indices

### 11.4 Future Enhancements

1. **Mobile App Integration**
   - Native iOS/Android notifications
   - Push notification service
   - In-app notification center

2. **Advanced Features**
   - SMS channel support
   - Slack/Teams integration
   - Webhook notifications
   - Custom notification sounds

3. **Analytics Dashboard**
   - User engagement metrics
   - Delivery performance graphs
   - A/B test results visualization

---

## Conclusion

This comprehensive migration plan provides a complete roadmap for upgrading the notification system from v1 to v2. The 16-week timeline allows for careful implementation, thorough testing, and safe deployment with minimal user disruption.

Key benefits of the migration:
- **Enhanced Security**: No more plaintext passwords
- **Better Performance**: Async operations and caching
- **Improved UX**: Real-time updates and rich notifications
- **Operational Excellence**: Monitoring, testing, and easy rollback
- **Future-Ready**: Extensible architecture for new channels

The phased approach ensures each component is properly migrated and tested before moving to the next phase, reducing risk and ensuring a successful migration.