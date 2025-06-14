import React from 'react'
import { cn } from '@/lib/utils'
import { Button, ButtonProps } from './button'

interface AnimatedButtonProps extends ButtonProps {
  animation?: 'pulse' | 'shimmer' | 'glow' | 'bounce'
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  className,
  animation = 'pulse',
  variant = 'default',
  ...props
}) => {
  const animationClasses = {
    pulse: 'hover:animate-pulse-glow',
    shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:animate-shimmer',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]',
    bounce: 'hover:animate-bounce'
  }
  
  return (
    <Button
      variant={variant}
      className={cn(
        "transition-all duration-300",
        animationClasses[animation],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

interface MagneticButtonProps extends ButtonProps {
  strength?: number
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className,
  strength = 0.25,
  asChild,
  ...props
}) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [transform, setTransform] = React.useState({ x: 0, y: 0 })
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const distanceX = (e.clientX - centerX) * strength
    const distanceY = (e.clientY - centerY) * strength
    
    setTransform({ x: distanceX, y: distanceY })
  }
  
  const handleMouseLeave = () => {
    setTransform({ x: 0, y: 0 })
  }
  
  // If asChild is true, wrap the button in a div to handle the magnetic effect
  if (asChild) {
    return (
      <div
        ref={ref}
        className="inline-block transition-transform duration-200"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px)`
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Button
          className={cn(className)}
          asChild={asChild}
          {...props}
        >
          {children}
        </Button>
      </div>
    )
  }
  
  // Otherwise, apply the effect directly to the button
  return (
    <Button
      ref={ref as any}
      className={cn("transition-transform duration-200", className)}
      style={{
        transform: `translate(${transform.x}px, ${transform.y}px)`
      }}
      onMouseMove={handleMouseMove as any}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Button>
  )
}

interface RippleButtonProps extends ButtonProps {}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  className,
  onClick,
  variant = 'default',
  ...props
}) => {
  const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    
    setRipples([...ripples, { x, y, id }])
    
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id))
    }, 600)
    
    if (onClick) onClick(e)
  }
  
  return (
    <Button
      variant={variant}
      className={cn("relative overflow-hidden", className)}
      onClick={handleClick}
      {...props}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-white/30"
          style={{
            left: ripple.x,
            top: ripple.y
          }}
        />
      ))}
      <span className="relative z-10 inline-flex items-center">{children}</span>
    </Button>
  )
}