import React from 'react'
import { cn } from '@/lib/utils'

interface GradientBackgroundProps {
  className?: string
  children?: React.ReactNode
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ className, children }) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 animate-gradient" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  )
}

interface ParticleBackgroundProps {
  className?: string
  children?: React.ReactNode
  particleCount?: number
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ 
  className, 
  children,
  particleCount = 50 
}) => {
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10
  }))
  
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-primary/10 animate-float"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>
      {children && <div className="relative z-10">{children}</div>}
    </div>
  )
}

interface GeometricBackgroundProps {
  className?: string
  children?: React.ReactNode
}

export const GeometricBackground: React.FC<GeometricBackgroundProps> = ({ className, children }) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="geometric-pattern"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <polygon
              points="50 0, 100 50, 50 100, 0 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary/10"
            />
            <circle
              cx="50"
              cy="50"
              r="2"
              fill="currentColor"
              className="text-primary/20"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geometric-pattern)" />
      </svg>
      {children && <div className="relative z-10">{children}</div>}
    </div>
  )
}