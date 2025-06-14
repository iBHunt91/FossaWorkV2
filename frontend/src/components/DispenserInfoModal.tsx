import React, { useState } from 'react';
import { Modal } from './ui/modal';
import { Fuel, Wrench, Calendar, Clock, CheckCircle, AlertCircle, ChevronRight, X, Gauge } from 'lucide-react';

interface FuelGrade {
  octane?: number;
  ethanol?: number;
  cetane?: number;
  position: number;
}

interface Dispenser {
  dispenser_number: string;
  dispenser_type: string;
  fuel_grades: Record<string, FuelGrade>;
  status?: string;
  progress_percentage?: number;
  automation_completed?: boolean;
  // Equipment details
  equipment?: {
    pump?: string;
    meter?: string;
    nozzles?: string[];
    make?: string;
    model?: string;
    standalone?: boolean;
  };
}

interface WorkOrder {
  id: string;
  external_id: string;
  site_name: string;
  address: string;
  dispensers?: Dispenser[];
}

interface DispenserModalData {
  workOrder: WorkOrder;
  dispensers?: Dispenser[];
}

interface DispenserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispenserData: DispenserModalData | null;
}

export const DispenserInfoModal: React.FC<DispenserInfoModalProps> = ({
  isOpen,
  onClose,
  dispenserData
}) => {
  const [selectedDispenser, setSelectedDispenser] = useState<Dispenser | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const formatFuelGrades = (fuelGrades: Record<string, FuelGrade>): string[] => {
    return Object.keys(fuelGrades)
      .sort((a, b) => fuelGrades[a].position - fuelGrades[b].position)
      .map(grade => grade.charAt(0).toUpperCase() + grade.slice(1));
  };

  const handleDispenserClick = (dispenser: Dispenser) => {
    setSelectedDispenser(dispenser);
    setShowDetails(true);
  };

  const handleBackToGrid = () => {
    setShowDetails(false);
    setSelectedDispenser(null);
  };

  const dispensers = dispenserData?.dispensers || dispenserData?.workOrder?.dispensers || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showDetails && selectedDispenser 
        ? `Dispenser ${selectedDispenser.dispenser_number} - ${selectedDispenser.dispenser_type}`
        : dispenserData?.workOrder 
          ? `${dispenserData.workOrder.site_name} - Dispensers`
          : 'Dispenser Information'
      }
      size="xl"
    >
      {!dispenserData || dispensers.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Dispenser Information Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Dispenser information is not available for this work order. 
            If this store has dispensers, please perform a scrape to gather the information.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Note: Not all stores have dispenser information available.
          </p>
        </div>
      ) : showDetails && selectedDispenser ? (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={handleBackToGrid}
            className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
            Back to all dispensers
          </button>

          {/* Detailed dispenser information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Type</h3>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {selectedDispenser.dispenser_type}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Fuel Grades</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formatFuelGrades(selectedDispenser.fuel_grades).map((grade, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                    >
                      {grade}
                    </span>
                  ))}
                </div>
              </div>

              {selectedDispenser.status && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h3>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedDispenser.status}
                  </p>
                </div>
              )}
            </div>

            {/* Equipment Information */}
            {selectedDispenser.equipment && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center">
                  <Wrench className="w-5 h-5 mr-2" />
                  Equipment Details
                </h3>
                
                {selectedDispenser.equipment.make && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Make:</span>
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      {selectedDispenser.equipment.make}
                    </p>
                  </div>
                )}
                
                {selectedDispenser.equipment.model && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Model:</span>
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      {selectedDispenser.equipment.model}
                    </p>
                  </div>
                )}
                
                {selectedDispenser.equipment.standalone !== undefined && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Type:</span>
                    <p className="font-medium text-gray-700 dark:text-gray-200">
                      {selectedDispenser.equipment.standalone ? 'Standalone' : 'MPD'}
                    </p>
                  </div>
                )}
                
                {selectedDispenser.equipment.nozzles && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Nozzles:</span>
                    <ul className="mt-1 space-y-1">
                      {selectedDispenser.equipment.nozzles.map((nozzle, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-200">
                          • {nozzle}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Grid view of all dispensers */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click on any dispenser to view detailed information
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {dispensers.map((dispenser) => (
              <button
                key={dispenser.dispenser_number}
                onClick={() => handleDispenserClick(dispenser)}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    #{dispenser.dispenser_number}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {dispenser.dispenser_type}
                </p>
                
                <div className="flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-gray-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFuelGrades(dispenser.fuel_grades).join(', ')}
                  </p>
                </div>
                
                {dispenser.automation_completed && (
                  <div className="mt-2 flex items-center text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="text-xs">Completed</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};