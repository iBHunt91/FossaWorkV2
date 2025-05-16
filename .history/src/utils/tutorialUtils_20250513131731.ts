/**
 * Utility functions for managing tutorial mode and data
 */

// Check if the current user is in tutorial mode
export const isTutorialMode = (): boolean => {
  const activeUserId = localStorage.getItem('activeUserId') || '';
  return activeUserId === 'tutorial';
};

// Check if a tutorial element has been seen/viewed by the user
export const isTutorialElementSeen = (elementId: string): boolean => {
  return localStorage.getItem(`tutorial_element_${elementId}_seen`) === 'true';
};

// Mark a tutorial element as seen
export const markTutorialElementSeen = (elementId: string): void => {
  localStorage.setItem(`tutorial_element_${elementId}_seen`, 'true');
};

// Check if a tutorial tour has been completed
export const isTutorialTourCompleted = (tourId: string): boolean => {
  return localStorage.getItem(`tour_${tourId}_completed`) === 'true';
};

// Check if a tutorial tour has been skipped
export const isTutorialTourSkipped = (tourId: string): boolean => {
  return localStorage.getItem(`tour_${tourId}_skipped`) === 'true';
};

// Check if welcome modal should be shown
export const shouldShowWelcomeModal = (): boolean => {
  // Check if user is in tutorial mode and hasn't seen the welcome modal
  return isTutorialMode() && localStorage.getItem('tutorialWelcomeSeen') !== 'true';
};

// Predefined tutorial tours
export const tutorialTours = {
  dashboard: {
    id: 'dashboard_tour',
    steps: [
      {
        target: '.dashboard-header',
        title: 'Dashboard Overview',
        content: 'This is your main dashboard where you can see an overview of all your work orders and important metrics.',
        position: 'bottom'
      },
      {
        target: '.work-orders-section',
        title: 'Work Orders',
        content: 'Here you can see all your pending work orders. Click on any card to see details and manage the work order.',
        position: 'right'
      },
      {
        target: '.notifications-panel',
        title: 'Notifications',
        content: 'Important alerts and notifications will appear here to keep you updated on changes.',
        position: 'left'
      },
      {
        target: '.settings-icon',
        title: 'Settings',
        content: 'Access user preferences, notification settings, and application configuration from here.',
        position: 'bottom'
      }
    ]
  },
  workOrder: {
    id: 'work_order_tour',
    steps: [
      {
        target: '.work-order-details',
        title: 'Work Order Details',
        content: 'This section shows all the information about the current work order, including customer details and service requirements.',
        position: 'right'
      },
      {
        target: '.dispenser-info',
        title: 'Dispenser Information',
        content: 'View and manage the dispensers associated with this work order.',
        position: 'bottom'
      },
      {
        target: '.schedule-section',
        title: 'Schedule Management',
        content: 'Use these controls to schedule or reschedule visits.',
        position: 'top'
      },
      {
        target: '.action-buttons',
        title: 'Actions',
        content: 'These buttons let you perform common tasks like completing work orders or adding notes.',
        position: 'left'
      }
    ]
  },
  settings: {
    id: 'settings_tour',
    steps: [
      {
        target: '.user-settings',
        title: 'User Settings',
        content: 'Manage your profile and account settings here.',
        position: 'right'
      },
      {
        target: '.notification-preferences',
        title: 'Notification Settings',
        content: 'Configure how you want to receive alerts and notifications.',
        position: 'bottom'
      },
      {
        target: '.tutorial-options',
        title: 'Tutorial Settings',
        content: 'Reset tutorial data or restart walkthroughs from this section.',
        position: 'left'
      }
    ]
  }
};

// Types of tutorial actions that can be tracked for completion
type TutorialActionType = 
  | 'view_work_order' 
  | 'update_schedule' 
  | 'mark_complete' 
  | 'add_note'
  | 'view_dispenser'
  | 'check_notifications'
  | 'update_preferences';

// Track tutorial action completion
export const trackTutorialAction = (actionType: TutorialActionType): void => {
  localStorage.setItem(`tutorial_action_${actionType}_completed`, 'true');
};

// Check if a tutorial action has been completed
export const isTutorialActionCompleted = (actionType: TutorialActionType): boolean => {
  return localStorage.getItem(`tutorial_action_${actionType}_completed`) === 'true';
};

// Reset all tutorial progress (localStorage items)
export const resetTutorialProgress = (): void => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('tutorial_') || key.startsWith('tour_') || 
        key.startsWith('tryit_') || key.startsWith('feature_')) {
      localStorage.removeItem(key);
    }
  });
};

// Reset tutorial data on the server
export const resetTutorialDataOnServer = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/reset-tutorial-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to reset tutorial data on server:', error);
    return false;
  }
}; 