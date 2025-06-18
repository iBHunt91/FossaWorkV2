import * as React from "react"
import { cn } from "@/lib/utils"

// Responsive Card with mobile-optimized padding
function ResponsiveCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 sm:gap-6 rounded-xl border py-4 sm:py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

// Responsive Card Header with mobile-optimized padding
function ResponsiveCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 sm:px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 sm:[.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

// Responsive Card Content with mobile-optimized padding
function ResponsiveCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 sm:px-6", className)}
      {...props}
    />
  )
}

// Responsive Card Footer with mobile-optimized padding
function ResponsiveCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 sm:px-6 [.border-t]:pt-4 sm:[.border-t]:pt-6", className)}
      {...props}
    />
  )
}

// Compact Card for mobile lists
function CompactCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="compact-card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-2 rounded-lg border p-3 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

// Expandable Card with mobile-friendly touch areas
interface ExpandableCardProps extends React.ComponentProps<"div"> {
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void
}

function ExpandableCard({ 
  className, 
  expanded = false, 
  onExpandChange,
  children,
  ...props 
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(expanded)

  React.useEffect(() => {
    setIsExpanded(expanded)
  }, [expanded])

  const handleToggle = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onExpandChange?.(newState)
  }

  return (
    <div
      data-slot="expandable-card"
      className={cn(
        "bg-card text-card-foreground rounded-xl border shadow-sm transition-all duration-200",
        isExpanded ? "py-4 sm:py-6" : "py-3 sm:py-4",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.props['data-slot'] === 'expandable-trigger') {
          return React.cloneElement(child as React.ReactElement<any>, {
            onClick: handleToggle,
            'aria-expanded': isExpanded,
          })
        }
        if (React.isValidElement(child) && child.props['data-slot'] === 'expandable-content') {
          return isExpanded ? child : null
        }
        return child
      })}
    </div>
  )
}

function ExpandableTrigger({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="expandable-trigger"
      className={cn(
        "w-full text-left px-4 sm:px-6 hover:bg-accent/50 transition-colors min-h-[44px] touch-manipulation",
        className
      )}
      {...props}
    />
  )
}

function ExpandableContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="expandable-content"
      className={cn(
        "px-4 sm:px-6 pt-2 sm:pt-4 animate-in slide-in-from-top-2 duration-200",
        className
      )}
      {...props}
    />
  )
}

// Swipeable Card with touch gestures (placeholder for future implementation)
interface SwipeableCardProps extends React.ComponentProps<"div"> {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

function SwipeableCard({ 
  className, 
  onSwipeLeft,
  onSwipeRight,
  ...props 
}: SwipeableCardProps) {
  // TODO: Implement touch gesture handling
  return (
    <div
      data-slot="swipeable-card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 sm:gap-6 rounded-xl border py-4 sm:py-6 shadow-sm touch-pan-x",
        className
      )}
      {...props}
    />
  )
}

export {
  ResponsiveCard,
  ResponsiveCardHeader,
  ResponsiveCardContent,
  ResponsiveCardFooter,
  CompactCard,
  ExpandableCard,
  ExpandableTrigger,
  ExpandableContent,
  SwipeableCard,
  // Re-export original components from card.tsx for convenience
  Card,
  CardTitle,
  CardDescription,
  CardAction,
} from './card'

export {
  ResponsiveCard as Card,
  ResponsiveCardHeader as CardHeader,
  ResponsiveCardContent as CardContent,
  ResponsiveCardFooter as CardFooter,
}