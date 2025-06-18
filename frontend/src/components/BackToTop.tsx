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
  const [scrollContainer, setScrollContainer] = useState<Element | null>(null)

  useEffect(() => {
    let container: Element | null = null
    
    const findScrollContainer = () => {
      // Find the container that's actually scrolling
      const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll')
      for (const el of containers) {
        if (el.scrollHeight > el.clientHeight) {
          container = el
          setScrollContainer(el)
          return el
        }
      }
      return null
    }
    
    const handleScroll = (event?: Event) => {
      let scrollTop = 0
      let scrollHeight = 0
      let clientHeight = 0
      
      if (container) {
        // Container scrolling
        scrollTop = container.scrollTop
        scrollHeight = container.scrollHeight
        clientHeight = container.clientHeight
      } else {
        // Window scrolling fallback
        scrollTop = window.pageYOffset || 
                   document.documentElement.scrollTop || 
                   document.body.scrollTop || 
                   0
        scrollHeight = document.documentElement.scrollHeight
        clientHeight = document.documentElement.clientHeight
      }
      
      const maxScroll = scrollHeight - clientHeight
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0

      // Update visibility
      setIsVisible(scrollTop > showAfter)

      // Update progress
      setScrollProgress(progress)
    }

    // Find and attach to scroll container
    container = findScrollContainer()
    
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true })
    } else {
      // Fallback to window scroll
      window.addEventListener('scroll', handleScroll, { passive: true })
      document.addEventListener('scroll', handleScroll, { passive: true })
    }
    
    // Check initial state
    handleScroll()
    
    // Re-check for container after a delay
    setTimeout(() => {
      if (!container) {
        container = findScrollContainer()
        if (container) {
          container.addEventListener('scroll', handleScroll, { passive: true })
          handleScroll()
        }
      }
    }, 500)

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      } else {
        window.removeEventListener('scroll', handleScroll)
        document.removeEventListener('scroll', handleScroll)
      }
    }
  }, [showAfter])

  const scrollToTop = () => {
    console.log('BackToTop clicked! Scroll container:', scrollContainer)
    
    if (scrollContainer) {
      // Scroll the container
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      
      // Fallback for browsers that don't support smooth scrolling
      setTimeout(() => {
        if (scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTop = 0
        }
      }, 100)
    } else {
      // Fallback to window scrolling
      try {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
        
        setTimeout(() => {
          if (window.scrollY > 0) {
            window.scrollTo(0, 0)
            document.documentElement.scrollTop = 0
            document.body.scrollTop = 0
          }
        }, 100)
      } catch (error) {
        console.error('Error scrolling to top:', error)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }
    }
  }

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '40px',
        right: '40px',
        zIndex: 99999,
        padding: '16px',
        borderRadius: '50%',
        backgroundColor: isVisible ? '#3B82F6' : 'transparent',
        color: 'white',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        cursor: 'pointer',
        boxShadow: isVisible ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'all 0.3s ease-in-out',
        backdropFilter: 'blur(8px)'
      }}
      className={className}
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