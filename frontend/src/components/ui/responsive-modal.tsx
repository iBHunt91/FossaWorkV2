import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  mobileFullScreen?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  mobileFullScreen = true,
  showCloseButton = true,
  className
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'max-w-full'
  };

  const modalClasses = cn(
    "bg-white dark:bg-gray-800 shadow-xl transform transition-all duration-200 ease-out",
    // Mobile: full screen if mobileFullScreen is true
    mobileFullScreen ? "w-full h-full sm:h-auto sm:rounded-lg" : "w-full rounded-lg",
    // Desktop: use size classes
    sizeClasses[size],
    className
  );

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black bg-opacity-50 z-50",
        // Mobile: no padding if full screen
        mobileFullScreen ? "sm:p-4" : "p-4",
        // Center content
        "flex items-center justify-center"
      )}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={modalClasses}
        style={{
          maxHeight: mobileFullScreen ? '100%' : 'calc(100vh - 2rem)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            "flex items-center justify-between border-b dark:border-gray-700",
            "px-4 py-3 sm:px-6 sm:py-4"
          )}>
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pr-2">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors",
                  "p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700",
                  "touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                )}
                aria-label="Close modal"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className={cn(
          "overflow-y-auto",
          "px-4 py-4 sm:px-6 sm:py-6",
          mobileFullScreen && !title && !showCloseButton ? "h-full" : ""
        )}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Responsive Dialog (similar to modal but with more semantic HTML)
interface ResponsiveDialogProps extends ResponsiveModalProps {
  footer?: React.ReactNode;
}

export const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  footer,
  children,
  ...props
}) => {
  return (
    <ResponsiveModal {...props}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className={cn(
            "border-t dark:border-gray-700 mt-4 -mx-4 sm:-mx-6",
            "px-4 py-3 sm:px-6 sm:py-4",
            "flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end"
          )}>
            {footer}
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
};

// Sheet component for mobile-first side panels
interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
  className
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sideClasses = {
    left: 'left-0 top-0 bottom-0 w-full sm:w-80 transform transition-transform ' + 
          (isOpen ? 'translate-x-0' : '-translate-x-full'),
    right: 'right-0 top-0 bottom-0 w-full sm:w-80 transform transition-transform ' + 
           (isOpen ? 'translate-x-0' : 'translate-x-full'),
    top: 'top-0 left-0 right-0 h-full sm:h-auto sm:max-h-[80vh] transform transition-transform ' + 
         (isOpen ? 'translate-y-0' : '-translate-y-full'),
    bottom: 'bottom-0 left-0 right-0 h-full sm:h-auto sm:max-h-[80vh] transform transition-transform ' + 
            (isOpen ? 'translate-y-0' : 'translate-y-full'),
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black transition-opacity z-40",
          isOpen ? "bg-opacity-50" : "bg-opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div
        className={cn(
          "fixed bg-white dark:bg-gray-800 shadow-xl z-50",
          sideClasses[side],
          "duration-300 ease-in-out",
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className={cn(
          "overflow-y-auto h-full",
          title ? "pt-0" : "pt-4",
          "px-4 pb-4 sm:px-6 sm:pb-6"
        )}>
          {children}
        </div>
      </div>
    </>
  );
};