import React, { useState, useEffect } from 'react'

export const ScrollDebug: React.FC = () => {
  const [scrollInfo, setScrollInfo] = useState({
    scrollY: 0,
    scrollHeight: 0,
    clientHeight: 0,
    maxScroll: 0,
    percentage: 0,
    scrollingElement: 'unknown',
    containerScroll: 0,
    containerHeight: 0,
    containerMax: 0
  })

  useEffect(() => {
    let scrollContainer: Element | null = null
    
    const findScrollContainer = () => {
      const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll')
      for (const el of containers) {
        if (el.scrollHeight > el.clientHeight) {
          scrollContainer = el
          return el
        }
      }
      return null
    }
    
    const updateScrollInfo = () => {
      // Window scroll values
      const windowScrollY = window.scrollY
      const windowPageYOffset = window.pageYOffset
      const docScrollTop = document.documentElement.scrollTop
      const bodyScrollTop = document.body.scrollTop
      
      const scrollY = windowScrollY || windowPageYOffset || docScrollTop || bodyScrollTop || 0
      
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight
      )
      
      const clientHeight = window.innerHeight || document.documentElement.clientHeight
      const maxScroll = scrollHeight - clientHeight
      const percentage = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0
      
      // Container scroll values
      let containerScroll = 0
      let containerHeight = 0
      let containerClientHeight = 0
      let containerMax = 0
      
      if (scrollContainer) {
        containerScroll = scrollContainer.scrollTop
        containerHeight = scrollContainer.scrollHeight
        containerClientHeight = scrollContainer.clientHeight
        containerMax = containerHeight - containerClientHeight
      }
      
      // Determine which element is scrolling
      let scrollingElement = 'none'
      if (containerScroll > 0) scrollingElement = 'container'
      else if (windowScrollY > 0) scrollingElement = 'window.scrollY'
      else if (windowPageYOffset > 0) scrollingElement = 'window.pageYOffset'
      else if (docScrollTop > 0) scrollingElement = 'document.documentElement'
      else if (bodyScrollTop > 0) scrollingElement = 'document.body'

      setScrollInfo({
        scrollY: Math.round(scrollY),
        scrollHeight,
        clientHeight,
        maxScroll,
        percentage: Math.round(percentage),
        scrollingElement,
        containerScroll: Math.round(containerScroll),
        containerHeight,
        containerMax
      })
    }

    // Find container
    scrollContainer = findScrollContainer()
    
    // Add listeners
    window.addEventListener('scroll', updateScrollInfo, true)
    document.addEventListener('scroll', updateScrollInfo, true)
    window.addEventListener('resize', updateScrollInfo)
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateScrollInfo)
    }
    
    updateScrollInfo()
    
    // Re-check after a delay
    setTimeout(() => {
      scrollContainer = findScrollContainer()
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', updateScrollInfo)
        updateScrollInfo()
      }
    }, 500)

    return () => {
      window.removeEventListener('scroll', updateScrollInfo)
      document.removeEventListener('scroll', updateScrollInfo)
      window.removeEventListener('resize', updateScrollInfo)
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateScrollInfo)
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 999999,
        minWidth: '200px'
      }}
    >
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '5px', marginBottom: '5px' }}>
        <strong>Window Scroll:</strong>
        <div>Y: {scrollInfo.scrollY}px</div>
        <div>Height: {scrollInfo.scrollHeight}px</div>
        <div>Max: {scrollInfo.maxScroll}px</div>
      </div>
      
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '5px', marginBottom: '5px' }}>
        <strong>Container Scroll:</strong>
        <div>Y: {scrollInfo.containerScroll}px</div>
        <div>Height: {scrollInfo.containerHeight}px</div>
        <div>Max: {scrollInfo.containerMax}px</div>
      </div>
      
      <div>Scrolling: {scrollInfo.scrollingElement}</div>
      <div style={{ marginTop: '5px', color: scrollInfo.containerScroll > 300 ? '#4ade80' : '#ef4444' }}>
        Show BackToTop: {scrollInfo.containerScroll > 300 ? 'YES' : 'NO'}
      </div>
      
      <button 
        onClick={() => {
          console.log('Debug scroll to top clicked')
          // Find and scroll container
          const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll')
          for (const el of containers) {
            if (el.scrollHeight > el.clientHeight) {
              el.scrollTop = 0
              console.log('Scrolled container to top')
              return
            }
          }
          // Fallback to window
          window.scrollTo(0, 0)
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
        }}
        style={{
          marginTop: '5px',
          padding: '2px 8px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
      >
        Test Scroll
      </button>
    </div>
  )
}

export default ScrollDebug