/**
 * Job Instruction Parsing Utility
 * Based on V1 rules for extracting key information from work order instructions
 */

export interface ParsedInstructions {
  dispenserNumbers: string[]
  dispenserPairs: string[]
  specialJobType: 'new_store' | 'remodeled' | 'circle_k_priority' | 'multi_day' | 'post_construction' | null
  priority: number | null
  multiDayInfo: {
    isMultiDay: boolean
    currentDay: number | null
    totalDays: number | null
    isStartDay: boolean
    isFinishDay: boolean
  }
  calibrationRequired: boolean
  fuelGrades: {
    regular: boolean
    plus: boolean
    super: boolean
    ultra: boolean
    diesel: boolean
    ethanol_free: boolean
    race_fuel: boolean
    special_88: boolean
    extra_89: boolean
  }
  automationType: 'all_dispensers' | 'specific_dispensers' | 'open_neck_prover'
  rawText: string
  keyInfo: string[] // Extracted key points for display
}

/**
 * Parse work order instructions to extract key information
 */
export function parseInstructions(
  instructions: string | null | undefined,
  serviceCode?: string
): ParsedInstructions {
  const result: ParsedInstructions = {
    dispenserNumbers: [],
    dispenserPairs: [],
    specialJobType: null,
    priority: null,
    multiDayInfo: {
      isMultiDay: false,
      currentDay: null,
      totalDays: null,
      isStartDay: false,
      isFinishDay: false
    },
    calibrationRequired: false,
    fuelGrades: {
      regular: false,
      plus: false,
      super: false,
      ultra: false,
      diesel: false,
      ethanol_free: false,
      race_fuel: false,
      special_88: false,
      extra_89: false
    },
    automationType: 'all_dispensers',
    rawText: instructions || '',
    keyInfo: []
  }

  if (!instructions) {
    return result
  }

  const text = instructions.toLowerCase()
  const originalText = instructions

  // 1. Dispenser Number Extraction
  extractDispenserNumbers(originalText, result)

  // 2. Special Job Classification
  extractSpecialJobType(text, originalText, result)

  // 3. Service Code Logic
  determineAutomationType(serviceCode, result)

  // 4. Calibration Detection - REMOVED (all jobs require calibration)
  // detectCalibration(text, result)

  // 5. Fuel Grade Classification
  extractFuelGrades(text, result)

  // 6. Multi-day Detection
  detectMultiDay(text, originalText, result)

  // 7. Priority Extraction
  extractPriority(originalText, result)

  // 8. Generate Key Info Summary
  generateKeyInfo(result)

  return result
}

/**
 * Extract dispenser numbers from various formats
 */
function extractDispenserNumbers(text: string, result: ParsedInstructions): void {
  // Pattern 1: #1, #2, #3 (single dispensers)
  // Exclude high numbers (>30) which are likely blend ratios like #70
  const singlePattern = /#(\d+)(?![/\d])/g
  let match
  while ((match = singlePattern.exec(text)) !== null) {
    const dispenser = match[1]
    const dispenserNum = parseInt(dispenser)
    // Skip numbers > 30 as they're likely blend ratios (E70, 70%, etc)
    if (dispenserNum <= 30 && !result.dispenserNumbers.includes(dispenser)) {
      result.dispenserNumbers.push(dispenser)
    }
  }

  // Pattern 2: #1/2, #3/4, #19/20 (dispenser pairs)
  const pairPattern = /#(\d+\/\d+)/g
  while ((match = pairPattern.exec(text)) !== null) {
    const pair = match[1]
    const [first, second] = pair.split('/')
    const firstNum = parseInt(first)
    const secondNum = parseInt(second)
    
    // Only include if both numbers are <= 30 (likely dispenser numbers, not blend ratios)
    if (firstNum <= 30 && secondNum <= 30) {
      if (!result.dispenserPairs.includes(pair)) {
        result.dispenserPairs.push(pair)
      }
      // Also add individual numbers
      if (!result.dispenserNumbers.includes(first)) {
        result.dispenserNumbers.push(first)
      }
      if (!result.dispenserNumbers.includes(second)) {
        result.dispenserNumbers.push(second)
      }
    }
  }

  // Pattern 3: dispenser #5 (with optional spacing)
  const dispenserPattern = /dispenser\s*#?\s*(\d+)/gi
  while ((match = dispenserPattern.exec(text)) !== null) {
    const dispenser = match[1]
    const dispenserNum = parseInt(dispenser)
    if (dispenserNum <= 30 && !result.dispenserNumbers.includes(dispenser)) {
      result.dispenserNumbers.push(dispenser)
    }
  }

  // Pattern 4: dispensers 1,2,3 or Dispensers #1,2,3
  const listPattern = /dispensers?\s*:?\s*#?\s*([\d,\s]+)/gi
  while ((match = listPattern.exec(text)) !== null) {
    const numberString = match[1]
    const numbers = numberString.match(/\d+/g) || []
    for (const num of numbers) {
      const numInt = parseInt(num)
      if (numInt <= 30 && !result.dispenserNumbers.includes(num)) {
        result.dispenserNumbers.push(num)
      }
    }
  }

  // Sort dispenser numbers numerically
  result.dispenserNumbers.sort((a, b) => parseInt(a) - parseInt(b))
}

/**
 * Extract special job classification keywords
 */
function extractSpecialJobType(text: string, originalText: string, result: ParsedInstructions): void {
  // 7-Eleven Specific
  if (text.includes('new') && (text.includes('store') || text.includes('station'))) {
    result.specialJobType = 'new_store'
  } else if (text.includes('remodeled store')) {
    result.specialJobType = 'remodeled'
  }
  
  // Circle K Specific - look for "Priority: [number]"
  const priorityMatch = originalText.match(/priority:\s*(\d+)/i)
  if (priorityMatch) {
    result.specialJobType = 'circle_k_priority'
    result.priority = parseInt(priorityMatch[1])
  }

  // Post construction
  if (text.includes('post construction')) {
    result.specialJobType = 'post_construction'
  }
}

/**
 * Determine automation type based on service codes
 */
function determineAutomationType(serviceCode: string | undefined, result: ParsedInstructions): void {
  if (!serviceCode) return

  switch (serviceCode) {
    case '2861':
    case '3002':
      result.automationType = 'all_dispensers'
      break
    case '2862':
      result.automationType = 'specific_dispensers'
      break
    case '3146':
      result.automationType = 'open_neck_prover'
      break
    default:
      result.automationType = 'all_dispensers'
  }
}

/**
 * Detect calibration requirements - REMOVED (all jobs require calibration)
 */
// function detectCalibration(text: string, result: ParsedInstructions): void {
//   if (text.includes('calibrat')) {
//     result.calibrationRequired = true
//   }
// }

/**
 * Extract fuel grade information
 */
function extractFuelGrades(text: string, result: ParsedInstructions): void {
  // Always Metered
  if (text.includes('regular')) result.fuelGrades.regular = true
  if (text.includes('diesel')) result.fuelGrades.diesel = true
  if (text.includes('super')) result.fuelGrades.super = true
  if (text.includes('ultra')) result.fuelGrades.ultra = true
  if (text.includes('ethanol-free') || text.includes('ethanol free')) result.fuelGrades.ethanol_free = true
  if (text.includes('race fuel')) result.fuelGrades.race_fuel = true

  // Never Metered
  if (text.includes('plus')) result.fuelGrades.plus = true
  if (text.includes('midgrade') || text.includes('mid grade')) result.fuelGrades.plus = true
  if (text.includes('special 88')) result.fuelGrades.special_88 = true
  if (text.includes('extra 89')) result.fuelGrades.extra_89 = true

  // Conditional (Premium) - has meter UNLESS Super/Ultra exists
  const hasPremium = text.includes('premium')
  const hasSuper = result.fuelGrades.super
  const hasUltra = result.fuelGrades.ultra
  
  // Premium gets metered unless Super or Ultra is present
  if (hasPremium && !hasSuper && !hasUltra) {
    result.fuelGrades.super = true // Treat premium as super when no super/ultra
  }
}

/**
 * Detect multi-day job information
 */
function detectMultiDay(text: string, originalText: string, result: ParsedInstructions): void {
  // Day X of Y pattern
  const dayPattern = /day\s+(\d+)\s+of\s+(\d+)/i
  const dayMatch = originalText.match(dayPattern)
  
  if (dayMatch) {
    result.multiDayInfo.isMultiDay = true
    result.multiDayInfo.currentDay = parseInt(dayMatch[1])
    result.multiDayInfo.totalDays = parseInt(dayMatch[2])
    result.specialJobType = 'multi_day'
  }

  // Start Day
  if (text.includes('start day')) {
    result.multiDayInfo.isMultiDay = true
    result.multiDayInfo.isStartDay = true
    result.specialJobType = 'multi_day'
  }

  // Finish Day
  if (text.includes('finish day')) {
    result.multiDayInfo.isMultiDay = true
    result.multiDayInfo.isFinishDay = true
    result.specialJobType = 'multi_day'
  }
}

/**
 * Extract priority information
 */
function extractPriority(text: string, result: ParsedInstructions): void {
  if (result.priority) return // Already extracted from Circle K

  // Look for other priority indicators
  const priorityPatterns = [
    /priority:\s*(\d+)/i,
    /priority\s+(\d+)/i,
    /pri:\s*(\d+)/i
  ]

  for (const pattern of priorityPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.priority = parseInt(match[1])
      break
    }
  }
}

/**
 * Generate key information summary for display
 */
function generateKeyInfo(result: ParsedInstructions): void {
  const keyInfo: string[] = []

  // Dispenser information
  if (result.dispenserPairs.length > 0) {
    keyInfo.push(`Dispensers: #${result.dispenserPairs.join(', #')}`)
  } else if (result.dispenserNumbers.length > 0) {
    if (result.dispenserNumbers.length <= 5) {
      keyInfo.push(`Dispensers: #${result.dispenserNumbers.join(', #')}`)
    } else {
      keyInfo.push(`${result.dispenserNumbers.length} Dispensers (#${result.dispenserNumbers[0]}-#${result.dispenserNumbers[result.dispenserNumbers.length - 1]})`)
    }
  }

  // Special job types
  if (result.specialJobType) {
    switch (result.specialJobType) {
      case 'new_store':
        keyInfo.push('🆕 New Store')
        break
      case 'remodeled':
        keyInfo.push('🔄 Remodeled Store')
        break
      case 'circle_k_priority':
        keyInfo.push(`🔥 Priority ${result.priority}`)
        break
      case 'multi_day':
        if (result.multiDayInfo.currentDay && result.multiDayInfo.totalDays) {
          keyInfo.push(`📅 Day ${result.multiDayInfo.currentDay}/${result.multiDayInfo.totalDays}`)
        } else if (result.multiDayInfo.isStartDay) {
          keyInfo.push('📅 Start Day')
        } else if (result.multiDayInfo.isFinishDay) {
          keyInfo.push('📅 Finish Day')
        } else {
          keyInfo.push('📅 Multi-Day Job')
        }
        break
      case 'post_construction':
        keyInfo.push('🚧 Post Construction')
        break
    }
  }

  // Calibration - REMOVED (all jobs require calibration)

  // Automation type (only show if not standard)
  if (result.automationType === 'specific_dispensers') {
    keyInfo.push('🎯 Specific Dispensers')
  } else if (result.automationType === 'open_neck_prover') {
    keyInfo.push('🔧 Open Neck Prover')
  }

  // Fuel grades (only show special ones)
  const specialFuels = []
  if (result.fuelGrades.ethanol_free) specialFuels.push('Ethanol-Free')
  if (result.fuelGrades.race_fuel) specialFuels.push('Race Fuel')
  if (result.fuelGrades.special_88) specialFuels.push('Special 88')
  if (result.fuelGrades.extra_89) specialFuels.push('Extra 89')
  
  if (specialFuels.length > 0) {
    keyInfo.push(`⛽ ${specialFuels.join(', ')}`)
  }

  result.keyInfo = keyInfo
}

/**
 * Get a short summary of instructions for compact display
 */
export function getInstructionSummary(
  instructions: string | null | undefined,
  serviceCode?: string,
  maxLength: number = 100
): string {
  if (!instructions) return ''

  const parsed = parseInstructions(instructions, serviceCode)
  
  if (parsed.keyInfo.length > 0) {
    const summary = parsed.keyInfo.join(' • ')
    if (summary.length <= maxLength) {
      return summary
    }
    // Truncate but try to keep complete items
    let truncated = ''
    for (const item of parsed.keyInfo) {
      if ((truncated + ' • ' + item).length <= maxLength - 3) {
        truncated += truncated ? ' • ' + item : item
      } else {
        break
      }
    }
    return truncated + (truncated.length < summary.length ? '...' : '')
  }

  // Fallback to truncated raw text
  if (instructions.length <= maxLength) {
    return instructions
  }
  return instructions.substring(0, maxLength - 3) + '...'
}

/**
 * Check if instructions contain important information that should be highlighted
 */
export function hasImportantInfo(
  instructions: string | null | undefined,
  serviceCode?: string
): boolean {
  if (!instructions) return false

  const parsed = parseInstructions(instructions, serviceCode)
  
  return parsed.specialJobType !== null ||
         parsed.dispenserNumbers.length > 0 ||
         parsed.priority !== null ||
         parsed.multiDayInfo.isMultiDay ||
         parsed.automationType !== 'all_dispensers'  // Show badge for specific dispensers or prover
}