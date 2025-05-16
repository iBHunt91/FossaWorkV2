import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiTarget } from 'react-icons/fi';

export interface TourStep {
  target: string; // CSS selector for the target element
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  disableOverlay?: boolean;
  highlightPadding?: number; // padding around the highlighted element in px
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  tourId: string; // Unique identifier for this tour
  showSkipButton?: boolean;
}

const GuidedTour: React.FC<GuidedTourProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  tourId,
  showSkipButton = true,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Find the target element when step changes
  useEffect(() => {
    if (!isOpen) return;
    
    const step = steps[currentStep];
    if (!step) return;
    
    try {
      const element = document.querySelector(step.target);
      if (element) {
        setTargetElement(element);
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll into view if needed
        const isInViewport = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        if (!isInViewport) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          
          // Re-calculate position after scrolling
          setTimeout(() => {
            const updatedRect = element.getBoundingClientRect();
            setTargetRect(updatedRect);
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error finding target element:", error);
    }
  }, [currentStep, isOpen, steps]);
  
  // Position the popover
  useEffect(() => {
    if (!targetRect || !popoverRef.current) return;
    
    const step = steps[currentStep];
    if (!step) return;
    
    const position = step.position || calculateOptimalPosition(targetRect);
    const popover = popoverRef.current;
    const popoverRect = popover.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = targetRect.top - popoverRect.height - 10;
        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 10;
        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
        left = targetRect.left - popoverRect.width - 10;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
        left = targetRect.right + 10;
        break;
    }
    
    // Ensure the popover stays in viewport
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popoverRect.width - 10;
    }
    if (top < 10) top = 10;
    if (top + popoverRect.height > window.innerHeight - 10) {
      top = window.innerHeight - popoverRect.height - 10;
    }
    
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    
  }, [targetRect, currentStep, steps]);
  
  // Calculate best position based on viewport
  const calculateOptimalPosition = (rect: DOMRect): 'top' | 'bottom' | 'left' | 'right' => {
    const spaceTop = rect.top;
    const spaceBottom = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;
    
    const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
    
    if (maxSpace === spaceTop) return 'top';
    if (maxSpace === spaceBottom) return 'bottom';
    if (maxSpace === spaceLeft) return 'left';
    return 'right';
  };
  
  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };
  
  const handleSkip = () => {
    localStorage.setItem(`tour_${tourId}_skipped`, 'true');
    onClose();
  };
  
  const handleComplete = () => {
    localStorage.setItem(`tour_${tourId}_completed`, 'true');
    onComplete();
    onClose();
  };
  
  if (!isOpen) return null;
  
  const currentStepData = steps[currentStep];
  const padding = currentStepData.highlightPadding || 5;
  
  return (
    <>
      {/* Overlay */}
      {!currentStepData.disableOverlay && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 transition-opacity">
          {targetRect && (
            <div 
              className="absolute bg-transparent border-2 border-primary-400 rounded-md"
              style={{
                top: targetRect.top - padding + window.scrollY,
                left: targetRect.left - padding,
                width: targetRect.width + (padding * 2),
                height: targetRect.height + (padding * 2),
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                transition: 'all 0.3s ease',
              }}
            />
          )}
        </div>
      )}
      
      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed z-[70] w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 transition-all"
        style={{ position: 'fixed', top: 0, left: 0 }}
      >
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 flex justify-between items-center">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
            <FiTarget className="mr-2 text-primary-500" />
            {currentStepData.title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
          >
            <FiX size={18} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            {currentStepData.content}
          </p>
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
            <div className="flex space-x-2">
              {showSkipButton && currentStep !== steps.length - 1 && (
                <button 
                  onClick={handleSkip}
                  className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Skip
                </button>
              )}
              {currentStep > 0 && (
                <button 
                  onClick={handlePrevious}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                >
                  <FiChevronLeft className="mr-1" size={14} /> Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded flex items-center"
              >
                {currentStep < steps.length - 1 ? (
                  <>Next <FiChevronRight className="ml-1" size={14} /></>
                ) : (
                  'Finish'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuidedTour; 