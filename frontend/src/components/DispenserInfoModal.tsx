import React, { useState } from 'react';
import { Modal } from './ui/modal';
import { Badge } from './ui/badge';
import { cleanSiteName } from '@/utils/storeColors';
import { format } from 'date-fns';
import { Dispenser as BaseDispenser } from '../services/api';
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
  Droplet,
  Calendar,
  MapPin,
  Store,
  FileText,
  Filter,
  Box
} from 'lucide-react';

// Comprehensive fuel grade ordering based on backend fuel_grades.py
const FUEL_GRADE_ORDER = [
  'Regular',
  'Anti-Freeze', 
  'Regular/Premium',
  'Regular/Premium/Diesel',
  'Sodium Hydroxide',
  'Special 88',
  'Stage 1 Dry Break',
  'Super',
  'Super Premium',
  'Toluene',
  'Trans Fluid',
  'Transmission Fluid',
  'Aviation Fuel',
  'Truck Diesel',
  'Ultra Blend',
  'Ultra Low Sulfur Diesel',
  'Bio-Diesel',
  'Regular/Premium/E-0',
  'Ethanol-Free',
  'Midgrade 91',
  'Regular (2nd)',
  'Regular / E-85',
  'Diesel (Generator)',
  'Diesel (drone)',
  'Diesel / DEF',
  'Diesel / Diesel',
  'Plus',
  'Diesel / Ethanol-Free',
  'DEF',
  'Diesel High Flow',
  'E85',
  'Ethanol',
  'Premium',
  'Mid',
  'Midgrade',
  'Diesel'
];

// Helper function to get fuel grade order index
const getGradeIndex = (grade: string): number => {
  // Direct match
  const directIndex = FUEL_GRADE_ORDER.findIndex(orderGrade => 
    orderGrade.toLowerCase() === grade.toLowerCase()
  );
  if (directIndex !== -1) return directIndex;
  
  // Partial match for complex grades
  const partialIndex = FUEL_GRADE_ORDER.findIndex(orderGrade => 
    grade.toLowerCase().includes(orderGrade.toLowerCase()) ||
    orderGrade.toLowerCase().includes(grade.toLowerCase())
  );
  if (partialIndex !== -1) return partialIndex;
  
  // Unknown grades go to end
  return FUEL_GRADE_ORDER.length;
};

// Use the base Dispenser interface from api.ts and extend it for modal-specific needs
interface Dispenser extends BaseDispenser {
  dispenser_numbers?: string[];  // Array format like ["1/2"]
  title?: string;  // Contains "Dispenser 1/2" format
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
  // From backend filter calculation
  dispenserNumber?: string;
  dispenserType?: string;
  meterType?: string;
  fuelGrades?: Array<{
    position: number;
    grade: string;
  }>;
}

interface WorkOrder {
  id: string;
  external_id?: string;
  site_name?: string;
  storeName?: string;
  address: string;
  service_name?: string;
  serviceName?: string;
  dispensers?: Dispenser[];
  store_number?: string;
  storeNumber?: string;
  visit_url?: string;
  scheduled_date?: string;
  scheduledDate?: string;
  created_date?: string;
  customerName?: string;
  serviceCode?: string;
}

interface DispenserModalData {
  workOrder: WorkOrder;
  dispensers?: Dispenser[];
  filters?: {
    [partNumber: string]: {
      quantity: number;
      description: string;
      filterType: string;
      isEdited?: boolean;
      originalQuantity?: number;
    };
  };
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
        ? `${cleanSiteName(dispenserData.workOrder.site_name || dispenserData.workOrder.storeName)} - Dispenser Information`
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
            Please run a dispenser scrape to gather the information.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Information - Store, Visit, Date */}
          {dispenserData?.workOrder && (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              {/* Top row - Store, Visit, Date badges */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Store Number Badge */}
                {(dispenserData.workOrder.store_number || dispenserData.workOrder.storeNumber) && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-3 py-1.5 font-medium">
                    <Store className="w-3 h-3 mr-1.5" />
                    Store {(dispenserData.workOrder.store_number || dispenserData.workOrder.storeNumber || '').replace('#', '')}
                  </Badge>
                )}
                
                {/* Visit Number Badge */}
                {(dispenserData.workOrder.external_id || dispenserData.workOrder.id) && (
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-3 py-1.5 font-medium">
                    <FileText className="w-3 h-3 mr-1.5" />
                    Visit {(dispenserData.workOrder.external_id || dispenserData.workOrder.id || '').replace('W-', '')}
                  </Badge>
                )}
                
                {/* Date Information */}
                {(dispenserData.workOrder.scheduled_date || dispenserData.workOrder.scheduledDate || dispenserData.workOrder.created_date) && (
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 px-3 py-1.5 font-medium">
                    <Calendar className="w-3 h-3 mr-1.5" />
                    {(() => {
                      const dateStr = dispenserData.workOrder.scheduled_date || dispenserData.workOrder.scheduledDate || dispenserData.workOrder.created_date;
                      if (!dateStr) return 'No date';
                      
                      try {
                        const date = new Date(dateStr);
                        const dayOfWeek = format(date, 'EEEE');
                        const formattedDate = format(date, 'MMM d, yyyy');
                        return `${dayOfWeek}, ${formattedDate}`;
                      } catch (error) {
                        return dateStr;
                      }
                    })()}
                  </Badge>
                )}
              </div>
              
              {/* Bottom row - Address (full width, clickable) */}
              {dispenserData.workOrder.address && (
                <button
                  onClick={() => {
                    // Intelligent address parsing for better navigation
                    const parseAddressForNavigation = (address: string): string => {
                      let cleanAddress = address.trim();
                      
                      // Remove common prefixes that might interfere with navigation
                      cleanAddress = cleanAddress.replace(/^(Location:|Address:|Site:|Store:|Station:)\s*/i, '');
                      
                      // Handle multi-line addresses (sometimes addresses have line breaks)
                      cleanAddress = cleanAddress.replace(/\n+/g, ', ');
                      
                      // Clean up multiple spaces and commas
                      cleanAddress = cleanAddress.replace(/\s+/g, ' ').replace(/,+/g, ',').replace(/,\s*,/g, ',');
                      
                      // Extract components for better parsing
                      const parts = cleanAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
                      
                      if (parts.length === 0) return cleanAddress;
                      
                      // Try to identify and reconstruct address components
                      let streetAddress = '';
                      let cityStateZip = '';
                      
                      // Look for ZIP code pattern (5 digits or 5+4 format)
                      const zipPattern = /\b\d{5}(-\d{4})?\b/;
                      
                      // Find the part with ZIP code (likely city, state zip)
                      const zipPartIndex = parts.findIndex(part => zipPattern.test(part));
                      
                      if (zipPartIndex > -1) {
                        // Everything before ZIP part is likely street address
                        streetAddress = parts.slice(0, zipPartIndex).join(', ');
                        // ZIP part is city, state, zip
                        cityStateZip = parts[zipPartIndex];
                        
                        // If there are parts after the ZIP, they might be additional info (county, etc.)
                        // We'll ignore those for navigation as they can confuse maps
                        
                        return streetAddress && cityStateZip ? `${streetAddress}, ${cityStateZip}` : cleanAddress;
                      }
                      
                      // If no ZIP found, try to identify state abbreviations
                      const statePattern = /\b[A-Z]{2}\b/;
                      const statePartIndex = parts.findIndex(part => statePattern.test(part));
                      
                      if (statePartIndex > -1) {
                        streetAddress = parts.slice(0, statePartIndex).join(', ');
                        cityStateZip = parts.slice(statePartIndex).join(', ');
                        return streetAddress && cityStateZip ? `${streetAddress}, ${cityStateZip}` : cleanAddress;
                      }
                      
                      // If we can't parse intelligently, use the first 2-3 parts (likely street + city/state)
                      if (parts.length >= 3) {
                        return parts.slice(0, 3).join(', ');
                      }
                      
                      return cleanAddress;
                    };
                    
                    const parsedAddress = parseAddressForNavigation(dispenserData.workOrder.address);
                    const encodedAddress = encodeURIComponent(parsedAddress);
                    
                    // Use Google Maps search with place API for better accuracy
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                  }}
                  className="w-full bg-white dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 flex items-center gap-3 text-left group"
                  title="Click to open in Google Maps"
                >
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/60 transition-colors">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Address</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                      {dispenserData.workOrder.address}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Summary Stats */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Total Dispensers: {dispensers.length}
                </p>
                {(dispenserData?.workOrder?.service_name || dispenserData?.workOrder?.serviceName) && (
                  <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                    Service: {dispenserData.workOrder.service_name || dispenserData.workOrder.serviceName}
                  </p>
                )}
              </div>
              <Gauge className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Filter Summary for this Job */}
          {dispenserData?.filters && Object.keys(dispenserData.filters).length > 0 ? (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 1px)',
                  backgroundSize: '32px 32px'
                }} />
              </div>
              
              {/* Header */}
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Filter Requirements
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.keys(dispenserData.filters).length} type{Object.keys(dispenserData.filters).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full">
                  <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {Object.values(dispenserData.filters).reduce((sum, filter) => sum + filter.quantity, 0)}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    Total
                  </span>
                </div>
              </div>
              
              {/* Filter Cards */}
              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(dispenserData.filters).map(([partNumber, filter], index) => {
                  // Enhanced color theming
                  let gradientClass = "from-gray-500 to-gray-600";
                  let glowClass = "";
                  let iconBg = "bg-gray-100 dark:bg-gray-800";
                  let icon = <Filter className="w-4 h-4" />;
                  
                  if (filter.filterType === 'gas') {
                    gradientClass = "from-blue-500 to-indigo-600";
                    glowClass = "hover:shadow-blue-500/25";
                    iconBg = "bg-blue-100 dark:bg-blue-900/50";
                    icon = <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
                  } else if (filter.filterType === 'diesel') {
                    gradientClass = "from-green-500 to-emerald-600";
                    glowClass = "hover:shadow-green-500/25";
                    iconBg = "bg-green-100 dark:bg-green-900/50";
                    icon = <Droplet className="w-4 h-4 text-green-600 dark:text-green-400" />;
                  } else if (filter.filterType === 'def') {
                    gradientClass = "from-cyan-500 to-teal-600";
                    glowClass = "hover:shadow-cyan-500/25";
                    iconBg = "bg-cyan-100 dark:bg-cyan-900/50";
                    icon = <Droplet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
                  }
                  
                  return (
                    <div
                      key={partNumber}
                      className={`group relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:scale-105 hover:shadow-lg ${glowClass}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Gradient Border Effect */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                      
                      {/* Content */}
                      <div className="relative p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-1.5 rounded-lg ${iconBg} transition-transform group-hover:scale-110`}>
                            {icon}
                          </div>
                          {filter.isEdited && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                              <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                                Edited
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                              {filter.filterType}
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {partNumber}
                            </p>
                          </div>
                          
                          <div className={`text-2xl font-bold bg-gradient-to-br ${gradientClass} bg-clip-text text-transparent`}>
                            {filter.quantity}
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover Effect Line */}
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradientClass} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Info className="w-5 h-5" />
                <p className="text-sm">
                  No filters required for this job
                  {dispenserData?.workOrder?.serviceCode === '3146' && ' (Open Neck Prover service)'}
                </p>
              </div>
            </div>
          )}

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
                    <div className="flex items-start gap-4">
                      {/* Left Side - Dispenser Number and Basic Info */}
                      <div className="flex items-center space-x-4 flex-shrink-0">
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
                          <div className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {getManufacturer(dispenser)} {getModelInfo(dispenser)}
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Fuel Grades (Responsive Layout) */}
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          {fuelGrades.sort((a, b) => {
                            const aIndex = getGradeIndex(a);
                            const bIndex = getGradeIndex(b);
                            
                            if (aIndex !== bIndex) return aIndex - bIndex;
                            return a.localeCompare(b); // Alphabetical for same priority
                          }).map((gradeType) => {
                            // API Standard Color Coding + Industry Best Practices
                            let colorClasses = "bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100";
                            
                            const grade = gradeType.toLowerCase();
                            
                            // API Standard: White = Regular gasoline (87 octane)
                            if (grade.includes('regular') || grade.includes('87')) {
                              colorClasses = "bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200";
                            }
                            // API Standard: Blue = Midgrade gasoline (89 octane)
                            else if (grade.includes('plus') || grade.includes('mid') || grade.includes('89') || grade.includes('88')) {
                              colorClasses = "bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100";
                            }
                            // API Standard: Red = Premium gasoline (91+ octane)
                            else if (grade.includes('premium') || grade.includes('super') || grade.includes('91') || grade.includes('93')) {
                              colorClasses = "bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 border-red-300 dark:border-red-600 text-red-900 dark:text-red-100";
                            }
                            // Green = Diesel (industry standard pump color)
                            else if (grade.includes('diesel') || grade.includes('dsl')) {
                              colorClasses = "bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 border-green-300 dark:border-green-600 text-green-900 dark:text-green-100";
                            }
                            // Yellow = E85/Ethanol (industry standard pump handle color)
                            else if (grade.includes('e85') || grade.includes('e15') || grade.includes('ethanol')) {
                              colorClasses = "bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900 dark:to-yellow-800 border-yellow-300 dark:border-yellow-600 text-yellow-900 dark:text-yellow-100";
                            }
                            // Light Blue = DEF (Diesel Exhaust Fluid)
                            else if (grade.includes('def') || grade.includes('exhaust')) {
                              colorClasses = "bg-gradient-to-r from-sky-100 to-sky-200 dark:from-sky-900 dark:to-sky-800 border-sky-300 dark:border-sky-600 text-sky-900 dark:text-sky-100";
                            }
                            // Purple = Special/Aviation fuels
                            else if (grade.includes('aviation') || grade.includes('jet') || grade.includes('avgas')) {
                              colorClasses = "bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-100";
                            }
                            // Orange = Bio-diesel and alternative fuels
                            else if (grade.includes('bio') || grade.includes('biodiesel') || grade.includes('renewable')) {
                              colorClasses = "bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 border-orange-300 dark:border-orange-600 text-orange-900 dark:text-orange-100";
                            }
                            // Cyan = Kerosene and heating fuels
                            else if (grade.includes('kerosene') || grade.includes('heating') || grade.includes('fuel oil')) {
                              colorClasses = "bg-gradient-to-r from-cyan-100 to-cyan-200 dark:from-cyan-900 dark:to-cyan-800 border-cyan-300 dark:border-cyan-600 text-cyan-900 dark:text-cyan-100";
                            }
                            // Pink = Racing/Special fuels
                            else if (grade.includes('race') || grade.includes('racing') || grade.includes('high octane')) {
                              colorClasses = "bg-gradient-to-r from-pink-100 to-pink-200 dark:from-pink-900 dark:to-pink-800 border-pink-300 dark:border-pink-600 text-pink-900 dark:text-pink-100";
                            }
                            // Indigo = CNG/LNG and gas fuels
                            else if (grade.includes('cng') || grade.includes('lng') || grade.includes('natural gas')) {
                              colorClasses = "bg-gradient-to-r from-indigo-100 to-indigo-200 dark:from-indigo-900 dark:to-indigo-800 border-indigo-300 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100";
                            }
                            
                            return (
                              <div
                                key={gradeType}
                                className={`inline-flex items-center px-2 py-1 border rounded text-xs font-medium ${colorClasses} whitespace-nowrap`}
                                title={gradeType} // Tooltip for full text
                              >
                                <Droplet className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span>{gradeType}</span>
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