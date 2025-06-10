import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Filter, MapPin, Calendar, Wrench, AlertTriangle, CheckCircle, Clock, XCircle, LayoutGrid, List, Eye } from 'lucide-react'
import { fetchWorkOrders, triggerScrape, updateWorkOrderStatus, openWorkOrderVisit } from '../services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '../components/LoadingSpinner'

// Types based on real data structure
interface RealWorkOrder {
  basic_info: {
    id: string
    external_id: string
    brand: string
    store_info: string
  }
  location: {
    site_name: string
    address: string
  }
  scheduling: {
    scheduled_date: string | null
    status: string
  }
  metadata: {
    user_id: string
    username: string
    notes: string | null
    created_at: string
    updated_at: string
  }
  dispensers: Array<{
    id: string
    number: string
    type: string
    fuel_grades: Record<string, any>
    status: string
    progress_percentage: number
    automation_completed: boolean
    timestamps: {
      created_at: string
      updated_at: string
    }
  }>
  visit_url?: string
}

const WorkOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const queryClient = useQueryClient()

  // TODO: Replace with auth context - remove hardcoded user
  const currentUserId = 'demo-user'

  const { data: rawWorkOrders, isLoading, error } = useQuery({
    queryKey: ['work-orders', currentUserId],
    queryFn: () => fetchWorkOrders(currentUserId),
    refetchInterval: 30000,
  })

  const scrapeMutation = useMutation({
    mutationFn: () => triggerScrape(currentUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })


  // Convert real data structure to display format
  const workOrders: RealWorkOrder[] = useMemo(() => {
    if (!rawWorkOrders) return []
    
    // Handle both mock data format and real exported format
    if (Array.isArray(rawWorkOrders)) {
      // Transform flat API response to nested structure
      return rawWorkOrders.map(wo => ({
        basic_info: {
          id: wo.id,
          external_id: wo.external_id,
          brand: wo.site_name?.includes('Wawa') ? 'Wawa' :
                 wo.site_name?.includes('7-Eleven') ? '7-Eleven' :
                 wo.site_name?.includes('Circle K') ? 'Circle K' :
                 wo.site_name?.includes('Shell') ? 'Shell' : 'Unknown',
          store_info: wo.site_name
        },
        location: {
          site_name: wo.site_name,
          address: wo.address
        },
        scheduling: {
          scheduled_date: wo.scheduled_date,
          status: wo.status
        },
        metadata: {
          user_id: 'demo-user',
          username: 'demo-user',
          notes: null,
          created_at: wo.created_at,
          updated_at: wo.updated_at
        },
        dispensers: wo.dispensers || [],
        visit_url: wo.visit_url
      }))
    }
    
    // If it's the exported format with work_orders array
    if (rawWorkOrders.work_orders) {
      return rawWorkOrders.work_orders
    }
    
    return []
  }, [rawWorkOrders])

  // Brand-specific styling (inspired by V1)
  const getBrandStyling = (brand: string) => {
    const lowerBrand = brand.toLowerCase()
    if (lowerBrand.includes('7-eleven') || lowerBrand.includes('speedway')) {
      return 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/10'
    }
    if (lowerBrand.includes('wawa')) {
      return 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'
    }
    if (lowerBrand.includes('circle') && lowerBrand.includes('k')) {
      return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/10'
    }
    if (lowerBrand.includes('shell')) {
      return 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
    }
    return 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
  }

  // Status icon mapping
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    }
  }

  // Clean address formatting - extract just the street address
  const formatAddress = (address: string) => {
    // Extract just the street address line
    const lines = address.split('\n').map(line => line.trim()).filter(Boolean)
    // Usually the street address is the first or second line
    for (const line of lines) {
      // Skip lines that are just store numbers or brand names
      if (!line.match(/^(Store|Site|#\d+|.*Stores?$)/i) && 
          line.match(/\d+.*\w+/) && // Has number and street name
          !line.match(/^\d{5}(-\d{4})?$/)) { // Not just a zip code
        return line
      }
    }
    // Fallback to cleaning the full address
    return address.replace(/\n\s*/g, ', ').replace(/\s{2,}/g, ' ').trim()
  }

  // Extract unique brands for filter
  const availableBrands = useMemo(() => {
    const brands = workOrders.map(wo => wo.basic_info.brand)
    return Array.from(new Set(brands)).sort()
  }, [workOrders])

  // Handle opening visit URL
  const handleOpenVisit = async (workOrderId: string) => {
    try {
      const result = await openWorkOrderVisit(workOrderId, 'demo-user')
      if (result.visit_url) {
        // Open the visit URL in a new tab
        window.open(result.visit_url, '_blank')
      }
    } catch (error) {
      console.error('Failed to open visit URL:', error)
      // Could add a toast notification here
    }
  }

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const searchText = searchTerm.toLowerCase()
      const matchesSearch = 
        wo.location.site_name.toLowerCase().includes(searchText) ||
        wo.basic_info.external_id.toLowerCase().includes(searchText) ||
        wo.location.address.toLowerCase().includes(searchText) ||
        wo.basic_info.brand.toLowerCase().includes(searchText) ||
        wo.basic_info.store_info.toLowerCase().includes(searchText)
      
      const matchesStatus = statusFilter === 'all' || wo.scheduling.status === statusFilter
      const matchesBrand = brandFilter === 'all' || wo.basic_info.brand === brandFilter

      return matchesSearch && matchesStatus && matchesBrand
    })
  }, [workOrders, searchTerm, statusFilter, brandFilter])

  const handleScrape = () => {
    scrapeMutation.mutate()
  }

  const handleStatusUpdate = (workOrderId: string, status: string) => {
    statusUpdateMutation.mutate({ workOrderId, status })
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl">Error Loading Work Orders</CardTitle>
            <CardDescription>Unable to fetch work orders. Please check your connection and try again.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={handleScrape}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Work Orders</h1>
            <p className="text-muted-foreground text-lg mb-2">Manage and monitor fuel dispenser automation tasks</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {filteredWorkOrders.length} of {workOrders.length} work orders
              </span>
              {workOrders.length > 0 && (
                <span>
                  Brands: {availableBrands.join(', ')}
                </span>
              )}
            </div>
          </div>
          
          <Button
            onClick={handleScrape}
            disabled={scrapeMutation.isPending}
            size="lg"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${scrapeMutation.isPending ? 'animate-spin' : ''}`} />
            {scrapeMutation.isPending ? 'Scraping...' : 'Scrape Work Orders'}
          </Button>
        </div>

        {/* Enhanced Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
            </CardTitle>
            <CardDescription>Filter and search work orders by various criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search work orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">All Brands</option>
                {availableBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>

              <div className="flex border border-border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none flex-1"
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none flex-1"
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Work Orders Display */}
      <section className="work-orders-list">
        {isLoading ? (
          <LoadingSpinner message="Loading work orders..." />
        ) : filteredWorkOrders.length > 0 ? (
          <div className={viewMode === 'grid' ? 'work-orders-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'work-orders-list space-y-4'}>
            {filteredWorkOrders.map((workOrder) => (
              <Card key={workOrder.basic_info.id} className={`${getBrandStyling(workOrder.basic_info.brand)} hover:shadow-md transition-shadow`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg leading-none">
                          {workOrder.basic_info.store_info || workOrder.location.site_name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {workOrder.basic_info.brand}
                        </Badge>
                      </div>
                      {workOrder.basic_info.external_id && (
                        <CardDescription className="text-sm">
                          Visit: {workOrder.basic_info.external_id.replace(/^(WO-|#)/, '')}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {/* Location and scheduling */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {formatAddress(workOrder.location.address)}
                      </p>
                    </div>
                    {workOrder.scheduling.scheduled_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Scheduled: {new Date(workOrder.scheduling.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Dispensers Summary */}
                  <div className="dispensers-summary">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">
                        Dispensers ({workOrder.dispensers.length})
                      </h4>
                    </div>
                    <div className="dispensers-grid grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {workOrder.dispensers.map((dispenser) => (
                        <div key={dispenser.id} className="dispenser-item p-3 bg-muted/50 rounded-lg border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              #{dispenser.number}
                            </span>
                            <Badge 
                              variant={dispenser.status === 'completed' ? 'default' : 
                                       dispenser.status === 'failed' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {dispenser.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {dispenser.type}
                          </div>
                          {dispenser.progress_percentage > 0 && (
                            <div className="mb-2">
                              <Progress value={dispenser.progress_percentage} className="h-2" />
                            </div>
                          )}
                          {Object.keys(dispenser.fuel_grades).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Object.keys(dispenser.fuel_grades).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {workOrder.visit_url && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleOpenVisit(workOrder.basic_info.id)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Open Visit in Browser
                      </Button>
                    )}
                  </div>

                  {/* Metadata footer */}
                  <div className="pt-3 border-t text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Created: {new Date(workOrder.metadata.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(workOrder.metadata.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-xl mb-2">No Work Orders Found</CardTitle>
              <CardDescription className="mb-6 max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all' || brandFilter !== 'all'
                  ? 'No work orders match your current filters. Try adjusting your search criteria.'
                  : 'No work orders available. Click "Scrape Work Orders" to fetch data from WorkFossa.'}
              </CardDescription>
              {!searchTerm && statusFilter === 'all' && brandFilter === 'all' && (
                <Button onClick={handleScrape}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scrape Work Orders
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>
      </div>
    </div>
  )
}

export default WorkOrders