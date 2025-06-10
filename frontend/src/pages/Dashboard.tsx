import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Users, AlertTriangle, CheckCircle, Activity, Settings, RefreshCw } from 'lucide-react'
import { fetchHealthCheck, fetchWorkOrders } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '../components/LoadingSpinner'

const Dashboard: React.FC = () => {
  const { token } = useAuth()

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealthCheck,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // For now, use a generic user ID since we need to implement proper user management
  const { data: workOrders, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['work-orders', token],
    queryFn: () => fetchWorkOrders('authenticated-user'),
    refetchInterval: 60000, // Refetch every minute
    enabled: !!token, // Only run query if authenticated
  })

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  const totalWorkOrders = workOrders?.length || 0
  const pendingWorkOrders = workOrders?.filter(wo => (wo.scheduling?.status || wo.status) === 'pending').length || 0
  const completedWorkOrders = workOrders?.filter(wo => (wo.scheduling?.status || wo.status) === 'completed').length || 0
  const inProgressWorkOrders = workOrders?.filter(wo => (wo.scheduling?.status || wo.status) === 'in_progress').length || 0
  
  const completionRate = totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0

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
    if (!status) return 'text-gray-600 bg-gray-50'
    switch (status) {
      case 'pending':
        return 'text-amber-600 bg-amber-50'
      case 'in_progress':
        return 'text-blue-600 bg-blue-50'
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">FossaWork V2 Dashboard</h1>
          <p className="text-xl text-muted-foreground">Modern Fuel Dispenser Automation System</p>
        </header>

        {/* System Status Alert */}
        <Alert className={health?.status === 'healthy' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <Activity className={`h-4 w-4 ${health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`} />
          <AlertDescription className={health?.status === 'healthy' ? 'text-green-800' : 'text-red-800'}>
            <span className="font-medium">
              {health?.status === 'healthy' ? 'All systems operational' : 'System issues detected'}
            </span>
            {health?.database && (
              <span className="ml-2 text-sm">Database: {health.database}</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                All work orders in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{pendingWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{inProgressWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                Currently processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                Successfully processed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        {totalWorkOrders > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Overall Progress</CardTitle>
              <CardDescription>
                Completion rate for all work orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completion Rate</span>
                  <span>{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Work Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Work Orders</CardTitle>
              <CardDescription>
                Latest 5 work orders in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workOrdersLoading ? (
                <div className="flex justify-center p-8">
                  <LoadingSpinner />
                </div>
              ) : workOrders && workOrders.length > 0 ? (
                <div className="space-y-4">
                  {workOrders.slice(0, 5).map((workOrder) => (
                    <div key={workOrder.basic_info?.id || workOrder.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                      <div className="space-y-1">
                        <h4 className="font-medium">{workOrder.location?.site_name || workOrder.site_name || 'Unknown Site'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {(workOrder.location?.address || workOrder.address || 'No address').split('\n')[0]}
                        </p>
                        {(workOrder.basic_info?.external_id || workOrder.external_id) && (
                          <p className="text-xs text-muted-foreground">
                            Visit: {(workOrder.basic_info?.external_id || workOrder.external_id).replace(/^(WO-|#)/, '')}
                          </p>
                        )}
                      </div>
                      {workOrder.visit_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(workOrder.visit_url, '_blank')}
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No work orders found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Scrape Work Orders" to fetch data from the system.
                  </p>
                  <Button onClick={() => window.location.href = '/work-orders?action=scrape'}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Scrape Work Orders
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and navigation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                onClick={() => window.location.href = '/work-orders'}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View All Work Orders
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/work-orders?action=scrape'}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Scrape Work Orders
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/automation'}
              >
                <Activity className="h-4 w-4 mr-2" />
                Automation Dashboard
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/settings'}
              >
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Dashboard