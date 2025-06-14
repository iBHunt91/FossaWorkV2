import React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { MagneticButton } from './animated-button'

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' }
  ]

  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-muted/50 backdrop-blur", className)}>
      {themes.map((t) => {
        const Icon = t.icon
        const isActive = theme === t.value
        
        return (
          <MagneticButton
            key={t.value}
            variant="ghost"
            size="sm"
            onClick={() => setTheme(t.value)}
            className={cn(
              "relative h-8 w-8 p-0",
              isActive && "bg-background shadow-sm"
            )}
            strength={0.2}
          >
            <Icon 
              className={cn(
                "h-4 w-4 transition-all duration-300",
                isActive ? "text-foreground scale-110" : "text-muted-foreground",
                t.value === 'dark' && resolvedTheme === 'dark' && "rotate-180"
              )} 
            />
            <span className="sr-only">{t.label}</span>
            {isActive && (
              <span className="absolute inset-0 rounded-md bg-primary/10 animate-pulse" />
            )}
          </MagneticButton>
        )
      })}
    </div>
  )
}

export const FloatingThemeToggle: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <MagneticButton
      onClick={toggleTheme}
      size="icon"
      variant="outline"
      className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg backdrop-blur border-primary/20 hover:border-primary/40 z-50 animate-bounce-in"
      style={{ animationDelay: '1s' }}
    >
      <Sun className={cn(
        "h-5 w-5 absolute transition-all duration-500",
        resolvedTheme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
      )} />
      <Moon className={cn(
        "h-5 w-5 absolute transition-all duration-500",
        resolvedTheme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'
      )} />
      <span className="sr-only">Toggle theme</span>
    </MagneticButton>
  )
}