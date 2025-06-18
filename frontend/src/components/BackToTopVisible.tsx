import React, { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

// Debug version that shows scroll state
export const BackToTopVisible: React.FC = () => {
  const [isAtTop, setIsAtTop] = useState(true)
  const [scrollContainer, setScrollContainer] = useState<Element | null>(null)
  
  useEffect(() => {
    let container: Element | null = null
    
    const findScrollContainer = () => {
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
    
    const checkScroll = () => {
      let scrollY = 0
      
      if (container) {
        scrollY = container.scrollTop
      } else {
        scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
      }
      
      setIsAtTop(scrollY < 50)
    }
    
    // Find scroll container
    container = findScrollContainer()
    
    // Check on mount
    checkScroll()
    
    // Add listeners
    if (container) {
      container.addEventListener('scroll', checkScroll, { passive: true })
    } else {
      window.addEventListener('scroll', checkScroll, { passive: true })
      document.addEventListener('scroll', checkScroll, { passive: true })
    }
    
    // Re-check after delay
    setTimeout(() => {
      if (!container) {
        container = findScrollContainer()
        if (container) {
          container.addEventListener('scroll', checkScroll, { passive: true })
          checkScroll()
        }
      }
    }, 500)
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll)
      } else {
        window.removeEventListener('scroll', checkScroll)
        document.removeEventListener('scroll', checkScroll)
      }
    }
  }, [])
  
  const scrollToTop = () => {
    console.log('BackToTopVisible clicked! Scroll container:', scrollContainer)
    
    if (scrollContainer) {
      // Scroll the container
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      
      // Fallback
      setTimeout(() => {
        if (scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTop = 0
        }
      }, 100)
    } else {
      // Try multiple methods for window scrolling
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        
        setTimeout(() => {
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
        }, 100)
      } catch (error) {
        console.error('Error scrolling to top:', error)
      }
    }
  }

  // Only show when not at top
  if (isAtTop) {
    return null
  }

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        backgroundColor: '#ef4444', // Red color
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 999999,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        color: 'white',
        border: 'none',
        outline: 'none'
      }}
      title="Back to top (Debug)"
    >
      <ChevronUp size={30} />
    </button>
  )
}

export default BackToTopVisible