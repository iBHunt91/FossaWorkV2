import React, { useEffect } from 'react';

/**
 * Component that injects CSS styles for date-grouped job cards
 */
const DateGroupStyles: React.FC = () => {
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.setAttribute('id', 'date-group-styles');
    
    // Define the CSS
    styleElement.textContent = `
      /* Date-grouped job cards styling */
      .date-grouped-card {
        position: relative;
        transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        margin-bottom: 0px !important;
      }
      
      .date-grouped-card:hover {
        transform: translateX(4px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      
      /* Add subtle left border to grouped cards */
      .date-grouped-card {
        border-left-width: 4px !important;
      }
      
      /* Positioning indicator for first/middle/last card in group */
      .date-group-first {
        position: relative;
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
        margin-bottom: 0 !important;
      }
      
      .date-group-middle {
        position: relative;
        border-radius: 0 !important;
        border-top-width: 0 !important;
        margin-bottom: 0 !important;
      }
      
      .date-group-last {
        position: relative;
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
        border-top-width: 0 !important;
      }
      
      /* When hovering over any card in the group, highlight the entire group */
      .date-grouped-wrapper:hover .date-grouped-card {
        border-color: currentColor;
      }
      
      /* Add shine effect on hover for grouped cards */
      .date-grouped-card:hover::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          to right,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.2) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        pointer-events: none;
        animation: shine 1s ease-in-out;
      }
      
      /* Optional connector line between cards in the same date group */
      .date-group-connector {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        background-color: currentColor;
        opacity: 0.5;
        z-index: 1;
      }
      
      /* Top connector (for all except first card) */
      .date-group-middle .date-group-connector-top,
      .date-group-last .date-group-connector-top {
        top: -2px;
        height: 4px;
      }
      
      /* Bottom connector (for all except last card) */
      .date-group-first .date-group-connector-bottom,
      .date-group-middle .date-group-connector-bottom {
        bottom: -2px;
        height: 4px;
      }
      
      @keyframes shine {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
      
      /* Dark mode adjustments */
      .dark .date-grouped-card:hover::after {
        background: linear-gradient(
          to right,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0) 100%
        );
      }
    `;
    
    // Append to document head
    document.head.appendChild(styleElement);
    
    // Cleanup on unmount
    return () => {
      const existingStyle = document.getElementById('date-group-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);
  
  // This is a utility component that doesn't render anything
  return null;
};

export default DateGroupStyles; 