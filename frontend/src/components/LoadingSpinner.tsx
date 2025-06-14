import React from 'react'
import { DotsLoader, Spinner } from '@/components/ui/animated-loader'
import { AnimatedText } from '@/components/ui/animated-text'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
  type?: 'dots' | 'spinner'
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = 'Loading...',
  type = 'dots'
}) => {
  const sizeMap = {
    small: 'sm' as const,
    medium: 'md' as const,
    large: 'lg' as const
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {type === 'dots' ? (
        <DotsLoader size={sizeMap[size]} />
      ) : (
        <Spinner size={sizeMap[size]} />
      )}
      {message && (
        <AnimatedText 
          text={message} 
          animationType="fade" 
          className="text-muted-foreground"
        />
      )}
    </div>
  )
}

export default LoadingSpinner