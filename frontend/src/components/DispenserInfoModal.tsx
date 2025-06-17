import React, { useState } from 'react';
import { Modal } from './ui/modal';
import { cleanSiteName } from '@/utils/storeColors';
import { 
  Fuel, 
  Wrench, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  Gauge,
  Hash,
  Cpu,
  Activity,
  Info,
  Package,
  Settings,
  Droplet
} from 'lucide-react';

interface FuelGrade {
  octane?: number;
  ethanol?: number;
  cetane?: number;
  position: number;
}

interface Dispenser {
  dispenser_number: string;
  dispenser_numbers?: string[];  // Array format like ["1/2"]
  title?: string;  // Contains "Dispenser 1/2" format
  dispenser_type: string;
  fuel_grades: Record<string, FuelGrade>;
  fuel_grades_list?: string[];  // New field from backend
  status?: string;
  progress_percentage?: number;
  automation_completed?: boolean;
  // Additional scraped fields
  serial_number?: string;
  stand_alone_code?: string;
  number_of_nozzles?: number;
  meter_type?: string;
  make?: string;
  model?: string;
  grades_list?: string[];
  custom_fields?: Record<string, any>;
  // Form data that may contain additional scraped info
  form_data?: {
    stand_alone_code?: string;
    grades_list?: string[];
    title?: string;
    dispenser_numbers?: string[];
    custom_fields?: Record<string, any>;
  };
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
  service_name?: string;
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
  const [expandedDispensers, setExpandedDispensers] = useState<Set<string>>(new Set());

  const formatFuelGrades = (fuelGrades: Record<string, any>): string[] => {
    if (!fuelGrades || Object.keys(fuelGrades).length === 0) return [];
    
    // Handle case where fuel_grades might have a different structure
    try {
      const grades = Object.entries(fuelGrades)
        .filter(([key, value]) => {
          // Filter out any non-fuel grade data
          const keyLower = key.toLowerCase();
          return typeof key === 'string' && 
                 !keyLower.includes('api') && 
                 !keyLower.includes('error') &&
                 !keyLower.includes('type') &&
                 !keyLower.includes('work order') &&
                 value !== null &&
                 value !== undefined;
        })
        .sort(([, a], [, b]) => {
          const posA = a?.position || 0;
          const posB = b?.position || 0;
          return posA - posB;
        })
        .map(([grade, gradeInfo]) => {
          // Handle both old format (with octane) and new format (with name)
          if (typeof gradeInfo === 'object' && gradeInfo?.name) {
            return gradeInfo.name;
          }
          if (typeof gradeInfo === 'string') {
            // If the value is a string, use it directly unless it contains error text
            if (gradeInfo.toLowerCase().includes('api') || gradeInfo.toLowerCase().includes('error')) {
              return null;
            }
            return gradeInfo;
          }
          // Just capitalize the grade name without octane ratings
          return grade.charAt(0).toUpperCase() + grade.slice(1).toLowerCase();
        })
        .filter(Boolean); // Remove any null values
        
      // If we still have bad data, return empty array
      if (grades.some(g => g.toLowerCase().includes('api') || g.toLowerCase().includes('type'))) {
        console.warn('Fuel grades contain API error text, returning empty array');
        return [];
      }
      
      return grades;
    } catch (error) {
      console.error('Error formatting fuel grades:', error, fuelGrades);
      return [];
    }
  };

  const toggleDispenser = (dispenserNumber: string) => {
    const newExpanded = new Set(expandedDispensers);
    if (newExpanded.has(dispenserNumber)) {
      newExpanded.delete(dispenserNumber);
    } else {
      newExpanded.add(dispenserNumber);
    }
    setExpandedDispensers(newExpanded);
  };

  const dispensers = dispenserData?.dispensers || dispenserData?.workOrder?.dispensers || [];
  
  // Debug logging
  if (isOpen && dispensers.length > 0) {
    console.log('DispenserInfoModal - Dispensers:', dispensers);
    console.log('DispenserInfoModal - First dispenser fuel_grades:', dispensers[0]?.fuel_grades);
    console.log('DispenserInfoModal - First dispenser fuel_grades_list:', (dispensers[0] as any)?.fuel_grades_list);
    console.log('DispenserInfoModal - First dispenser full data:', dispensers[0]);
  }
  
  // Collect all unique fuel grade types across all dispensers for consistent column alignment
  const allFuelGradeTypes = new Set<string>();
  dispensers.forEach(dispenser => {
    let fuelGrades = (dispenser as any).fuel_grades_list || dispenser.grades_list || formatFuelGrades(dispenser.fuel_grades);
    
    // Filter out non-fuel grade items
    if (Array.isArray(fuelGrades)) {
      fuelGrades = fuelGrades.filter(grade => {
        if (typeof grade !== 'string') return false;
        const gradeLower = grade.toLowerCase();
        const nonFuelKeywords = [
          'stand alone', 'standalone', 'code',
          'nozzle', 'nozzles',
          'meter', 'type',
          'number of',
          'per side'
        ];
        return !nonFuelKeywords.some(keyword => gradeLower.includes(keyword));
      });
      
      fuelGrades.forEach(grade => allFuelGradeTypes.add(grade));
    }
  });
  
  // Convert to array and sort in a consistent order (Regular, Plus, Premium, Diesel, others...)
  const sortedFuelGradeTypes = Array.from(allFuelGradeTypes).sort((a, b) => {
    const order = ['Regular', 'Plus', 'Mid', 'Premium', 'Super', 'Diesel', 'DEF'];
    const aIndex = order.findIndex(o => a.toLowerCase().includes(o.toLowerCase()));
    const bIndex = order.findIndex(o => b.toLowerCase().includes(o.toLowerCase()));
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  // Helper to get dispenser manufacturer
  const getManufacturer = (dispenser: Dispenser): string => {
    return dispenser.make || dispenser.equipment?.make || dispenser.dispenser_type.split(' ')[0] || 'Unknown';
  };

  // Helper to get model info
  const getModelInfo = (dispenser: Dispenser): string => {
    return dispenser.model || dispenser.equipment?.model || dispenser.dispenser_type || 'Unknown';
  };

  // Helper to format dispenser number display
  const formatDispenserNumber = (dispenser: Dispenser): string => {
    // First priority: Use the dispenser_number field directly
    // This should have the proper format like "1/2", "3/4", etc.
    if (dispenser.dispenser_number && dispenser.dispenser_number !== 'Unknown') {
      return dispenser.dispenser_number;
    }
    
    // Second priority: Check if there's a dispenser_numbers array
    // For dual-sided dispensers, this might have ["1", "2"] which we combine to "1/2"
    if (dispenser.dispenser_numbers && dispenser.dispenser_numbers.length > 1) {
      return dispenser.dispenser_numbers.join('/');
    } else if (dispenser.dispenser_numbers && dispenser.dispenser_numbers.length === 1) {
      return dispenser.dispenser_numbers[0];
    }
    
    // Last resort: Try to extract from title (e.g., "Dispenser 1/2" -> "1/2")
    if (dispenser.title) {
      const match = dispenser.title.match(/Dispenser\s+(\d+(?:\/\d+)?)/i);
      if (match) {
        return match[1];
      }
    }
    
    // Fallback
    return 'Unknown';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dispenserData?.workOrder 
        ? `${cleanSiteName(dispenserData.workOrder.site_name)} - Dispenser Information`
        : 'Dispenser Information'
      }
      size="2xl"
    >
      {!dispenserData || dispensers.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Dispenser Information Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Dispenser information is not available for this work order. 
            Please run a dispenser scrape to gather the information.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Total Dispensers: {dispensers.length}
                </p>
                {dispenserData?.workOrder?.service_name && (
                  <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                    Service: {dispenserData.workOrder.service_name}
                  </p>
                )}
              </div>
              <Gauge className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Dispenser List with Expandable Details */}
          <div className="space-y-3">
            {dispensers.map((dispenser) => {
              const isExpanded = expandedDispensers.has(dispenser.dispenser_number);
              const dispenserNum = formatDispenserNumber(dispenser);
              // Use fuel_grades_list if available, otherwise parse fuel_grades
              let fuelGrades = (dispenser as any).fuel_grades_list || dispenser.grades_list || formatFuelGrades(dispenser.fuel_grades);
              
              // Filter out non-fuel grade items that might have been incorrectly included
              if (Array.isArray(fuelGrades)) {
                fuelGrades = fuelGrades.filter(grade => {
                  if (typeof grade !== 'string') return false;
                  const gradeLower = grade.toLowerCase();
                  // Filter out obvious non-fuel items
                  const nonFuelKeywords = [
                    'stand alone', 'standalone', 'code',
                    'nozzle', 'nozzles',
                    'meter', 'type',
                    'number of',
                    'per side'
                  ];
                  return !nonFuelKeywords.some(keyword => gradeLower.includes(keyword));
                });
              }
              
              // Debug logging for each dispenser
              console.log(`Dispenser ${dispenserNum} - fuel_grades:`, dispenser.fuel_grades);
              console.log(`Dispenser ${dispenserNum} - fuel_grades_list:`, (dispenser as any).fuel_grades_list);
              console.log(`Dispenser ${dispenserNum} - grades_list:`, dispenser.grades_list);
              console.log(`Dispenser ${dispenserNum} - computed fuelGrades:`, fuelGrades);
              
              return (
                <div 
                  key={dispenser.dispenser_number}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
                >
                  {/* Main Dispenser Row - Always Visible */}
                  <button
                    onClick={() => toggleDispenser(dispenser.dispenser_number)}
                    className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      {/* Left Side - Dispenser Number and Basic Info */}
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex items-center space-x-2">
                          <div className="bg-blue-600 text-white rounded-md px-3 py-1 text-sm font-bold min-w-[4rem] text-center">
                            {dispenserNum}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {getManufacturer(dispenser)} {getModelInfo(dispenser)}
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Fuel Grades (Fixed Width for Consistent Alignment) */}
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center gap-2">
                          {sortedFuelGradeTypes.map((gradeType) => {
                            // Check if this dispenser has this grade type
                            const hasGrade = fuelGrades.includes(gradeType);
                            
                            if (!hasGrade) {
                              // Empty placeholder to maintain alignment
                              return (
                                <div
                                  key={gradeType}
                                  className="w-20 h-7" // Fixed width placeholder
                                />
                              );
                            }
                            
                            // Determine color based on grade type
                            let colorClasses = "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100";
                            
                            if (gradeType.toLowerCase().includes('plus') || gradeType.toLowerCase().includes('mid')) {
                              colorClasses = "bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700 text-green-900 dark:text-green-100";
                            } else if (gradeType.toLowerCase().includes('premium')) {
                              colorClasses = "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-100";
                            } else if (gradeType.toLowerCase().includes('diesel')) {
                              colorClasses = "bg-gradient-to-r from-gray-600 to-gray-700 dark:from-gray-700 dark:to-gray-800 border-gray-500 dark:border-gray-600 text-white";
                            } else if (gradeType.toLowerCase().includes('e85') || gradeType.toLowerCase().includes('ethanol')) {
                              colorClasses = "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100";
                            } else if (gradeType.toLowerCase().includes('def')) {
                              colorClasses = "bg-gradient-to-r from-cyan-50 to-cyan-100 dark:from-cyan-900 dark:to-cyan-800 border-cyan-200 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100";
                            }
                            
                            return (
                              <div
                                key={gradeType}
                                className={`inline-flex items-center justify-center px-2 py-1 border rounded text-xs font-medium w-20 ${colorClasses}`}
                              >
                                <Droplet className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{gradeType}</span>
                              </div>
                            );
                          })}
                        </div>
                        
                        {dispenser.automation_completed && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Equipment Information */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                            <Cpu className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                            Equipment Details
                          </h4>
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Make:</span>
                              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                {getManufacturer(dispenser)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Model:</span>
                              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                {getModelInfo(dispenser)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Serial Number:</span>
                              <span className="ml-2 font-mono font-medium text-gray-900 dark:text-white">
                                {dispenser.serial_number || 'N/A'}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Stand Alone Code:</span>
                              <span className="ml-2 font-mono font-medium text-gray-900 dark:text-white">
                                {dispenser.stand_alone_code || dispenser.form_data?.stand_alone_code || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Configuration */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                            <Settings className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                            Configuration
                          </h4>
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Number of Nozzles:</span>
                              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                {dispenser.number_of_nozzles || dispenser.form_data?.custom_fields?.number_of_nozzles || 'N/A'}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Meter Type:</span>
                              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                {dispenser.meter_type || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};