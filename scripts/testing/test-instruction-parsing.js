/**
 * Test script for instruction parsing functionality
 * Run with: node scripts/testing/test-instruction-parsing.js
 */

// Mock the instruction parser (since this is Node.js, not TypeScript/browser)
const mockInstructions = [
  {
    text: "Calibrate dispensers #1, #2, #3 - NEW STORE setup required",
    serviceCode: "2861",
    expected: {
      dispensers: ["1", "2", "3"],
      specialJob: "new_store",
      calibration: true
    }
  },
  {
    text: "Priority: 5 - Check dispenser #19/20 for Circle K remodel",
    serviceCode: "2862", 
    expected: {
      dispensers: ["19", "20"],
      specialJob: "circle_k_priority",
      priority: 5
    }
  },
  {
    text: "Day 2 of 3 - Calibrate all dispensers with ethanol-free fuel",
    serviceCode: "3002",
    expected: {
      multiDay: true,
      currentDay: 2,
      totalDays: 3,
      fuelGrades: ["ethanol_free"]
    }
  },
  {
    text: "Post construction - dispensers 5,6,7 need special setup",
    serviceCode: "2862",
    expected: {
      dispensers: ["5", "6", "7"],
      specialJob: "post_construction"
    }
  },
  {
    text: "Regular maintenance check - no special requirements",
    serviceCode: "2861",
    expected: {
      dispensers: [],
      specialJob: null
    }
  }
]

console.log('🧪 Testing Instruction Parsing Rules\n')
console.log('=' .repeat(60))

// Simulate the parsing logic for testing
function simulateParser(text, serviceCode) {
  const result = {
    dispenserNumbers: [],
    dispenserPairs: [],
    specialJobType: null,
    priority: null,
    multiDay: false,
    calibrationRequired: false,
    keyInfo: []
  }

  const lowerText = text.toLowerCase()

  // 1. Dispenser extraction
  const singlePattern = /#(\d+)(?![/\d])/g
  let match
  while ((match = singlePattern.exec(text)) !== null) {
    result.dispenserNumbers.push(match[1])
  }

  const pairPattern = /#(\d+\/\d+)/g
  while ((match = pairPattern.exec(text)) !== null) {
    result.dispenserPairs.push(match[1])
    const [first, second] = match[1].split('/')
    result.dispenserNumbers.push(first, second)
  }

  const listPattern = /dispensers?\s*:?\s*#?\s*([\d,\s]+)/gi
  while ((match = listPattern.exec(text)) !== null) {
    const numbers = match[1].match(/\d+/g) || []
    result.dispenserNumbers.push(...numbers)
  }

  // Remove duplicates and sort
  result.dispenserNumbers = [...new Set(result.dispenserNumbers)].sort((a, b) => parseInt(a) - parseInt(b))

  // 2. Special job types
  if (lowerText.includes('new') && (lowerText.includes('store') || lowerText.includes('station'))) {
    result.specialJobType = 'new_store'
  } else if (lowerText.includes('remodeled')) {
    result.specialJobType = 'remodeled'
  } else if (lowerText.includes('post construction')) {
    result.specialJobType = 'post_construction'
  }

  // Priority
  const priorityMatch = text.match(/priority:\s*(\d+)/i)
  if (priorityMatch) {
    result.specialJobType = 'circle_k_priority'
    result.priority = parseInt(priorityMatch[1])
  }

  // Multi-day
  const dayMatch = text.match(/day\s+(\d+)\s+of\s+(\d+)/i)
  if (dayMatch) {
    result.multiDay = true
    result.currentDay = parseInt(dayMatch[1])
    result.totalDays = parseInt(dayMatch[2])
    result.specialJobType = 'multi_day'
  }

  // Calibration
  if (lowerText.includes('calibrat')) {
    result.calibrationRequired = true
  }

  // Generate key info
  if (result.dispenserNumbers.length > 0) {
    if (result.dispenserNumbers.length <= 3) {
      result.keyInfo.push(`Dispensers: #${result.dispenserNumbers.join(', #')}`)
    } else {
      result.keyInfo.push(`${result.dispenserNumbers.length} Dispensers`)
    }
  }

  if (result.specialJobType === 'new_store') result.keyInfo.push('🆕 New Store')
  if (result.specialJobType === 'circle_k_priority') result.keyInfo.push(`🔥 Priority ${result.priority}`)
  if (result.specialJobType === 'multi_day') result.keyInfo.push(`📅 Day ${result.currentDay}/${result.totalDays}`)
  if (result.specialJobType === 'post_construction') result.keyInfo.push('🚧 Post Construction')
  if (result.calibrationRequired) result.keyInfo.push('⚙️ Calibration Required')

  return result
}

// Run tests
mockInstructions.forEach((test, index) => {
  console.log(`\n📝 Test ${index + 1}:`)
  console.log(`Input: "${test.text}"`)
  console.log(`Service Code: ${test.serviceCode}`)
  
  const result = simulateParser(test.text, test.serviceCode)
  
  console.log(`\n🔍 Parsed Results:`)
  console.log(`  Dispensers: [${result.dispenserNumbers.join(', ')}]`)
  console.log(`  Dispenser Pairs: [${result.dispenserPairs.join(', ')}]`)
  console.log(`  Special Job: ${result.specialJobType}`)
  console.log(`  Priority: ${result.priority}`)
  console.log(`  Multi-day: ${result.multiDay ? `Day ${result.currentDay}/${result.totalDays}` : 'No'}`)
  console.log(`  Calibration: ${result.calibrationRequired ? 'Yes' : 'No'}`)
  console.log(`  Key Info: ${result.keyInfo.join(' • ') || 'None'}`)
  
  // Simple validation
  let passed = 0
  let total = 0
  
  if (test.expected.dispensers) {
    total++
    if (JSON.stringify(result.dispenserNumbers) === JSON.stringify(test.expected.dispensers)) {
      passed++
      console.log(`  ✅ Dispensers match expected`)
    } else {
      console.log(`  ❌ Dispensers don't match - Expected: [${test.expected.dispensers.join(', ')}]`)
    }
  }
  
  if (test.expected.specialJob !== undefined) {
    total++
    if (result.specialJobType === test.expected.specialJob) {
      passed++
      console.log(`  ✅ Special job type matches`)
    } else {
      console.log(`  ❌ Special job type doesn't match - Expected: ${test.expected.specialJob}`)
    }
  }
  
  if (test.expected.calibration !== undefined) {
    total++
    if (result.calibrationRequired === test.expected.calibration) {
      passed++
      console.log(`  ✅ Calibration detection matches`)
    } else {
      console.log(`  ❌ Calibration detection doesn't match`)
    }
  }
  
  if (test.expected.priority !== undefined) {
    total++
    if (result.priority === test.expected.priority) {
      passed++
      console.log(`  ✅ Priority matches`)
    } else {
      console.log(`  ❌ Priority doesn't match - Expected: ${test.expected.priority}`)
    }
  }

  console.log(`\n📊 Test Score: ${passed}/${total} checks passed`)
  console.log('-'.repeat(60))
})

console.log('\n🎉 Instruction Parsing Test Complete!')
console.log('\n💡 Next Steps:')
console.log('  1. Run the frontend development server: npm run dev')
console.log('  2. Navigate to the Work Orders page')
console.log('  3. Look for work orders with instructions')
console.log('  4. Verify that parsed instruction badges appear above the full instructions')
console.log('  5. Check that badges show: dispensers, special job types, priorities, etc.')
console.log('\n🔧 Frontend Implementation:')
console.log('  • InstructionSummary component renders parsed instruction badges')
console.log('  • WorkOrders.tsx shows summary above collapsible full instructions')
console.log('  • Parser handles V1 rules: dispensers, job types, calibration, fuel grades')