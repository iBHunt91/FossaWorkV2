import Tooltip from 'react-tooltip';

/**
 * Utility to manage tooltips and ensure they're properly hidden when mouse leaves elements
 */
const TooltipManager = {
  // Track if tooltip manager is initialized
  isInitialized: false,
  
  // Interval to forcibly check for and hide tooltips
  cleanupInterval: null as number | null,
  
  /**
   * Rebuild all tooltips in the document
   */
  rebuildAll: () => {
    Tooltip.rebuild();
  },

  /**
   * Hide all tooltips in the document 
   */
  hideAll: () => {
    Tooltip.hide();
  },

  /**
   * Setup global event listeners to ensure tooltips are hidden when mouse leaves the document
   */
  setupGlobalListeners: () => {
    // Only initialize once
    if (TooltipManager.isInitialized) return;
    TooltipManager.isInitialized = true;
    
    // Hide tooltips when mouse leaves the document
    document.addEventListener('mouseleave', TooltipManager.hideAll);
    
    // Hide tooltips when user clicks anywhere
    document.addEventListener('click', TooltipManager.hideAll);
    
    // Hide tooltips when scrolling
    const onScroll = () => {
      document.documentElement.classList.add('is-scrolling');
      TooltipManager.hideAll();
      
      setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 100);
    };
    
    // Add scroll event listener
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Also handle window resize
    window.addEventListener('resize', TooltipManager.hideAll);
  },
  
  /**
   * Clean up global event listeners
   */
  cleanupGlobalListeners: () => {
    document.removeEventListener('mouseleave', TooltipManager.hideAll);
    document.removeEventListener('click', TooltipManager.hideAll);
    window.removeEventListener('scroll', () => {});
    window.removeEventListener('resize', TooltipManager.hideAll);
    
    TooltipManager.isInitialized = false;
  }
};

export default TooltipManager; 