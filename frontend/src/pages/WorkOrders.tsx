import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Filter, MapPin, Calendar, Wrench, AlertTriangle, CheckCircle, Clock, XCircle, List, Eye, Fuel, Sparkles, Trash2, ChevronDown, ChevronUp, Settings, Bug, Eraser, Download, CheckSquare, Square, CalendarDays, Database, ChevronLeft, ChevronRight, Hash, ArrowRight } from 'lucide-react'
import { fetchWorkOrders, triggerScrape, updateWorkOrderStatus, openWorkOrderVisit, getScrapingProgress, triggerBatchDispenserScrape, getDispenserScrapingProgress, scrapeDispensersForWorkOrder, clearDispensersForWorkOrder, getUserPreferences, clearAllWorkOrders } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useDebouncedCallback } from 'use-debounce'
import { useWorkOrderScrapingProgress, useDispenserScrapingProgress, useSingleDispenserProgress } from '../hooks/useProgressPolling'
import { getBrandStyle, getBrandCardStyle, getBrandBadgeStyle, cleanSiteName } from '@/utils/storeColors'
import { cn } from '@/lib/utils'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isThisWeek, getDay, isBefore, isSameWeek } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '../components/LoadingSpinner'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button'
import { ProgressLoader, DotsLoader, SkeletonLoader } from '@/components/ui/animated-loader'
import { ParticleBackground } from '@/components/ui/animated-background'
import { DispenserInfoModal } from '@/components/DispenserInfoModal'
import { DispenserInfoModalDebug } from '@/components/DispenserInfoModalDebug'
import { DebugModal } from '@/components/DebugModal'
import WorkOrderWeeklyView from '../components/WorkOrderWeeklyView'
import InstructionSummary from '../components/InstructionSummary'
import { hasImportantInfo } from '../utils/instructionParser'
import BackToTop from '../components/BackToTop'
import ScrapingStatus from '../components/ScrapingStatus'
import { useWeekendMode } from '../hooks/useWeekendMode'
import { WorkOrdersErrorBoundary } from '../components/ErrorBoundary'

// Enhanced work order interface with V1 compatibility
interface EnhancedWorkOrder {
  id: string
  external_id: string
  site_name: string
  address: string
  scheduled_date: string | null
  status: string
  visit_url?: string
  created_at: string
  updated_at: string
  // V1 Enhanced fields
  store_number?: string
  service_code?: string
  service_description?: string
  service_name?: string
  service_items?: string | string[]
  visit_id?: string
  visit_number?: string
  instructions?: string
  scraped_data?: {
    raw_html?: string
    address_components?: {
      street?: string
      intersection?: string
      cityState?: string
      county?: string
    }
    service_info?: {
      type?: string
      quantity?: number
    }
    visit_info?: {
      visit_id?: string
      date?: string
      url?: string
    }
  }
  dispensers: Array<{
    id: string
    dispenser_number: string
    dispenser_type: string
    fuel_grades: Record<string, any>
    status: string
    progress_percentage: number
    automation_completed: boolean
    created_at: string
    updated_at: string
  }>
}

// Empty State Component - handles all empty state scenarios reliably
interface EmptyStateProps {
  workOrders: EnhancedWorkOrder[]
  filteredWorkOrders: EnhancedWorkOrder[]
  weekFilteredWorkOrders: EnhancedWorkOrder[]
  viewMode: 'list' | 'weekly'
  selectedWeek: Date
  showAllJobs: boolean
  weekendModeEnabled: boolean
  setWeekendModeEnabled: (enabled: boolean) => void
  setShowAllJobs: (show: boolean) => void
  handleScrape: () => void
  handleWeekChange: (date: Date) => void
}

const EmptyStateComponent: React.FC<EmptyStateProps> = ({
  workOrders,
  filteredWorkOrders,
  weekFilteredWorkOrders,
  viewMode,
  selectedWeek,
  showAllJobs,
  weekendModeEnabled,
  setWeekendModeEnabled,
  setShowAllJobs,
  handleScrape,
  handleWeekChange
}) => {
  // Determine if current view is empty
  const currentViewEmpty = viewMode === 'weekly' 
    ? filteredWorkOrders.length === 0
    : weekFilteredWorkOrders.length === 0

  // Check if we have any work orders at all
  const hasAnyWorkOrders = workOrders.length > 0

  // Calculate next week info
  const nextWeek = addWeeks(new Date(), 1)
  const nextWeekStart = startOfWeek(nextWeek, { weekStartsOn: 1 })
  const nextWeekEnd = endOfWeek(nextWeek, { weekStartsOn: 1 })
  
  const nextWeekWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false
    const date = new Date(wo.scheduled_date)
    return date >= nextWeekStart && date <= nextWeekEnd
  })

  // Determine week type for list view
  const today = new Date()
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 })
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 })
  
  const isPastWeek = viewMode === 'list' && weekEnd < currentWeekStart
  const isFutureWeek = viewMode === 'list' && weekStart > currentWeekEnd
  const isCurrentWeek = viewMode === 'weekly' || isThisWeek(selectedWeek)

  // Find next week with work
  const findNextWeekWithWork = () => {
    let checkWeek = addWeeks(selectedWeek, 1)
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(checkWeek, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(checkWeek, { weekStartsOn: 1 })
      const hasWork = workOrders.some(wo => {
        if (!wo.scheduled_date) return false
        const date = new Date(wo.scheduled_date)
        return date >= weekStart && date <= weekEnd
      })
      if (hasWork) return checkWeek
      checkWeek = addWeeks(checkWeek, 1)
    }
    return null
  }

  // No work orders at all - first time user or need to scrape
  if (!hasAnyWorkOrders) {
    return (
      <>
        <Fuel className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-bounce" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="No Work Orders Available" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text="You don't have any work orders yet. Click 'Scrape Work Orders' below to fetch your latest assignments from WorkFossa."
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <RippleButton onClick={handleScrape} size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Scrape Work Orders
          </RippleButton>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto">
            💡 Make sure your WorkFossa credentials are configured in Settings and you have assigned work orders on the WorkFossa platform.
          </div>
        </div>
      </>
    )
  }

  // Weekly view with no work orders
  if (currentViewEmpty && viewMode === 'weekly') {
    return (
      <>
        <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="No Work Orders Available" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text={showAllJobs 
              ? "No work orders found in your current view. Try adjusting your filters or scraping for updates."
              : "No work orders found for your selected work days. Try expanding your view or checking your preferences."
            }
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <RippleButton onClick={handleScrape} size="lg" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Check for Updates
            </RippleButton>
            {!showAllJobs && (
              <RippleButton 
                onClick={() => setShowAllJobs(true)} 
                size="lg"
                variant="default"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Show All Jobs
              </RippleButton>
            )}
          </div>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto">
            {showAllJobs 
              ? "💡 Weekly view shows all work across your schedule"
              : "💡 Enable 'Show All Jobs' to see work scheduled for all days"
            }
          </div>
        </div>
      </>
    )
  }

  // Past week with no work orders
  if (currentViewEmpty && isPastWeek) {
    const nextWeekWithWork = findNextWeekWithWork()
    return (
      <>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="✓ Week Complete" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text={`No work was scheduled for the week of ${format(weekStart, 'MMM d')}. This week is complete!`}
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <RippleButton 
              onClick={() => handleWeekChange(new Date())} 
              size="lg"
              variant="outline"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Return to Current Week
            </RippleButton>
            {nextWeekWithWork && (
              <RippleButton 
                onClick={() => handleWeekChange(nextWeekWithWork)} 
                size="lg"
                variant="default"
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                View Next Work
              </RippleButton>
            )}
          </div>
          {!weekendModeEnabled && nextWeekWithWork && (
            <div className="text-xs text-muted-foreground max-w-sm mx-auto">
              💡 Enable weekend mode to automatically jump to weeks with scheduled work
            </div>
          )}
        </div>
      </>
    )
  }

  // Current week complete with next week work
  if (currentViewEmpty && nextWeekWorkOrders.length > 0 && isCurrentWeek) {
    return (
      <>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="✓ Current Week Complete" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text={`Excellent! You've completed all work for this week. ${nextWeekWorkOrders.length} work ${nextWeekWorkOrders.length === 1 ? 'order' : 'orders'} scheduled for next week.`}
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <RippleButton 
            onClick={() => {
              setWeekendModeEnabled(true)
              handleWeekChange(nextWeek)
            }} 
            size="lg"
            variant="default"
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            View Next Week's Work
          </RippleButton>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto">
            🏁 Weekend mode automatically activates on Thursday afternoons or weekends when the current week is complete.
          </div>
        </div>
      </>
    )
  }

  // Future week with no work
  if (currentViewEmpty && isFutureWeek) {
    const nextWeekWithWork = findNextWeekWithWork()
    const weekDesc = format(weekStart, 'MMM d, yyyy')
    
    return (
      <>
        <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="No Work Scheduled" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text={`No work orders are scheduled for the week of ${weekDesc}. Check back closer to the date or run a fresh scrape.`}
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <RippleButton 
              onClick={() => handleWeekChange(new Date())} 
              size="lg"
              variant="outline"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Return to Current Week
            </RippleButton>
            {nextWeekWithWork && (
              <RippleButton 
                onClick={() => handleWeekChange(nextWeekWithWork)} 
                size="lg"
                variant="default"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Find Next Work
              </RippleButton>
            )}
          </div>
          <RippleButton 
            onClick={handleScrape} 
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Check for Updates
          </RippleButton>
        </div>
      </>
    )
  }

  // All caught up - current week complete and no immediate future work
  if (currentViewEmpty && nextWeekWorkOrders.length === 0 && isCurrentWeek) {
    const hasFutureWork = workOrders.some(wo => {
      if (!wo.scheduled_date) return false
      const date = new Date(wo.scheduled_date)
      return date > currentWeekEnd
    })
    
    return (
      <>
        <Sparkles className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
        <CardTitle className="text-xl mb-2">
          <AnimatedText text="✓ All Caught Up!" animationType="reveal" />
        </CardTitle>
        <CardDescription className="mb-6 max-w-md mx-auto">
          <AnimatedText 
            text={hasFutureWork 
              ? "Amazing! You've completed all work for this week. Future work is scheduled, but nothing immediate."
              : "Amazing! You've completed all your work and have no upcoming orders scheduled. Time to relax!"
            }
            animationType="fade"
            delay={0.2}
          />
        </CardDescription>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <RippleButton onClick={handleScrape} size="lg" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Check for New Work
            </RippleButton>
            {hasFutureWork && !weekendModeEnabled && (
              <RippleButton 
                onClick={() => setWeekendModeEnabled(true)} 
                size="lg"
                variant="default"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Enable Weekend Mode
              </RippleButton>
            )}
          </div>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto">
            {hasFutureWork 
              ? "💪 Great work! Enable weekend mode to jump ahead to future work weeks."
              : "🎉 Enjoy your well-deserved break! Check back later for new assignments."
            }
          </div>
        </div>
      </>
    )
  }

  // Default fallback - should handle any remaining edge cases
  return (
    <>
      <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
      <CardTitle className="text-xl mb-2">
        <AnimatedText text="No Work Orders Found" animationType="reveal" />
      </CardTitle>
      <CardDescription className="mb-6 max-w-md mx-auto">
        <AnimatedText 
          text="No work orders match your current criteria. Try adjusting your filters or refreshing your data."
          animationType="fade"
          delay={0.2}
        />
      </CardDescription>
      <div className="space-y-4">
        <RippleButton onClick={handleScrape} size="lg" variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </RippleButton>
      </div>
    </>
  )
}

const WorkOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list')
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<Set<string>>(new Set())
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [hasPerformedSmartWeekDetection, setHasPerformedSmartWeekDetection] = useState(false)
  const [highlightedWorkOrderId, setHighlightedWorkOrderId] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [forceRefreshDispensers, setForceRefreshDispensers] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'scraping' | 'success' | 'error'>('idle')
  const [scrapeMessage, setScrapeMessage] = useState('')
  const [scrapingProgress, setScrapingProgress] = useState<any>(null)
  const [isPollingProgress, setIsPollingProgress] = useState(false)
  const [expandedInstructions, setExpandedInstructions] = useState<Set<string>>(new Set())
  
  // Dispenser scraping state
  const [dispenserScrapeStatus, setDispenserScrapeStatus] = useState<'idle' | 'scraping' | 'success' | 'error'>('idle')
  const [dispenserScrapeMessage, setDispenserScrapeMessage] = useState('')
  const [dispenserScrapingProgress, setDispenserScrapingProgress] = useState<any>(null)
  const [isPollingDispenserProgress, setIsPollingDispenserProgress] = useState(false)
  
  // Single dispenser scraping state
  const [singleDispenserProgress, setSingleDispenserProgress] = useState<any>(null)
  const [activeScrapeWorkOrderId, setActiveScrapeWorkOrderId] = useState<string | null>(null)
  
  // Dispenser modal state
  const [showDispenserModal, setShowDispenserModal] = useState(false)
  const [selectedWorkOrderForModal, setSelectedWorkOrderForModal] = useState<EnhancedWorkOrder | null>(null)
  
  // Debug modal state
  const [showDebugModal, setShowDebugModal] = useState(false)
  const [selectedWorkOrderForDebug, setSelectedWorkOrderForDebug] = useState<EnhancedWorkOrder | null>(null)
  
  // Dropdown states
  const [clearDataOpen, setClearDataOpen] = useState(false)
  const [scrapeDataOpen, setScrapeDataOpen] = useState(false)
  
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Check if any scraping is in progress
  const isAnyScraping = scrapeStatus === 'scraping' || 
                       dispenserScrapeStatus === 'scraping' || 
                       singleDispenserProgress !== null

  // Removed duplicate useEffect - using the more robust implementation below

  // Debounced search implementation
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      setDebouncedSearchTerm(value)
    },
    300 // 300ms delay
  )

  // Update debounced search term when search term changes
  React.useEffect(() => {
    debouncedSearch(searchTerm)
  }, [searchTerm, debouncedSearch])


  // Require authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AnimatedCard animate="bounce" hover="glow">
          <CardContent className="text-center py-8">
            <AnimatedText text="Please login to view work orders" animationType="reveal" className="text-lg" />
          </CardContent>
        </AnimatedCard>
      </div>
    )
  }

  const currentUserId = user.id

  // Fetch user preferences for work week settings
  const { data: userPreferences } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Get work days from preferences or use default
  const workDays = useMemo(() => {
    if (userPreferences?.workWeek?.workDays && Array.isArray(userPreferences.workWeek.workDays)) {
      return userPreferences.workWeek.workDays
    }
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] // Default work week
  }, [userPreferences])

  // Use custom hooks for progress polling
  // Fetch work orders - defined early so refetchWorkOrders is available
  const { data: rawWorkOrders, isLoading, error, refetch: refetchWorkOrders } = useQuery({
    queryKey: ['work-orders', currentUserId],
    queryFn: () => fetchWorkOrders(currentUserId),
    refetchInterval: isPollingProgress || isPollingDispenserProgress ? 2000 : 30000, // Poll faster during scraping
    staleTime: isPollingProgress || isPollingDispenserProgress ? 0 : 5000, // Consider data stale immediately during scraping
  })

  const {
    data: workOrderProgress,
    isPolling: isPollingWorkOrders
  } = useWorkOrderScrapingProgress(currentUserId, isPollingProgress)

  const {
    data: dispenserProgress,
    isPolling: isPollingDispensers
  } = useDispenserScrapingProgress(currentUserId, isPollingDispenserProgress)

  const {
    data: singleDispenserProgressData,
    isPolling: isPollingSingleDispenser
  } = useSingleDispenserProgress(currentUserId, activeScrapeWorkOrderId, !!activeScrapeWorkOrderId)

  // Update state when progress data changes
  useEffect(() => {
    if (workOrderProgress) {
      setScrapingProgress(workOrderProgress)
      
      if (workOrderProgress.status === 'completed' || workOrderProgress.status === 'failed') {
        setIsPollingProgress(false)
        setScrapeStatus(workOrderProgress.status === 'completed' ? 'success' : 'error')
        setScrapeMessage(workOrderProgress.message)
        localStorage.removeItem(`wo_scraping_${currentUserId}`)
        
        if (workOrderProgress.status === 'completed') {
          // Immediately refetch work orders
          queryClient.invalidateQueries({ queryKey: ['work-orders'] })
          refetchWorkOrders()
        }
        
        setTimeout(() => {
          setScrapingProgress(null)
          setScrapeStatus('idle')
          setScrapeMessage('')
        }, 5000)
      }
    }
  }, [workOrderProgress, currentUserId, queryClient, refetchWorkOrders])

  useEffect(() => {
    if (dispenserProgress) {
      setDispenserScrapingProgress(dispenserProgress)
      
      if (dispenserProgress.status === 'completed' || dispenserProgress.status === 'failed' || 
          dispenserProgress.status === 'not_found' || dispenserProgress.status === 'idle') {
        setIsPollingDispenserProgress(false)
        
        // Handle not_found status (no active scraping session)
        if (dispenserProgress.status === 'not_found' || dispenserProgress.status === 'idle') {
          // Just stop polling, don't show error
          setDispenserScrapingProgress(null)
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        } else {
          setDispenserScrapeStatus(dispenserProgress.status === 'completed' ? 'success' : 'error')
          setDispenserScrapeMessage(dispenserProgress.message)
          
          if (dispenserProgress.status === 'completed') {
            // Immediately refetch work orders
            queryClient.invalidateQueries({ queryKey: ['work-orders'] })
            refetchWorkOrders()
          }
          
          setTimeout(() => {
            setDispenserScrapingProgress(null)
            setDispenserScrapeStatus('idle')
            setDispenserScrapeMessage('')
          }, 5000)
        }
        
        localStorage.removeItem(`disp_scraping_${currentUserId}`)
      }
    }
  }, [dispenserProgress, currentUserId, queryClient, refetchWorkOrders])

  useEffect(() => {
    if (singleDispenserProgressData) {
      setSingleDispenserProgress(singleDispenserProgressData)
      
      if (singleDispenserProgressData.status === 'completed' || singleDispenserProgressData.percentage >= 100) {
        setSingleDispenserProgress({
          ...singleDispenserProgressData,
          percentage: 100,
          status: 'in_progress',
          message: singleDispenserProgressData.message || 'Completing...'
        })
        
        setTimeout(async () => {
          setDispenserScrapeStatus('success')
          setDispenserScrapeMessage(singleDispenserProgressData.message || `Successfully scraped dispensers`)
          setSingleDispenserProgress(null)
          setActiveScrapeWorkOrderId(null)
          
          await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
          
          setTimeout(() => {
            setDispenserScrapeStatus('idle')
            setDispenserScrapeMessage('')
          }, 5000)
        }, 500)
      } else if (singleDispenserProgressData.status === 'failed') {
        setDispenserScrapeStatus('error')
        setDispenserScrapeMessage(singleDispenserProgressData.error || 'Dispenser scraping failed')
        setSingleDispenserProgress(null)
        setActiveScrapeWorkOrderId(null)
      } else if (singleDispenserProgressData.status === 'not_found' || singleDispenserProgressData.status === 'idle') {
        // No active scraping session, just clear
        setSingleDispenserProgress(null)
        setActiveScrapeWorkOrderId(null)
        
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      }
    }
  }, [singleDispenserProgressData, queryClient])

  // Handle click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCalendar && calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        // Check if the click is not on the calendar dropdown itself
        const calendarDropdown = document.querySelector('.calendar-dropdown')
        if (calendarDropdown && !calendarDropdown.contains(event.target as Node)) {
          setShowCalendar(false)
        }
      }
    }
    
    if (showCalendar) {
      // Add small delay to ensure calendar is fully rendered before adding listener
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showCalendar])


  // Check for existing scraping progress on component mount
  useEffect(() => {
    const checkExistingProgress = async () => {
      if (!currentUserId) return
      
      try {
        // Check localStorage first for recent scraping activity
        const woStoredState = localStorage.getItem(`wo_scraping_${currentUserId}`)
        const dispStoredState = localStorage.getItem(`disp_scraping_${currentUserId}`)
        
        // If we have stored state, check if it's recent (within last 10 minutes)
        if (woStoredState) {
          const stored = JSON.parse(woStoredState)
          const startTime = new Date(stored.startedAt).getTime()
          const now = new Date().getTime()
          const tenMinutes = 10 * 60 * 1000
          
          if (now - startTime > tenMinutes) {
            // Too old, clear it
            localStorage.removeItem(`wo_scraping_${currentUserId}`)
          }
        }
        
        // Check work order scraping progress
        const woProgress = await getScrapingProgress(currentUserId)
        if (woProgress.status === 'in_progress') {
          setScrapeStatus('scraping')
          setScrapeMessage(woProgress.message)
          setScrapingProgress(woProgress)
          setIsPollingProgress(true)
        } else if (woStoredState) {
          // Clear stale localStorage if backend says no scraping
          localStorage.removeItem(`wo_scraping_${currentUserId}`)
        }
        
        // Check dispenser scraping progress
        const dispProgress = await getDispenserScrapingProgress(currentUserId)
        if (dispProgress.status === 'in_progress') {
          setDispenserScrapeStatus('scraping')
          setDispenserScrapeMessage(dispProgress.message)
          setDispenserScrapingProgress(dispProgress)
          setIsPollingDispenserProgress(true)
        } else if (dispStoredState) {
          // Clear stale localStorage if backend says no scraping
          localStorage.removeItem(`disp_scraping_${currentUserId}`)
        }
      } catch (error) {
        console.error('Failed to check existing progress:', error)
      }
    }
    
    checkExistingProgress()
  }, [currentUserId])

  const scrapeMutation = useMutation({
    mutationFn: () => triggerScrape(currentUserId),
    onMutate: () => {
      setScrapeStatus('scraping')
      setScrapeMessage('Initializing scraping process...')
      // Set initial progress immediately to show UI feedback
      setScrapingProgress({
        status: 'in_progress',
        percentage: 0,
        current_phase: 'Initializing',
        message: 'Starting work order scraping...',
        total_work_orders: 0,
        processed_work_orders: 0,
        successful_work_orders: 0,
        failed_work_orders: 0
      })
      setIsPollingProgress(true) // Start polling for progress
      
      // Store scraping state in localStorage
      localStorage.setItem(`wo_scraping_${currentUserId}`, JSON.stringify({
        status: 'scraping',
        startedAt: new Date().toISOString()
      }))
    },
    onSuccess: (data) => {
      console.log('Scrape initiated:', data)
      // Don't set success status here - let the progress polling handle it
    },
    onError: (error: any) => {
      console.error('Scrape failed:', error)
      setScrapeStatus('error')
      setScrapeMessage(error.response?.data?.detail || 'Failed to initiate scraping. Please try again.')
      setIsPollingProgress(false) // Stop polling on error
      
      // Clear localStorage
      localStorage.removeItem(`wo_scraping_${currentUserId}`)
      
      // Reset status after showing error
      setTimeout(() => {
        setScrapeStatus('idle')
        setScrapeMessage('')
      }, 5000)
    }
  })

  const statusUpdateMutation = useMutation({
    mutationFn: ({ workOrderId, status }: { workOrderId: string; status: string }) => 
      updateWorkOrderStatus(workOrderId, currentUserId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  // Clear all work orders mutation
  const clearAllMutation = useMutation({
    mutationFn: () => clearAllWorkOrders(currentUserId),
    onSuccess: (data) => {
      console.log('Cleared work orders:', data)
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      refetchWorkOrders() // Immediately refetch
    },
    onError: (error) => {
      console.error('Failed to clear work orders:', error)
    }
  })

  // Batch dispenser scraping mutation
  const dispenserScrapeMutation = useMutation({
    mutationFn: (forceRefresh: boolean = false) => triggerBatchDispenserScrape(currentUserId, undefined, forceRefresh),
    onMutate: () => {
      setDispenserScrapeStatus('scraping')
      setDispenserScrapeMessage('Initializing batch dispenser scraping...')
      // Set initial progress immediately to show UI feedback
      setDispenserScrapingProgress({
        status: 'in_progress',
        percentage: 0,
        current_phase: 'Initializing',
        message: 'Starting batch dispenser scraping...',
        total_work_orders: 0,
        processed_work_orders: 0,
        successful_work_orders: 0,
        failed_work_orders: 0,
        current_work_order: null
      })
      setIsPollingDispenserProgress(true) // Start polling for progress
      
      // Store scraping state in localStorage
      localStorage.setItem(`disp_scraping_${currentUserId}`, JSON.stringify({
        status: 'scraping',
        startedAt: new Date().toISOString()
      }))
    },
    onSuccess: (data) => {
      console.log('Dispenser scrape initiated:', data)
      // Handle immediate completion cases
      if (data.status === 'no_work_orders' || data.status === 'all_skipped') {
        setDispenserScrapeStatus('error')
        setDispenserScrapeMessage(data.message)
        setIsPollingDispenserProgress(false)
        
        // Clear localStorage
        localStorage.removeItem(`disp_scraping_${currentUserId}`)
        
        // Show appropriate status icon and message
        if (data.status === 'all_skipped') {
          setDispenserScrapeStatus('success')
          setDispenserScrapeMessage(data.message || 'All work orders already have dispensers')
        }
        
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
          setDispenserScrapingProgress(null)
        }, 5000)
      } else if (data.status === 'scraping_started') {
        // Continue with polling - progress will be handled by the polling hook
        console.log('Scraping started, polling for progress...')
      }
    },
    onError: (error: any) => {
      console.error('Dispenser scrape failed:', error)
      setDispenserScrapeStatus('error')
      setDispenserScrapeMessage(error.response?.data?.detail || 'Failed to initiate dispenser scraping. Please try again.')
      setIsPollingDispenserProgress(false) // Stop polling on error
      
      // Clear localStorage
      localStorage.removeItem(`disp_scraping_${currentUserId}`)
      
      // Reset status after showing error
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
        setDispenserScrapeMessage('')
      }, 5000)
    }
  })

  // Enhanced work orders with V1 data
  const workOrders: EnhancedWorkOrder[] = useMemo(() => {
    if (!rawWorkOrders) return []
    
    console.log('Raw work orders from API:', rawWorkOrders)
    
    // Handle API response format
    if (Array.isArray(rawWorkOrders)) {
      return rawWorkOrders
    }
    
    return []
  }, [rawWorkOrders])

  // Extract clean store name from full site name
  const getCleanStoreName = useCallback((siteName: string) => {
    if (!siteName) return ''
    
    // First clean the site name to remove time suffixes
    const cleanedName = cleanSiteName(siteName)
    const lower = cleanedName.toLowerCase()
    
    // Handle 7-Eleven variations (including "Eleven Stores, Inc")
    if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven') || 
        lower.includes('eleven stores') || lower.includes('speedway')) {
      // Extract store number if present
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `7-Eleven #${storeMatch[1]}` : '7-Eleven'
    }
    
    // Handle Wawa variations (including "Wawa 2025 AccuMeasure")
    if (lower.includes('wawa')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Wawa #${storeMatch[1]}` : 'Wawa'
    }
    
    // Handle Circle-K variations
    if (lower.includes('circle k') || lower.includes('circlek') || lower.includes('circle-k')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Circle-K #${storeMatch[1]}` : 'Circle-K'
    }
    
    // Handle other brands
    if (lower.includes('costco')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Costco #${storeMatch[1]}` : 'Costco'
    }
    
    if (lower.includes('shell')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Shell #${storeMatch[1]}` : 'Shell'
    }
    
    if (lower.includes('marathon')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Marathon #${storeMatch[1]}` : 'Marathon'
    }
    
    if (lower.includes('bp') && !lower.includes('bpx')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `BP #${storeMatch[1]}` : 'BP'
    }
    
    if (lower.includes('exxon') || lower.includes('mobil')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `ExxonMobil #${storeMatch[1]}` : 'ExxonMobil'
    }
    
    if (lower.includes('chevron')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Chevron #${storeMatch[1]}` : 'Chevron'
    }
    
    if (lower.includes('texaco')) {
      const storeMatch = cleanedName.match(/#(\d+)/)
      return storeMatch ? `Texaco #${storeMatch[1]}` : 'Texaco'
    }
    
    // Fallback: return cleaned name if no brand detected
    return cleanedName
  }, [])

  // Clean site name to remove time suffixes (like "1956am" from "Circle K 1956am")

  // Brand detection from site name - improved parsing
  const getBrand = useCallback((siteName: string) => {
    const cleanedName = cleanSiteName(siteName)
    const lower = cleanedName.toLowerCase()
    // Handle variations and common misspellings
    if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven') || 
        lower.includes('eleven stores') || lower.includes('speedway')) return '7-Eleven'
    if (lower.includes('wawa')) return 'Wawa'
    if (lower.includes('circle k') || lower.includes('circlek') || lower.includes('circle-k')) return 'Circle K'
    if (lower.includes('costco')) return 'Costco'
    if (lower.includes('shell')) return 'Shell'
    if (lower.includes('marathon')) return 'Marathon'
    if (lower.includes('bp') && !lower.includes('bpx')) return 'BP'
    if (lower.includes('exxon') || lower.includes('mobil')) return 'ExxonMobil'
    if (lower.includes('chevron')) return 'Chevron'
    if (lower.includes('texaco')) return 'Texaco'
    return 'Other'
  }, [])

  // Use the new brand styling system
  const getBrandStyling = useCallback((siteName: string) => {
    return getBrandCardStyle(siteName)
  }, [])

  // Status icon mapping with animations
  const getStatusIcon = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500 animate-pulse" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin-slow" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500 animate-bounce" />
    }
  }, [])

  // Helper function to calculate dispenser count for a work order
  const getDispenserCount = useCallback((workOrder: EnhancedWorkOrder) => {
    let dispenserCount = 0;
    
    // First try to get from service_items
    if (workOrder.service_items) {
      const items = Array.isArray(workOrder.service_items) 
        ? workOrder.service_items 
        : [workOrder.service_items];
      
      for (const item of items) {
        const match = item.toString().match(/(\d+)\s*x\s*(All\s*)?Dispenser/i);
        if (match) {
          dispenserCount = parseInt(match[1], 10);
          break;
        }
      }
    }
    
    // Fallback to dispensers array if available
    if (dispenserCount === 0 && workOrder.dispensers && workOrder.dispensers.length > 0) {
      dispenserCount = workOrder.dispensers.length;
    }
    
    return dispenserCount;
  }, []);

  // Enhanced address formatting with better handling of incomplete addresses
  const formatAddress = useCallback((address: string) => {
    if (!address || address.trim() === '') return 'Address not available'
    
    // Split by newlines first, then by commas for better parsing
    let lines = address.split('\n').map(line => line.trim()).filter(Boolean)
    
    // If no newlines, try splitting by commas
    if (lines.length === 1) {
      lines = address.split(',').map(line => line.trim()).filter(Boolean)
    }
    
    const addressParts = []
    let hasStreetAddress = false
    
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue
      
      // Skip lines that are just store numbers or brand names (but only if we have other address info)
      if (line.match(/^(Store|Site|#\d+|.*Stores?$)/i) && addressParts.length > 0) {
        continue
      }
      
      // Skip pure zip codes if we have other parts
      if (line.match(/^\d{5}(-\d{4})?$/) && addressParts.length > 0) {
        continue
      }
      
      // Check if this looks like a street address
      if (line.match(/\d+.*\w+/) && 
          (line.match(/\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy|Circle|Cir|Court|Ct|Plaza|Place|Pl)\b/i) ||
           line.match(/\d+\s+\w+/))) {
        hasStreetAddress = true
      }
      
      addressParts.push(line)
    }
    
    // If we have multiple parts, join with commas
    if (addressParts.length > 1) {
      return addressParts.join(', ')
    }
    
    // Single part - just return it cleaned up
    return address.replace(/\n\s*/g, ', ').replace(/\s{2,}/g, ' ').trim()
  }, [])

  // Extract unique brands for filter
  const availableBrands = useMemo(() => {
    const brands = workOrders.map(wo => getBrand(wo.site_name))
    return Array.from(new Set(brands)).sort()
  }, [workOrders, getBrand])

  // Handle opening visit URL with proper format
  const handleOpenVisit = useCallback(async (workOrder: EnhancedWorkOrder) => {
    try {
      // Priority 1: Use the scraped visit URL if available
      if (workOrder.visit_url) {
        window.open(workOrder.visit_url, '_blank')
        return
      }
      
      // Priority 2: Use scraped data visit URL if available
      if (workOrder.scraped_data?.visit_info?.url) {
        window.open(workOrder.scraped_data.visit_info.url, '_blank')
        return
      }
      
      // Priority 3: Construct URL if we have the work order ID and visit ID
      if (workOrder.id && workOrder.visit_id) {
        // Extract numeric ID from work order ID (remove W- prefix if present)
        const workOrderId = workOrder.id.replace(/^W-/, '')
        const visitUrl = `https://app.workfossa.com/app/work/${workOrderId}/visits/${workOrder.visit_id}/`
        window.open(visitUrl, '_blank')
        return
      }
      
      // Priority 4: Fallback to API call
      const result = await openWorkOrderVisit(workOrder.id, currentUserId)
      if (result.visit_url) {
        window.open(result.visit_url, '_blank')
      }
    } catch (error) {
      console.error('Failed to open visit URL:', error)
    }
  }, [currentUserId])

  // Filter work orders using debounced search term
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const searchText = debouncedSearchTerm.toLowerCase()
      const cleanedSiteName = cleanSiteName(wo.site_name)
      const matchesSearch = 
        !searchText || // Show all if no search term
        cleanedSiteName.toLowerCase().includes(searchText) ||
        wo.external_id.toLowerCase().includes(searchText) ||
        wo.address.toLowerCase().includes(searchText) ||
        (wo.store_number && wo.store_number.toLowerCase().includes(searchText)) ||
        (wo.service_code && wo.service_code.toLowerCase().includes(searchText)) ||
        (wo.service_description && wo.service_description.toLowerCase().includes(searchText))
      
      const matchesBrand = brandFilter === 'all' || getBrand(wo.site_name) === brandFilter

      return matchesSearch && matchesBrand
    })
  }, [workOrders, debouncedSearchTerm, brandFilter])

  // Memoize work orders with dispensers count
  const workOrdersWithDispensersCount = useMemo(() => {
    return workOrders.filter(wo => wo.dispensers && wo.dispensers.length > 0).length
  }, [workOrders])

  // Memoize work orders without dispensers count
  const workOrdersWithoutDispensersCount = useMemo(() => {
    return workOrders.filter(wo => !wo.dispensers || wo.dispensers.length === 0).length
  }, [workOrders])

  // Use Weekend Mode hook
  const {
    isWeekendMode,
    weekendModeEnabled,
    setWeekendModeEnabled,
    setWeekendModeDismissed
  } = useWeekendMode({
    workDays,
    filteredWorkOrders,
    showAllJobs
  })

  // Filter work orders by selected week (or show all if toggle is on)
  const weekFilteredWorkOrders = useMemo(() => {
    if (showAllJobs) {
      return filteredWorkOrders
    }
    
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 })
    
    return filteredWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false
      const date = new Date(wo.scheduled_date)
      return date >= weekStart && date <= weekEnd
    })
  }, [filteredWorkOrders, selectedWeek, showAllJobs])

  // Smart Week Detection - automatically select a week with actual work orders
  useEffect(() => {
    if (!hasPerformedSmartWeekDetection && workOrders.length > 0 && !isLoading) {
      console.log('🧠 Performing smart week detection...')
      
      // Find the best week to display
      const findBestWeek = () => {
        const today = new Date()
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
        const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 })
        
        // First, check if current week has work orders
        const currentWeekOrders = workOrders.filter(wo => {
          if (!wo.scheduled_date) return false
          const date = new Date(wo.scheduled_date)
          return date >= currentWeekStart && date <= currentWeekEnd
        })
        
        if (currentWeekOrders.length > 0) {
          console.log('📅 Current week has work orders, staying here')
          return today
        }
        
        // If current week is empty, find the nearest week with work orders
        const scheduledWorkOrders = workOrders.filter(wo => wo.scheduled_date)
        
        if (scheduledWorkOrders.length === 0) {
          console.log('📅 No scheduled work orders found, staying on current week')
          return today
        }
        
        // Sort work orders by date
        const sortedOrders = scheduledWorkOrders.sort((a, b) => 
          new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime()
        )
        
        // Find the closest week to today that has work orders
        let bestWeek = new Date(sortedOrders[0].scheduled_date!)
        let minDistance = Math.abs(new Date(sortedOrders[0].scheduled_date!).getTime() - today.getTime())
        
        for (const order of sortedOrders) {
          const orderDate = new Date(order.scheduled_date!)
          const distance = Math.abs(orderDate.getTime() - today.getTime())
          
          if (distance < minDistance) {
            minDistance = distance
            bestWeek = orderDate
          }
        }
        
        console.log('📅 Found best week with work orders:', format(bestWeek, 'MMM d, yyyy'))
        return bestWeek
      }
      
      const bestWeek = findBestWeek()
      setSelectedWeek(bestWeek)
      setHasPerformedSmartWeekDetection(true)
    }
  }, [workOrders, hasPerformedSmartWeekDetection, isLoading])

  // Auto-enable weekend mode
  useEffect(() => {
    if (isWeekendMode && !weekendModeEnabled) {
      setWeekendModeEnabled(true)
      // Auto-advance to next week
      setSelectedWeek(addWeeks(new Date(), 1))
    }
  }, [isWeekendMode, weekendModeEnabled, setWeekendModeEnabled, setSelectedWeek])


  // Reset weekend mode on manual navigation
  const handleWeekChange = useCallback((newWeek: Date) => {
    setSelectedWeek(newWeek)
    // Reset weekend mode if user manually navigates
    if (weekendModeEnabled) {
      setWeekendModeEnabled(false)
      setWeekendModeDismissed(true)
    }
  }, [weekendModeEnabled, setWeekendModeEnabled, setWeekendModeDismissed])

  // Group work orders by week or day
  const groupedByWeek = useMemo(() => {
    if (viewMode === 'weekly') return {} // Weekly view handles its own grouping
    
    const groups: { [key: string]: EnhancedWorkOrder[] } = {}
    
    // Use weekFilteredWorkOrders for list view
    const ordersToGroup = viewMode === 'weekly' ? filteredWorkOrders : weekFilteredWorkOrders
    
    // When showing all jobs, group all work orders by their scheduled week
    if (showAllJobs) {
      // Include unscheduled orders
      filteredWorkOrders.forEach(wo => {
        if (!wo.scheduled_date) {
          if (!groups['Unscheduled']) {
            groups['Unscheduled'] = []
          }
          groups['Unscheduled'].push(wo)
        }
      })
    } else {
      // Also include unscheduled orders when viewing current week
      if (isThisWeek(selectedWeek)) {
        filteredWorkOrders.forEach(wo => {
          if (!wo.scheduled_date) {
            if (!groups['Unscheduled']) {
              groups['Unscheduled'] = []
            }
            groups['Unscheduled'].push(wo)
          }
        })
      }
    }
    
    ordersToGroup.forEach(wo => {
      if (wo.scheduled_date) {
        const date = new Date(wo.scheduled_date)
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
        const weekKey = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
        
        if (!groups[weekKey]) {
          groups[weekKey] = []
        }
        groups[weekKey].push(wo)
      }
    })
    
    // Sort work orders within each week by scheduled date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (!a.scheduled_date) return 1
        if (!b.scheduled_date) return -1
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      })
    })
    
    return groups
  }, [filteredWorkOrders, weekFilteredWorkOrders, viewMode, selectedWeek, showAllJobs])
  
  // Group work orders by day for list view
  const groupedByDay = useMemo(() => {
    if (viewMode !== 'list') return {}
    
    const groups: { [key: string]: EnhancedWorkOrder[] } = {}
    
    const ordersToGroup = showAllJobs ? filteredWorkOrders : weekFilteredWorkOrders
    
    // Group by day
    ordersToGroup.forEach(wo => {
      if (!wo.scheduled_date) {
        const key = 'Unscheduled'
        if (!groups[key]) groups[key] = []
        groups[key].push(wo)
      } else {
        const date = new Date(wo.scheduled_date)
        const dayName = format(date, 'EEEE')
        const dateStr = format(date, 'MMMM d, yyyy')
        const key = `${dayName} - ${dateStr}`
        if (!groups[key]) groups[key] = []
        groups[key].push(wo)
      }
    })
    
    // Sort work orders within each day
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (!a.scheduled_date) return 1
        if (!b.scheduled_date) return -1
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      })
    })
    
    return groups
  }, [filteredWorkOrders, weekFilteredWorkOrders, viewMode, showAllJobs])

  const handleScrape = useCallback(() => {
    if (isAnyScraping) {
      alert('Another scraping operation is in progress. Please wait for it to complete.')
      return
    }
    console.log('Starting work order scrape for user:', currentUserId)
    scrapeMutation.mutate()
  }, [isAnyScraping, currentUserId, scrapeMutation])

  const handleDispenserScrape = useCallback(() => {
    if (isAnyScraping) {
      alert('Another scraping operation is in progress. Please wait for it to complete.')
      return
    }
    console.log('Starting batch dispenser scrape for user:', currentUserId, 'Force refresh:', forceRefreshDispensers)
    dispenserScrapeMutation.mutate(forceRefreshDispensers)
  }, [isAnyScraping, currentUserId, forceRefreshDispensers, dispenserScrapeMutation])

  const handleStatusUpdate = useCallback((workOrderId: string, status: string) => {
    statusUpdateMutation.mutate({ workOrderId, status })
  }, [statusUpdateMutation])

  // Handle work order selection
  const toggleWorkOrderSelection = useCallback((workOrderId: string) => {
    setSelectedWorkOrders(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(workOrderId)) {
        newSelection.delete(workOrderId)
      } else {
        newSelection.add(workOrderId)
      }
      return newSelection
    })
  }, [])

  const selectAllWorkOrders = useCallback(() => {
    const allIds = new Set(filteredWorkOrders.map(wo => wo.id))
    setSelectedWorkOrders(allIds)
  }, [filteredWorkOrders])

  const deselectAllWorkOrders = useCallback(() => {
    setSelectedWorkOrders(new Set())
  }, [])


  // Handle batch operations
  const handleBatchDispenserScrape = useCallback(async () => {
    if (selectedWorkOrders.size === 0) return
    
    // Prevent concurrent scraping
    if (isAnyScraping) {
      alert('Another scraping operation is in progress. Please wait for it to complete.')
      return
    }

    const selectedIds = Array.from(selectedWorkOrders)
    console.log(`Starting selective dispenser scrape for ${selectedIds.length} work orders:`, selectedIds)
    
    // Clear selections after starting
    deselectAllWorkOrders()
    
    try {
      // Use mutation with selected work order IDs
      const result = await triggerBatchDispenserScrape(currentUserId, selectedIds, forceRefreshDispensers)
      
      if (result.status === 'no_work_orders' || result.status === 'all_skipped') {
        setDispenserScrapeStatus('error')
        setDispenserScrapeMessage(result.message)
        setIsPollingDispenserProgress(false)
        
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      } else {
        // Set up polling for progress
        setDispenserScrapeStatus('scraping')
        setDispenserScrapeMessage(`Initializing batch dispenser scraping for ${selectedIds.length} work orders...`)
        // Set initial progress immediately to show UI feedback
        setDispenserScrapingProgress({
          status: 'in_progress',
          percentage: 0,
          current_phase: 'Initializing',
          message: `Starting batch dispenser scraping for ${selectedIds.length} selected work orders...`,
          total_work_orders: selectedIds.length,
          processed_work_orders: 0,
          successful_work_orders: 0,
          failed_work_orders: 0,
          current_work_order: null
        })
        setIsPollingDispenserProgress(true)
        
        // Store scraping state in localStorage
        localStorage.setItem(`disp_scraping_${currentUserId}`, JSON.stringify({
          status: 'scraping',
          startedAt: new Date().toISOString(),
          selectedCount: selectedIds.length
        }))
      }
      
    } catch (error: any) {
      console.error('Batch dispenser scrape failed:', error)
      setDispenserScrapeStatus('error')
      setDispenserScrapeMessage(error.response?.data?.detail || 'Failed to initiate batch dispenser scraping')
      setIsPollingDispenserProgress(false)
      
      // Clear localStorage
      localStorage.removeItem(`disp_scraping_${currentUserId}`)
      
      // Reset status after showing error
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
        setDispenserScrapeMessage('')
      }, 5000)
    }
  }, [selectedWorkOrders, isAnyScraping, currentUserId, forceRefreshDispensers, deselectAllWorkOrders])

  // Handler for scraping dispensers for a specific work order
  const handleScrapeDispensers = useCallback(async (workOrder: EnhancedWorkOrder, event?: React.MouseEvent) => {
    // Prevent any default behavior
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    try {
      console.log(`Scraping dispensers for work order ${workOrder.external_id}`)
      
      // Set scraping status
      setDispenserScrapeStatus('scraping')
      setDispenserScrapeMessage(`Starting dispenser scrape for ${workOrder.external_id}...`)
      setActiveScrapeWorkOrderId(workOrder.id)
      setSingleDispenserProgress({
        status: 'in_progress',
        phase: 'initializing',
        percentage: 0,
        message: 'Starting dispenser scrape...',
        work_order_id: workOrder.id
      })
      
      // Start the scraping
      const result = await scrapeDispensersForWorkOrder(workOrder.id, currentUserId, forceRefreshDispensers)
      
      if (result.status === 'scraping_started') {
        // The polling hook will automatically handle progress updates
        console.log('Dispenser scraping started, polling will handle progress')
      } else if (result.status === 'skipped') {
        // Work order already has dispensers and force refresh is false
        setDispenserScrapeMessage(result.message || `${workOrder.external_id} already has dispensers`)
        setDispenserScrapeStatus('success')
        setSingleDispenserProgress(null)
        setActiveScrapeWorkOrderId(null)
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 3000)
      } else {
        // Other error cases
        setDispenserScrapeMessage(result.message || 'Failed to start dispenser scraping')
        setDispenserScrapeStatus('error')
        setSingleDispenserProgress(null)
        setActiveScrapeWorkOrderId(null)
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      }
    } catch (error: any) {
      console.error('Error scraping dispensers:', error)
      setDispenserScrapeMessage(error.response?.data?.detail || error.message || 'Failed to scrape dispensers')
      setDispenserScrapeStatus('error')
      setSingleDispenserProgress(null)
      setActiveScrapeWorkOrderId(null)
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
        setDispenserScrapeMessage('')
      }, 5000)
    }
  }, [currentUserId, forceRefreshDispensers])

  // Handler for clearing dispensers for a specific work order
  const handleClearDispensers = useCallback(async (workOrder: EnhancedWorkOrder) => {
    // Skip confirmation dialog
    
    try {
      console.log(`Clearing dispensers for work order ${workOrder.external_id}`)
      
      const result = await clearDispensersForWorkOrder(workOrder.id, currentUserId)
      
      if (result.status === 'success') {
        // Refresh work orders to show updated data
        queryClient.invalidateQueries({ queryKey: ['work-orders'] })
        
        // Show success message
        setDispenserScrapeMessage(`Successfully cleared ${result.cleared_count || 0} dispensers for ${workOrder.external_id}`)
        setDispenserScrapeStatus('success')
      } else {
        setDispenserScrapeMessage(result.message || 'Failed to clear dispensers')
        setDispenserScrapeStatus('error')
      }
    } catch (error: any) {
      console.error('Error clearing dispensers:', error)
      setDispenserScrapeMessage(error.response?.data?.detail || error.message || 'Failed to clear dispensers')
      setDispenserScrapeStatus('error')
    } finally {
      // Reset status after a delay
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
      }, 3000)
    }
  }, [currentUserId, queryClient])

  // Handler for clearing all work orders
  const handleClearAllWorkOrders = useCallback(() => {
    clearAllMutation.mutate()
  }, [clearAllMutation])

  // Handler for clearing all dispensers
  const handleClearAllDispensers = useCallback(() => {
    const workOrdersWithDispensers = workOrders.filter(wo => wo.dispensers && wo.dispensers.length > 0)
    if (workOrdersWithDispensersCount > 0 && confirm(`Clear dispensers from ${workOrdersWithDispensersCount} work orders?`)) {
      workOrdersWithDispensers.forEach(wo => {
        clearDispensersForWorkOrder(wo.id, user?.id || '')
      })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    }
  }, [workOrders, workOrdersWithDispensersCount, user?.id, queryClient])

  // Handler for clearing a single work order
  const handleClearSingleWorkOrder = useCallback((workOrderId: string) => {
    console.log('Clear single work order:', workOrderId)
    // Implement single work order clear logic if needed
  }, [])

  // Handler for view mode changes
  const handleSetListView = useCallback(() => setViewMode('list'), [])
  const handleSetWeeklyView = useCallback(() => setViewMode('weekly'), [])
  const handleToggleShowAllJobs = useCallback(() => setShowAllJobs(prev => !prev), [])

  // Handler for exiting weekend mode
  const handleExitWeekendMode = useCallback(() => {
    setWeekendModeEnabled(false)
    setWeekendModeDismissed(true)
    handleWeekChange(new Date())
  }, [handleWeekChange])

  // Callbacks for WorkOrderWeeklyView - moved outside conditional rendering
  const handleWorkOrderClick = useCallback((workOrder: EnhancedWorkOrder) => {
    console.log('Work order clicked:', workOrder)
    // You can add additional click handling here if needed
  }, [])

  const handleViewDispensers = useCallback((workOrder: EnhancedWorkOrder) => {
    console.log('Opening dispenser modal for work order:', workOrder)
    setSelectedWorkOrderForModal(workOrder)
    setShowDispenserModal(true)
  }, [])

  // Calculate group statistics for all groups at once to avoid hooks in loops
  const groupStats = useMemo(() => {
    const stats: Record<string, { totalDispensers: number; hasDispensers: boolean }> = {}
    const groups = viewMode === 'list' ? groupedByDay : groupedByWeek
    
    Object.entries(groups).forEach(([groupLabel, groupOrders]) => {
      stats[groupLabel] = {
        totalDispensers: groupOrders.reduce((sum, wo) => sum + (wo.dispensers?.length || 0), 0),
        hasDispensers: groupOrders.some(wo => wo.dispensers && wo.dispensers.length > 0)
      }
    })
    
    return stats
  }, [viewMode, groupedByDay, groupedByWeek])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AnimatedCard animate="bounce" hover="glow" className="max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4 animate-pulse" />
            <CardTitle className="text-2xl">
              <AnimatedText text="Connection Error" animationType="reveal" />
            </CardTitle>
            <CardDescription>
              <AnimatedText text="Unable to connect to the server. Please check that the backend is running and try again." animationType="fade" delay={0.2} />
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <RippleButton onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </RippleButton>
            <div className="text-xs text-muted-foreground">
              If the issue persists, ensure your backend server is running on the correct port.
            </div>
          </CardContent>
        </AnimatedCard>
      </div>
    )
  }

  // Show loading state only on initial load, not during refetches
  if (isLoading && !rawWorkOrders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AnimatedCard animate="bounce" hover="glow">
          <CardContent className="p-8 text-center">
            <DotsLoader size="lg" className="mx-auto mb-4" />
            <p className="text-muted-foreground">Loading work orders...</p>
          </CardContent>
        </AnimatedCard>
      </div>
    )
  }

  return (
    <WorkOrdersErrorBoundary>
      <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 lg:space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-slide-in-from-top">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
              <GradientText text="Work Orders" gradient="from-blue-600 via-purple-600 to-pink-600" />
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg mb-2">
              <AnimatedText text="Manage and monitor fuel dispenser automation tasks" animationType="split" delay={0.2} />
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground animate-fade-in" style={{animationDelay: '0.4s'}}>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold text-base text-foreground">{viewMode === 'weekly' ? filteredWorkOrders.length : weekFilteredWorkOrders.length}</span>
                <span className="text-muted-foreground/60">of</span>
                <span className="font-semibold text-base text-foreground">{workOrders.length}</span>
                <span className="text-muted-foreground">work orders</span>
                {viewMode !== 'weekly' && !showAllJobs && (
                  <span className="text-muted-foreground/70 ml-1">
                    in {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')}
                  </span>
                )}
                {showAllJobs && viewMode !== 'weekly' && (
                  <span className="text-muted-foreground/70 ml-1">
                    (all weeks)
                  </span>
                )}
              </span>
              {workOrders.length > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {brandFilter === 'all' 
                    ? `${availableBrands.length} Brands`
                    : brandFilter
                  }
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap justify-start lg:justify-end">
            <DropdownMenu open={clearDataOpen} onOpenChange={setClearDataOpen}>
              <DropdownMenuTrigger asChild>
                <AnimatedButton
                  disabled={clearAllMutation.isPending || workOrders.length === 0}
                  size="default"
                  variant="destructive"
                  animation="pulse"
                  className="w-full sm:w-auto min-w-[140px]"
                >
                  <Database className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Clear Data</span>
                  <span className="sm:hidden">Clear</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </AnimatedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 z-50">
                <DropdownMenuLabel className="text-base font-semibold">Clear Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleClearAllWorkOrders}
                  disabled={clearAllMutation.isPending || workOrders.length === 0}
                  className="text-destructive focus:text-destructive py-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <Trash2 className="w-4 h-4 mr-3" />
                      <span className="font-medium">Clear Work Orders</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {workOrders.length} items
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleClearAllDispensers}
                  disabled={workOrdersWithDispensersCount === 0}
                  className="text-destructive focus:text-destructive py-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <Fuel className="w-4 h-4 mr-3" />
                      <span className="font-medium">Clear All Dispensers</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {workOrdersWithDispensersCount} orders
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={scrapeDataOpen} onOpenChange={setScrapeDataOpen}>
              <DropdownMenuTrigger asChild>
                <AnimatedButton
                  disabled={isAnyScraping}
                  size="default"
                  variant="default"
                  animation="shimmer"
                  className="w-full sm:w-auto min-w-[140px] sm:min-w-[180px]"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isAnyScraping ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isAnyScraping ? 'Scraping...' : 'Scrape Data'}</span>
                  <span className="sm:hidden">{isAnyScraping ? 'Scraping' : 'Scrape'}</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </AnimatedButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 z-50">
                <DropdownMenuLabel className="text-base font-semibold">Scraping Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleScrape}
                  disabled={scrapeMutation.isPending || scrapeStatus === 'scraping' || isAnyScraping}
                  className="py-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <RefreshCw className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="font-medium">Scrape Work Orders</div>
                        <div className="text-xs text-muted-foreground">Update work order list from WorkFossa</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {workOrders.length}
                    </Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDispenserScrape}
                  disabled={dispenserScrapeMutation.isPending || dispenserScrapeStatus === 'scraping' || isAnyScraping}
                  className="py-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <Fuel className="w-4 h-4 mr-3 text-orange-600 dark:text-orange-400" />
                      <div>
                        <div className="font-medium">Scrape All Dispensers</div>
                        <div className="text-xs text-muted-foreground">Get dispenser data for all orders</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {forceRefreshDispensers 
                        ? workOrders.length 
                        : workOrdersWithoutDispensersCount}
                    </Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault() // Prevent dropdown from closing
                  }}
                  className="py-2"
                >
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setForceRefreshDispensers(!forceRefreshDispensers)
                      }}
                      className="flex items-center gap-2 text-sm w-full"
                    >
                      {forceRefreshDispensers ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>Force refresh existing dispensers</span>
                    </button>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Batch Actions - hide in weekly view */}
            {selectedWorkOrders.size > 0 && viewMode !== 'weekly' && (
              <>
                <div className="hidden sm:block h-10 w-px bg-border/50" />
                <AnimatedButton
                  onClick={handleBatchDispenserScrape}
                  disabled={selectedWorkOrders.size === 0 || isAnyScraping}
                  size="default"
                  variant="outline"
                  animation="scale"
                  className="w-full sm:w-auto min-w-[140px] sm:min-w-[200px] border-orange-500/50 hover:border-orange-500"
                >
                  <Fuel className="w-4 h-4 mr-2 text-orange-500" />
                  <span className="hidden sm:inline">Scrape Selected ({selectedWorkOrders.size})</span>
                  <span className="sm:hidden">Scrape ({selectedWorkOrders.size})</span>
                </AnimatedButton>
                <AnimatedButton
                  onClick={deselectAllWorkOrders}
                  size="default"
                  variant="ghost"
                  animation="fade"
                  className="w-full sm:w-auto"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Clear Selection</span>
                  <span className="sm:hidden">Clear</span>
                </AnimatedButton>
              </>
            )}
          </div>
        </div>

        {/* Hourly Scraping Status */}
        <div className="animate-slide-in-from-top" style={{animationDelay: '0.2s'}}>
          <ScrapingStatus compact={false} showDetails={true} />
        </div>

        {/* Weekend Mode Banner - Enhanced Design */}
        {weekendModeEnabled && (
          <div className="animate-slide-in-from-top" style={{animationDelay: '0.3s'}}>
            <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 via-blue-500/10 to-indigo-500/5 backdrop-blur-sm shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Icon and Text Section */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-lg"></div>
                      <div className="relative p-2.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm border border-blue-500/30">
                        <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                        <h3 className="font-semibold text-blue-700 dark:text-blue-300 text-base">
                          Weekend Mode Active
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Previewing next week's work • 
                        <span className="font-medium ml-1">
                          {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Button Section */}
                  <Button
                    onClick={handleExitWeekendMode}
                    size="sm"
                    variant="ghost"
                    className="w-full md:w-auto border border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10 transition-all duration-200"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View Current Week
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scraping Status Display */}
        {scrapeStatus !== 'idle' && (
          <div className="animate-slide-in-from-top">
            {scrapeStatus === 'scraping' && (
              <GlowCard 
                glowColor="rgba(59, 130, 246, 0.3)" 
                className="w-full border-blue-500/20 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
                      <div className="relative p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full shadow-lg">
                        <RefreshCw className="w-6 h-6 text-white animate-spin" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Scraping Work Orders
                      </CardTitle>
                      <CardDescription className="text-sm">
                        <AnimatedText 
                          text={scrapingProgress?.message || scrapeMessage}
                          animationType="fade"
                          className="text-muted-foreground"
                        />
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {scrapingProgress && (
                    <>
                      {/* Sleek Progress Section */}
                      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-100/50 to-indigo-100/50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 animate-pulse"></div>
                        
                        <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
                          {/* Circular Progress */}
                          <div className="flex justify-center">
                            <div className="relative w-24 h-24">
                              <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="42"
                                  stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                  className="text-blue-200/30 dark:text-blue-800/30"
                                />
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="42"
                                  stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 42}`}
                                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - (Number(scrapingProgress.percentage || 0) / 100))}`}
                                  className="text-blue-600 dark:text-blue-400 transition-all duration-500 ease-out"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <GradientText 
                                  text={`${Math.round(Number(scrapingProgress.percentage || 0))}%`}
                                  gradient="from-blue-600 to-indigo-600"
                                  className="text-2xl font-black"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Info */}
                          <div className="space-y-3 text-center md:text-left">
                            <div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Phase</div>
                              <div className="font-semibold text-sm capitalize">
                                {scrapingProgress.phase || 'Initializing'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</div>
                              <Badge variant="secondary" className="text-xs">
                                {scrapingProgress.message || 'Processing...'}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Results Card */}
                          <div className="flex justify-center">
                            {scrapingProgress.work_orders_found > 0 ? (
                              <AnimatedCard 
                                hover="scale" 
                                animate="bounce" 
                                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 p-4 text-center min-w-[120px]"
                              >
                                <GradientText 
                                  text={String(scrapingProgress.work_orders_found)}
                                  gradient="from-green-600 to-emerald-600"
                                  className="text-3xl font-black block mb-1"
                                />
                                <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
                                  Found
                                </div>
                              </AnimatedCard>
                            ) : (
                              <div className="text-center text-muted-foreground">
                                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                                <div className="text-xs">Searching...</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </GlowCard>
            )}
            
            {scrapeStatus === 'success' && (
              <AnimatedCard animate="slide" hover="glow" className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle className="h-5 w-5 text-green-600 animate-scale-in flex-shrink-0" />
                  <AnimatedText 
                    text={scrapeMessage}
                    animationType="fade"
                    className="font-medium text-green-700 dark:text-green-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
            
            {scrapeStatus === 'error' && (
              <AnimatedCard animate="slide" hover="border" className="border-red-500 bg-red-50 dark:bg-red-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <XCircle className="h-5 w-5 animate-shake flex-shrink-0" />
                  <AnimatedText 
                    text={scrapeMessage}
                    animationType="fade"
                    className="font-medium text-red-700 dark:text-red-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* Batch Dispenser Scraping Status Display */}
        {dispenserScrapeStatus !== 'idle' && !singleDispenserProgress && (
          <div className="animate-slide-in-from-top">
            {dispenserScrapeStatus === 'scraping' && dispenserScrapingProgress && (
              <GlowCard 
                glowColor="rgba(251, 146, 60, 0.3)" 
                className="w-full border-orange-500/20 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
                      <div className="relative p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-lg">
                        <Fuel className="w-6 h-6 text-white animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-0.5 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        Scraping Dispenser Data
                      </CardTitle>
                      <CardDescription className="text-sm">
                        <AnimatedText 
                          text={dispenserScrapingProgress?.message || dispenserScrapeMessage}
                          animationType="fade"
                          className="text-muted-foreground"
                        />
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-2">
                  {dispenserScrapingProgress && (
                    <div className="space-y-4">
                      {/* Sleek Progress Section */}
                      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-100/50 to-amber-100/50 dark:from-orange-900/20 dark:to-amber-900/20 p-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5 animate-pulse"></div>
                        
                        <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
                          {/* Circular Progress */}
                          <div className="flex justify-center">
                            <div className="relative w-24 h-24">
                              <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="40"
                                  stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                  className="text-gray-200 dark:text-gray-700"
                                />
                                <circle
                                  cx="48"
                                  cy="48"
                                  r="40"
                                  stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 40}`}
                                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - (Number(dispenserScrapingProgress.percentage || 0) / 100))}`}
                                  className="text-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                                  style={{
                                    stroke: 'url(#gradient)',
                                  }}
                                />
                                <defs>
                                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f97316" />
                                    <stop offset="100%" stopColor="#f59e0b" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                  {Math.round(Number(dispenserScrapingProgress.percentage || 0))}%
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Progress Details */}
                          <div className="text-center space-y-2">
                            <div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {dispenserScrapingProgress.processed || 0} / {dispenserScrapingProgress.total_work_orders || 0}
                              </div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                Work Orders Processed
                              </div>
                            </div>
                            <Progress 
                              value={Number(dispenserScrapingProgress.percentage || 0)} 
                              className="h-2 bg-gray-200 dark:bg-gray-700"
                            />
                          </div>
                          
                          {/* Status Summary */}
                          <div className="flex justify-center">
                            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">
                                    {dispenserScrapingProgress.successful || 0}
                                  </div>
                                  <div className="text-xs text-green-600/80 font-medium">
                                    Success
                                  </div>
                                </div>
                                {dispenserScrapingProgress.failed > 0 && (
                                  <>
                                    <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-red-600">
                                        {dispenserScrapingProgress.failed || 0}
                                      </div>
                                      <div className="text-xs text-red-600/80 font-medium">
                                        Failed
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </GlowCard>
            )}
            
            {dispenserScrapeStatus === 'success' && !activeScrapeWorkOrderId && (
              <AnimatedCard animate="slide" hover="glow" className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle className="h-5 w-5 text-green-600 animate-scale-in flex-shrink-0" />
                  <AnimatedText 
                    text={dispenserScrapeMessage}
                    animationType="fade"
                    className="font-medium text-green-700 dark:text-green-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
            
            {dispenserScrapeStatus === 'error' && !activeScrapeWorkOrderId && (
              <AnimatedCard animate="slide" hover="border" className="border-red-500 bg-red-50 dark:bg-red-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <XCircle className="h-5 w-5 animate-shake flex-shrink-0" />
                  <AnimatedText 
                    text={dispenserScrapeMessage}
                    animationType="fade"
                    className="font-medium text-red-700 dark:text-red-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* Single Dispenser Scraping Display */}
        {(singleDispenserProgress || (activeScrapeWorkOrderId && dispenserScrapeStatus !== 'idle')) && (
          <div className="animate-slide-in-from-top">
            {/* Progress Card - Show only when in progress */}
            {singleDispenserProgress && singleDispenserProgress.status === 'in_progress' && (
            <GlowCard 
              glowColor="rgba(251, 146, 60, 0.3)" 
              className="w-full border-orange-500/20 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-lg">
                      <Fuel className="w-6 h-6 text-white animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-0.5 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      Scraping Dispenser Data
                    </CardTitle>
                    <CardDescription className="text-sm">
                      <AnimatedText 
                        text={singleDispenserProgress.message || 'Processing...'}
                        animationType="fade"
                        className="text-muted-foreground"
                      />
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-2">
                <div className="space-y-4">
                  {/* Sleek Progress Section */}
                  <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-100/50 to-amber-100/50 dark:from-orange-900/20 dark:to-amber-900/20 p-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5 animate-pulse"></div>
                    
                    <div className="relative flex items-center justify-between gap-4">
                      {/* Progress Bar */}
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground capitalize">{singleDispenserProgress.phase}</span>
                          <span className="font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                            {Math.round(Number(singleDispenserProgress.percentage || 0))}%
                          </span>
                        </div>
                        <Progress 
                          value={Number(singleDispenserProgress.percentage || 0)} 
                          className="h-3 bg-gray-200 dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </GlowCard>
            )}
            
            {/* Success Message - Show when completed */}
            {dispenserScrapeStatus === 'success' && activeScrapeWorkOrderId && (
              <AnimatedCard animate="slide" hover="glow" className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle className="h-5 w-5 text-green-600 animate-scale-in flex-shrink-0" />
                  <AnimatedText 
                    text={dispenserScrapeMessage}
                    animationType="fade"
                    className="font-medium text-green-700 dark:text-green-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
            
            {/* Error Message - Show when failed */}
            {dispenserScrapeStatus === 'error' && activeScrapeWorkOrderId && (
              <AnimatedCard animate="slide" hover="border" className="border-red-500 bg-red-50 dark:bg-red-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <XCircle className="h-5 w-5 animate-shake flex-shrink-0" />
                  <AnimatedText 
                    text={dispenserScrapeMessage}
                    animationType="fade"
                    className="font-medium text-red-700 dark:text-red-300"
                  />
                </CardContent>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* Enhanced Filters */}
        <GlowCard glowColor="rgba(59, 130, 246, 0.2)" className="animate-slide-in-from-left overflow-visible" style={{animationDelay: '0.2s'}}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <ShimmerText text="Filters & Search" />
            </CardTitle>
            <CardDescription>Filter and search work orders by various criteria</CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <div className="space-y-4 overflow-visible">
              {/* Selection controls - hide in weekly view */}
              {filteredWorkOrders.length > 0 && viewMode !== 'weekly' && (
                <div className="flex items-center gap-4 pb-2 border-b border-border/50">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      if (selectedWorkOrders.size === filteredWorkOrders.length) {
                        deselectAllWorkOrders()
                      } else {
                        selectAllWorkOrders()
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1 -mx-3 -my-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded hover:bg-accent/50"
                  >
                    {selectedWorkOrders.size === filteredWorkOrders.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 hover:text-primary/70" />
                    )}
                    Select All ({filteredWorkOrders.length})
                  </button>
                  
                  {selectedWorkOrders.size > 0 && selectedWorkOrders.size < filteredWorkOrders.length && (
                    <span className="text-sm text-muted-foreground">
                      {selectedWorkOrders.size} selected
                    </span>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 overflow-visible">
                {/* Search bar */}
                <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search work orders..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      debouncedSearch(e.target.value)
                    }}
                    className="pl-10 input-modern w-full"
                  />
                </div>

                {/* Week Navigation - Show for all views */}
                <div className="relative md:col-span-2 lg:col-span-1" ref={calendarRef}>
                    <div className="flex items-center bg-background border border-input rounded-md h-10">
                      <RippleButton
                        onClick={() => handleWeekChange(subWeeks(selectedWeek, 1))}
                        size="sm"
                        variant="ghost"
                        className="h-full w-10 rounded-l-md rounded-r-none flex-shrink-0"
                        disabled={showAllJobs && viewMode !== 'weekly'}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </RippleButton>
                      
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className={cn(
                          "flex items-center gap-2 px-3 h-full hover:bg-accent/50 transition-colors flex-1 min-w-0",
                          showAllJobs && viewMode !== 'weekly' && "opacity-50 cursor-not-allowed hover:bg-transparent"
                        )}
                        disabled={showAllJobs && viewMode !== 'weekly'}
                      >
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {showAllJobs && viewMode !== 'weekly' 
                            ? 'All Weeks' 
                            : weekendModeEnabled 
                            ? `Next Week: ${format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')}`
                            : `${format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM d')}`
                          }
                        </span>
                      </button>
                      
                      <RippleButton
                        onClick={() => handleWeekChange(addWeeks(selectedWeek, 1))}
                        size="sm"
                        variant="ghost"
                        className="h-full w-10 flex-shrink-0"
                        disabled={showAllJobs && viewMode !== 'weekly'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </RippleButton>
                      
                      {!isThisWeek(selectedWeek) && !showAllJobs && (
                        <RippleButton
                          onClick={() => setSelectedWeek(new Date())}
                          size="sm"
                          variant="ghost"
                          className="h-full px-3 rounded-l-none rounded-r-md border-l flex-shrink-0"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">Today</span>
                        </RippleButton>
                      )}
                    </div>
                  </div>

                {/* Calendar Dropdown Portal */}
                {showCalendar && calendarRef.current && createPortal(
                  <div 
                    className="fixed bg-background border border-border rounded-lg shadow-xl p-4 z-[9999] w-[400px] calendar-dropdown"
                    style={{
                      top: calendarRef.current.getBoundingClientRect().bottom + 8,
                      left: calendarRef.current.getBoundingClientRect().left,
                      pointerEvents: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">Select a date</h3>
                        <button
                          onClick={() => setShowCalendar(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Month/Year selector */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => {
                            const newDate = subWeeks(selectedWeek, 4)
                            handleWeekChange(newDate)
                          }}
                          className="p-2 hover:bg-accent rounded transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <span className="font-medium">
                          {format(selectedWeek, 'MMMM yyyy')}
                        </span>
                        
                        <button
                          onClick={() => {
                            const newDate = addWeeks(selectedWeek, 4)
                            handleWeekChange(newDate)
                          }}
                          className="p-2 hover:bg-accent rounded transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Work orders with dates */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <p className="text-xs text-muted-foreground mb-2">Click a work order to jump to its week:</p>
                        {workOrders
                          .filter(wo => wo.scheduled_date)
                          .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
                          .map(wo => {
                            const date = new Date(wo.scheduled_date!)
                            const isInSelectedWeek = date >= startOfWeek(selectedWeek, { weekStartsOn: 1 }) && 
                                                   date <= endOfWeek(selectedWeek, { weekStartsOn: 1 })
                            
                            // Get dispenser count from various sources
                            const getDispenserCount = (): number | null => {
                              // Direct dispenser array
                              if (wo.dispensers && wo.dispensers.length > 0) {
                                return wo.dispensers.length
                              }
                              
                              // Extract from service items
                              if (wo.service_items) {
                                const items = Array.isArray(wo.service_items) 
                                  ? wo.service_items 
                                  : [wo.service_items]
                                
                                for (const item of items) {
                                  const match = item.toString().match(/(\d+)\s*x\s*(All\s*)?Dispenser/i)
                                  if (match) {
                                    return parseInt(match[1], 10)
                                  }
                                }
                              }
                              
                              return null
                            }
                            
                            const dispenserCount = getDispenserCount()
                            
                            return (
                              <button
                                key={wo.id}
                                type="button"
                                onMouseDown={(e) => {
                                  // Prevent the calendar from closing before we process the click
                                  e.preventDefault()
                                  e.stopPropagation()
                                  
                                  // Ensure we have a valid date object
                                  const orderDate = new Date(wo.scheduled_date!)
                                  // Set to the start of the week containing this date (Monday)
                                  const weekStart = startOfWeek(orderDate, { weekStartsOn: 1 })
                                  
                                  // Update the selected week
                                  handleWeekChange(weekStart)
                                  
                                  // Close calendar after state update
                                  setTimeout(() => {
                                    setShowCalendar(false)
                                  }, 50)
                                  
                                  // For weekly view, we need to ensure the week navigation happens first
                                  if (viewMode === 'weekly') {
                                    // Wait longer for weekly view to update
                                    setTimeout(() => {
                                      setHighlightedWorkOrderId(wo.id)
                                      // Weekly view doesn't need scroll as cards are visible
                                    }, 400)
                                  } else {
                                    // For grid/list views, highlight and scroll
                                    setTimeout(() => {
                                      setHighlightedWorkOrderId(wo.id)
                                      
                                      // Scroll to the highlighted work order after highlighting is set
                                      setTimeout(() => {
                                        const element = document.getElementById(`work-order-${wo.id}`)
                                        if (element) {
                                          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                        }
                                      }, 100)
                                    }, 300)
                                  }
                                  
                                  // Clear highlight after 3 seconds
                                  setTimeout(() => {
                                    setHighlightedWorkOrderId(null)
                                  }, 3500)
                                }}
                                className={cn(
                                  "w-full text-left p-3 rounded hover:bg-accent/50 transition-colors",
                                  isInSelectedWeek && "bg-accent/30",
                                  highlightedWorkOrderId === wo.id && "ring-2 ring-primary"
                                )}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-sm">{cleanSiteName(wo.site_name)}</div>
                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                      {format(date, 'EEE, MMM d')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {wo.store_number && (
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs px-2 py-0.5 ${getBrandBadgeStyle(wo.site_name)}`}
                                      >
                                        <Hash className="w-3 h-3 mr-1" />
                                        {wo.store_number.replace(/^#/, '')}
                                      </Badge>
                                    )}
                                    {wo.visit_number && (
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs px-2 py-0.5 ${getBrandBadgeStyle(wo.site_name)}`}
                                      >
                                        <Wrench className="w-3 h-3 mr-1" />
                                        Visit {wo.visit_number}
                                      </Badge>
                                    )}
                                    {dispenserCount && dispenserCount > 0 && (
                                      <Badge 
                                        variant="secondary" 
                                        className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 font-medium"
                                      >
                                        <Fuel className="w-3 h-3 mr-1" />
                                        {dispenserCount}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                      
                      <div className="pt-2 border-t">
                        <Button
                          onClick={() => {
                            setSelectedWeek(new Date())
                            setShowCalendar(false)
                          }}
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Go to Current Week
                        </Button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* Store Filter */}
                <div className="md:col-span-1">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 input-modern"
                  >
                    <option value="all">All Stores</option>
                    {availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                {/* View Mode Switcher */}
                <div className="md:col-span-1">
                  <div className="flex border border-border rounded-lg overflow-hidden glass h-10">
                    <MagneticButton
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={handleSetListView}
                      className="rounded-none flex-1 h-full"
                      strength={0.1}
                    >
                      <List className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">List</span>
                    </MagneticButton>
                    <MagneticButton
                      variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={handleSetWeeklyView}
                      className="rounded-none flex-1 h-full"
                      strength={0.1}
                    >
                      <CalendarDays className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Week</span>
                    </MagneticButton>
                  </div>
                </div>
              </div>
              
              {/* Show All Jobs Toggle */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleToggleShowAllJobs}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded hover:bg-accent/50"
                >
                    {showAllJobs ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Show all jobs
                  </button>
                  {showAllJobs && (
                    <span className="text-xs text-muted-foreground">
                      (Week separators will be shown)
                    </span>
                  )}
                </div>
            </div>
          </CardContent>
        </GlowCard>

      {/* Work Orders Display */}
      <section className="work-orders-list">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <DotsLoader />
            <AnimatedText text="Loading work orders..." animationType="fade" className="text-muted-foreground" />
          </div>
        ) : (viewMode === 'weekly' ? filteredWorkOrders.length : weekFilteredWorkOrders.length) > 0 ? (
          viewMode === 'weekly' ? (
            <WorkOrderWeeklyView 
              workOrders={filteredWorkOrders}
              workDays={workDays}
              selectedWeek={selectedWeek}
              onWeekChange={handleWeekChange}
              highlightedWorkOrderId={highlightedWorkOrderId}
              showAllJobs={showAllJobs}
              onWorkOrderClick={handleWorkOrderClick}
              onViewDispensers={handleViewDispensers}
              onOpenVisit={handleOpenVisit}
            />
          ) : (
          <div className="space-y-8">
            {Object.entries(viewMode === 'list' ? groupedByDay : groupedByWeek).map(([groupLabel, groupOrders]) => {
              // Get pre-calculated group statistics
              const currentGroupStats = groupStats[groupLabel] || { totalDispensers: 0, hasDispensers: false }
              
              return (
              <div key={groupLabel} className="space-y-4">
                {/* Enhanced Group Header */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
                  <div className="relative flex items-center gap-4 p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">
                        {groupLabel === 'Unscheduled' ? (
                          <span className="text-muted-foreground">Unscheduled Orders</span>
                        ) : (
                          groupLabel
                        )}
                      </h3>
                      {viewMode !== 'list' && groupLabel !== 'Unscheduled' && (
                        <p className="text-sm text-muted-foreground">
                          {groupOrders.filter(wo => wo.scheduled_date).length > 0 && 
                            `${format(new Date(groupOrders[0].scheduled_date!), 'EEEE')} - ${format(new Date(groupOrders[groupOrders.length - 1].scheduled_date!), 'EEEE')}`
                          }
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Job Count Badge - Enhanced Styling */}
                      <Badge 
                        variant="secondary" 
                        className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 font-medium shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <Wrench className="w-3.5 h-3.5 mr-2 text-slate-600 dark:text-slate-400" />
                        <span className="font-semibold text-sm">
                          {groupOrders.length}
                        </span>
                        <span className="ml-1 text-xs">
                          {groupOrders.length === 1 ? 'job' : 'jobs'}
                        </span>
                      </Badge>
                      
                      {/* Dispensers Count Badge - Enhanced Styling */}
                      {currentGroupStats.hasDispensers && (
                        <Badge 
                          variant="outline" 
                          className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-3 py-1.5 font-medium shadow-sm hover:shadow-md hover:from-blue-100 hover:to-blue-150 dark:hover:from-blue-900/50 dark:hover:to-blue-800/60 transition-all duration-200"
                        >
                          <Fuel className="w-3.5 h-3.5 mr-2 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-sm">
                            {currentGroupStats.totalDispensers}
                          </span>
                          <span className="ml-1 text-xs">
                            dispensers
                          </span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Work Orders for this group */}
                <div className={viewMode === 'list' ? "relative" : "space-y-4"}>
                  {groupOrders.map((workOrder, index) => (
              <div key={workOrder.id} id={`work-order-${workOrder.id}`} className={cn(
                "relative",
                viewMode === 'list' ? "ml-8" : "",
                viewMode === 'list' && index < groupOrders.length - 1 && "mb-6"
              )}>
                {/* Same Day badge centered on the line in the gap */}
                {viewMode === 'list' && groupOrders.length > 1 && index === 0 && (
                  <div className="absolute -left-8 -bottom-3 translate-y-1/2 z-20 flex">
                    <div className="relative left-[1px] -translate-x-1/2">
                      <div className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        Same Day
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Connection bracket for list view */}
                {viewMode === 'list' && groupOrders.length > 1 && (
                  <>
                    <div className="absolute -left-8 top-0 bottom-0 w-8 flex items-center">
                      {/* Top curve for first item */}
                      {index === 0 && (
                        <div className="absolute left-0 top-1/2 w-full h-1/2 border-l-2 border-t-2 border-primary/40 rounded-tl-xl" />
                      )}
                      {/* Middle connection */}
                      {index > 0 && index < groupOrders.length - 1 && (
                        <div className="absolute left-0 top-0 w-full h-full border-l-2 border-primary/40" />
                      )}
                      {/* Bottom curve for last item */}
                      {index === groupOrders.length - 1 && (
                        <div className="absolute left-0 top-0 w-full h-1/2 border-l-2 border-b-2 border-primary/40 rounded-bl-xl" />
                      )}
                      {/* Horizontal connector line */}
                      <div className="absolute left-0 top-1/2 w-full h-0.5 bg-primary/40" />
                      {/* Connection dot */}
                      <div className="absolute right-0 top-1/2 w-2 h-2 bg-primary rounded-full -translate-y-1/2 translate-x-1/2" />
                    </div>
                    
                  </>
                )}
                
                {/* Selection Checkbox - Outside the card */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    console.log('Checkbox clicked for:', workOrder.id)
                    toggleWorkOrderSelection(workOrder.id)
                  }}
                  className="absolute top-4 left-4 z-30 flex items-center justify-center w-8 h-8 bg-background border-2 border-border rounded hover:border-primary hover:bg-accent transition-colors cursor-pointer shadow-sm"
                  aria-label={`Select ${workOrder.site_name}`}
                  aria-checked={selectedWorkOrders.has(workOrder.id)}
                >
                  {selectedWorkOrders.has(workOrder.id) ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                
                <AnimatedCard 
                  className={cn(
                    getBrandStyling(workOrder.site_name),
                    "card-hover glass-dark transition-all duration-300 h-full flex flex-col",
                    highlightedWorkOrderId === workOrder.id && "ring-4 ring-primary ring-opacity-60 shadow-lg shadow-primary/20 scale-[1.02]",
                    viewMode === 'list' && groupOrders.length > 1 && "border-l-4 border-l-primary/50",
                    weekendModeEnabled && "opacity-90 border-blue-500/30 bg-blue-500/5"
                  )}
                  hover="lift"
                  animate="slide"
                  delay={index * 0.1}
                >
                  <CardHeader className="pb-3 px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                      <div className="flex items-start gap-3 pl-8 sm:pl-10 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          {viewMode === 'list' && groupOrders.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                <CalendarDays className="w-3 h-3 mr-1" />
                                {index + 1} of {groupOrders.length} on this day
                              </Badge>
                            </div>
                          )}
                          <CardTitle className="text-lg font-semibold leading-tight break-words mb-2">
                            <AnimatedText 
                              text={getCleanStoreName(workOrder.site_name)} 
                              animationType="fade"
                            />
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            {weekendModeEnabled && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Future Work
                              </Badge>
                            )}
                            {(workOrder.visit_number || workOrder.visit_id || workOrder.scraped_data?.visit_info?.visit_id) && (
                              <Badge variant="default" className="text-xs px-2 py-0.5 bg-blue-600 text-white dark:bg-blue-500">
                                Visit #{workOrder.visit_number || workOrder.visit_id || workOrder.scraped_data?.visit_info?.visit_id}
                              </Badge>
                            )}
                            {workOrder.store_number && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-600 text-white dark:bg-green-500">
                                Store #{workOrder.store_number.replace(/^#/, '')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Key Instructions - Inline in header */}
                      {workOrder.instructions && hasImportantInfo(workOrder.instructions, workOrder.service_code) && (
                        <div className="flex-shrink-0">
                          <InstructionSummary 
                            instructions={workOrder.instructions}
                            serviceCode={workOrder.service_code}
                            mode="compact-badges"
                          />
                        </div>
                      )}
                    </div>
                  </CardHeader>

                <CardContent className="pt-0 px-4 sm:px-6 space-y-3">
                  {/* Scheduled Date and Dispensers Row */}
                  <div className="flex items-center justify-between gap-2">
                    {workOrder.scheduled_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-primary">
                            {new Date(workOrder.scheduled_date).toLocaleDateString('en-US', { weekday: 'long' })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(workOrder.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const dispenserCount = getDispenserCount(workOrder);
                      
                      if (dispenserCount > 0) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation() // Prevent work order card click
                              console.log('Opening dispenser modal for work order:', workOrder)
                              setSelectedWorkOrderForModal(workOrder)
                              setShowDispenserModal(true)
                            }}
                            className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md font-medium shadow-sm hover:shadow-lg hover:from-blue-100 hover:to-blue-150 dark:hover:from-blue-900/50 dark:hover:to-blue-800/60 hover:scale-105 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                            title="Click to view dispenser details"
                          >
                            <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-semibold">
                              {dispenserCount}
                            </span>
                            <span className="text-xs text-blue-600/80 dark:text-blue-400/80">
                              {dispenserCount === 1 ? 'dispenser' : 'dispensers'}
                            </span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Location */}
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <a 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const getFullAddress = () => {
                            // Try multiple sources for address
                            if (workOrder.scraped_data?.address_components) {
                              const parts = [];
                              
                              // Add street address if available
                              if (workOrder.scraped_data.address_components.street) {
                                parts.push(workOrder.scraped_data.address_components.street);
                              }
                              
                              // Add intersection info if no street address
                              if (!workOrder.scraped_data.address_components.street && workOrder.scraped_data.address_components.intersection) {
                                parts.push(`Near ${workOrder.scraped_data.address_components.intersection}`);
                              }
                              
                              // Always include city/state if available
                              if (workOrder.scraped_data.address_components.cityState) {
                                parts.push(workOrder.scraped_data.address_components.cityState);
                              }
                              
                              if (parts.length > 0) {
                                return parts.join(', ');
                              }
                            }
                            
                            // Fallback to main address field
                            if (workOrder.address && workOrder.address.trim() && workOrder.address !== 'Address not available') {
                              return workOrder.address;
                            }
                            
                            // Last resort - use site name + store number for search
                            if (workOrder.site_name) {
                              let searchQuery = workOrder.site_name;
                              if (workOrder.store_number) {
                                searchQuery += ` ${workOrder.store_number}`;
                              }
                              // Add city/state if we have it from components but no street
                              if (workOrder.scraped_data?.address_components?.cityState) {
                                searchQuery += `, ${workOrder.scraped_data.address_components.cityState}`;
                              }
                              return searchQuery;
                            }
                            
                            return '';
                          };
                          
                          const fullAddress = getFullAddress();
                          if (!fullAddress) {
                            // No address available - don't open maps
                            return;
                          }
                          
                          const address = encodeURIComponent(fullAddress);
                          const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          
                          if (isMobile) {
                            if (isIOS) {
                              // Try Apple Maps first on iOS
                              window.open(`maps://maps.apple.com/?q=${address}`, '_blank');
                            } else {
                              // Use Google Maps on Android
                              window.open(`https://maps.google.com/maps?q=${address}`, '_blank');
                            }
                          } else {
                            // Desktop - open Google Maps in browser
                            window.open(`https://maps.google.com/maps?q=${address}`, '_blank');
                          }
                        }}
                        className="text-sm text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors block flex-1"
                        title="Click to open in maps"
                      >
                        {(() => {
                          // Show full address with proper formatting
                          if (workOrder.scraped_data?.address_components) {
                            const { street, cityState, county } = workOrder.scraped_data.address_components;
                            return (
                              <div className="space-y-0.5">
                                {street && <div className="font-medium">{street}</div>}
                                {cityState && <div>{cityState}</div>}
                                {county && <div className="text-xs text-muted-foreground">{county}</div>}
                              </div>
                            );
                          }
                          
                          if (workOrder.address && workOrder.address !== 'Address not available') {
                            const parts = workOrder.address.split(',').map(p => p.trim());
                            return (
                              <div className="space-y-0.5">
                                {parts.map((part, idx) => (
                                  <div key={idx} className={idx === 0 ? "font-medium" : ""}>{part}</div>
                                ))}
                              </div>
                            );
                          }
                          
                          return <span className="italic text-muted-foreground">Address not available</span>;
                        })()}
                      </a>
                    </div>
                  </div>

                  {/* Collapsible Full Instructions */}
                  {workOrder.instructions && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newExpanded = new Set(expandedInstructions)
                          if (newExpanded.has(workOrder.id)) {
                            newExpanded.delete(workOrder.id)
                          } else {
                            newExpanded.add(workOrder.id)
                          }
                          setExpandedInstructions(newExpanded)
                        }}
                        className="w-full p-3 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Full Instructions
                            </h4>
                          </div>
                          {expandedInstructions.has(workOrder.id) ? (
                            <ChevronUp className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                      </button>
                      {expandedInstructions.has(workOrder.id) && (
                        <div className="px-3 pb-3 -mt-1">
                          <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                            {workOrder.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Action Toolbar */}
                  <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t">
                    {workOrder.visit_url && (
                      <RippleButton 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenVisit(workOrder)}
                        title="Open Visit"
                      >
                        <Eye className="w-4 h-4" />
                      </RippleButton>
                    )}
                    <RippleButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log('Opening dispenser modal for work order:', workOrder)
                        console.log('Dispensers:', workOrder.dispensers)
                        setSelectedWorkOrderForModal(workOrder)
                        setShowDispenserModal(true)
                      }}
                      title="View Dispensers"
                    >
                      <Fuel className="w-4 h-4" />
                    </RippleButton>
                    {workOrder.customer_url && !workOrder.dispensers?.length && (
                      <RippleButton
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleScrapeDispensers(workOrder, e)}
                        title="Scrape Dispensers"
                        disabled={isAnyScraping}
                      >
                        <Sparkles className="w-4 h-4" />
                      </RippleButton>
                    )}
                    <RippleButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkOrderForDebug(workOrder)
                        setShowDebugModal(true)
                      }}
                      className="ml-auto"
                      title="Debug"
                    >
                      <Bug className="w-4 h-4" />
                    </RippleButton>
                  </div>
                </CardContent>
              </AnimatedCard>
              </div>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
          )
        ) : (
          <AnimatedCard animate="bounce" hover="glow">
            <CardContent className="text-center py-12">
              {searchTerm || brandFilter !== 'all' ? (
                // Filtered but no results
                <>
                  <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
                  <CardTitle className="text-xl mb-2">
                    <AnimatedText text="No Matching Work Orders" animationType="reveal" />
                  </CardTitle>
                  <CardDescription className="mb-6 max-w-md mx-auto">
                    <AnimatedText 
                      text="No work orders match your current search or filter criteria. Try adjusting your filters or clearing them to see all work orders."
                      animationType="fade"
                      delay={0.2}
                    />
                  </CardDescription>
                  <div className="flex gap-2 justify-center">
                    <RippleButton 
                      onClick={() => {
                        setSearchTerm('')
                        setStatusFilter('all')
                        setBrandFilter('all')
                      }}
                      variant="outline"
                    >
                      Clear Filters
                    </RippleButton>
                  </div>
                </>
              ) : (
                <EmptyStateComponent 
                  workOrders={workOrders}
                  filteredWorkOrders={filteredWorkOrders}
                  weekFilteredWorkOrders={weekFilteredWorkOrders}
                  viewMode={viewMode}
                  selectedWeek={selectedWeek}
                  showAllJobs={showAllJobs}
                  weekendModeEnabled={weekendModeEnabled}
                  setWeekendModeEnabled={setWeekendModeEnabled}
                  setShowAllJobs={setShowAllJobs}
                  handleScrape={handleScrape}
                  handleWeekChange={handleWeekChange}
                />
              )}
            </CardContent>
          </AnimatedCard>
        )}
      </section>
      
      {/* Dispenser Info Modal */}
      <DispenserInfoModal
        isOpen={showDispenserModal}
        onClose={() => {
          setShowDispenserModal(false)
          setSelectedWorkOrderForModal(null)
        }}
        dispenserData={selectedWorkOrderForModal && selectedWorkOrderForModal.dispensers ? {
          workOrder: selectedWorkOrderForModal,
          dispensers: selectedWorkOrderForModal.dispensers
        } : null}
      />
      
      {/* Debug Modal */}
      <DebugModal
        isOpen={showDebugModal}
        onClose={() => {
          setShowDebugModal(false)
          setSelectedWorkOrderForDebug(null)
        }}
        workOrder={selectedWorkOrderForDebug}
      />
      
      </div>
      
      {/* Back to Top Button - Moved outside container */}
      <BackToTop />
    </div>
    </WorkOrdersErrorBoundary>
  )
}

export default WorkOrders