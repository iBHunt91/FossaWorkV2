import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiTool, FiInfo } from 'react-icons/fi';
import { GiGasPump } from 'react-icons/gi';

interface DispenserModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispensers?: any[]; // Add back but make optional
  orderId?: string | null;
  sortFuelTypes?: (gradeString: string) => string[]; // Make optional
}

const DispenserModal: React.FC<DispenserModalProps> = ({ 
  isOpen, 
  onClose,
  dispensers = [],
  orderId = null,
}) => {
  // Create a ref for the modal element
  const modalRef = useRef<HTMLDivElement | null>(null);
  
  // Create a ref to track if we've added the portal root
  const portalRootCreated = useRef<boolean>(false);
  
  // Function to ensure the portal root element exists
  const ensurePortalRootExists = () => {
    if (portalRootCreated.current) return document.getElementById('dispenser-modal-portal');
    
    // Create the portal root if it doesn't exist
    const existingPortalRoot = document.getElementById('dispenser-modal-portal');
    if (existingPortalRoot) {
      portalRootCreated.current = true;
      return existingPortalRoot;
    }
    
    const portalRoot = document.createElement('div');
    portalRoot.id = 'dispenser-modal-portal';
    // Make sure it appears on top of everything
    portalRoot.style.position = 'relative';
    portalRoot.style.zIndex = '9999'; 
    document.body.appendChild(portalRoot);
    portalRootCreated.current = true;
    return portalRoot;
  };
  
  // Create a div for the modal if needed
  useEffect(() => {
    if (!modalRef.current) {
      modalRef.current = document.createElement('div');
    }
    
    // Add the modal element to the portal root when opened
    if (isOpen) {
      const portalRoot = ensurePortalRootExists();
      if (portalRoot && modalRef.current) {
        portalRoot.appendChild(modalRef.current);
      }
    }
    
    // Clean up when component unmounts
    return () => {
      if (modalRef.current && modalRef.current.parentNode) {
        modalRef.current.parentNode.removeChild(modalRef.current);
      }
    };
  }, [isOpen]);
  
  // Log for debugging
  console.log("DispenserModal: isOpen =", isOpen, "modalRef.current =", modalRef.current);
  
  // Don't render anything if the modal is not open
  if (!isOpen) return null;
  
  // Create the modal content
  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 px-4 py-3 flex justify-between items-center">
          <h2 className="text-lg font-medium text-white flex items-center">
            <GiGasPump className="mr-2 h-5 w-5" />
            Dispenser Data {orderId && <span className="ml-1">for Order #{orderId}</span>}
          </h2>
          <button
            className="text-white hover:text-gray-200 focus:outline-none"
            onClick={onClose}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {dispensers.length > 0 ? (
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Showing {dispensers.length} dispenser{dispensers.length !== 1 ? 's' : ''}
              </div>
              
              {/* List of dispensers */}
              <div className="space-y-3">
                {dispensers.map((dispenser, index) => (
                  <div 
                    key={index} 
                    className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                        {dispenser.title || `Dispenser #${index + 1}`}
                      </h3>
                    </div>
                    <div className="p-3">
                      <div className="flex flex-col space-y-2">
                        {dispenser.serial && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Serial: </span>
                            <span className="text-gray-800 dark:text-gray-200">{dispenser.serial}</span>
                          </div>
                        )}
                        {dispenser.make && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Make: </span>
                            <span className="text-gray-800 dark:text-gray-200">{dispenser.make}</span>
                          </div>
                        )}
                        {dispenser.model && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Model: </span>
                            <span className="text-gray-800 dark:text-gray-200">{dispenser.model}</span>
                          </div>
                        )}
                        
                        {/* Display fields with better formatting */}
                        {dispenser.fields && Object.keys(dispenser.fields).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            {Object.entries(dispenser.fields).map(([key, value]) => (
                              <div key={key} className="text-xs mt-1">
                                <span className="text-gray-600 dark:text-gray-400">{key}: </span>
                                <span className="text-gray-800 dark:text-gray-200">{value as string}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                <FiTool className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-gray-700 dark:text-gray-300 font-medium mb-1">No dispenser information</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No equipment data is available for this work order
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center"
            onClick={onClose}
          >
            <FiX className="mr-1 h-4 w-4" /> Close
          </button>
        </div>
      </div>
    </div>
  );
  
  // Use createPortal to render the modal content to the modalRef element
  return modalRef.current ? createPortal(modalContent, modalRef.current) : null;
};

export default DispenserModal; 