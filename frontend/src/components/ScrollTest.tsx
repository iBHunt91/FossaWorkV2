import React from 'react'

export const ScrollTest: React.FC = () => {
  const testScroll = () => {
    console.log('=== Scroll Test ===')
    console.log('window.scrollY:', window.scrollY)
    console.log('window.pageYOffset:', window.pageYOffset)
    console.log('document.documentElement.scrollTop:', document.documentElement.scrollTop)
    console.log('document.body.scrollTop:', document.body.scrollTop)
    console.log('document.documentElement.scrollHeight:', document.documentElement.scrollHeight)
    console.log('document.documentElement.clientHeight:', document.documentElement.clientHeight)
    console.log('window.innerHeight:', window.innerHeight)
    
    // Check for overflow styles
    const htmlStyles = window.getComputedStyle(document.documentElement)
    const bodyStyles = window.getComputedStyle(document.body)
    console.log('HTML overflow:', htmlStyles.overflow, htmlStyles.overflowY)
    console.log('BODY overflow:', bodyStyles.overflow, bodyStyles.overflowY)
    console.log('HTML height:', htmlStyles.height)
    console.log('BODY height:', bodyStyles.height)
    
    // Try to find the actual scrolling element
    const elements = [document.documentElement, document.body]
    const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll, [style*="overflow"]')
    containers.forEach((el, i) => {
      console.log(`Container ${i}:`, el.className, 'scrollTop:', el.scrollTop, 'scrollHeight:', el.scrollHeight)
    })
  }
  
  const forceScroll = () => {
    // Force scroll to top using all methods
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    
    // Also try scrolling any containers
    const containers = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll')
    containers.forEach(el => {
      el.scrollTop = 0
    })
    
    console.log('Forced scroll to top - check values again')
    setTimeout(testScroll, 100)
  }
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 255, 0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}
    >
      <button 
        onClick={testScroll}
        style={{
          padding: '5px 10px',
          backgroundColor: 'white',
          color: 'blue',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Test Scroll Values
      </button>
      <button 
        onClick={forceScroll}
        style={{
          padding: '5px 10px',
          backgroundColor: 'white',
          color: 'blue',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Force Scroll Top
      </button>
    </div>
  )
}

export default ScrollTest