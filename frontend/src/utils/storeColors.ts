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

export const getBrandStyle = (siteName: string): BrandStyle => {
  const lower = siteName.toLowerCase()
  
  if (lower.includes('7-eleven') || lower.includes('7 eleven')) {
    return {
      name: '7-Eleven',
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      hoverBgColor: 'hover:bg-red-100',
      darkBgColor: 'dark:bg-red-950/20',
      darkTextColor: 'dark:text-red-400',
      darkBorderColor: 'dark:border-red-800',
      darkHoverBgColor: 'dark:hover:bg-red-900/30'
    }
  }
  
  if (lower.includes('wawa')) {
    return {
      name: 'Wawa',
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      hoverBgColor: 'hover:bg-amber-100',
      darkBgColor: 'dark:bg-amber-950/20',
      darkTextColor: 'dark:text-amber-400',
      darkBorderColor: 'dark:border-amber-800',
      darkHoverBgColor: 'dark:hover:bg-amber-900/30'
    }
  }
  
  if (lower.includes('circle k')) {
    return {
      name: 'Circle K',
      color: 'bg-orange-500',
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
  
  if (lower.includes('shell')) {
    return {
      name: 'Shell',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      hoverBgColor: 'hover:bg-yellow-100',
      darkBgColor: 'dark:bg-yellow-950/20',
      darkTextColor: 'dark:text-yellow-400',
      darkBorderColor: 'dark:border-yellow-800',
      darkHoverBgColor: 'dark:hover:bg-yellow-900/30'
    }
  }
  
  if (lower.includes('speedway')) {
    return {
      name: 'Speedway',
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      hoverBgColor: 'hover:bg-blue-100',
      darkBgColor: 'dark:bg-blue-950/20',
      darkTextColor: 'dark:text-blue-400',
      darkBorderColor: 'dark:border-blue-800',
      darkHoverBgColor: 'dark:hover:bg-blue-900/30'
    }
  }
  
  if (lower.includes('bp') || lower.includes('british petroleum')) {
    return {
      name: 'BP',
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      hoverBgColor: 'hover:bg-green-100',
      darkBgColor: 'dark:bg-green-950/20',
      darkTextColor: 'dark:text-green-400',
      darkBorderColor: 'dark:border-green-800',
      darkHoverBgColor: 'dark:hover:bg-green-900/30'
    }
  }
  
  if (lower.includes('exxon') || lower.includes('mobil')) {
    return {
      name: 'ExxonMobil',
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      hoverBgColor: 'hover:bg-indigo-100',
      darkBgColor: 'dark:bg-indigo-950/20',
      darkTextColor: 'dark:text-indigo-400',
      darkBorderColor: 'dark:border-indigo-800',
      darkHoverBgColor: 'dark:hover:bg-indigo-900/30'
    }
  }
  
  if (lower.includes('chevron')) {
    return {
      name: 'Chevron',
      color: 'bg-sky-500',
      textColor: 'text-sky-600',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      hoverBgColor: 'hover:bg-sky-100',
      darkBgColor: 'dark:bg-sky-950/20',
      darkTextColor: 'dark:text-sky-400',
      darkBorderColor: 'dark:border-sky-800',
      darkHoverBgColor: 'dark:hover:bg-sky-900/30'
    }
  }
  
  if (lower.includes('sunoco')) {
    return {
      name: 'Sunoco',
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      hoverBgColor: 'hover:bg-purple-100',
      darkBgColor: 'dark:bg-purple-950/20',
      darkTextColor: 'dark:text-purple-400',
      darkBorderColor: 'dark:border-purple-800',
      darkHoverBgColor: 'dark:hover:bg-purple-900/30'
    }
  }
  
  if (lower.includes('valero')) {
    return {
      name: 'Valero',
      color: 'bg-teal-500',
      textColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      hoverBgColor: 'hover:bg-teal-100',
      darkBgColor: 'dark:bg-teal-950/20',
      darkTextColor: 'dark:text-teal-400',
      darkBorderColor: 'dark:border-teal-800',
      darkHoverBgColor: 'dark:hover:bg-teal-900/30'
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
  return `${brand.bgColor} ${brand.borderColor} ${brand.hoverBgColor} ${brand.darkBgColor} ${brand.darkBorderColor} ${brand.darkHoverBgColor} border-2`
}

// Get badge styling classes based on brand
export const getBrandBadgeStyle = (siteName: string): string => {
  const brand = getBrandStyle(siteName)
  return `${brand.textColor} ${brand.darkTextColor} border-current/30`
}