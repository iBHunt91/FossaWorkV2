import React from 'react'
import { ChevronUp } from 'lucide-react'

// Always visible version for debugging
export const BackToTopVisible: React.FC = () => {
  const scrollToTop = () => {
    console.log('BackToTopVisible clicked!')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
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
        color: 'white'
      }}
    >
      <ChevronUp size={30} />
    </div>
  )
}

export default BackToTopVisible