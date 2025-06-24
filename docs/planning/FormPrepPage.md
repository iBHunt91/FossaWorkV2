# Form Prep Complete Implementation Guide - Version 2

This comprehensive document combines the migration plan and technical specification for the Form Prep functionality. It provides everything needed to rebuild this system from scratch while maintaining all custom logic and user experience.

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current System Overview](#current-system-overview)
3. [Custom Business Logic](#custom-business-logic)
4. [Implementation Details](#implementation-details)
5. [UI Component Specifications](#ui-component-specifications)
6. [API Specifications](#api-specifications)
7. [Data Models](#data-models)
8. [Migration Plan](#migration-plan)
9. [Error Handling](#error-handling)
10. [Testing Requirements](#testing-requirements)
11. [Performance & Security](#performance--security)

## Executive Summary

The Form Prep page is a critical component that enables automated form filling for fuel dispenser testing and prover scheduling using Playwright browser automation. This guide provides all technical details, custom logic, and implementation specifications needed to recreate this functionality.

### Core Features
1. **Single Visit Automation** - Process individual work order visits
2. **Batch Visit Automation** - Process multiple visits sequentially
3. **Real-time Progress Tracking** - Dispenser-level progress updates
4. **Job Management** - Pause/resume/cancel capabilities
5. **Work Week Rollover** - Automatic advancement to next week planning

## Current System Overview

### Technical Architecture

#### Frontend Components
- **FormPrep.tsx** - Main container component
- **SingleVisitAutomation.tsx** - Single visit processing UI
- **BatchVisitAutomation.tsx** - Batch processing UI
- **DispenserProgressCard.tsx** - Progress visualization
- **WorkWeekRolloverIndicator.tsx** - Week planning status

#### Backend Systems
- **AutomateForm.js** - Core automation engine
- **FormProcessor.js** - Enhanced form processing logic
- **accumeasure-form-handler-enhanced.js** - AccuMeasure-specific logic
- **JobManager.js** - Job state management
- **automationSocketService.ts** - Real-time WebSocket updates

#### Data Flow
```
User Interface → Form Service API → Automation Engine → Playwright Browser
      ↑                                      ↓
      ←───── WebSocket Updates ←───── Job Manager
```

### Technology Stack
- **Frontend**: React 18+, TypeScript, TailwindCSS, react-icons
- **Backend**: Node.js, Express, Playwright
- **Real-time**: WebSocket (Socket.io)
- **Storage**: JSON files (current), Database (v2)
- **Browser Automation**: Playwright with Chromium

## Custom Business Logic

### 1. Fuel Grade Classification System

```javascript
// CRITICAL: This logic determines form behavior
const FUEL_GRADE_CONFIG = {
  // Always metered (5 iterations)
  METERED_GRADES: [
    'Regular', 'Regular FP9', 'Regular FP10',
    'Diesel', 'Diesel #2', 'ULSD', 'ULSD #2',
    'Super', 'Super FP9', 'Super FP10', 'Super Premium',
    'Ultra', 'Ultra Premium', 'Ultra 94',
    'Ethanol-Free', 'Ethanol-Free Regular', 'Rec Fuel',
    'Race Fuel', 'Race Fuel 112'
  ],
  
  // Always non-metered (3 iterations)
  NON_METERED_GRADES: [
    'Plus', 'Plus FP9', 'Plus FP10',
    'Special 88', 'Extra 89', 'Midgrade 89'
  ],
  
  // Context-dependent (check for super variants)
  CONDITIONAL_GRADES: {
    'Premium': {
      metered: true, // Default
      condition: 'NO_SUPER_VARIANTS',
      fallbackProver: 'REGULAR_PROVER'
    }
  }
};

// Implementation
function classifyFuelGrade(grade, allGradesOnDispenser) {
  // Normalize the grade name
  const normalizedGrade = grade.trim().toUpperCase();
  
  // Check metered list
  if (METERED_GRADES.some(m => normalizedGrade.includes(m.toUpperCase()))) {
    return { type: 'metered', iterations: 5 };
  }
  
  // Check non-metered list
  if (NON_METERED_GRADES.some(nm => normalizedGrade.includes(nm.toUpperCase()))) {
    return { type: 'non-metered', iterations: 3 };
  }
  
  // Check conditional grades
  if (grade.toLowerCase().includes('premium')) {
    const hasSuperVariants = allGradesOnDispenser.some(g => 
      g.toLowerCase().includes('super') || 
      g.toLowerCase().includes('ultra')
    );
    
    return {
      type: hasSuperVariants ? 'non-metered' : 'metered',
      iterations: hasSuperVariants ? 3 : 5,
      useRegularProver: hasSuperVariants
    };
  }
  
  // Default fallback
  return { type: 'metered', iterations: 5 };
}
```

### 2. Prover Assignment Algorithm

```javascript
// CRITICAL: This determines which prover to use for each fuel
function getPreferredProver(fuelType, allFuelTypes, proverPreferences, dispenserData) {
  const normalizedFuel = fuelType.toLowerCase().trim();
  
  // PRIORITY 1: Ethanol-Free gets first choice
  if (normalizedFuel.includes('ethanol-free') || normalizedFuel.includes('rec fuel')) {
    // Find prover with ethanol-free preference
    for (const prover of proverPreferences.provers) {
      if (prover.preferred_fuel_types?.some(pref => 
        pref.toLowerCase().includes('ethanol-free') || 
        pref.toLowerCase().includes('rec fuel')
      )) {
        return prover.prover_id;
      }
    }
  }
  
  // PRIORITY 2: Premium special case
  if (normalizedFuel.includes('premium')) {
    const hasSuperVariants = allFuelTypes.some(ft => 
      ft.toLowerCase().includes('super') || 
      ft.toLowerCase().includes('ultra')
    );
    
    if (hasSuperVariants) {
      // Premium uses Regular's prover when super variants exist
      const regularProver = proverPreferences.provers.find(p =>
        p.preferred_fuel_types?.some(pref => 
          pref.toLowerCase() === 'regular' &&
          !pref.toLowerCase().includes('ethanol-free')
        )
      );
      if (regularProver) return regularProver.prover_id;
    }
  }
  
  // PRIORITY 3: Direct match
  const directMatch = proverPreferences.provers.find(prover =>
    prover.preferred_fuel_types?.some(pref => 
      pref.toLowerCase() === normalizedFuel
    )
  );
  if (directMatch) return directMatch.prover_id;
  
  // PRIORITY 4: Partial match
  const partialMatch = proverPreferences.provers.find(prover =>
    prover.preferred_fuel_types?.some(pref => {
      const prefLower = pref.toLowerCase();
      const fuelLower = normalizedFuel;
      return prefLower.includes(fuelLower) || fuelLower.includes(prefLower);
    })
  );
  if (partialMatch) return partialMatch.prover_id;
  
  // PRIORITY 5: Fallback to first prover
  return proverPreferences.provers[0]?.prover_id || 'FP1';
}
```

### 3. Dispenser Dropdown Selection Strategy

```javascript
// CRITICAL: Complex logic for finding and selecting correct dispenser
async function selectDispenserFromDropdown(page, targetDispenser, formSection) {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      // Step 1: Find the correct dropdown (NOT the grade dropdown)
      const dropdownSelectors = [
        'select.form-control:has(option:contains("VEP Prover"))',
        'select.form-control:has(option:contains("prover (5 gallon)"))',
        'select.ks-select:not(:has(option:contains("Regular")))',
        '.equipment-dropdown select',
        '#dispenser-select'
      ];
      
      let dropdown = null;
      for (const selector of dropdownSelectors) {
        const found = await page.$(selector);
        if (found) {
          // Verify it's equipment, not grades
          const options = await page.$$eval(`${selector} option`, opts =>
            opts.map(o => o.textContent)
          );
          
          const isGradeDropdown = options.some(opt => 
            ['Regular', 'Plus', 'Premium', 'Diesel'].includes(opt?.trim())
          );
          
          if (!isGradeDropdown) {
            dropdown = found;
            break;
          }
        }
      }
      
      if (!dropdown) {
        throw new Error('Could not find equipment dropdown');
      }
      
      // Step 2: Open dropdown and wait for options
      await dropdown.click();
      await page.waitForTimeout(500);
      
      // Step 3: Find and click the target option
      const optionSelectors = [
        `option:text-matches("${targetDispenser.dispenserTitle}", "i")`,
        `li:text-matches("${targetDispenser.dispenserTitle}", "i")`,
        `.dropdown-item:text-matches("${targetDispenser.dispenserTitle}", "i")`
      ];
      
      for (const selector of optionSelectors) {
        const option = await page.$(selector);
        if (option) {
          await option.click();
          await page.waitForTimeout(300);
          
          // Verify selection
          const selectedValue = await dropdown.evaluate(el => el.value);
          if (selectedValue) {
            return true;
          }
        }
      }
      
      // Fallback: Try keyboard navigation
      await dropdown.focus();
      const options = await page.$$eval('option', opts => opts.map(o => o.textContent));
      const targetIndex = options.findIndex(opt => 
        opt?.toLowerCase().includes(targetDispenser.dispenserTitle.toLowerCase())
      );
      
      if (targetIndex > 0) {
        for (let i = 0; i < targetIndex; i++) {
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(100);
        }
        await page.keyboard.press('Enter');
        return true;
      }
      
    } catch (error) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Failed to select dispenser after ${MAX_RETRIES} attempts: ${error.message}`);
      }
      await page.waitForTimeout(1000);
    }
  }
}
```

### 4. Work Week Rollover Logic

```javascript
// CRITICAL: Determines when to show next week's jobs
function calculateWorkWeekRollover(preference, jobs, referenceDate = new Date()) {
  const { startDay, endDay, timezone } = preference;
  
  // Get current time in user's timezone
  const now = new Date(referenceDate.toLocaleString('en-US', { timeZone: timezone }));
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  // Calculate boundaries
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - ((currentDay - startDay + 7) % 7));
  thisWeekStart.setHours(0, 0, 0, 0);
  
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + (endDay - startDay));
  thisWeekEnd.setHours(23, 59, 59, 999);
  
  // Rollover conditions
  let isRolledOver = false;
  let rolloverReason = null;
  
  // Condition 1: After 5pm on end day
  if (currentDay === endDay && currentHour >= 17) {
    isRolledOver = true;
    rolloverReason = 'time';
  }
  
  // Condition 2: Weekend (Saturday/Sunday)
  if (currentDay === 0 || currentDay === 6) {
    isRolledOver = true;
    rolloverReason = 'time';
  }
  
  // Condition 3: No jobs remaining (only Thursday or later)
  if (currentDay >= 4) { // Thursday = 4
    const remainingJobs = jobs.filter(job => {
      const visitDate = new Date(job.visits?.[0]?.date);
      return visitDate >= now && visitDate <= thisWeekEnd;
    });
    
    if (remainingJobs.length === 0) {
      isRolledOver = true;
      rolloverReason = 'no-jobs';
    }
  }
  
  // Return effective boundaries
  if (isRolledOver) {
    const nextWeekStart = new Date(thisWeekEnd);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    nextWeekStart.setHours(0, 0, 0, 0);
    
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + (endDay - startDay));
    nextWeekEnd.setHours(23, 59, 59, 999);
    
    return {
      isRolledOver: true,
      rolloverReason,
      effectiveWeekStart: nextWeekStart,
      effectiveWeekEnd: nextWeekEnd,
      boundaries: {
        thisWeekStart,
        thisWeekEnd,
        nextWeekStart,
        nextWeekEnd
      }
    };
  }
  
  return {
    isRolledOver: false,
    rolloverReason: null,
    effectiveWeekStart: thisWeekStart,
    effectiveWeekEnd: thisWeekEnd,
    boundaries: {
      thisWeekStart,
      thisWeekEnd,
      nextWeekStart: null,
      nextWeekEnd: null
    }
  };
}
```

### 5. Job Code Detection and Routing

```javascript
// CRITICAL: Determines which form type to use
async function detectJobTypeFromWorkOrder(workOrderId, userId) {
  // Load scraped content
  const scrapedPath = `data/users/${userId}/scraped_content.json`;
  const scrapedData = JSON.parse(await fs.readFile(scrapedPath, 'utf8'));
  
  // Find work order
  const workOrder = scrapedData.workOrders.find(wo => 
    wo.id === `W-${workOrderId}` || wo.id === workOrderId
  );
  
  if (!workOrder?.services) {
    return { formType: 'AccuMeasure', serviceCode: null };
  }
  
  // Analyze services
  let primaryService = null;
  let isSpecificDispensers = false;
  let dispenserCount = 1;
  let formType = 'AccuMeasure';
  
  for (const service of workOrder.services) {
    const code = service.code?.toString();
    
    switch (code) {
      case '2861':
      case '3002':
        // All dispensers - AccuMeasure
        primaryService = code;
        dispenserCount = service.quantity || 1;
        formType = 'AccuMeasure';
        break;
        
      case '2862':
        // Specific dispensers - AccuMeasure with filtering
        primaryService = code;
        isSpecificDispensers = true;
        formType = 'AccuMeasure';
        
        // Parse instructions for dispenser numbers
        if (service.description || workOrder.instructions) {
          const instructions = service.description || workOrder.instructions;
          const dispenserNumbers = instructions.match(/\b\d+\b/g) || [];
          dispenserCount = dispenserNumbers.length || 1;
        }
        break;
        
      case '3146':
        // Open Neck Prover - Different form
        primaryService = code;
        formType = 'OpenNeckProver';
        break;
    }
  }
  
  return {
    formType,
    serviceCode: primaryService,
    isSpecificDispensers,
    dispenserCount,
    workOrderData: workOrder
  };
}
```

### 6. Form Count Determination Logic

```javascript
// CRITICAL: Determines how many forms to create
async function determineFormCount(workOrder, dispensers, serviceCode) {
  let formCount = 1; // Default
  
  // Priority 1: Service quantity
  if (workOrder.services && workOrder.services.length > 0) {
    const totalQuantity = workOrder.services.reduce((sum, service) => {
      // Only count relevant service codes
      if (['2861', '2862', '3002'].includes(service.code?.toString())) {
        return sum + (service.quantity || 0);
      }
      return sum;
    }, 0);
    
    if (totalQuantity > 0) {
      console.log(`Form count from services: ${totalQuantity}`);
      return totalQuantity;
    }
  }
  
  // Priority 2: Dispenser count
  if (dispensers && dispensers.length > 0) {
    console.log(`Form count from dispensers: ${dispensers.length}`);
    return dispensers.length;
  }
  
  // Priority 3: Default
  console.log('Using default form count: 1');
  return formCount;
}
```

### 7. Progress Update System

```javascript
// CRITICAL: Real-time progress tracking
class ProgressTracker {
  constructor(jobId, totalDispensers, totalFuelGrades) {
    this.jobId = jobId;
    this.totalDispensers = totalDispensers;
    this.totalFuelGrades = totalFuelGrades;
    this.completedDispensers = 0;
    this.completedFuelGrades = 0;
    this.currentDispenser = null;
    this.currentFuelGrade = null;
    this.startTime = Date.now();
  }
  
  updateDispenserProgress(dispenserIndex, dispenserTitle) {
    this.currentDispenser = {
      index: dispenserIndex,
      title: dispenserTitle,
      progress: 0
    };
    
    this.emit('dispenser_started', {
      jobId: this.jobId,
      type: 'dispenser_started',
      current: dispenserIndex + 1,
      total: this.totalDispensers,
      percentage: Math.round((dispenserIndex / this.totalDispensers) * 100),
      message: `Processing ${dispenserTitle}`,
      timestamp: new Date().toISOString(),
      dispenser: {
        id: `dispenser_${dispenserIndex}`,
        title: dispenserTitle
      }
    });
  }
  
  updateFuelGradeProgress(fuelGrade, status, iteration) {
    this.currentFuelGrade = {
      grade: fuelGrade,
      status,
      iteration
    };
    
    const overallProgress = this.calculateOverallProgress();
    
    this.emit('fuel_grade_progress', {
      jobId: this.jobId,
      type: 'fuel_grade_progress',
      current: this.completedFuelGrades,
      total: this.totalFuelGrades,
      percentage: overallProgress,
      message: `Processing ${fuelGrade} - ${status}`,
      timestamp: new Date().toISOString(),
      fuelType: fuelGrade,
      phase: `Iteration ${iteration}`,
      estimatedRemainingTime: this.calculateRemainingTime()
    });
  }
  
  calculateOverallProgress() {
    const dispenserWeight = 0.2;
    const fuelGradeWeight = 0.8;
    
    const dispenserProgress = (this.completedDispensers / this.totalDispensers) * dispenserWeight;
    const fuelProgress = (this.completedFuelGrades / this.totalFuelGrades) * fuelGradeWeight;
    
    return Math.round((dispenserProgress + fuelProgress) * 100);
  }
  
  calculateRemainingTime() {
    const elapsed = Date.now() - this.startTime;
    const completed = this.completedFuelGrades || 1;
    const avgTimePerGrade = elapsed / completed;
    const remaining = this.totalFuelGrades - completed;
    const estimatedMs = remaining * avgTimePerGrade;
    
    return {
      minutes: Math.round(estimatedMs / 60000),
      formatted: this.formatTime(estimatedMs)
    };
  }
  
  formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
```

## Implementation Details

### FormPrep Page Component

```typescript
// src/pages/FormAutomation.tsx
interface FormAutomationPageProps {
  userId: string;
}

const FormAutomationPage: React.FC<FormAutomationPageProps> = ({ userId }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [rolloverInfo, setRolloverInfo] = useState<RolloverInfo | null>(null);
  
  // Hooks
  const { data: workOrderData, loading, error } = useWorkOrders(userId);
  const { rollover, boundaries } = useWorkWeekRollover({ jobs: workOrders });
  
  // Components to render
  return (
    <div className="form-automation-container">
      <PageHeader 
        title="Form Automation"
        description="Automate fuel dispenser testing"
      />
      
      {rollover?.isRolledOver && (
        <WorkWeekRolloverAlert rolloverState={rollover} />
      )}
      
      <EnhancedFeaturesNotice />
      
      <TabNavigation 
        tabs={['single', 'batch']}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      
      <TabContent>
        {activeTab === 'single' ? (
          <SingleVisitAutomation 
            userId={userId}
            workOrders={workOrders}
          />
        ) : (
          <BatchVisitAutomation
            userId={userId}
            workOrders={workOrders}
          />
        )}
      </TabContent>
    </div>
  );
};
```

### Form Automation Service

```javascript
// services/FormAutomationService.js
class FormAutomationService {
  async processVisit(visitUrl, options) {
    // 1. Create job record
    const job = await JobService.create({
      type: 'single',
      userId: options.userId,
      metadata: { visitUrl, ...options }
    });
    
    // 2. Extract work order details
    const workOrderId = this.extractWorkOrderId(visitUrl);
    const jobType = await this.detectJobType(workOrderId, options.userId);
    
    // 3. Route to appropriate processor
    const processor = this.getProcessor(jobType);
    
    // 4. Execute automation
    const result = await processor.process({
      jobId: job.id,
      visitUrl,
      workOrderId,
      ...options
    });
    
    return result;
  }
  
  async processBatch(workOrders, options) {
    // Implement batch processing logic
  }
}
```

### WebSocket Implementation

```typescript
// services/AutomationWebSocket.ts
class AutomationWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:3003/automation`);
      
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ 
          type: 'auth', 
          userId 
        }));
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };
      
      this.ws.onerror = reject;
    });
  }
  
  subscribeToJob(jobId: string, callbacks: JobCallbacks) {
    this.ws.send(JSON.stringify({ 
      type: 'subscribe', 
      jobId 
    }));
    
    this.jobCallbacks.set(jobId, callbacks);
  }
}
```

## UI Component Specifications

### 1. FormPrep Page Layout

```typescript
interface FormPrepLayout {
  header: {
    title: "Form Automation";
    description: "Automate form filling for fuel dispenser testing and prover scheduling";
    enhancedFeaturesNotice: boolean;
    workWeekRolloverIndicator: boolean;
  };
  
  tabs: {
    single: {
      label: "Single Visit";
      icon: "FiPlay";
      description: "Process individual visits with enhanced AccuMeasure automation features";
    };
    batch: {
      label: "Batch Processing";
      icon: "FiLayers";
      description: "Process multiple visits simultaneously with enhanced automation and queue management";
    };
  };
  
  states: {
    loading: "Spinner with 'Loading work orders for active user...'";
    error: "Error message with retry button";
    empty: "Empty state with guidance";
    ready: "Tab content";
  };
}
```

### 2. Single Visit Automation UI

```typescript
interface SingleVisitUI {
  inputSection: {
    visitUrlInput: {
      placeholder: "Enter visit URL or select from dropdown";
      validation: "Must contain 'workfossa.com' and '/visits/'";
    };
    
    workOrderDropdown: {
      groupBy: "week";
      format: "Store Name - #StoreNumber - Date";
      weeks: ["Past Due", "This Week", "Next Week", "Week 3", "Week 4", "Future"];
      defaultExpanded: ["Past Due", "This Week", "Next Week"];
    };
  };
  
  controlsSection: {
    startButton: {
      text: "Start Automation";
      icon: "FiPlay";
      disabled: "when processing or no URL";
    };
    
    headlessToggle: {
      label: "Run in background (headless)";
      default: true;
    };
    
    openInBrowserButton: {
      text: "Open Visit in Browser";
      icon: "FiExternalLink";
      action: "Opens URL in new tab with debug mode";
    };
  };
  
  progressSection: {
    statusCard: {
      title: "Automation Status";
      elements: ["Status badge", "Progress bar", "Current action", "Time elapsed"];
    };
    
    dispenserCards: {
      layout: "Grid of DispenserProgressCard components";
      updateFrequency: "Real-time via WebSocket";
    };
  };
  
  jobHistorySection: {
    title: "Recent Jobs";
    maxItems: 5;
    clearButton: true;
    itemFormat: {
      store: "Store name and number";
      status: "Completed/Failed badge";
      duration: "Time taken";
      timestamp: "Relative time";
    };
  };
}
```

### 3. Batch Visit Automation UI

```typescript
interface BatchVisitUI {
  selectionSection: {
    selectAllToggle: "Select/deselect all visits";
    weekFilters: "Filter by week groups";
    visitList: {
      groupBy: "week";
      checkboxes: true;
      format: "Store info with service details";
      badges: ["Job code", "Dispenser count"];
    };
  };
  
  controlsSection: {
    startBatchButton: {
      text: "Start Batch Processing ({count} visits)";
      disabled: "when no visits selected";
    };
    
    resumeFailedButton: {
      visible: "when failed batch exists";
      text: "Resume from last failed";
    };
  };
  
  progressSection: {
    overallProgress: {
      title: "Batch Progress";
      elements: ["Progress bar", "Visit counter", "Time remaining"];
    };
    
    currentVisitCard: {
      title: "Current Visit";
      content: "Same as single visit progress";
    };
    
    queuedVisits: {
      title: "Queued Visits";
      format: "List with pending/completed status";
    };
  };
  
  advancedControls: {
    pauseResumeButton: "Toggle based on state";
    skipCurrentButton: "Skip to next visit";
    diagnosticsButton: "Show diagnostic panel";
  };
}
```

### 4. Progress Visualization

```typescript
// components/DispenserProgressCard.tsx
interface EnhancedProgressCard {
  // Visual indicators
  statusIcon: 'pending' | 'processing' | 'completed' | 'error';
  progressBar: boolean;
  animatedUpdates: boolean;
  
  // Detailed information
  dispenserInfo: {
    title: string;
    number: string;
    formNumber: number;
    totalForms: number;
  };
  
  // Fuel grade progress
  fuelGrades: Array<{
    grade: string;
    status: string;
    prover?: string;
    meter?: string;
  }>;
  
  // Real-time updates
  currentAction?: string;
  estimatedTime?: string;
}
```

## API Specifications

### 1. Form Automation Endpoints

```yaml
/api/form-automation:
  POST:
    description: Start single visit automation
    body:
      visitUrl: string (required)
      headless: boolean (default: true)
      workOrderId: string (optional)
      serviceCode: string (optional)
      isSpecificDispensers: boolean (optional)
      instructions: string (optional)
      dispenserCount: number (optional)
    response:
      message: "Visit processing started"
      jobId: string
    
/api/form-automation/batch:
  POST:
    description: Start batch automation
    body:
      filePath: string (required)
      headless: boolean (default: true)
      selectedVisits: string[] (required)
      resumeFromBatchId: string (optional)
    response:
      message: "Batch processing started"
      jobId: string
      totalVisits: number

/api/form-automation/unified-status/{jobId}:
  GET:
    description: Get real-time job status
    response:
      jobId: string
      status: "idle|running|paused|completed|error"
      message: string
      progress: number (0-100)
      completedVisits: number
      totalVisits: number
      currentVisit: string
      currentVisitName: string
      dispenserProgress: DispenserProgress[]
      isBatch: boolean
      userId: string
      
/api/form-automation/pause/{jobId}:
  POST:
    description: Pause running job
    response:
      success: boolean
      message: string

/api/form-automation/resume/{jobId}:
  POST:
    description: Resume paused job
    response:
      success: boolean
      message: string

/api/form-automation/cancel/{jobId}:
  POST:
    description: Cancel running job
    response:
      success: boolean
      message: string

/api/form-automation/active-jobs:
  GET:
    description: Get all active jobs for user
    response:
      jobs: Job[]

/api/form-automation/clear-history:
  POST:
    description: Clear job history
    body:
      jobType: "single|batch|all"
    response:
      success: boolean
      clearedCount: number
```

### 2. WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  "join-user-room": { userId: string };
  "subscribe-job": { jobId: string };
  "unsubscribe-job": { jobId: string };
  "ping": {};
}

// Server → Client
interface ServerEvents {
  "connection-confirmed": {
    userId: string;
    socketId: string;
    timestamp: string;
  };
  
  "progress_update": {
    jobId: string;
    type: ProgressType;
    current: number;
    total: number;
    percentage: number;
    message: string;
    timestamp: string;
    phase?: string;
    fuelType?: string;
    dispenser?: DispenserInfo;
    estimatedRemainingTime?: number;
  };
  
  "automation-error": {
    jobId: string;
    error: {
      type: string;
      severity: "low|medium|high|critical";
      userMessage: string;
      suggestedActions: string[];
      recoverable: boolean;
    };
  };
  
  "automation-complete": {
    jobId: string;
    result: {
      success: boolean;
      completedForms: number;
      duration: number;
      errors: any[];
    };
  };
  
  "automation-cancelled": {
    jobId: string;
    reason: string;
  };
}
```

## Data Models

### 1. Work Order Structure

```typescript
interface WorkOrder {
  id: string; // Format: "W-123456"
  customer: {
    name: string;
    storeNumber: string; // Format: "#1234"
    address: {
      street: string;
      cityState: string;
      county: string;
    };
  };
  services: Array<{
    type: string;
    quantity: number;
    description: string;
    code: string; // "2861", "2862", "3002", "3146"
  }>;
  visits: {
    nextVisit?: {
      visitId: string;
      date: string;
      url: string;
    };
  };
  instructions?: string;
  _userId?: string;
}
```

### 2. Dispenser Data Structure

```typescript
interface DispenserStore {
  dispenserData: {
    [workOrderId: string]: {
      dispensers: Array<{
        dispenserTitle: string; // "Dispenser 1 - Dual"
        dispenserNumber?: string; // "1"
        nozzles: Array<{
          position: string; // "A", "B"
          fuelType: string; // "Regular", "Plus", etc.
        }>;
      }>;
      timestamp: string;
    };
  };
}
```

### 3. Prover Preferences Structure

```typescript
interface ProverPreferences {
  provers: Array<{
    prover_id: string; // "FP1", "FP2", etc.
    prover_name: string;
    priority: number;
    preferred_fuel_types: string[];
    is_active: boolean;
  }>;
  default_assignments: {
    [fuelType: string]: string; // fuel -> prover_id
  };
  special_rules: {
    ethanol_free_priority: boolean;
    premium_follows_regular: boolean;
  };
}
```

### 4. Job State Structure

```typescript
interface JobState {
  id: string;
  type: "single" | "batch";
  status: JobStatus;
  userId: string;
  metadata: {
    visitUrl?: string;
    workOrderId?: string;
    serviceCode?: string;
    isSpecificDispensers?: boolean;
    headless: boolean;
    batchFile?: string;
    selectedVisits?: string[];
  };
  progress: {
    current: number;
    total: number;
    percentage: number;
    currentVisit?: string;
    currentDispenser?: DispenserInfo;
    completedFuelGrades: { [dispenserId: string]: string[] };
  };
  checkpoints: Array<{
    phase: string;
    timestamp: string;
    data: any;
  }>;
  startTime: string;
  endTime?: string;
  error?: JobError;
}
```

## Migration Plan

### Phase 1: Core Infrastructure Setup (Weeks 1-2)

#### Database Schema Design
```sql
-- Jobs table
CREATE TABLE automation_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('single', 'batch') NOT NULL,
  status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'cancelled') NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Job progress table
CREATE TABLE job_progress (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,
  visit_id VARCHAR(36),
  dispenser_id VARCHAR(50),
  fuel_grade VARCHAR(50),
  status ENUM('pending', 'processing', 'completed', 'error') NOT NULL,
  prover_id VARCHAR(50),
  meter_value VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE CASCADE
);

-- Batch state persistence
CREATE TABLE batch_states (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  batch_id VARCHAR(36) NOT NULL,
  current_index INT NOT NULL,
  work_orders JSON NOT NULL,
  completed_indices JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Phase 2: Component Migration (Weeks 3-4)
- FormPrep page migration
- Single visit automation
- Progress tracking UI

### Phase 3: Advanced Features (Weeks 5-6)
- Batch automation
- Job management
- Error recovery

### Phase 4: Integration & Testing (Weeks 7-8)
- End-to-end testing
- Performance testing
- Bug fixes

### Phase 5: Polish & Documentation (Weeks 9-10)
- UI/UX improvements
- Documentation
- Training materials

### Data Migration

```javascript
// scripts/migrateFormAutomationData.js
async function migrateFormAutomationData() {
  // 1. Read existing JSON files
  // 2. Transform data structure
  // 3. Insert into database
  // 4. Verify migration
  // 5. Archive old files
}
```

## Error Handling

### 1. Error Categories

```typescript
enum ErrorType {
  // Recoverable errors
  ELEMENT_NOT_FOUND = "element_not_found",
  TIMEOUT = "timeout",
  NETWORK_ERROR = "network_error",
  
  // Semi-recoverable (needs user intervention)
  LOGIN_REQUIRED = "login_required",
  INVALID_CREDENTIALS = "invalid_credentials",
  FORM_CHANGED = "form_changed",
  
  // Non-recoverable
  INVALID_URL = "invalid_url",
  NO_DISPENSERS = "no_dispensers",
  BROWSER_CRASH = "browser_crash"
}

interface ErrorHandler {
  async handle(error: Error, context: ErrorContext): Promise<ErrorResolution> {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case ErrorType.ELEMENT_NOT_FOUND:
        return this.retryWithAlternativeSelectors(context);
        
      case ErrorType.TIMEOUT:
        return this.retryWithExtendedTimeout(context);
        
      case ErrorType.LOGIN_REQUIRED:
        return this.promptUserLogin(context);
        
      default:
        return this.failWithUserMessage(error, context);
    }
  }
}
```

### 2. Retry Strategies

```javascript
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,
  
  selectors: {
    // Primary → Fallback → Last resort
    dispenserDropdown: [
      'select#dispenser-select',
      'select.form-control:has(option:contains("Dispenser"))',
      'select[name*="dispenser"]'
    ],
    
    proverDropdown: [
      'select#prover-select',
      'select:has(option[value*="FP"])',
      'select[name*="prover"]'
    ],
    
    saveButton: [
      'button[type="submit"]:contains("Save")',
      'button.btn-primary:contains("Save")',
      'input[type="submit"][value*="Save"]'
    ]
  }
};
```

## Testing Requirements

### 1. Unit Tests

```typescript
describe('Form Automation Logic', () => {
  describe('Fuel Grade Classification', () => {
    test('classifies metered grades correctly', () => {
      expect(classifyFuelGrade('Regular', [])).toEqual({
        type: 'metered',
        iterations: 5
      });
    });
    
    test('handles Premium with super variants', () => {
      const allGrades = ['Regular', 'Super', 'Premium'];
      expect(classifyFuelGrade('Premium', allGrades)).toEqual({
        type: 'non-metered',
        iterations: 3,
        useRegularProver: true
      });
    });
  });
  
  describe('Prover Assignment', () => {
    test('prioritizes ethanol-free', () => {
      const proverPrefs = {
        provers: [
          { prover_id: 'FP1', preferred_fuel_types: ['Regular'] },
          { prover_id: 'FP2', preferred_fuel_types: ['Ethanol-Free'] }
        ]
      };
      
      expect(getPreferredProver('Ethanol-Free', [], proverPrefs))
        .toBe('FP2');
    });
  });
  
  describe('Work Week Rollover', () => {
    test('rolls over after 5pm on Friday', () => {
      const friday5pm = new Date('2024-01-19T17:00:00');
      const result = calculateWorkWeekRollover(
        { startDay: 1, endDay: 5 },
        [],
        friday5pm
      );
      
      expect(result.isRolledOver).toBe(true);
      expect(result.rolloverReason).toBe('time');
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Form Automation E2E', () => {
  test('completes single visit automation', async () => {
    // 1. Start automation
    const response = await api.post('/form-automation', {
      visitUrl: 'https://app.workfossa.com/work/123/visits/456',
      headless: true
    });
    
    const { jobId } = response.data;
    
    // 2. Monitor progress
    const updates = [];
    const socket = await connectWebSocket();
    socket.on('progress_update', update => updates.push(update));
    
    // 3. Wait for completion
    await waitForJobCompletion(jobId);
    
    // 4. Verify results
    expect(updates).toContainEqual(
      expect.objectContaining({
        type: 'form_completed',
        percentage: 100
      })
    );
  });
});
```

## Performance & Security

### 1. Browser Resource Management

```javascript
class BrowserPool {
  constructor(maxConcurrent = 3) {
    this.pool = [];
    this.inUse = new Set();
    this.maxConcurrent = maxConcurrent;
  }
  
  async acquire() {
    if (this.pool.length === 0 && this.inUse.size < this.maxConcurrent) {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });
      return browser;
    }
    
    // Wait for available browser
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.pool.length > 0) {
          clearInterval(checkInterval);
          resolve(this.pool.shift());
        }
      }, 100);
    });
  }
  
  release(browser) {
    this.inUse.delete(browser);
    this.pool.push(browser);
  }
}
```

### 2. Progress Update Throttling

```javascript
class ProgressThrottler {
  constructor(minInterval = 500) {
    this.lastUpdate = 0;
    this.minInterval = minInterval;
    this.pendingUpdate = null;
  }
  
  emit(event, data) {
    const now = Date.now();
    
    if (now - this.lastUpdate >= this.minInterval) {
      this.doEmit(event, data);
      this.lastUpdate = now;
    } else {
      // Queue update
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = setTimeout(() => {
        this.doEmit(event, data);
        this.lastUpdate = Date.now();
      }, this.minInterval - (now - this.lastUpdate));
    }
  }
}
```

### 3. User Data Isolation

```javascript
// CRITICAL: Always use user-specific paths
function getUserDataPath(userId, filename) {
  // Validate userId to prevent path traversal
  if (!userId || userId.includes('..') || userId.includes('/')) {
    throw new Error('Invalid user ID');
  }
  
  return path.join('data', 'users', userId, filename);
}

// NEVER use global paths for user data
// BAD: path.join('data', 'dispenser_store.json')
// GOOD: getUserDataPath(userId, 'dispenser_store.json')
```

### 4. Input Validation

```javascript
function validateVisitUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Must be Fossa domain
    if (!parsed.hostname.includes('workfossa.com')) {
      throw new Error('Invalid domain');
    }
    
    // Must be visits path
    if (!parsed.pathname.includes('/visits/')) {
      throw new Error('Invalid path');
    }
    
    // Extract and validate IDs
    const match = parsed.pathname.match(/\/work\/(\d+)\/visits\/(\d+)/);
    if (!match) {
      throw new Error('Invalid URL format');
    }
    
    return {
      valid: true,
      workOrderId: match[1],
      visitId: match[2]
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

## Deployment Considerations

### 1. Environment Variables

```bash
# Required environment variables
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers
NODE_ENV=production
SERVER_PORT=3003
WEBSOCKET_PORT=3003
LOG_LEVEL=info
MAX_CONCURRENT_AUTOMATIONS=3
AUTOMATION_TIMEOUT=180000
```

### 2. System Requirements

```yaml
minimum:
  cpu: 2 cores
  ram: 4GB
  disk: 10GB (for browser cache)
  
recommended:
  cpu: 4 cores
  ram: 8GB
  disk: 20GB
  
dependencies:
  - Node.js 18+
  - Chromium dependencies
  - Write access to data directory
```

## Risk Mitigation

### Technical Risks
1. **Browser Automation Stability**
   - Mitigation: Implement robust retry logic
   - Fallback: Manual intervention options

2. **Real-time Communication**
   - Mitigation: Implement reconnection logic
   - Fallback: Polling-based updates

3. **Data Migration**
   - Mitigation: Comprehensive backup strategy
   - Fallback: Dual-write during transition

### Business Risks
1. **User Adoption**
   - Mitigation: Maintain familiar UI patterns
   - Training: Comprehensive user guides

2. **Performance Impact**
   - Mitigation: Gradual rollout
   - Monitoring: Performance metrics

## Success Metrics

### Technical Metrics
- Job success rate > 95%
- Average processing time < 2 minutes per visit
- WebSocket uptime > 99%
- Error recovery rate > 90%

### Business Metrics
- User adoption rate > 80%
- Time savings > 50%
- Support ticket reduction > 30%
- User satisfaction > 4.5/5

## Conclusion

This comprehensive guide provides everything needed to rebuild the Form Prep functionality in version 2. It includes:

1. **All Custom Business Logic**: Fuel grade classifications, prover assignments, and routing rules
2. **Complete Implementation Details**: Architecture, components, and services
3. **UI/UX Specifications**: Exact layouts and interactions
4. **API Design**: All endpoints and WebSocket events
5. **Data Models**: Complete structures for all entities
6. **Migration Strategy**: Phased approach with timeline
7. **Error Handling**: Comprehensive recovery strategies
8. **Testing Requirements**: Unit and integration test specifications
9. **Performance & Security**: Critical considerations for production

An AI assistant can use this guide to accurately rebuild the entire Form Automation system while maintaining all the custom business logic and user experience requirements. The phased migration approach ensures minimal disruption while delivering incremental value throughout the process.