import React from 'react';
import { Modal } from './ui/modal';

interface DispenserInfoModalDebugProps {
  isOpen: boolean;
  onClose: () => void;
  dispenserData: any;
}

export const DispenserInfoModalDebug: React.FC<DispenserInfoModalDebugProps> = ({
  isOpen,
  onClose,
  dispenserData
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispenser Data Debug"
      size="2xl"
    >
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Raw Dispenser Data:</h3>
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto max-h-96 text-xs">
          {JSON.stringify(dispenserData, null, 2)}
        </pre>
      </div>
    </Modal>
  );
};