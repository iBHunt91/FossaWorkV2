import { WorkOrder } from '../types';

// Types for filter determination
export interface DispenserFilter {
  fuelType: 'GAS' | 'DIESEL' | 'UNKNOWN';
  filterNeeded: boolean;
  grade: string;
  reason: string;
}

export interface FilterWarning {
  dispenserId: string;
  warning: string;
  grades: string[];
  severity?: number;
}

export interface FilterCalculationResult {
  gasFilters: number;
  dieselFilters: number;
  warnings: FilterWarning[];
  gasFilterTypes?: string[];
  dieselFilterTypes?: string[];
}

/**
 * Determines the severity level of a filter warning
 * Severity ranges from 1-10:
 * 1-3: Low severity - informational
 * 4-7: Medium severity - requires attention
 * 8-10: High severity - critical issue
 * 
 * @param warning The warning message
 * @returns Number from 1-10 indicating severity
 */
export function determineWarningSeverity(warning: FilterWarning): number {
  const warningText = warning.warning.toLowerCase();
  
  // Critical issues (8-10)
  if (
    warningText.includes('missing') || 
    warningText.includes('failed') ||
    warningText.includes('not functioning') ||
    warningText.includes('critical') ||
    warningText.includes('emergency') ||
    warningText.includes('contamination') ||
    warningText.includes('water intrusion')
  ) {
    return 9;
  }
  
  // High severity issues (7-8)
  if (
    warningText.includes('unknown fuel grade') ||
    warningText.includes('complex configuration') ||
    warningText.includes('zero filters') ||
    warningText.includes('excessive') ||
    warningText.includes('overdue') ||
    warningText.includes('malfunction')
  ) {
    return 8;
  }
  
  // Medium severity issues (4-7)
  if (
    warningText.includes('inconsistent') ||
    warningText.includes('verify') ||
    warningText.includes('unexpected') ||
    warningText.includes('unusual') ||
    warningText.includes('configuration') ||
    warningText.includes('unmatched')
  ) {
    return 6;
  }
  
  // Low severity issues (1-3)
  if (
    warningText.includes('note') ||
    warningText.includes('reminder') ||
    warningText.includes('consider') ||
    warningText.includes('check next visit')
  ) {
    return 3;
  }
  
  // Default medium severity
  return 5;
}

/**
 * Determines if a specific fuel grade requires a filter
 * @param grade The fuel grade to check
 * @param allGradesOnDispenser All grades on this particular dispenser
 */
export function doesGradeRequireFilter(
  grade: string, 
  allGradesOnDispenser: string[]
): DispenserFilter {
  // Normalize grade for case-insensitive comparison
  const normalizedGrade = grade.trim().toLowerCase();
  
  // Check if there are premium/super/ultra grades that might conflict
  const hasPremium = allGradesOnDispenser.some(g => 
    g.toLowerCase().includes('premium') && !g.toLowerCase().includes('super premium'));
  const hasSuper = allGradesOnDispenser.some(g => 
    g.toLowerCase().includes('super'));
  const hasUltra = allGradesOnDispenser.some(g => 
    g.toLowerCase().includes('ultra') && !g.toLowerCase().includes('ultra low'));

  // Regular always gets a filter
  if (normalizedGrade.includes('regular')) {
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'Regular always receives a filter'
    };
  }
  
  // Diesel always gets a filter
  if (normalizedGrade.includes('diesel')) {
    return {
      fuelType: 'DIESEL',
      filterNeeded: true,
      grade,
      reason: 'Diesel always receives a filter'
    };
  }
  
  // Ethanol-Free always gets a filter
  if (
    normalizedGrade.includes('ethanol-free') || 
    normalizedGrade.includes('e-0') ||
    normalizedGrade.includes('non-ethanol')
  ) {
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'Ethanol-Free always receives a filter'
    };
  }
  
  // Premium logic
  if (normalizedGrade.includes('premium') && !normalizedGrade.includes('super premium')) {
    // If both Premium and Super exist, Premium doesn't get a filter
    if (hasSuper) {
      return {
        fuelType: 'GAS',
        filterNeeded: false,
        grade,
        reason: 'Premium doesn\'t receive a filter when Super is present'
      };
    }
    
    // If both Premium and Ultra exist, Premium doesn't get a filter
    if (hasUltra) {
      return {
        fuelType: 'GAS',
        filterNeeded: false,
        grade,
        reason: 'Premium doesn\'t receive a filter when Ultra is present'
      };
    }
    
    // Otherwise Premium gets a filter
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'Premium receives a filter when neither Super nor Ultra are present'
    };
  }
  
  // Super/Super Premium logic
  if (normalizedGrade.includes('super')) {
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'Super/Super Premium always receives a filter'
    };
  }
  
  // Ultra logic
  if (normalizedGrade.includes('ultra') && !normalizedGrade.includes('ultra low')) {
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'Ultra always receives a filter'
    };
  }

  // Plus/Midgrade typically doesn't get a filter (it's a blend)
  if (normalizedGrade.includes('plus') || normalizedGrade.includes('midgrade')) {
    return {
      fuelType: 'GAS',
      filterNeeded: false,
      grade,
      reason: 'Plus/Midgrade is typically a blend and doesn\'t receive a filter'
    };
  }
  
  // E-85 gets a gas filter
  if (normalizedGrade.includes('e-85') || normalizedGrade.includes('e85')) {
    return {
      fuelType: 'GAS',
      filterNeeded: true,
      grade,
      reason: 'E-85 receives a gas filter'
    };
  }
  
  // Kerosene gets a diesel filter
  if (normalizedGrade.includes('kerosene')) {
    return {
      fuelType: 'DIESEL',
      filterNeeded: true,
      grade,
      reason: 'Kerosene receives a diesel filter'
    };
  }
  
  // For unknown or unhandled grades, flag as unknown
  return {
    fuelType: 'UNKNOWN',
    filterNeeded: false,
    grade,
    reason: 'Unknown fuel type - requires manual verification'
  };
}

/**
 * Calculates the number of filters needed for a work order
 * @param order The work order to calculate filters for
 */
export function calculateFiltersForWorkOrder(order: WorkOrder): FilterCalculationResult {
  let gasFilters = 0;
  let dieselFilters = 0;
  const warnings: FilterWarning[] = [];
  
  // Process dispensers if they exist
  if (order.dispensers && order.dispensers.length > 0) {
    order.dispensers.forEach((dispenser, index) => {
      // Extract fuel grades from the dispenser
      let grades: string[] = [];
      
      if (dispenser.fields && dispenser.fields.Grade) {
        // Split by commas or slashes to get individual grades
        grades = dispenser.fields.Grade.split(/[,;\/]+/).map(g => g.trim());
      }
      
      if (grades.length === 0 && dispenser.title) {
        // Try to extract from title if fields.Grade is not available
        const titleParts = dispenser.title.split('-');
        if (titleParts.length > 1) {
          const gradesSection = titleParts[1].trim();
          grades = gradesSection.split(/[,;\/]+/).map(g => g.trim());
        }
      }
      
      // Check each grade to see if it needs a filter
      const dispenserFilters: DispenserFilter[] = [];
      const unknownGrades: string[] = [];
      
      grades.forEach(grade => {
        const filterInfo = doesGradeRequireFilter(grade, grades);
        dispenserFilters.push(filterInfo);
        
        if (filterInfo.fuelType === 'UNKNOWN') {
          unknownGrades.push(grade);
        }
        
        if (filterInfo.filterNeeded) {
          if (filterInfo.fuelType === 'GAS') {
            gasFilters++;
          } else if (filterInfo.fuelType === 'DIESEL') {
            dieselFilters++;
          }
        }
      });
      
      // Add warning if unknown grades were found
      if (unknownGrades.length > 0) {
        const warning: FilterWarning = {
          dispenserId: `Dispenser ${index + 1}`,
          warning: 'Unknown fuel grade(s) detected',
          grades: unknownGrades
        };
        
        // Set the severity for this warning
        warning.severity = determineWarningSeverity(warning);
        warnings.push(warning);
      }
      
      // Add warning if conflicting premium/super/ultra logic
      const premiumGrades = dispenserFilters.filter(f => 
        f.grade.toLowerCase().includes('premium') && !f.grade.toLowerCase().includes('super premium'));
      const superGrades = dispenserFilters.filter(f => 
        f.grade.toLowerCase().includes('super'));
      const ultraGrades = dispenserFilters.filter(f => 
        f.grade.toLowerCase().includes('ultra') && !f.grade.toLowerCase().includes('ultra low'));
      
      if (premiumGrades.length > 0 && superGrades.length > 0 && ultraGrades.length > 0) {
        const warning: FilterWarning = {
          dispenserId: `Dispenser ${index + 1}`,
          warning: 'Complex configuration with Premium, Super, and Ultra - verify filter needs',
          grades: [...premiumGrades, ...superGrades, ...ultraGrades].map(f => f.grade)
        };
        
        // Set the severity for this warning
        warning.severity = determineWarningSeverity(warning);
        warnings.push(warning);
      }
    });
  } else if (order.dispenserHtml) {
    // Try to extract information from HTML if structured dispenser data is not available
    try {
      // Extract grade information from HTML
      const gradeMatches = order.dispenserHtml.match(/Grade[s]?:?\s*([^<]+)/gi);
      
      if (gradeMatches && gradeMatches.length > 0) {
        // There could be multiple dispensers in the HTML
        gradeMatches.forEach((match, index) => {
          // Extract just the grades part after "Grade:" or "Grades:"
          const gradesText = match.replace(/Grade[s]?:?\s*/i, '').trim();
          const grades = gradesText.split(/[,;\/]+/).map(g => g.trim());
          
          // Check each grade
          const dispenserFilters: DispenserFilter[] = [];
          const unknownGrades: string[] = [];
          
          grades.forEach(grade => {
            const filterInfo = doesGradeRequireFilter(grade, grades);
            dispenserFilters.push(filterInfo);
            
            if (filterInfo.fuelType === 'UNKNOWN') {
              unknownGrades.push(grade);
            }
            
            if (filterInfo.filterNeeded) {
              if (filterInfo.fuelType === 'GAS') {
                gasFilters++;
              } else if (filterInfo.fuelType === 'DIESEL') {
                dieselFilters++;
              }
            }
          });
          
          // Add warning if unknown grades were found
          if (unknownGrades.length > 0) {
            const warning: FilterWarning = {
              dispenserId: `HTML Dispenser ${index + 1}`,
              warning: 'Unknown fuel grade(s) detected in HTML content',
              grades: unknownGrades
            };
            
            // Set the severity for this warning
            warning.severity = determineWarningSeverity(warning);
            warnings.push(warning);
          }
        });
      } else {
        // If we couldn't find grade information, add a warning
        const warning: FilterWarning = {
          dispenserId: 'HTML Content',
          warning: 'Could not extract grade information from HTML content',
          grades: []
        };
        
        // Set the severity for this warning
        warning.severity = determineWarningSeverity(warning);
        warnings.push(warning);
        
        // Fallback to basic estimate based on dispenser count
        const dispenserCount = (order.services?.find(s => s.type === "Meter Calibration")?.quantity || 0);
        if (dispenserCount > 0) {
          // Updated estimate: assume 2 gas filters per dispenser (for Regular and Premium)
          gasFilters = dispenserCount * 2;
          const warning: FilterWarning = {
            dispenserId: 'Estimated',
            warning: `Filter estimation using standard calculation - verify actual filter needs`,
            grades: []
          };
          
          // Set the severity for this warning
          warning.severity = determineWarningSeverity(warning);
          warnings.push(warning);
        }
      }
    } catch (error) {
      console.error('Error parsing dispenser HTML:', error);
      const warning: FilterWarning = {
        dispenserId: 'Error',
        warning: 'Error processing dispenser information',
        grades: []
      };
      
      // Set the severity for this warning
      warning.severity = determineWarningSeverity(warning);
      warnings.push(warning);
    }
  } else {
    // If no dispenser data at all, use a fallback method
    const dispenserCount = (order.services?.find(s => s.type === "Meter Calibration")?.quantity || 0);
    if (dispenserCount > 0) {
      // Updated estimate: assume 2 gas filters per dispenser (for Regular and Premium)
      gasFilters = dispenserCount * 2;
      const warning: FilterWarning = {
        dispenserId: 'No Data',
        warning: `Please verify filter needs - using standard estimates`,
        grades: []
      };
      
      // Set the severity for this warning
      warning.severity = determineWarningSeverity(warning);
      warnings.push(warning);
    }
  }
  
  // Apply severity levels to any warnings that don't have them yet
  warnings.forEach(warning => {
    if (warning.severity === undefined) {
      warning.severity = determineWarningSeverity(warning);
    }
  });
  
  return {
    gasFilters,
    dieselFilters,
    warnings
  };
} 