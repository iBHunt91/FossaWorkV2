import React, { useState, useEffect } from 'react';
import { DispenserAutomation } from '../components/DispenserAutomation';
import BatchProcessor from '../components/BatchProcessor';
import QueueManager from '../components/QueueManager';
import LoadingSpinner from '../components/LoadingSpinner';
import { Settings, Play, Users, Activity, RefreshCw, FileText, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button';
import { DotsLoader, SkeletonLoader } from '@/components/ui/animated-loader';
import { GradientBackground } from '@/components/ui/animated-background';
import { useAuth } from '../contexts/AuthContext';

interface WorkOrder {
  id: string;
  external_id: string;
  site_name: string;
  address: string;
  scheduled_date: string;
  status: string;
  dispensers?: any[];
}

export const Automation: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'queue'>('single');
  const { user } = useAuth();
  
  const currentUserId = user?.id || 'demo-user';

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/work-orders/${currentUserId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setWorkOrders(data.work_orders || []);
        
        // Auto-select first work order if available
        if (data.work_orders && data.work_orders.length > 0) {
          setSelectedWorkOrder(data.work_orders[0]);
        }
      } else {
        throw new Error(data.message || 'Failed to load work orders');
      }
      
    } catch (error) {
      console.error('Failed to load work orders:', error);
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAutomationComplete = (jobId: string) => {
    console.log('Automation completed for job:', jobId);
    // Optionally refresh work orders to get updated status
    loadWorkOrders();
  };

  const handleAutomationError = (error: string) => {
    console.error('Automation error:', error);
    setError(`Automation failed: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <DotsLoader />
          <AnimatedText text="Loading work orders..." animationType="fade" className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <GradientBackground className="absolute inset-0 opacity-5" />
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8 animate-slide-in-from-top">
          <h1 className="text-4xl font-bold mb-2">
            <GradientText text="Form Automation & Job Management" gradient="from-blue-600 via-purple-600 to-pink-600" />
          </h1>
          <p className="text-muted-foreground text-lg">
            <AnimatedText text="Automate AccuMeasure form filling for fuel dispenser testing workflows" animationType="split" delay={0.2} />
          </p>
          
          {/* Tab Navigation */}
          <div className="mt-6">
            <nav className="flex space-x-2 p-1 bg-muted/50 backdrop-blur-sm rounded-lg">
              <MagneticButton
                onClick={() => setActiveTab('single')}
                variant={activeTab === 'single' ? 'default' : 'ghost'}
                className="flex-1 justify-center"
                strength={0.1}
              >
                <Play className="w-4 h-4 mr-2" />
                Single Work Order
              </MagneticButton>
              <MagneticButton
                onClick={() => setActiveTab('batch')}
                variant={activeTab === 'batch' ? 'default' : 'ghost'}
                className="flex-1 justify-center"
                strength={0.1}
              >
                <Users className="w-4 h-4 mr-2" />
                Batch Processing
              </MagneticButton>
              <MagneticButton
                onClick={() => setActiveTab('queue')}
                variant={activeTab === 'queue' ? 'default' : 'ghost'}
                className="flex-1 justify-center"
                strength={0.1}
              >
                <Activity className="w-4 h-4 mr-2" />
                Job Queue
              </MagneticButton>
            </nav>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6 alert-modern error animate-slide-in-from-right">
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="absolute top-2 right-2"
            >
              ×
            </Button>
          </Alert>
        )}

        {/* Tab Content */}
        {activeTab === 'single' ? (
          /* Single Work Order Automation */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Work Orders Selection */}
            <div className="lg:col-span-1">
              <AnimatedCard animate="slide" delay={0.1} hover="lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg">
                    <ShimmerText text="Work Orders" />
                  </CardTitle>
                  <AnimatedButton
                    onClick={loadWorkOrders}
                    variant="ghost"
                    size="sm"
                    animation="pulse"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </AnimatedButton>
                </CardHeader>
                <CardContent>
                  {workOrders.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground animate-bounce" />
                      <div>
                        <h3 className="font-medium">
                          <AnimatedText text="No work orders" animationType="reveal" />
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          <AnimatedText text="Run the scraping automation first to load work orders." animationType="fade" delay={0.2} />
                        </p>
                      </div>
                      <RippleButton
                        onClick={() => window.location.href = '/dashboard'}
                        size="sm"
                      >
                        Go to Dashboard
                      </RippleButton>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {workOrders.map((workOrder, index) => (
                        <div
                          key={workOrder.id}
                          onClick={() => setSelectedWorkOrder(workOrder)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all animate-scale-in card-hover ${
                            selectedWorkOrder?.id === workOrder.id
                              ? 'border-primary bg-primary/5 glass'
                              : 'border-border hover:border-primary/50'
                          }`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <h3 className="font-medium text-sm">
                                {workOrder.external_id}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {workOrder.site_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {workOrder.address}
                              </p>
                            </div>
                            <Badge 
                              variant={
                                workOrder.status === 'completed' ? 'default' :
                                workOrder.status === 'in_progress' ? 'secondary' :
                                'outline'
                              }
                              className={workOrder.status === 'completed' ? 'badge-gradient' : ''}
                            >
                              {workOrder.status}
                            </Badge>
                          </div>
                          
                          {workOrder.dispensers && workOrder.dispensers.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground">
                                {workOrder.dispensers.length} dispenser{workOrder.dispensers.length !== 1 ? 's' : ''}
                                {workOrder.dispensers.filter(d => d.automation_completed).length > 0 && (
                                  <span className="ml-2 text-green-600">
                                    ({workOrder.dispensers.filter(d => d.automation_completed).length} automated)
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </AnimatedCard>
            </div>

            {/* Single Automation Interface */}
            <div className="lg:col-span-2">
              {selectedWorkOrder ? (
                <DispenserAutomation
                  workOrder={selectedWorkOrder}
                  onComplete={handleAutomationComplete}
                  onError={handleAutomationError}
                />
              ) : (
                <AnimatedCard animate="bounce" hover="glow" className="h-full">
                  <CardContent className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
                    <Zap className="h-12 w-12 text-muted-foreground animate-pulse" />
                    <div>
                      <h3 className="font-medium">
                        <AnimatedText text="Select a work order" animationType="reveal" />
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        <AnimatedText text="Choose a work order from the list to start form automation." animationType="fade" delay={0.2} />
                      </p>
                    </div>
                  </CardContent>
                </AnimatedCard>
              )}
            </div>
          </div>
        ) : activeTab === 'batch' ? (
          /* Batch Processing Interface */
          <BatchProcessor 
            userId={currentUserId}
            onBatchStarted={(batchId) => {
              console.log('Batch started:', batchId);
              // Optionally refresh work orders or show notification
            }}
          />
        ) : (
          /* Job Queue Management Interface */
          <QueueManager 
            userId={currentUserId}
            onJobSubmitted={(jobId) => {
              console.log('Job submitted:', jobId);
              // Optionally show notification
            }}
            onJobCompleted={(jobId) => {
              console.log('Job completed:', jobId);
              // Optionally refresh work orders or show notification
            }}
          />
        )}

        {/* Info Panel */}
        <GlowCard className="mt-8 bg-gradient-to-br from-blue-500/5 to-purple-500/5 animate-slide-in-from-bottom" style={{animationDelay: '0.3s'}}>
          <CardHeader>
            <CardTitle className="text-lg">
              <GradientText 
                text={
                  activeTab === 'single' 
                    ? 'How Single Work Order Automation Works'
                    : activeTab === 'batch'
                    ? 'How Batch Processing Works'
                    : 'How Job Queue Management Works'
                }
                gradient="from-blue-600 to-purple-600"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTab === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.4s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                    Setup
                  </h4>
                  <p className="text-muted-foreground">
                    Provide your WorkFossa credentials and select a work order with dispensers to automate.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.5s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">2</span>
                    Automation
                  </h4>
                  <p className="text-muted-foreground">
                    The system will log into WorkFossa, navigate to the visit page, and automatically fill AccuMeasure forms for each dispenser.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.6s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">3</span>
                    Tracking
                  </h4>
                  <p className="text-muted-foreground">
                    Monitor real-time progress with live updates for each automation phase and individual dispenser progress.
                  </p>
                </div>
              </div>
            ) : activeTab === 'batch' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.4s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                    Selection
                  </h4>
                  <p className="text-muted-foreground">
                    Select multiple work orders to process simultaneously. Configure batch settings like concurrency and retry attempts.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.5s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">2</span>
                    Processing
                  </h4>
                  <p className="text-muted-foreground">
                    The system processes work orders in parallel with intelligent error handling and automatic retries for failed jobs.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.6s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">3</span>
                    Management
                  </h4>
                  <p className="text-muted-foreground">
                    Track batch progress, pause/resume jobs, and get detailed reports on successful and failed automation attempts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.4s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                    Queue Management
                  </h4>
                  <p className="text-muted-foreground">
                    View all automation jobs in a priority-based queue with real-time status updates and resource utilization monitoring.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.5s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">2</span>
                    Job Control
                  </h4>
                  <p className="text-muted-foreground">
                    Start, stop, pause, and cancel individual jobs or the entire queue. Configure priority levels and retry policies.
                  </p>
                </div>
                <div className="space-y-2 animate-fade-in" style={{animationDelay: '0.6s'}}>
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">3</span>
                    Monitoring
                  </h4>
                  <p className="text-muted-foreground">
                    Monitor job execution metrics, success rates, and performance statistics with detailed logging and error tracking.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </GlowCard>
      </div>
    </div>
  );
};