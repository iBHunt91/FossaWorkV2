import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, Settings, Activity, FileText, Zap, LogOut, Sparkles, Moon, Sun, MapPin, Filter, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { MagneticButton, RippleButton } from '@/components/ui/animated-button'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import ScrapingStatus from './ScrapingStatus'

const Navigation: React.FC = () => {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home, gradient: 'from-blue-600 to-cyan-600' },
    { path: '/work-orders', label: 'Work Orders', icon: Calendar, gradient: 'from-purple-600 to-pink-600' },
    { path: '/job-map', label: 'Job Map', icon: MapPin, gradient: 'from-emerald-600 to-teal-600' },
    { path: '/filters', label: 'Filters', icon: Filter, gradient: 'from-yellow-600 to-orange-600' },
    { path: '/automation', label: 'Automation', icon: Zap, gradient: 'from-orange-600 to-red-600' },
    { path: '/testing', label: 'Testing', icon: FlaskConical, gradient: 'from-indigo-600 to-purple-600' },
    { path: '/settings', label: 'Settings', icon: Settings, gradient: 'from-green-600 to-teal-600' },
  ]

  return (
    <nav className="flex flex-col h-full bg-card/98 backdrop-blur-lg border-r border-border shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3 animate-slide-in-from-left">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-lg blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center w-10 h-10 bg-primary rounded-lg animate-float">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold">
              <GradientText text="FossaWork" gradient="from-blue-600 via-purple-600 to-pink-600" />
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs badge-gradient animate-scale-in" style={{animationDelay: '0.3s'}}>
                V2
              </Badge>
              <Badge variant="outline" className="text-xs animate-scale-in" style={{animationDelay: '0.4s'}}>
                <Sparkles className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Scraping Status - Prominent Position */}
      <div className="px-4 pt-4 animate-slide-in-from-left" style={{animationDelay: '0.2s'}}>
        <ScrapingStatus compact={true} />
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 px-4 py-4">
        <nav className="space-y-2">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            const isHovered = hoveredItem === item.path

            return (
              <div
                key={item.path}
                className="relative animate-slide-in-from-left"
                style={{animationDelay: `${index * 0.1}s`}}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Hover Background Effect */}
                {isHovered && !isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg blur-md animate-fade-in" />
                )}
                
                <MagneticButton
                  asChild
                  variant={isActive ? 'default' : 'ghost'}
                  className={`relative w-full justify-start h-11 px-4 transition-all duration-200 ${
                    isActive ? 'shadow-lg shadow-primary/25 bg-primary text-primary-foreground' : 'text-foreground hover:text-foreground'
                  }`}
                  strength={0.15}
                >
                  <Link to={item.path}>
                    <div className="relative">
                      <Icon className={`w-5 h-5 mr-3 transition-transform duration-200 ${
                        isActive ? 'animate-spin-slow' : isHovered ? 'scale-110' : ''
                      }`} />
                    </div>
                    <span className="font-medium">
                      {isActive ? (
                        item.label
                      ) : (
                        item.label
                      )}
                    </span>
                    {isActive && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary-foreground rounded-full animate-pulse" />
                    )}
                  </Link>
                </MagneticButton>
              </div>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 space-y-3">
        {/* Theme Toggle */}
        <div className="px-2">
          <div className="p-3 rounded-lg bg-accent/50 glass animate-slide-in-from-left" style={{animationDelay: '0.7s'}}>
            <p className="text-xs font-medium mb-2 text-center">Theme</p>
            <div className="flex gap-1">
              {[
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Activity, label: 'Auto' }
              ].map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex-1 p-2 rounded-md transition-all group relative ${
                      theme === option.value 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-accent'
                    }`}
                    title={option.label}
                  >
                    <Icon className="w-4 h-4 mx-auto" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        
        {/* User Info */}
        {user && (
          <div className="px-3 py-2 rounded-lg bg-accent/50 glass animate-slide-in-from-left" style={{animationDelay: '0.8s'}}>
            <p className="text-sm font-medium truncate">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        
        {/* Logout Button */}
        <RippleButton
          onClick={logout}
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive animate-slide-in-from-left"
          size="sm"
          style={{animationDelay: '0.9s'}}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </RippleButton>
        
        <div className="text-center pt-2 animate-fade-in" style={{animationDelay: '1s'}}>
          <p className="text-xs text-muted-foreground">Version 2.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">
            <AnimatedText text="Fuel Dispenser Automation" animationType="fade" delay={1.1} className="text-xs" />
          </p>
        </div>
      </div>
    </nav>
  )
}

export default Navigation