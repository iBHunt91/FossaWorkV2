import React from 'react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }
  
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

interface DotsLoaderProps {
  className?: string
}

export const DotsLoader: React.FC<DotsLoaderProps> = ({ className }) => {
  return (
    <div className={cn("flex space-x-2", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 w-3 animate-bounce rounded-full bg-primary"
          style={{
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

interface PulseLoaderProps {
  className?: string
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({ className }) => {
  return (
    <div className={cn("relative h-20 w-20", className)}>
      <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
      <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" style={{ animationDelay: '0.5s' }} />
      <div className="relative h-full w-full rounded-full bg-primary" />
    </div>
  )
}

interface ProgressLoaderProps {
  progress: number
  className?: string
  showPercentage?: boolean
}

export const ProgressLoader: React.FC<ProgressLoaderProps> = ({ 
  progress, 
  className,
  showPercentage = true 
}) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {showPercentage && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  )
}

interface SkeletonLoaderProps {
  className?: string
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className }) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-muted",
        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:animate-shimmer",
        className
      )}
    />
  )
}