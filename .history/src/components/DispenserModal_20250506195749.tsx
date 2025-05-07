import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

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
      className="modal-overlay"
      style={{
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: 'rgba(0, 0, 0, 0.7)', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div 
        className="modal-content"
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          maxWidth: '90%',
          maxHeight: '90%',
          overflow: 'auto',
          position: 'relative',
          color: 'black'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, fontSize: '24px', fontWeight: 'bold' }}>
          Dispenser Information {orderId && `(Order #${orderId})`}
        </h2>
        
        {dispensers.length > 0 ? (
          <div>
            <p style={{ marginBottom: '20px' }}>
              Showing {dispensers.length} dispenser{dispensers.length !== 1 ? 's' : ''}
            </p>
            
            {/* Simple list of dispensers */}
            <div>
              {dispensers.map((dispenser, index) => (
                <div key={index} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  padding: '10px', 
                  marginBottom: '10px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <h3 style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
                    {dispenser.title || `Dispenser #${index + 1}`}
                  </h3>
                  {dispenser.serial && (
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                      <strong>Serial:</strong> {dispenser.serial}
                    </p>
                  )}
                  {dispenser.make && (
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                      <strong>Make/Model:</strong> {dispenser.make} {dispenser.model ? `/ ${dispenser.model}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
            No dispenser information available
          </p>
        )}
        
        <button
          style={{
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={onClose}
        >
          <FiX style={{ marginRight: '5px' }} /> Close
        </button>
      </div>
    </div>
  );
  
  // Use createPortal to render the modal content to the modalRef element
  return modalRef.current ? createPortal(modalContent, modalRef.current) : null;
};

export default DispenserModal; 