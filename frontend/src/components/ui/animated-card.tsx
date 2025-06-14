import React from 'react'
import { cn } from '@/lib/utils'

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  hover?: 'lift' | 'glow' | 'border' | 'scale'
  animate?: 'fade' | 'slide' | 'bounce'
  delay?: number
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  hover = 'lift',
  animate = 'fade',
  delay = 0
}) => {
  const hoverClasses = {
    lift: 'hover:-translate-y-1 hover:shadow-2xl',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]',
    border: 'hover:border-primary hover:shadow-lg',
    scale: 'hover:scale-[1.02]'
  }
  
  const animateClasses = {
    fade: 'animate-fade-in',
    slide: 'animate-slide-in-from-bottom',
    bounce: 'animate-bounce-in'
  }
  
  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-6 transition-all duration-300",
        hoverClasses[hover],
        animateClasses[animate],
        className
      )}
      style={{
        animationDelay: `${delay}s`,
        animationFillMode: 'both'
      }}
    >
      {children}
    </div>
  )
}

interface GlowCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
}

export const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className,
  glowColor = 'rgba(59, 130, 246, 0.5)'
}) => {
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 })
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }
  
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-6 transition-all duration-300",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <div
        className="pointer-events-none absolute opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
          inset: '-1px'
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

interface FlipCardProps {
  front: React.ReactNode
  back: React.ReactNode
  className?: string
}

export const FlipCard: React.FC<FlipCardProps> = ({ front, back, className }) => {
  const [isFlipped, setIsFlipped] = React.useState(false)
  
  return (
    <div
      className={cn("relative h-full w-full cursor-pointer", className)}
      style={{ perspective: '1000px' }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className="relative h-full w-full transition-transform duration-600"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        <div
          className="absolute h-full w-full rounded-lg border bg-card p-6"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {front}
        </div>
        <div
          className="absolute h-full w-full rounded-lg border bg-card p-6"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {back}
        </div>
      </div>
    </div>
  )
}