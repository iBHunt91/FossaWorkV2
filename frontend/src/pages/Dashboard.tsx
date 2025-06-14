import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Users, AlertTriangle, CheckCircle, Activity, Settings, RefreshCw, Store, TrendingUp, CalendarDays, Building2, MapPin } from 'lucide-react'
import { fetchHealthCheck, fetchWorkOrders, getUserPreferences } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '../components/LoadingSpinner'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedButton, RippleButton } from '@/components/ui/animated-button'
import { ProgressLoader, DotsLoader } from '@/components/ui/animated-loader'

const Dashboard: React.FC = () => {
  const { token, user } = useAuth()
  const currentUserId = user?.id || 'authenticated-user'

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealthCheck,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Fetch user preferences including work week settings
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
    enabled: !!token,
  })

  // For now, use a generic user ID since we need to implement proper user management
  const { data: workOrders, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['work-orders', token],
    queryFn: () => fetchWorkOrders(currentUserId),
    refetchInterval: 60000, // Refetch every minute
    enabled: !!token, // Only run query if authenticated
  })

  // Calculate current and next week date ranges based on user preferences
  const getWeekRange = (weekOffset: number = 0) => {
    const today = new Date()
    const currentDay = today.getDay()
    
    // Get work week days from preferences (default Monday-Friday)
    const workDays = preferences?.work_week?.days || [1, 2, 3, 4, 5]
    
    // Find the start of the current week (Sunday)
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - currentDay + (weekOffset * 7))
    weekStart.setHours(0, 0, 0, 0)
    
    // Find the end of the current week (Saturday)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    // Filter dates within this week that are work days
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      if (workDays.includes(date.getDay())) {
        dates.push(date)
      }
    }
    
    // Return the first and last work days of the week
    if (dates.length > 0) {
      return { 
        start: dates[0], 
        end: dates[dates.length - 1],
        workDays: dates
      }
    } else {
      // No work days in this week, return week bounds
      return { start: weekStart, end: weekEnd, workDays: [] }
    }
  }

  const currentWeek = getWeekRange(0)
  const nextWeek = getWeekRange(1)

  // Analyze work orders by store and week
  const storeAnalysis = useMemo(() => {
    if (!workOrders || workOrders.length === 0) {
      return {
        currentWeek: new Map(),
        nextWeek: new Map(),
        totalStores: 0,
        uniqueStores: new Set()
      }
    }

    const currentWeekStores = new Map<string, number>()
    const nextWeekStores = new Map<string, number>()
    const uniqueStores = new Set<string>()

    workOrders.forEach((wo: any) => {
      const storeName = wo.location?.site_name || wo.site_name || 'Unknown'
      uniqueStores.add(storeName)

      // Check if work order has a scheduled date
      if (wo.scheduled_date) {
        const scheduledDate = new Date(wo.scheduled_date)
        const workDays = preferences?.work_week?.days || [1, 2, 3, 4, 5]
        
        // Only count if scheduled on a work day
        if (workDays.includes(scheduledDate.getDay())) {
          // Check if in current week
          if (scheduledDate >= currentWeek.start && scheduledDate <= currentWeek.end) {
            currentWeekStores.set(storeName, (currentWeekStores.get(storeName) || 0) + 1)
          } 
          // Check if in next week
          else if (scheduledDate >= nextWeek.start && scheduledDate <= nextWeek.end) {
            nextWeekStores.set(storeName, (nextWeekStores.get(storeName) || 0) + 1)
          }
        }
      }
    })

    return {
      currentWeek: currentWeekStores,
      nextWeek: nextWeekStores,
      totalStores: uniqueStores.size,
      uniqueStores
    }
  }, [workOrders, currentWeek, nextWeek, preferences?.work_week?.days])

  if (healthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <DotsLoader />
        <AnimatedText text="Loading system status..." animationType="fade" />
      </div>
    )
  }

  const totalWorkOrders = workOrders?.length || 0
  const currentWeekTotal = Array.from(storeAnalysis.currentWeek.values()).reduce((sum, count) => sum + count, 0)
  const nextWeekTotal = Array.from(storeAnalysis.nextWeek.values()).reduce((sum, count) => sum + count, 0)

  const getStatusVariant = (status: string | undefined) => {
    if (!status) return 'outline' as const
    switch (status) {
      case 'pending':
        return 'secondary' as const
      case 'in_progress':
        return 'default' as const
      case 'completed':
        return 'default' as const
      case 'failed':
        return 'destructive' as const
      default:
        return 'outline' as const
    }
  }

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'text-muted-foreground bg-muted/50'
    switch (status) {
      case 'pending':
        return 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-500/10'
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-500/10'
      default:
        return 'text-muted-foreground bg-muted/50'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold mb-2">
            <GradientText text="FossaWork V2 Dashboard" gradient="from-blue-600 via-purple-600 to-pink-600" />
          </h1>
          <p className="text-xl text-muted-foreground">
            <AnimatedText text="Modern Fuel Dispenser Automation System" animationType="split" delay={0.5} />
          </p>
          {preferences?.work_week && (
            <div className="mt-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                <Calendar className="w-3 h-3 mr-1" />
                Work Week: {(() => {
                  const days = preferences.work_week.days || [1, 2, 3, 4, 5]
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const selectedDays = days.map(d => dayNames[d])
                  
                  // Check for common patterns
                  if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) return 'Mon-Fri'
                  if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Mon-Sat'
                  if (JSON.stringify(days) === JSON.stringify([0, 1, 2, 3, 4, 5])) return 'Sun-Fri'
                  if (JSON.stringify(days) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'Sun-Sat'
                  
                  // For custom selections, show individual days
                  return selectedDays.join(', ')
                })()}
              </Badge>
            </div>
          )}
        </header>

        {/* System Status Alert */}
        <Alert 
          variant={health?.status === 'healthy' ? 'default' : 'destructive'}
          className={`alert-modern ${health?.status === 'healthy' ? 'success' : 'error'} animate-slide-in-from-top`}
        >
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">
              {health?.status === 'healthy' ? 'All systems operational' : 'System issues detected'}
            </span>
            {health?.database && (
              <span className="ml-2 text-sm">Database: {health.database}</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Total Work Orders */}
        <div className="grid grid-cols-1 max-w-md mx-auto mb-6">
          <AnimatedCard hover="lift" animate="slide" delay={0.1}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
              <Store className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <GradientText text={String(totalWorkOrders)} gradient="from-purple-600 to-pink-600" />
              </div>
              <p className="text-xs text-muted-foreground">
                All work orders in system
              </p>
            </CardContent>
          </AnimatedCard>
        </div>

        {/* Weekly Store Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlowCard glowColor="rgba(59, 130, 246, 0.3)">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Current Week
                  </CardTitle>
                  <CardDescription>
                    {currentWeek.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - {currentWeek.end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    <GradientText text={String(storeAnalysis.currentWeek.size)} gradient="from-blue-600 to-cyan-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    stores ({currentWeekTotal} visits)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {storeAnalysis.currentWeek.size > 0 ? (
                <div className="space-y-3">
                  {Array.from(storeAnalysis.currentWeek.entries())
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([store, count]) => (
                      <div key={store} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">{store}</span>
                        </div>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                          {count} {count === 1 ? 'visit' : 'visits'}
                        </Badge>
                      </div>
                    ))}
                  {storeAnalysis.currentWeek.size > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      +{storeAnalysis.currentWeek.size - 5} more stores
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No stores scheduled this week</p>
                </div>
              )}
            </CardContent>
          </GlowCard>

          <GlowCard glowColor="rgba(34, 197, 94, 0.3)">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Next Week
                  </CardTitle>
                  <CardDescription>
                    {nextWeek.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - {nextWeek.end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    <GradientText text={String(storeAnalysis.nextWeek.size)} gradient="from-green-600 to-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    stores ({nextWeekTotal} visits)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {storeAnalysis.nextWeek.size > 0 ? (
                <div className="space-y-3">
                  {Array.from(storeAnalysis.nextWeek.entries())
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([store, count]) => (
                      <div key={store} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-sm">{store}</span>
                        </div>
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          {count} {count === 1 ? 'visit' : 'visits'}
                        </Badge>
                      </div>
                    ))}
                  {storeAnalysis.nextWeek.size > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      +{storeAnalysis.nextWeek.size - 5} more stores
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No stores scheduled next week</p>
                </div>
              )}
            </CardContent>
          </GlowCard>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatedCard hover="border" animate="fade" delay={0.5} className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and navigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatedButton 
                variant="outline"
                className="w-full justify-start flex-row" 
                animation="pulse"
                onClick={() => window.location.href = '/work-orders'}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View All Work Orders
              </AnimatedButton>
              
              <AnimatedButton 
                variant="outline" 
                className="w-full justify-start flex-row"
                animation="shimmer"
                onClick={() => window.location.href = '/work-orders?action=scrape'}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Scrape Work Orders
              </AnimatedButton>
              
              <AnimatedButton 
                variant="outline" 
                className="w-full justify-start flex-row"
                animation="pulse"
                onClick={() => window.location.href = '/automation'}
              >
                <Activity className="h-4 w-4 mr-2" />
                Automation Dashboard
              </AnimatedButton>
              
              <AnimatedButton 
                variant="outline" 
                className="w-full justify-start flex-row"
                animation="pulse"
                onClick={() => window.location.href = '/settings'}
              >
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </AnimatedButton>
            </CardContent>
          </AnimatedCard>
        </div>
      </div>
    </div>
  )
}

export default Dashboard