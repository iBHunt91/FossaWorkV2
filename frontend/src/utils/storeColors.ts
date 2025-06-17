// Store brand color mapping for consistent theming across all views

export interface BrandStyle {
  name: string
  color: string
  textColor: string
  bgColor: string
  borderColor: string
  hoverBgColor: string
  darkBgColor: string
  darkTextColor: string
  darkBorderColor: string
  darkHoverBgColor: string
}

// Helper function to clean site names by removing time suffixes and extracting brand name
export const cleanSiteName = (siteName: string): string => {
  // Remove time patterns like "1956am", "456pm", etc.
  let cleaned = siteName.replace(/\s+\d{1,4}[ap]m$/i, '').trim()
  
  // Extract just the brand name
  const lower = cleaned.toLowerCase()
  if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven')) {
    return '7-Eleven'
  } else if (lower.includes('wawa')) {
    return 'Wawa'
  } else if (lower.includes('circle k') || lower.includes('circle-k') || lower.includes('circlek')) {
    return 'Circle K'
  } else if (lower.includes('speedway')) {
    return 'Speedway'
  } else if (lower.includes('costco')) {
    return 'Costco'
  } else if (lower.includes('mobil')) {
    return 'Mobil'
  } else if (lower.includes('exxon')) {
    return 'Exxon'
  }
  
  // For other stores, try to extract just the brand name
  // Remove common suffixes like "Stores", "Inc", etc.
  cleaned = cleaned.replace(/\s+(Stores?|Inc\.?|LLC|Corp\.?|Corporation|Company|Co\.|Wholesale).*$/i, '').trim()
  
  return cleaned
}

export const getBrandStyle = (siteName: string): BrandStyle => {
  const cleanedName = cleanSiteName(siteName)
  const lower = cleanedName.toLowerCase()
  
  // 7-Eleven family (7-Eleven, Speedway, Mobil - all owned by 7-Eleven)
  // Using 7-Eleven's official colors: Green #007A53, Red #DA291C, Orange #FF6720
  if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven') || 
      lower.includes('7eleven') || (lower.includes('eleven') && lower.includes('stores')) ||
      lower.includes('speedway') || lower.includes('mobil') || lower.includes('exxon')) {
    return {
      name: '7-Eleven',
      color: 'bg-emerald-600', // Close to #007A53
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      hoverBgColor: 'hover:bg-emerald-100',
      darkBgColor: 'dark:bg-emerald-950/20',
      darkTextColor: 'dark:text-emerald-400',
      darkBorderColor: 'dark:border-emerald-800',
      darkHoverBgColor: 'dark:hover:bg-emerald-900/30'
    }
  }
  
  // Wawa - Using their red and yellow brand colors
  if (lower.includes('wawa')) {
    return {
      name: 'Wawa',
      color: 'bg-red-600', // Their red color
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      hoverBgColor: 'hover:bg-red-100',
      darkBgColor: 'dark:bg-red-950/20',
      darkTextColor: 'dark:text-red-400',
      darkBorderColor: 'dark:border-red-800',
      darkHoverBgColor: 'dark:hover:bg-red-900/30'
    }
  }
  
  // Circle K - Using their red and orange brand colors
  if (lower.includes('circle k') || lower.includes('circlek') || lower.includes('circle-k')) {
    return {
      name: 'Circle K',
      color: 'bg-orange-500', // Their orange accent
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      hoverBgColor: 'hover:bg-orange-100',
      darkBgColor: 'dark:bg-orange-950/20',
      darkTextColor: 'dark:text-orange-400',
      darkBorderColor: 'dark:border-orange-800',
      darkHoverBgColor: 'dark:hover:bg-orange-900/30'
    }
  }
  
  
  // Costco - Using their official colors: Blue #005DAA, Red #E31837
  if (lower.includes('costco')) {
    return {
      name: 'Costco',
      color: 'bg-blue-700', // Close to #005DAA
      textColor: 'text-blue-800',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      hoverBgColor: 'hover:bg-blue-100',
      darkBgColor: 'dark:bg-blue-950/20',
      darkTextColor: 'dark:text-blue-400',
      darkBorderColor: 'dark:border-blue-800',
      darkHoverBgColor: 'dark:hover:bg-blue-900/30'
    }
  }
  
  
  // Default for unknown brands
  return {
    name: 'Other',
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    hoverBgColor: 'hover:bg-gray-100',
    darkBgColor: 'dark:bg-gray-950/20',
    darkTextColor: 'dark:text-gray-400',
    darkBorderColor: 'dark:border-gray-800',
    darkHoverBgColor: 'dark:hover:bg-gray-900/30'
  }
}

// Get card styling classes based on brand
export const getBrandCardStyle = (siteName: string): string => {
  const brand = getBrandStyle(siteName)
  return `${brand.bgColor} ${brand.borderColor} ${brand.hoverBgColor} ${brand.darkBgColor} ${brand.darkBorderColor} ${brand.darkHoverBgColor} border-2 border-l-4 ${getBrandAccentBorder(siteName)}`
}

// Get the accent border color for brand
export const getBrandAccentBorder = (siteName: string): string => {
  const lower = siteName.toLowerCase()
  
  // 7-Eleven family (7-Eleven, Speedway, Mobil)
  if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven') || 
      lower.includes('7eleven') || (lower.includes('eleven') && lower.includes('stores')) ||
      lower.includes('speedway') || lower.includes('mobil') || lower.includes('exxon')) {
    return 'border-l-emerald-600'
  }
  if (lower.includes('wawa')) return 'border-l-red-600'
  if (lower.includes('circle k') || lower.includes('circlek') || lower.includes('circle-k')) return 'border-l-orange-500'
  if (lower.includes('costco')) return 'border-l-blue-700'
  
  return 'border-l-gray-500'
}

// Get badge styling classes based on brand
export const getBrandBadgeStyle = (siteName: string): string => {
  const brand = getBrandStyle(siteName)
  return `${brand.textColor} ${brand.darkTextColor} border-current/30`
}