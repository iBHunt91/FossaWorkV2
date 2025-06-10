import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, Settings, Activity, FileText, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const Navigation: React.FC = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/work-orders', label: 'Work Orders', icon: Calendar },
    { path: '/automation', label: 'Automation', icon: Zap },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">FossaWork</h1>
            <Badge variant="secondary" className="text-xs">
              V2
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <Button
                key={item.path}
                asChild
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start h-11 px-4"
              >
                <Link to={item.path}>
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Version 2.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">
            Fuel Dispenser Automation
          </p>
        </div>
      </div>
    </nav>
  )
}

export default Navigation