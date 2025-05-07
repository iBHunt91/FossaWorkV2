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
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-70 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full mx-4 sm:mx-auto max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <GiGasPump className="h-6 w-6 mr-3" />
            Dispenser Information {orderId && <span className="ml-1">- Order #{orderId}</span>}
          </h2>
          <button
            className="text-white hover:text-gray-200 transition-colors focus:outline-none"
            onClick={onClose}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {dispensers.length > 0 ? (
            <div className="space-y-4">
              <div className="pb-3 mb-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-2 rounded-full">
                    <FiInfo className="h-5 w-5" />
                  </div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                    Showing {dispensers.length} dispenser{dispensers.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              {/* Grid for dispensers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dispensers.map((dispenser, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 dark:bg-gray-900/40 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md"
                  >
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-800 dark:text-white">
                        {dispenser.title || `Dispenser #${index + 1}`}
                      </h3>
                    </div>
                    <div className="p-4">
                      {dispenser.serial && (
                        <div className="flex items-start mb-2">
                          <span className="text-gray-500 dark:text-gray-400 w-24 shrink-0 text-sm">Serial:</span>
                          <span className="text-gray-800 dark:text-gray-200 text-sm">{dispenser.serial}</span>
                        </div>
                      )}
                      {dispenser.make && (
                        <div className="flex items-start mb-2">
                          <span className="text-gray-500 dark:text-gray-400 w-24 shrink-0 text-sm">Make:</span>
                          <span className="text-gray-800 dark:text-gray-200 text-sm">{dispenser.make}</span>
                        </div>
                      )}
                      {dispenser.model && (
                        <div className="flex items-start mb-2">
                          <span className="text-gray-500 dark:text-gray-400 w-24 shrink-0 text-sm">Model:</span>
                          <span className="text-gray-800 dark:text-gray-200 text-sm">{dispenser.model}</span>
                        </div>
                      )}
                      
                      {/* If there are fields, show them in a nicer format */}
                      {dispenser.fields && Object.keys(dispenser.fields).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Details</h4>
                          <div className="space-y-1">
                            {Object.entries(dispenser.fields).map(([key, value]) => (
                              <div key={key} className="flex items-start">
                                <span className="text-gray-500 dark:text-gray-400 w-1/3 shrink-0 text-xs">{key}:</span>
                                <span className="text-gray-800 dark:text-gray-200 text-xs">{value as string}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <FiTool className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No dispenser information available</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                This work order doesn't have any dispenser information attached to it yet.
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center font-medium"
            onClick={onClose}
          >
            <FiX className="mr-1.5" /> Close
          </button>
        </div>
      </div>
    </div>
  );
  
  // Use createPortal to render the modal content to the modalRef element
  return modalRef.current ? createPortal(modalContent, modalRef.current) : null;
};

export default DispenserModal; 