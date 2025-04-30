# Development Tasks

## Overview
This document outlines current development tasks, requirements, and priorities.

## Table of Contents
1. [Current Tasks](#current-tasks)
2. [Task Requirements](#task-requirements)
3. [Dependencies](#dependencies)
4. [Priorities](#priorities)
5. [Task Status](#task-status)

## Current Tasks
### Completed Tasks
* ✅ Implement multi-user account system
* ✅ Create user-specific data directories
* ✅ Add user management UI to settings page
* ✅ Implement Bruce Hunt user migration script
* ✅ Migrate prover preferences for Bruce Hunt
* ✅ Migrate email settings for Bruce Hunt
* ✅ Migrate pushover settings for Bruce Hunt
* ✅ Improve Prover Preferences UI with Rescrape functionality
* ✅ Enhance dropdown styling and usability for fuel type selection

### Active Tasks
* Add user profile page with custom settings
* Implement user-specific notification preferences
* Create user data export/import functionality
* Add user activity logging
* Enhance security for user credentials storage

### Upcoming Tasks
* Implement user roles and permissions
* Create shared data functionality between users
* Add user-specific theme preferences
* Create backup/restore system for user data
* Implement user settings sync across devices

## Task Requirements
### Multi-User System
* Each user must have isolated data storage
* UI must clearly indicate the active user
* Switching users must update all displayed data
* User credentials must be securely stored
* Server must use active user's credentials for operations

### User Migration
* Migration scripts must preserve all existing data
* Scripts must handle missing files gracefully
* User-specific directories must maintain proper structure
* Migration must handle both global and specific user data
* System must continue to function during migration

### User Management
* UI must provide clear user management controls
* Adding users must validate email format
* Deleting users must confirm before removing data
* Editing users must update all relevant references
* Active user indication must be prominent in UI

## Dependencies
### Core Dependencies
* User manager module (`server/utils/userManager.js`)
* Data manager module (`scripts/utils/dataManager.js`)
* File system access for user data
* User interface components for management
* Authentication system for user validation

### External Dependencies
* Fossa API access for each user account
* Email service for notifications
* Pushover service for mobile alerts
* Local storage for user preferences
* Secure credential storage

## Priorities
### High Priority
* Ensuring all users can access their data reliably
* Maintaining data isolation between users
* Providing clear UI for user management
* Securing user credentials
* Enabling smooth user switching

### Medium Priority
* Optimizing user-specific file access
* Enhancing user profile options
* Implementing shared data functionality
* Creating user activity logs
* Adding user-specific notification preferences

### Low Priority
* UI customization per user
* Advanced user analytics
* Multi-device synchronization
* Role-based access controls
* Cross-user data comparison tools

## Task Status
### Completed
* Multi-user account system implementation ✅
* User-specific data directories ✅
* User management UI ✅
* Bruce Hunt user migration ✅
* Settings migration for Bruce Hunt ✅

### In Progress
* User profile enhancements
* User-specific notification preferences
* User data backup/restore system
* Security enhancements for user credentials
* User activity logging

### Planned
* User roles and permissions
* Shared data functionality
* User-specific theme preferences
* Multi-device synchronization
* Cross-user data comparison tools

## Task Management
* Task assignment
* Time tracking
* Progress reporting
* Review process 