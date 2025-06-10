import React from 'react'
import { Card as ShadcnCard } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <ShadcnCard 
      className={cn(
        onClick && 'cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      {children}
    </ShadcnCard>
  )
}

export default Card