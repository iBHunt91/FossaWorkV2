import React, { useEffect, useState } from 'react';
import { FiX, FiInfo } from 'react-icons/fi';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructions: string;
  title?: string;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ 
  isOpen, 
  onClose, 
  instructions,
  title = 'Job Instructions'
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  // Handle animation timing
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOpen) {
      // Small delay to allow CSS transition to work properly
      setModalVisible(true);
    } else {
      // Allow time for exit animation
      timer = setTimeout(() => {
        setModalVisible(false);
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);
  
  if (!isOpen && !modalVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm transition-opacity duration-300 modal-overlay"
      style={{ opacity: isOpen ? '1' : '0' }}
      onClick={onClose}
      aria-labelledby="instructions-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 transition-opacity" aria-hidden="true">
        <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
      </div>
      
      <div 
        className="flex items-center justify-center min-h-screen p-4"
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl text-left shadow-xl transform transition-all duration-300 sm:my-8 w-full max-w-2xl border border-gray-200 dark:border-gray-700 modal-content"
          style={{ 
            transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.95)', 
            opacity: isOpen ? '1' : '0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 px-4 py-3 rounded-t-xl">
            <div className="flex justify-between items-center">
              <h3 
                className="text-base leading-6 font-medium text-white flex items-center"
                id="instructions-modal-title"
              >
                <div className="bg-blue-500/40 p-1 rounded-md mr-2 shadow-inner">
                  <FiInfo className="text-white" size={18} />
                </div>
                <span>{title}</span>
              </h3>
              <button
                className="text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors p-1 rounded-full hover:bg-blue-700/50 dark:hover:bg-blue-800/70"
                onClick={onClose}
                aria-label="Close"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="prose dark:prose-invert prose-sm max-w-none">
              {instructions.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-3 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal; 