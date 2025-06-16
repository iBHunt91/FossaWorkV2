import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Filter, MapPin, Calendar, Wrench, AlertTriangle, CheckCircle, Clock, XCircle, LayoutGrid, List, Eye, Fuel, Sparkles, Trash2, ChevronDown, ChevronUp, Settings, Bug, Eraser, Download, CheckSquare, Square } from 'lucide-react'
import { fetchWorkOrders, triggerScrape, updateWorkOrderStatus, openWorkOrderVisit, getScrapingProgress, triggerBatchDispenserScrape, getDispenserScrapingProgress, scrapeDispensersForWorkOrder, clearDispensersForWorkOrder } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useDebouncedCallback } from 'use-debounce'
import { useWorkOrderScrapingProgress, useDispenserScrapingProgress, useSingleDispenserProgress } from '../hooks/useProgressPolling'
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

const WorkOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<Set<string>>(new Set())
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
  
  const queryClient = useQueryClient()
  const { user } = useAuth()

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

  // Use custom hooks for progress polling
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
          queryClient.invalidateQueries({ queryKey: ['work-orders'] })
        }
        
        setTimeout(() => {
          setScrapingProgress(null)
          setScrapeStatus('idle')
          setScrapeMessage('')
        }, 5000)
      }
    }
  }, [workOrderProgress, currentUserId, queryClient])

  useEffect(() => {
    if (dispenserProgress) {
      setDispenserScrapingProgress(dispenserProgress)
      
      if (dispenserProgress.status === 'completed' || dispenserProgress.status === 'failed') {
        setIsPollingDispenserProgress(false)
        setDispenserScrapeStatus(dispenserProgress.status === 'completed' ? 'success' : 'error')
        setDispenserScrapeMessage(dispenserProgress.message)
        localStorage.removeItem(`disp_scraping_${currentUserId}`)
        
        if (dispenserProgress.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['work-orders'] })
        }
        
        setTimeout(() => {
          setDispenserScrapingProgress(null)
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      }
    }
  }, [dispenserProgress, currentUserId, queryClient])

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
        
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      }
    }
  }, [singleDispenserProgressData, queryClient])

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


  const { data: rawWorkOrders, isLoading, error } = useQuery({
    queryKey: ['work-orders', currentUserId],
    queryFn: () => fetchWorkOrders(currentUserId),
    refetchInterval: 30000,
  })

  const scrapeMutation = useMutation({
    mutationFn: () => triggerScrape(currentUserId),
    onMutate: () => {
      setScrapeStatus('scraping')
      setScrapeMessage('Initializing scraping process...')
      setScrapingProgress(null)
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
    mutationFn: async () => {
      const response = await fetch(`/api/v1/work-orders/clear-all?user_id=${currentUserId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to clear work orders')
      }
      return response.json()
    },
    onSuccess: (data) => {
      console.log('Cleared work orders:', data)
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
    onError: (error) => {
      console.error('Failed to clear work orders:', error)
    }
  })

  // Batch dispenser scraping mutation
  const dispenserScrapeMutation = useMutation({
    mutationFn: () => triggerBatchDispenserScrape(currentUserId),
    onMutate: () => {
      setDispenserScrapeStatus('scraping')
      setDispenserScrapeMessage('Initializing batch dispenser scraping...')
      setDispenserScrapingProgress(null)
      setIsPollingDispenserProgress(true) // Start polling for progress
      
      // Store scraping state in localStorage
      localStorage.setItem(`disp_scraping_${currentUserId}`, JSON.stringify({
        status: 'scraping',
        startedAt: new Date().toISOString()
      }))
    },
    onSuccess: (data) => {
      console.log('Dispenser scrape initiated:', data)
      if (data.status === 'no_work_orders') {
        setDispenserScrapeStatus('error')
        setDispenserScrapeMessage(data.message)
        setIsPollingDispenserProgress(false)
        
        // Clear localStorage
        localStorage.removeItem(`disp_scraping_${currentUserId}`)
        
        setTimeout(() => {
          setDispenserScrapeStatus('idle')
          setDispenserScrapeMessage('')
        }, 5000)
      }
      // Otherwise let the progress polling handle status updates
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
  const getCleanStoreName = (siteName: string) => {
    if (!siteName) return ''
    
    const lower = siteName.toLowerCase()
    
    // Handle 7-Eleven variations (including "Eleven Stores, Inc")
    if (lower.includes('7-eleven') || lower.includes('7 eleven') || lower.includes('seven eleven') || 
        lower.includes('eleven stores') || lower.includes('speedway')) {
      // Extract store number if present
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `7-Eleven #${storeMatch[1]}` : '7-Eleven'
    }
    
    // Handle Wawa variations (including "Wawa 2025 AccuMeasure")
    if (lower.includes('wawa')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Wawa #${storeMatch[1]}` : 'Wawa'
    }
    
    // Handle Circle-K variations
    if (lower.includes('circle k') || lower.includes('circlek') || lower.includes('circle-k')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Circle-K #${storeMatch[1]}` : 'Circle-K'
    }
    
    // Handle other brands
    if (lower.includes('costco')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Costco #${storeMatch[1]}` : 'Costco'
    }
    
    if (lower.includes('shell')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Shell #${storeMatch[1]}` : 'Shell'
    }
    
    if (lower.includes('marathon')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Marathon #${storeMatch[1]}` : 'Marathon'
    }
    
    if (lower.includes('bp') && !lower.includes('bpx')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `BP #${storeMatch[1]}` : 'BP'
    }
    
    if (lower.includes('exxon') || lower.includes('mobil')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `ExxonMobil #${storeMatch[1]}` : 'ExxonMobil'
    }
    
    if (lower.includes('chevron')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Chevron #${storeMatch[1]}` : 'Chevron'
    }
    
    if (lower.includes('texaco')) {
      const storeMatch = siteName.match(/#(\d+)/)
      return storeMatch ? `Texaco #${storeMatch[1]}` : 'Texaco'
    }
    
    // Fallback: return original if no brand detected
    return siteName
  }

  // Brand detection from site name - improved parsing
  const getBrand = (siteName: string) => {
    const lower = siteName.toLowerCase()
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
  }

  // Brand-specific styling with modern glass morphism
  const getBrandStyling = (siteName: string) => {
    const brand = getBrand(siteName)
    switch (brand) {
      case '7-Eleven':
        return 'gradient-border border-l-4 border-l-green-500 bg-gradient-to-br from-green-500/5 to-green-600/5 dark:from-green-500/10 dark:to-green-600/10 hover:shadow-green-500/20'
      case 'Wawa':
        return 'gradient-border border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/5 to-amber-600/5 dark:from-amber-500/10 dark:to-amber-600/10 hover:shadow-amber-500/20'
      case 'Circle K':
        return 'gradient-border border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/5 to-red-600/5 dark:from-red-500/10 dark:to-red-600/10 hover:shadow-red-500/20'
      case 'Shell':
        return 'gradient-border border-l-4 border-l-yellow-500 bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 dark:from-yellow-500/10 dark:to-yellow-600/10 hover:shadow-yellow-500/20'
      default:
        return 'gradient-border border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-blue-600/5 dark:from-blue-500/10 dark:to-blue-600/10 hover:shadow-blue-500/20'
    }
  }

  // Status icon mapping with animations
  const getStatusIcon = (status: string) => {
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
  }

  // Enhanced address formatting with better handling of incomplete addresses
  const formatAddress = (address: string) => {
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
  }

  // Extract unique brands for filter
  const availableBrands = useMemo(() => {
    const brands = workOrders.map(wo => getBrand(wo.site_name))
    return Array.from(new Set(brands)).sort()
  }, [workOrders])

  // Handle opening visit URL with proper format
  const handleOpenVisit = async (workOrder: EnhancedWorkOrder) => {
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
  }

  // Filter work orders using debounced search term
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const searchText = debouncedSearchTerm.toLowerCase()
      const matchesSearch = 
        !searchText || // Show all if no search term
        wo.site_name.toLowerCase().includes(searchText) ||
        wo.external_id.toLowerCase().includes(searchText) ||
        wo.address.toLowerCase().includes(searchText) ||
        (wo.store_number && wo.store_number.toLowerCase().includes(searchText)) ||
        (wo.service_code && wo.service_code.toLowerCase().includes(searchText)) ||
        (wo.service_description && wo.service_description.toLowerCase().includes(searchText))
      
      const matchesStatus = statusFilter === 'all' || wo.status === statusFilter
      const matchesBrand = brandFilter === 'all' || getBrand(wo.site_name) === brandFilter

      return matchesSearch && matchesStatus && matchesBrand
    })
  }, [workOrders, debouncedSearchTerm, statusFilter, brandFilter])

  const handleScrape = () => {
    console.log('Starting work order scrape for user:', currentUserId)
    scrapeMutation.mutate()
  }

  const handleDispenserScrape = () => {
    console.log('Starting batch dispenser scrape for user:', currentUserId)
    dispenserScrapeMutation.mutate()
  }

  const handleStatusUpdate = (workOrderId: string, status: string) => {
    statusUpdateMutation.mutate({ workOrderId, status })
  }

  // Handle work order selection
  const toggleWorkOrderSelection = (workOrderId: string) => {
    const newSelection = new Set(selectedWorkOrders)
    if (newSelection.has(workOrderId)) {
      newSelection.delete(workOrderId)
    } else {
      newSelection.add(workOrderId)
    }
    setSelectedWorkOrders(newSelection)
  }

  const selectAllWorkOrders = () => {
    const allIds = new Set(filteredWorkOrders.map(wo => wo.id))
    setSelectedWorkOrders(allIds)
  }

  const deselectAllWorkOrders = () => {
    setSelectedWorkOrders(new Set())
  }

  // Handle batch operations
  const handleBatchDispenserScrape = async () => {
    if (selectedWorkOrders.size === 0) return

    const selectedIds = Array.from(selectedWorkOrders)
    console.log(`Starting selective dispenser scrape for ${selectedIds.length} work orders:`, selectedIds)
    
    // Clear selections after starting
    deselectAllWorkOrders()
    
    // Set scraping status
    setDispenserScrapeStatus('scraping')
    setDispenserScrapeMessage(`Scraping dispensers for ${selectedIds.length} selected work orders...`)
    
    try {
      // Scrape each selected work order sequentially
      for (let i = 0; i < selectedIds.length; i++) {
        const workOrderId = selectedIds[i]
        const workOrder = workOrders.find(wo => wo.id === workOrderId)
        
        if (workOrder) {
          setDispenserScrapeMessage(`Scraping ${i + 1} of ${selectedIds.length}: ${workOrder.site_name}...`)
          
          try {
            await scrapeDispensersForWorkOrder(workOrderId, currentUserId)
            console.log(`Successfully scraped dispensers for ${workOrderId}`)
          } catch (error) {
            console.error(`Failed to scrape dispensers for ${workOrderId}:`, error)
          }
          
          // Small delay between scrapes to avoid overwhelming the server
          if (i < selectedIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
      
      // Success message
      setDispenserScrapeStatus('success')
      setDispenserScrapeMessage(`Successfully scraped dispensers for ${selectedIds.length} work orders!`)
      
      // Refresh work orders to show updated dispenser counts
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      
      // Reset status after showing success
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
        setDispenserScrapeMessage('')
      }, 3000)
      
    } catch (error) {
      console.error('Batch dispenser scrape failed:', error)
      setDispenserScrapeStatus('error')
      setDispenserScrapeMessage('Failed to complete batch dispenser scraping')
      
      setTimeout(() => {
        setDispenserScrapeStatus('idle')
        setDispenserScrapeMessage('')
      }, 5000)
    }
  }

  // Handler for scraping dispensers for a specific work order
  const handleScrapeDispensers = async (workOrder: EnhancedWorkOrder, event?: React.MouseEvent) => {
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
      const result = await scrapeDispensersForWorkOrder(workOrder.id, currentUserId)
      
      if (result.status === 'scraping_started') {
        // The polling hook will automatically handle progress updates
        console.log('Dispenser scraping started, polling will handle progress')
      } else {
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
  }

  // Handler for clearing dispensers for a specific work order
  const handleClearDispensers = async (workOrder: EnhancedWorkOrder) => {
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
  }

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

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="container mx-auto p-6 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-in-from-top">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <GradientText text="Work Orders" gradient="from-blue-600 via-purple-600 to-pink-600" />
            </h1>
            <p className="text-muted-foreground text-lg mb-2">
              <AnimatedText text="Manage and monitor fuel dispenser automation tasks" animationType="split" delay={0.2} />
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground animate-fade-in" style={{animationDelay: '0.4s'}}>
              <span className="inline-flex items-center gap-1">
                <span className="number-display text-sm">{filteredWorkOrders.length}</span>
                <span>of</span>
                <span className="number-display text-sm">{workOrders.length}</span>
                <span>work orders</span>
              </span>
              {workOrders.length > 0 && (
                <span className="chip chip-primary">
                  Brands: {availableBrands.join(', ')}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <AnimatedButton
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending || workOrders.length === 0}
              size="lg"
              variant="destructive"
              animation="pulse"
              className="min-w-[140px]"
            >
              <Trash2 className={`w-4 h-4 mr-2 ${clearAllMutation.isPending ? 'animate-spin' : ''}`} />
              {clearAllMutation.isPending ? 'Clearing...' : 'Clear All'}
            </AnimatedButton>
            <AnimatedButton
              onClick={handleScrape}
              disabled={scrapeMutation.isPending || scrapeStatus === 'scraping'}
              size="lg"
              animation="shimmer"
              className="min-w-[180px]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${scrapeStatus === 'scraping' ? 'animate-spin' : ''}`} />
              {scrapeStatus === 'scraping' ? 'Scraping...' : 'Scrape Work Orders'}
            </AnimatedButton>
            <AnimatedButton
              onClick={handleDispenserScrape}
              disabled={dispenserScrapeMutation.isPending || dispenserScrapeStatus === 'scraping'}
              size="lg"
              variant="secondary"
              animation="pulse"
              className="min-w-[180px]"
            >
              <Fuel className={`w-4 h-4 mr-2 ${dispenserScrapeStatus === 'scraping' ? 'animate-spin' : ''}`} />
              {dispenserScrapeStatus === 'scraping' ? 'Scraping Dispensers...' : 'Scrape Dispensers'}
            </AnimatedButton>
            
            {/* Batch Actions */}
            {selectedWorkOrders.size > 0 && (
              <>
                <div className="h-10 w-px bg-border/50" />
                <AnimatedButton
                  onClick={handleBatchDispenserScrape}
                  disabled={selectedWorkOrders.size === 0}
                  size="lg"
                  variant="outline"
                  animation="scale"
                  className="min-w-[200px] border-orange-500/50 hover:border-orange-500"
                >
                  <Fuel className="w-4 h-4 mr-2 text-orange-500" />
                  Scrape Selected ({selectedWorkOrders.size})
                </AnimatedButton>
                <AnimatedButton
                  onClick={deselectAllWorkOrders}
                  size="lg"
                  variant="ghost"
                  animation="fade"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Clear Selection
                </AnimatedButton>
              </>
            )}
          </div>
        </div>

        {/* Scraping Status Display */}
        {scrapeStatus !== 'idle' && (
          <div className="animate-slide-in-from-top">
            {scrapeStatus === 'scraping' && (
              <GlowCard 
                glowColor="rgba(59, 130, 246, 0.4)" 
                className="w-full animate-pulse-glow border-primary/30"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <ProgressLoader size="lg" className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">Scraping in Progress</CardTitle>
                      <CardDescription className="text-base">
                        <AnimatedText 
                          text={scrapingProgress?.message || scrapeMessage}
                          animationType="fade"
                          className="font-medium"
                        />
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {scrapingProgress && (
                    <>
                      {/* Progress Display */}
                      <div className="bg-gradient-to-r from-primary/5 to-blue-500/5 rounded-xl p-6 border border-primary/20">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                          {/* Percentage */}
                          <div className="text-center">
                            <div className="mb-2">
                              <ShimmerText 
                                text={`${Math.round(Number(scrapingProgress.percentage || 0))}%`}
                                className="text-5xl font-black text-primary block"
                              />
                            </div>
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              Complete
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="space-y-3">
                            <div className="text-center">
                              <div className="text-sm font-medium text-muted-foreground mb-2">Overall Progress</div>
                              <Progress 
                                value={Number(scrapingProgress.percentage || 0)} 
                                className="h-4 bg-muted/50"
                              />
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">Current Phase</div>
                              <div className="font-semibold text-sm mt-1 capitalize bg-muted/30 rounded-md px-3 py-1 inline-block">
                                {scrapingProgress.phase}
                              </div>
                            </div>
                          </div>
                          
                          {/* Results */}
                          {scrapingProgress.work_orders_found > 0 && (
                            <div className="text-center">
                              <AnimatedCard 
                                hover="scale" 
                                animate="bounce" 
                                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 p-4"
                              >
                                <div className="text-green-600 text-3xl mb-2">📊</div>
                                <GradientText 
                                  text={String(scrapingProgress.work_orders_found)}
                                  gradient="from-green-600 to-emerald-600"
                                  className="text-3xl font-black block mb-1"
                                />
                                <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
                                  Work Orders Found
                                </div>
                              </AnimatedCard>
                            </div>
                          )}
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
                        
                        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
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
        <GlowCard glowColor="rgba(59, 130, 246, 0.2)" className="animate-slide-in-from-left" style={{animationDelay: '0.2s'}}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <ShimmerText text="Filters & Search" />
            </CardTitle>
            <CardDescription>Filter and search work orders by various criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Selection controls */}
              {filteredWorkOrders.length > 0 && (
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search work orders..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      debouncedSearch(e.target.value)
                    }}
                    className="pl-10 input-modern"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 input-modern"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 input-modern"
                >
                  <option value="all">All Brands</option>
                  {availableBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>

                <div className="flex border border-border rounded-lg overflow-hidden glass">
                  <MagneticButton
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none flex-1"
                    strength={0.1}
                  >
                    <LayoutGrid className="w-4 h-4 mr-1" />
                    Grid
                  </MagneticButton>
                  <MagneticButton
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none flex-1"
                    strength={0.1}
                  >
                    <List className="w-4 h-4 mr-1" />
                    List
                  </MagneticButton>
                </div>
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
        ) : filteredWorkOrders.length > 0 ? (
          <div className={viewMode === 'grid' ? 'work-orders-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'work-orders-list space-y-4'}>
            {filteredWorkOrders.map((workOrder, index) => (
              <div key={workOrder.id} className="relative">
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
                  className={`${getBrandStyling(workOrder.site_name)} card-hover glass-dark`}
                  hover="lift"
                  animate="slide"
                  delay={index * 0.1}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 pl-10">
                        <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <CardTitle className="text-lg leading-none break-words min-w-0">
                            <AnimatedText 
                              text={getCleanStoreName(workOrder.site_name)} 
                              animationType="fade"
                            />
                          </CardTitle>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(workOrder.visit_number || workOrder.visit_id || workOrder.scraped_data?.visit_info?.visit_id) && (
                            <Badge variant="default" className="text-xs bg-blue-600 text-white dark:bg-blue-500 shadow-sm">
                              <span className="text-xs opacity-90">Visit:</span> {workOrder.visit_number || workOrder.visit_id || workOrder.scraped_data?.visit_info?.visit_id}
                            </Badge>
                          )}
                          {workOrder.store_number && (
                            <Badge variant="secondary" className="text-xs bg-green-600 text-white dark:bg-green-500 shadow-sm">
                              <span className="text-xs opacity-90">Store:</span> {workOrder.store_number}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {/* Scheduled Date and Dispensers */}
                  <div className="flex flex-wrap items-center gap-4 animate-slide-in-from-left" style={{animationDelay: '0.4s'}}>
                    {workOrder.scheduled_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium">
                          Scheduled: {new Date(workOrder.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {(() => {
                      // Extract dispenser count from service items
                      let dispenserCount = 0;
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
                      
                      if (dispenserCount > 0) {
                        return (
                          <div className="flex items-center gap-2">
                            <Fuel className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm">
                              <span className="font-medium">Dispensers:</span> {dispenserCount}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Enhanced Location */}
                  <div className="space-y-2 animate-slide-in-from-left" style={{animationDelay: '0.5s'}}>
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
                        className="text-sm text-muted-foreground space-y-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block no-underline hover:underline"
                        title="Click to open in maps"
                      >
                        {(() => {
                          // Check multiple sources for address data
                          const hasAddressComponents = workOrder.scraped_data?.address_components && 
                            (workOrder.scraped_data.address_components.street || 
                             workOrder.scraped_data.address_components.cityState);
                          
                          if (hasAddressComponents) {
                            return (
                              <div className="space-y-1">
                                {workOrder.scraped_data.address_components.street && (
                                  <div className="font-medium leading-tight">{workOrder.scraped_data.address_components.street}</div>
                                )}
                                {workOrder.scraped_data.address_components.intersection && (
                                  <div className="text-xs text-muted-foreground/70 leading-tight">
                                    Near {workOrder.scraped_data.address_components.intersection}
                                  </div>
                                )}
                                {workOrder.scraped_data.address_components.cityState && (
                                  <div className="leading-tight">{workOrder.scraped_data.address_components.cityState}</div>
                                )}
                                {workOrder.scraped_data.address_components.county && (
                                  <div className="text-xs text-muted-foreground/70 leading-tight">
                                    {workOrder.scraped_data.address_components.county}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          // Fallback to formatted address with better line breaks
                          if (workOrder.address) {
                            return (
                              <div className="space-y-1">
                                {(() => {
                                  // Split address by common delimiters and display as separate lines
                                  const addressParts = workOrder.address.split(/,(?=\s)/).map(part => part.trim()).filter(Boolean);
                                  
                                  if (addressParts.length > 1) {
                                    return addressParts.map((part, index) => (
                                      <div key={index} className={`leading-tight ${index === 0 ? 'font-medium' : ''}`}>
                                        {part}
                                      </div>
                                    ));
                                  } else {
                                    // Single line address
                                    return <div className="leading-tight">{workOrder.address}</div>;
                                  }
                                })()}
                              </div>
                            );
                          }
                          
                          // Last resort - show placeholder
                          return <div className="text-muted-foreground/50 italic">Address not available</div>;
                        })()}
                      </a>
                    </div>
                  </div>

                  {/* Collapsible Instructions */}
                  {workOrder.instructions && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 animate-slide-in-from-left" style={{animationDelay: '0.6s'}}>
                      <button
                        onClick={() => {
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
                              ⚠️ Instructions
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
                        <div className="px-3 pb-3">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            {workOrder.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Action Toolbar */}
                  <div className="flex gap-2 flex-wrap animate-fade-in" style={{animationDelay: '0.8s'}}>
                    {workOrder.visit_url && (
                      <RippleButton 
                        variant="default" 
                        size="sm"
                        onClick={() => handleOpenVisit(workOrder)}
                        className="btn-modern"
                        title="Open Visit in Browser"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Open Visit
                      </RippleButton>
                    )}
                    <RippleButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('Opening dispenser modal for work order:', workOrder)
                        console.log('Dispensers:', workOrder.dispensers)
                        setSelectedWorkOrderForModal(workOrder)
                        setShowDispenserModal(true)
                      }}
                      className="btn-modern"
                      title="View Dispenser Information"
                    >
                      <Fuel className="w-4 h-4 mr-1" />
                      Dispensers
                    </RippleButton>
                    <RippleButton
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleScrapeDispensers(workOrder, e)}
                      className="btn-modern border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
                      title="Scrape Dispensers for This Work Order"
                      disabled={dispenserScrapeStatus === 'scraping'}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Scrape
                    </RippleButton>
                    <RippleButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleClearDispensers(workOrder)}
                      className="btn-modern border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                      title="Clear Dispensers for This Work Order"
                      disabled={dispenserScrapeStatus === 'scraping'}
                    >
                      <Eraser className="w-4 h-4 mr-1" />
                      Clear
                    </RippleButton>
                    <RippleButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkOrderForDebug(workOrder)
                        setShowDebugModal(true)
                      }}
                      className="btn-modern border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950"
                      title="Debug: View All Scraped Data"
                    >
                      <Bug className="w-4 h-4 mr-1" />
                      Debug
                    </RippleButton>
                  </div>
                </CardContent>
              </AnimatedCard>
              </div>
            ))}
          </div>
        ) : (
          <AnimatedCard animate="bounce" hover="glow">
            <CardContent className="text-center py-12">
              {searchTerm || statusFilter !== 'all' || brandFilter !== 'all' ? (
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
                // No work orders at all
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
    </div>
  )
}

export default WorkOrders