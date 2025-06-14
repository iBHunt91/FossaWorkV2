import React, { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Icon, LatLngBounds, LatLng } from 'leaflet'
import { Calendar, MapPin, Clock, User, ExternalLink, RotateCcw, AlertTriangle, ChevronLeft, ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getWorkOrders, WorkOrder, getScheduleSettings, ScheduleSettings } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/services/fileLoggingService'
import LoadingSpinner from '@/components/LoadingSpinner'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default icons
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'

const DefaultIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconRetinaUrl: markerIconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const SelectedIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconRetinaUrl: markerIconRetina,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -45],
  shadowSize: [57, 57],
  className: 'selected-marker'
})

interface JobLocation {
  id: string
  lat: number
  lng: number
  workOrder: WorkOrder
}

interface FailedGeocode {
  workOrder: WorkOrder
  reason: string
}

interface WeekInfo {
  weekStart: Date
  weekEnd: Date
  weekNumber: number
  isCurrentWeek: boolean
  displayText: string
}

interface MapControllerProps {
  selectedJob: string | null
  jobLocations: JobLocation[]
  onMapReady: () => void
}

// Component to control map view
const MapController: React.FC<MapControllerProps> = ({ selectedJob, jobLocations, onMapReady }) => {
  const map = useMap()

  useEffect(() => {
    onMapReady()
  }, [onMapReady])

  useEffect(() => {
    if (selectedJob && jobLocations.length > 0) {
      const selectedLocation = jobLocations.find(loc => loc.id === selectedJob)
      if (selectedLocation) {
        map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, {
          duration: 1.5
        })
      }
    }
  }, [selectedJob, jobLocations, map])

  const resetView = useCallback(() => {
    if (jobLocations.length > 0) {
      const bounds = new LatLngBounds(
        jobLocations.map(loc => new LatLng(loc.lat, loc.lng))
      )
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [jobLocations, map])

  // Expose reset function globally
  useEffect(() => {
    (window as any).resetMapView = resetView
  }, [resetView])

  return null
}

const JobMap: React.FC = () => {
  const { user } = useAuth()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [jobLocations, setJobLocations] = useState<JobLocation[]>([])
  const [failedGeocodes, setFailedGeocodes] = useState<FailedGeocode[]>([])
  const [currentWeekOrders, setCurrentWeekOrders] = useState<WorkOrder[]>([])
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<WeekInfo | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Helper functions for week calculations
  const getWeekInfo = useCallback((date: Date, settings: ScheduleSettings | null): WeekInfo => {
    const weekStart = new Date(date)
    const dayOfWeek = weekStart.getDay()
    
    // Adjust for work week preferences (Monday start vs Sunday start)
    const startDay = settings?.work_on_weekends ? 0 : 1 // 0 = Sunday, 1 = Monday
    const daysToSubtract = dayOfWeek >= startDay ? dayOfWeek - startDay : dayOfWeek + 7 - startDay
    
    weekStart.setDate(weekStart.getDate() - daysToSubtract)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    const weekLength = settings?.work_on_weekends ? 6 : 4 // 7 days vs 5 days
    weekEnd.setDate(weekStart.getDate() + weekLength)
    weekEnd.setHours(23, 59, 59, 999)
    
    // Calculate week number
    const yearStart = new Date(weekStart.getFullYear(), 0, 1)
    const weekNumber = Math.ceil(((weekStart.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7)
    
    // Check if current week
    const now = new Date()
    const currentWeekStart = new Date(now)
    const currentDayOfWeek = currentWeekStart.getDay()
    const currentStartDay = settings?.work_on_weekends ? 0 : 1
    const currentDaysToSubtract = currentDayOfWeek >= currentStartDay ? currentDayOfWeek - currentStartDay : currentDayOfWeek + 7 - currentStartDay
    
    currentWeekStart.setDate(currentWeekStart.getDate() - currentDaysToSubtract)
    currentWeekStart.setHours(0, 0, 0, 0)
    
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime()
    
    // Generate display text
    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const startText = weekStart.toLocaleDateString('en-US', formatOptions)
    const endText = weekEnd.toLocaleDateString('en-US', formatOptions)
    const displayText = `${startText} - ${endText}`
    
    return {
      weekStart,
      weekEnd,
      weekNumber,
      isCurrentWeek,
      displayText
    }
  }, [])
  
  const getCurrentWeek = useCallback((): WeekInfo => {
    return getWeekInfo(new Date(), scheduleSettings)
  }, [getWeekInfo, scheduleSettings])
  
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    if (!selectedWeek) return
    
    const newDate = new Date(selectedWeek.weekStart)
    const weekLength = 7 // Always 7 days for navigation
    newDate.setDate(newDate.getDate() + (direction === 'next' ? weekLength : -weekLength))
    
    setSelectedWeek(getWeekInfo(newDate, scheduleSettings))
  }, [selectedWeek, getWeekInfo, scheduleSettings])
  
  const goToCurrentWeek = useCallback(() => {
    setSelectedWeek(getCurrentWeek())
  }, [getCurrentWeek])

  // Geocoding function - using a demo geocoding approach
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Clean up the address for better geocoding results
      const cleanAddress = address.replace(/\n/g, ', ').replace(/\s+/g, ' ').trim()
      
      // Try OSM Nominatim API (free, but rate limited)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1&countrycodes=us`
      )
      
      if (!response.ok) {
        throw new Error(`Geocoding API returned ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        }
      }
      
      // If no results, try with just city/state if available
      const cityStateMatch = cleanAddress.match(/([^,]+,\s*[A-Z]{2})/i)
      if (cityStateMatch) {
        const cityStateResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityStateMatch[1])}&limit=1&countrycodes=us`
        )
        const cityStateData = await cityStateResponse.json()
        
        if (cityStateData && cityStateData.length > 0) {
          return {
            lat: parseFloat(cityStateData[0].lat),
            lng: parseFloat(cityStateData[0].lon)
          }
        }
      }
      
      return null
    } catch (error) {
      logger.error('geocoding', `Failed to geocode address: ${address}`, error)
      return null
    }
  }
  
  // Load schedule settings
  useEffect(() => {
    const loadScheduleSettings = async () => {
      if (!user?.id) return
      
      try {
        console.log('JobMap: Loading schedule settings for user:', user.id)
        const response = await getScheduleSettings(user.id)
        const settings = response.settings || response // Handle different response formats
        setScheduleSettings(settings)
        logger.info('job-map', 'Loaded schedule settings', settings)
        console.log('JobMap: Schedule settings loaded:', settings)
      } catch (error: any) {
        logger.warn('job-map', 'Failed to load schedule settings, using defaults', error)
        console.warn('JobMap: Failed to load schedule settings:', error)
        console.log('JobMap: Schedule settings error details:', {
          message: error?.message,
          response: error?.response,
          status: error?.response?.status,
          data: error?.response?.data
        })
        
        // Use default settings
        const defaultSettings = {
          auto_scrape_enabled: true,
          scrape_interval_minutes: 60,
          scrape_times: [],
          schedule_change_check_minutes: 15,
          working_hours_start: '06:00',
          working_hours_end: '18:00',
          work_on_weekends: false,
          holiday_dates: []
        }
        setScheduleSettings(defaultSettings)
        console.log('JobMap: Using default schedule settings:', defaultSettings)
      }
    }
    
    loadScheduleSettings()
  }, [user?.id])
  
  // Initialize selected week when schedule settings are loaded OR on initial mount
  useEffect(() => {
    if (!selectedWeek) {
      // Initialize with current week immediately, don't wait for settings
      const defaultSettings = {
        work_on_weekends: false,
        holiday_dates: []
      }
      setSelectedWeek(getWeekInfo(new Date(), scheduleSettings || defaultSettings))
    }
  }, [scheduleSettings, selectedWeek, getWeekInfo])
  
  // Filter orders for selected week
  useEffect(() => {
    console.log('JobMap: Filtering orders - workOrders:', workOrders.length, 'selectedWeek:', selectedWeek?.displayText)
    
    if (!workOrders.length || !selectedWeek) {
      console.log('JobMap: No work orders or selected week, clearing current week orders')
      setCurrentWeekOrders([])
      return
    }
    
    // Use default settings if scheduleSettings haven't loaded yet
    const settings = scheduleSettings || {
      work_on_weekends: false,
      holiday_dates: []
    }
    
    // Check if any work orders have scheduled dates
    const ordersWithDates = workOrders.filter(order => order.scheduled_date)
    
    let weekOrders
    if (ordersWithDates.length === 0) {
      // If no work orders have scheduled dates, show all work orders
      console.log('JobMap: No work orders have scheduled dates, showing all orders')
      weekOrders = workOrders
    } else {
      // Filter by week as normal for orders with scheduled dates
      weekOrders = workOrders.filter(order => {
        if (!order.scheduled_date) {
          logger.debug('job-map', `Order ${order.id} has no scheduled date`)
          return false
        }
        
        const orderDate = new Date(order.scheduled_date)
        // Reset time to start of day for accurate date comparison
        orderDate.setHours(0, 0, 0, 0)
        
        // Create date objects for comparison with time normalized
        const weekStartCompare = new Date(selectedWeek.weekStart)
        weekStartCompare.setHours(0, 0, 0, 0)
        const weekEndCompare = new Date(selectedWeek.weekEnd)
        weekEndCompare.setHours(23, 59, 59, 999)
        
        const isInWeek = orderDate >= weekStartCompare && orderDate <= weekEndCompare
        
        if (!isInWeek) {
          logger.debug('job-map', `Order ${order.id} (${order.scheduled_date}) not in week ${selectedWeek.displayText}`)
        }
        
        // Filter out weekend jobs if work_on_weekends is false
        if (!settings.work_on_weekends) {
          const dayOfWeek = orderDate.getDay()
          if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
            return false
          }
        }
        
        // Filter out holidays
        const orderDateString = orderDate.toISOString().split('T')[0]
        if (settings.holiday_dates.includes(orderDateString)) {
          return false
        }
        
        return isInWeek
      })
    }
    
    logger.info('job-map', `Found ${weekOrders.length} orders for selected week (${selectedWeek.displayText})`)
    console.log('JobMap: Week filtering complete:', {
      totalOrders: workOrders.length,
      filteredOrders: weekOrders.length,
      weekStart: selectedWeek.weekStart.toISOString(),
      weekEnd: selectedWeek.weekEnd.toISOString(),
      firstOrderDate: workOrders[0]?.scheduled_date,
      weekDisplayText: selectedWeek.displayText
    })
    setCurrentWeekOrders(weekOrders)
  }, [workOrders, selectedWeek, scheduleSettings])

  // Load work orders
  useEffect(() => {
    const loadWorkOrders = async () => {
      if (!user?.id) {
        logger.warn('job-map', 'No user ID available')
        console.warn('JobMap: No user ID available', user)
        return
      }
      
      try {
        setLoading(true)
        logger.info('job-map', `Loading work orders for user ${user.id}`)
        console.log('JobMap: Starting to load work orders for user:', user.id)
        
        const orders = await getWorkOrders(user.id)
        console.log('JobMap: Loaded work orders:', orders)
        console.log('JobMap: Work orders type:', typeof orders, 'isArray:', Array.isArray(orders))
        logger.info('job-map', `Loaded ${orders?.length || 0} total work orders`)
        
        // Ensure orders is an array
        const ordersArray = Array.isArray(orders) ? orders : []
        setWorkOrders(ordersArray)
        
        // If we have orders and no week is selected yet, check if we should adjust to show data
        if (ordersArray.length > 0 && !selectedWeek) {
          const firstOrderWithDate = ordersArray.find(o => o.scheduled_date)
          if (firstOrderWithDate) {
            const firstOrderDate = new Date(firstOrderWithDate.scheduled_date)
            const currentDate = new Date()
            
            // If orders are from a different year, set initial week to show those orders
            if (firstOrderDate.getFullYear() !== currentDate.getFullYear()) {
              console.log('JobMap: Work orders are from', firstOrderDate.getFullYear(), 
                         'but current year is', currentDate.getFullYear(), 
                         '- adjusting initial week to show existing data')
              
              // Find the date range of all orders
              const orderDates = ordersArray
                .filter(o => o.scheduled_date)
                .map(o => new Date(o.scheduled_date))
                .sort((a, b) => a.getTime() - b.getTime())
              
              if (orderDates.length > 0) {
                // Set selected week to the week of the first order
                setSelectedWeek(getWeekInfo(orderDates[0], scheduleSettings || { work_on_weekends: false, holiday_dates: [] }))
              }
            }
          }
        }
      } catch (error: any) {
        logger.error('job-map', 'Failed to load work orders', error)
        console.error('JobMap: Error loading work orders:', error)
        console.error('JobMap: Error details:', {
          message: error?.message,
          response: error?.response,
          status: error?.response?.status,
          data: error?.response?.data
        })
        setError('Failed to load work orders. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    loadWorkOrders()
  }, [user?.id])
  
  // Geocode addresses when week orders change
  useEffect(() => {
    const geocodeOrders = async () => {
      if (!currentWeekOrders.length) {
        setJobLocations([])
        setFailedGeocodes([])
        return
      }
      
      const locations: JobLocation[] = []
      const failed: FailedGeocode[] = []
      
      // Geocode with rate limiting to avoid hitting API limits
      for (const order of currentWeekOrders) {
        if (order.address && order.address.trim() && order.address !== 'Address not available') {
          logger.debug('job-map', `Geocoding address for ${order.site_name}: ${order.address}`)
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const coords = await geocodeAddress(order.address)
          if (coords) {
            locations.push({
              id: order.id,
              lat: coords.lat,
              lng: coords.lng,
              workOrder: order
            })
            logger.debug('job-map', `Successfully geocoded ${order.site_name}: ${coords.lat}, ${coords.lng}`)
          } else {
            failed.push({
              workOrder: order,
              reason: 'Geocoding failed'
            })
            logger.warn('job-map', `Failed to geocode address for ${order.site_name}: ${order.address}`)
          }
        } else {
          failed.push({
            workOrder: order,
            reason: 'No valid address'
          })
          logger.warn('job-map', `No valid address for order ${order.id} - ${order.site_name}`)
        }
      }

      setJobLocations(locations)
      setFailedGeocodes(failed)
      logger.info('job-map', `Successfully geocoded ${locations.length} locations (${failed.length} failures)`)
    }
    
    geocodeOrders()
  }, [currentWeekOrders])
  
  // Auto-zoom map to fit all markers when locations change
  useEffect(() => {
    if (mapReady && jobLocations.length > 0) {
      // Small delay to ensure map is fully rendered
      setTimeout(() => {
        if ((window as any).resetMapView) {
          (window as any).resetMapView()
        }
      }, 100)
    }
  }, [mapReady, jobLocations])

  const handleJobSelect = (jobId: string) => {
    setSelectedJob(prevSelected => prevSelected === jobId ? null : jobId)
  }

  const handleResetView = () => {
    setSelectedJob(null)
    if ((window as any).resetMapView) {
      (window as any).resetMapView()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'pending': return 'bg-yellow-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date scheduled'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading && workOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-muted-foreground">Loading work orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Job List Sidebar */}
      <div className="w-96 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Job Map
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetView}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset View
            </Button>
          </div>
          
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
                disabled={!selectedWeek}
                className="px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="text-center min-w-[140px]">
                <div className="text-sm font-medium">
                  {selectedWeek?.displayText || 'Loading...'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedWeek?.isCurrentWeek ? 'Current Week' : `Week ${selectedWeek?.weekNumber || ''}`}
                  {scheduleSettings && !scheduleSettings.work_on_weekends && ' (Mon-Fri)'}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
                disabled={!selectedWeek}
                className="px-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            {selectedWeek && !selectedWeek.isCurrentWeek && (
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentWeek}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Current
              </Button>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {currentWeekOrders.length} total jobs • {jobLocations.length} on map
            {failedGeocodes.length > 0 && ` • ${failedGeocodes.length} without location`}
            {workOrders.length > 0 && workOrders.filter(o => o.scheduled_date).length === 0 && 
              ` • All jobs (no dates)`}
          </p>
        </div>

        <ScrollArea className="flex-1 job-list-scroll">
          <div className="p-4 space-y-3">
            {/* Show loading state for geocoding */}
            {loading && workOrders.length > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <LoadingSpinner className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-sm">Geocoding addresses...</p>
                      <p className="text-xs text-muted-foreground">This may take a moment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Show geocoded jobs first */}
            {jobLocations.map((location) => {
              const { workOrder } = location
              const isSelected = selectedJob === workOrder.id

              return (
                <Card
                  key={workOrder.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleJobSelect(workOrder.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{workOrder.site_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {workOrder.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-green-500" title="Location available" />
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(workOrder.status)} flex-shrink-0`} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(workOrder.scheduled_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Job #{workOrder.external_id || workOrder.id.slice(0, 8)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {workOrder.status.replace('_', ' ')}
                      </Badge>
                      {workOrder.dispensers.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {workOrder.dispensers.length} dispenser{workOrder.dispensers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Show failed geocodes */}
            {failedGeocodes.map(({ workOrder, reason }) => {
              const isSelected = selectedJob === workOrder.id

              return (
                <Card
                  key={workOrder.id}
                  className={`cursor-pointer transition-all hover:shadow-md opacity-75 ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleJobSelect(workOrder.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{workOrder.site_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {workOrder.address || 'No address available'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-400" title={reason} />
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(workOrder.status)} flex-shrink-0`} />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(workOrder.scheduled_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-600 dark:text-amber-400 text-xs">Location unavailable</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {workOrder.status.replace('_', ' ')}
                      </Badge>
                      {workOrder.dispensers.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {workOrder.dispensers.length} dispenser{workOrder.dispensers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {currentWeekOrders.length === 0 && !loading && selectedWeek && (
              <Card>
                <CardContent className="p-6 text-center">
                  <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No jobs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No jobs scheduled for {selectedWeek.displayText}
                    {selectedWeek.isCurrentWeek && ' (current week)'}
                  </p>
                  {scheduleSettings && !scheduleSettings.work_on_weekends && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Weekends excluded from work schedule
                    </p>
                  )}
                  {workOrders.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          💡 <strong>Tip:</strong> You have {workOrders.length} work orders in the system. 
                          Try navigating to different weeks using the arrow buttons above to find them.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Find the first work order with a date
                          const firstOrderWithDate = workOrders.find(o => o.scheduled_date)
                          if (firstOrderWithDate) {
                            const orderDate = new Date(firstOrderWithDate.scheduled_date)
                            setSelectedWeek(getWeekInfo(orderDate, scheduleSettings))
                          }
                        }}
                        className="w-full"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Go to First Work Order's Week
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {jobLocations.length > 0 ? (
          <MapContainer
            center={[39.8283, -98.5795]} // Center of US
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController
              selectedJob={selectedJob}
              jobLocations={jobLocations}
              onMapReady={() => setMapReady(true)}
            />

            {jobLocations.map((location) => {
              const { workOrder } = location
              const isSelected = selectedJob === workOrder.id

              return (
                <Marker
                  key={workOrder.id}
                  position={[location.lat, location.lng]}
                  icon={isSelected ? SelectedIcon : DefaultIcon}
                  eventHandlers={{
                    click: () => handleJobSelect(workOrder.id)
                  }}
                >
                  <Popup>
                    <div className="w-64 p-2">
                      <h3 className="font-semibold text-sm mb-2">{workOrder.site_name}</h3>
                      <p className="text-xs text-gray-600 mb-2">{workOrder.address}</p>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(workOrder.scheduled_date)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <Badge variant="secondary" className="text-xs">
                            {workOrder.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        {workOrder.dispensers.length > 0 && (
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            <span>{workOrder.dispensers.length} dispenser{workOrder.dispensers.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}

                        {workOrder.visit_url && (
                          <div className="pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs h-7"
                              onClick={() => window.open(workOrder.visit_url, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open Visit
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Card className="w-96">
              <CardContent className="pt-6 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Jobs to Display</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedWeek 
                    ? `No jobs with valid addresses found for ${selectedWeek.displayText}.`
                    : 'Loading week information...'
                  }
                </p>
                {selectedWeek && !selectedWeek.isCurrentWeek && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToCurrentWeek}
                    className="mt-3 flex items-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Go to Current Week
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default JobMap