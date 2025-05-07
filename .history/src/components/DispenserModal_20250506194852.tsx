import React from 'react';
import { FiX } from 'react-icons/fi';

interface DispenserModalProps {
  isOpen: boolean;
  onClose: () => void;
  // dispensers: any[]; // Simplified for now
  // orderId?: string | null;
  // sortFuelTypes: (gradeString: string) => string[]; 
}

const DispenserModal: React.FC<DispenserModalProps> = ({ 
  isOpen, 
  onClose, 
}) => {
  if (!isOpen) return null;

  console.log("DispenserModal: Rendering simplified modal because isOpen is true.");

  return (
    <div 
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000, // Ensure it's on top
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          color: 'black', // Ensure text is visible
          minWidth: '300px',
          minHeight: '200px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        <h2>Dispenser Modal (Test)</h2>
        <p>If you see this, the modal is rendering!</p>
        <button 
          onClick={onClose} 
          style={{ 
            marginTop: '20px', 
            padding: '10px 15px', 
            border: 'none', 
            backgroundColor: '#007bff', 
            color: 'white', 
            borderRadius: '5px' 
          }}
        >
          <FiX style={{ marginRight: '5px' }} /> Close
        </button>
      </div>
    </div>
  );
};

export default DispenserModal; 