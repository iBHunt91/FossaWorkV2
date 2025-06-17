import React, { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackToTopProps {
  showAfter?: number // Show button after scrolling this many pixels
  className?: string
}

export const BackToTop: React.FC<BackToTopProps> = ({ 
  showAfter = 300,
  className 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      // Calculate scroll position - use multiple methods for compatibility
      const scrollTop = window.pageYOffset || 
                       document.documentElement.scrollTop || 
                       document.body.scrollTop || 
                       0
      
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0


      // Update visibility
      setIsVisible(scrollTop > showAfter)

      // Update progress
      setScrollProgress(progress)
    }

    // Add scroll listener to window and document for better compatibility
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('scroll', handleScroll, { passive: true })
    
    // Check initial state
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('scroll', handleScroll)
    }
  }, [showAfter])

  const scrollToTop = () => {
    // Try multiple methods to ensure scrolling works
    const scrollElement = document.documentElement || document.body
    
    // Method 1: Standard window.scrollTo
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
    
    // Method 2: Fallback for older browsers or specific scroll containers
    scrollElement.scrollTop = 0
  }

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed z-50 group",
        // Responsive positioning - closer to edge on mobile
        "bottom-4 right-4 md:bottom-8 md:right-8",
        // Base styles
        "p-3 md:p-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
        "shadow-lg hover:shadow-2xl hover:scale-110 active:scale-95",
        "transition-all duration-300 ease-in-out",
        "backdrop-blur-sm border-2 border-white/20",
        // Visibility transitions
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        className
      )}
      aria-label="Back to top"
      title="Back to top"
    >
      <div className="relative">
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - scrollProgress / 100)}`}
            className="transition-all duration-300"
          />
        </svg>
        
        {/* Pulse animation on hover */}
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:animate-ping group-hover:opacity-20"></div>
        
        {/* Icon container */}
        <div className="relative flex items-center justify-center">
          <ChevronUp className="w-5 h-5 md:w-6 md:h-6 animate-bounce" />
        </div>
      </div>
    </button>
  )
}

export default BackToTop