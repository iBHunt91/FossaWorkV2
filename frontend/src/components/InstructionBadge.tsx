import React from 'react'
import { cn } from '@/lib/utils'

interface InstructionBadgeProps {
  children: React.ReactNode
  variant?: 'new-store' | 'remodeled' | 'priority' | 'multi-day' | 'post-construction' | 'dispensers' | 'specific' | 'prover' | 'fuel'
  className?: string
}

const variantStyles = {
  'new-store': 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-200 dark:shadow-green-900/50',
  'remodeled': 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-200 dark:shadow-blue-900/50',
  'priority': 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-red-200 dark:shadow-red-900/50',
  'multi-day': 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-purple-200 dark:shadow-purple-900/50',
  'post-construction': 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200 dark:shadow-orange-900/50',
  'dispensers': 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900/40 dark:to-blue-800/40 dark:text-blue-200 border-2 border-blue-300 dark:border-blue-600',
  'specific': 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 dark:from-indigo-900/40 dark:to-indigo-800/40 dark:text-indigo-200 border-2 border-indigo-300 dark:border-indigo-600',
  'prover': 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-900/40 dark:to-gray-800/40 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600',
  'fuel': 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 dark:from-green-900/40 dark:to-green-800/40 dark:text-green-200 border-2 border-green-300 dark:border-green-600'
}

export const InstructionBadge: React.FC<InstructionBadgeProps> = ({
  children,
  variant = 'dispensers',
  className
}) => {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105",
      variantStyles[variant],
      className
    )}>
      {children}
    </div>
  )
}

export default InstructionBadge