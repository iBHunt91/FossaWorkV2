# Ethanol-Free Auto Positioning

## Overview
The Ethanol-Free Auto Positioning feature automatically assigns special fuel types (Ethanol-Free, Ethanol-Free Gasoline Plus, and Rec Fuel 90) to the appropriate dispenser position based on the presence of other fuel types.

## Purpose
This feature simplifies the form filling process by automatically positioning special fuel types consistently, removing the need for manual selection and reducing the chance of positioning errors.

## How It Works

### Auto-Positioning Logic
When enabled, the feature follows these rules:
1. If an Ethanol-Free type fuel is the **only** grade on a dispenser, it uses Position 1 (standard position)
2. If an Ethanol-Free type fuel appears with other grades (but **without** Diesel), it automatically uses Position 3
3. If Diesel is present on the same dispenser as an Ethanol-Free type fuel, standard position preferences are used

### Affected Fuel Types
The following fuel types are considered "special" and subject to auto-positioning:
- Ethanol-Free
- Ethanol-Free Gasoline Plus
- Rec Fuel 90

### Toggle Control
Users can enable or disable this feature through the Prover Preferences page. When disabled, all fuel types follow the standard position preferences.

## Configuration
1. Navigate to the Prover Preferences page from Settings
2. Find the "Auto-Position Special Fuel Types" toggle at the top of the page
3. Enable or disable as desired
4. Click "Save Positions" to apply the changes

## Technical Implementation
The auto-positioning logic is implemented in two main components:

1. **Frontend Configuration (ProverPreferences.tsx)**
   - Provides a toggle UI for enabling/disabling the feature
   - Stores the setting in the prover_preferences.json file

2. **Form Automation Logic (AutomateForm.js)**
   - Checks for the autoPositionEthanolFree setting when determining prover positions
   - Analyzes all fuel types on a dispenser to make positioning decisions
   - Applies the special positioning rules for Ethanol-Free type fuels when appropriate

## Usage Examples

### Example 1: Single Grade Dispenser
A dispenser with only Ethanol-Free:
- Position: 1 (default position)

### Example 2: Multi-Grade Without Diesel
A dispenser with Regular, Plus, and Ethanol-Free:
- Regular: Position 1
- Plus: Position 2
- Ethanol-Free: Position 3

### Example 3: Multi-Grade With Diesel
A dispenser with Regular, Diesel, and Ethanol-Free:
- Regular: Position 1 (based on standard preferences)
- Diesel: Position 2 (based on standard preferences)
- Ethanol-Free: Position according to standard preferences (does not automatically use Position 3) 