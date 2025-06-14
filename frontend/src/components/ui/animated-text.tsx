import React from 'react'
import { cn } from '@/lib/utils'

interface AnimatedTextProps {
  text: string
  className?: string
  delay?: number
  animationType?: 'reveal' | 'split' | 'fade' | 'bounce'
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  className,
  delay = 0,
  animationType = 'reveal'
}) => {
  const words = text.split(' ')
  
  if (animationType === 'split') {
    return (
      <span className={cn("inline-flex flex-wrap", className)}>
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-flex mr-1">
            {word.split('').map((char, charIndex) => (
              <span
                key={charIndex}
                className="inline-block animate-text-reveal"
                style={{
                  animationDelay: `${delay + (wordIndex * 0.1) + (charIndex * 0.05)}s`
                }}
              >
                {char}
              </span>
            ))}
          </span>
        ))}
      </span>
    )
  }
  
  if (animationType === 'bounce') {
    return (
      <span className={cn("inline-flex flex-wrap", className)}>
        {words.map((word, index) => (
          <span
            key={index}
            className="inline-block mr-1 animate-bounce-in"
            style={{
              animationDelay: `${delay + (index * 0.1)}s`,
              animationFillMode: 'both'
            }}
          >
            {word}
          </span>
        ))}
      </span>
    )
  }
  
  return (
    <span
      className={cn(
        animationType === 'reveal' && "inline-block animate-text-reveal",
        animationType === 'fade' && "inline-block animate-fade-in",
        className
      )}
      style={{
        animationDelay: `${delay}s`,
        animationFillMode: 'both'
      }}
    >
      {text}
    </span>
  )
}

interface ShimmerTextProps {
  text: string
  className?: string
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({ text, className }) => {
  return (
    <span
      className={cn(
        "inline-block bg-gradient-to-r from-primary/50 via-primary to-primary/50 bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer",
        className
      )}
    >
      {text}
    </span>
  )
}

interface GradientTextProps {
  text: string
  className?: string
  gradient?: string
}

export const GradientText: React.FC<GradientTextProps> = ({ 
  text, 
  className,
  gradient = "from-blue-600 to-purple-600" 
}) => {
  return (
    <span
      className={cn(
        "inline-block bg-gradient-to-r bg-clip-text text-transparent",
        gradient,
        className
      )}
    >
      {text}
    </span>
  )
}