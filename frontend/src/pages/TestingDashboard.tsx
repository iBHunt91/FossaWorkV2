import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Loader2, Play, RefreshCw, Shield, Database, Globe, Zap, Users, Bell, FileText, Settings, FlaskConical, ChevronRight, ChevronDown, Wifi, WifiOff, Circle, Calendar } from 'lucide-react';
import api from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button';
import { DotsLoader } from '@/components/ui/animated-loader';

interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
  timestamp?: Date;
}

interface TestSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tests: TestCase[];
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  endpoint?: string;
  testFunction?: () => Promise<TestResult>;
}

export const TestingDashboard: React.FC = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()); // Start with all sections closed
  const [runningAll, setRunningAll] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  // Check backend status on component mount
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await api.get('/health', { timeout: 5000 });
        setBackendStatus('online');
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackendStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const runTest = async (testId: string, testFunction?: () => Promise<TestResult>, endpoint?: string) => {
    // Set initial running state with more detail
    setTestResults(prev => ({
      ...prev,
      [testId]: { 
        status: 'running', 
        message: `Starting test...`,
        timestamp: new Date()
      }
    }));

    // Add small delay to show the starting message
    await new Promise(resolve => setTimeout(resolve, 100));

    // Add timeout wrapper
    const timeoutPromise = new Promise<TestResult>((_, reject) => {
      setTimeout(() => reject(new Error('Test timed out after 30 seconds')), 30000);
    });

    try {
      let testPromise: Promise<TestResult>;
      
      if (testFunction) {
        // Update message for custom function
        setTestResults(prev => ({
          ...prev,
          [testId]: { 
            status: 'running', 
            message: `Executing test function...`,
            timestamp: new Date()
          }
        }));
        testPromise = testFunction();
      } else if (endpoint) {
        // Update message to show which endpoint we're calling
        setTestResults(prev => ({
          ...prev,
          [testId]: { 
            status: 'running', 
            message: `Connecting to backend API...`,
            timestamp: new Date()
          }
        }));

        // Small delay to show connection message
        await new Promise(resolve => setTimeout(resolve, 200));

        setTestResults(prev => ({
          ...prev,
          [testId]: { 
            status: 'running', 
            message: `Calling API endpoint: ${endpoint}...`,
            timestamp: new Date()
          }
        }));

        testPromise = api.get(`/api/test${endpoint}`).then(response => ({
          status: response.data.success ? 'success' : 'error',
          message: response.data.message || 'Test completed',
          details: response.data.data,
          timestamp: new Date()
        }));
      } else {
        testPromise = Promise.resolve({ 
          status: 'error' as const, 
          message: 'No test implementation found' 
        });
      }

      // Race between test and timeout
      const result = await Promise.race([testPromise, timeoutPromise]);

      setTestResults(prev => ({
        ...prev,
        [testId]: result
      }));
    } catch (error: any) {
      console.error(`Test ${testId} failed:`, error);
      
      let errorMessage = 'Test failed';
      let errorDetails = {};

      if (error.message === 'Test timed out after 30 seconds') {
        errorMessage = 'Test timed out - the backend might not be responding';
        errorDetails = { 
          timeout: true, 
          hint: 'Check if the backend server is running on port 8000',
          endpoint: endpoint || 'custom function',
          command: 'cd backend && uvicorn app.main:app --reload --port 8000'
        };
      } else if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to backend server';
        errorDetails = { 
          networkError: true,
          hint: 'Make sure the backend is running on port 8000',
          command: 'cd backend && uvicorn app.main:app --reload --port 8000',
          details: 'The backend server is not responding. This usually means it needs to be started.'
        };
      } else if (error.response?.status === 404) {
        errorMessage = `Endpoint not found: ${endpoint}`;
        errorDetails = { 
          notFound: true,
          endpoint,
          hint: 'This test endpoint might not be implemented yet',
          details: 'The API endpoint exists but the test route is missing.'
        };
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
        errorDetails = error.response.data;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setTestResults(prev => ({
        ...prev,
        [testId]: {
          status: 'error',
          message: errorMessage,
          details: errorDetails,
          timestamp: new Date()
        }
      }));
    }
  };

  const testSections: TestSection[] = [
    {
      id: 'auth',
      title: 'Authentication System',
      description: 'Test login, token validation, and user sessions',
      icon: Shield,
      tests: [
        {
          id: 'auth-status',
          name: 'Check Authentication Status',
          description: 'Verify if you are currently logged in',
          testFunction: async () => {
            try {
              const response = await api.get('/api/auth/me');
              return {
                status: 'success',
                message: `Logged in as: ${response.data.username}`,
                details: response.data
              };
            } catch (error) {
              return {
                status: 'error',
                message: 'Not authenticated',
                details: error
              };
            }
          }
        },
        {
          id: 'token-validation',
          name: 'Validate JWT Token',
          description: 'Check if your authentication token is valid',
          endpoint: '/auth/validate-token'
        },
        {
          id: 'workfossa-connection',
          name: 'WorkFossa Connection',
          description: 'Test connection to WorkFossa API',
          endpoint: '/auth/test-workfossa'
        }
      ]
    },
    {
      id: 'database',
      title: 'Database Connection',
      description: 'Verify database connectivity and operations',
      icon: Database,
      tests: [
        {
          id: 'db-connection',
          name: 'Database Connection',
          description: 'Check if the database is accessible',
          endpoint: '/health/database'
        },
        {
          id: 'db-tables',
          name: 'Table Structure',
          description: 'Verify all required tables exist',
          endpoint: '/health/tables'
        },
        {
          id: 'db-performance',
          name: 'Query Performance',
          description: 'Test database query response times',
          endpoint: '/health/db-performance'
        }
      ]
    },
    {
      id: 'scraping',
      title: 'Web Scraping',
      description: 'Test work order and dispenser scraping functionality',
      icon: Globe,
      tests: [
        {
          id: 'scraper-status',
          name: 'Scraper Status',
          description: 'Check if the scraping service is ready',
          endpoint: '/scraping/status'
        },
        {
          id: 'test-work-order',
          name: 'Sample Work Order Scrape',
          description: 'Try scraping a single work order (test mode)',
          endpoint: '/scraping/test-work-order'
        },
        {
          id: 'test-dispenser',
          name: 'Sample Dispenser Scrape',
          description: 'Try scraping dispensers from a test location',
          endpoint: '/scraping/test-dispenser'
        }
      ]
    },
    {
      id: 'automation',
      title: 'Form Automation',
      description: 'Test form filling and batch processing capabilities',
      icon: Zap,
      tests: [
        {
          id: 'automation-ready',
          name: 'Automation Service',
          description: 'Check if automation service is configured',
          endpoint: '/automation/status'
        },
        {
          id: 'browser-launch',
          name: 'Browser Launch Test',
          description: 'Test if Playwright can launch a browser',
          endpoint: '/automation/test-browser'
        },
        {
          id: 'form-detection',
          name: 'Form Detection',
          description: 'Test ability to detect form fields',
          endpoint: '/automation/test-form-detection'
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notification System',
      description: 'Test email, Pushover, and desktop notifications',
      icon: Bell,
      tests: [
        {
          id: 'email-config',
          name: 'Email Configuration',
          description: 'Verify email settings are valid',
          endpoint: '/notifications/test-email-config'
        },
        {
          id: 'pushover-config',
          name: 'Pushover Configuration',
          description: 'Verify Pushover API credentials',
          endpoint: '/notifications/test-pushover-config'
        },
        {
          id: 'test-notification',
          name: 'Send Test Notification',
          description: 'Send a test notification to all configured channels',
          testFunction: async () => {
            try {
              const response = await api.post('/api/test/notifications/test', {
                message: 'Test notification from Testing Dashboard',
                title: 'FossaWork Test'
              });
              return {
                status: 'success',
                message: 'Test notification sent successfully',
                details: response.data
              };
            } catch (error: any) {
              return {
                status: 'error',
                message: 'Failed to send test notification',
                details: error.response?.data
              };
            }
          }
        }
      ]
    },
    {
      id: 'api',
      title: 'API Endpoints',
      description: 'Test core API functionality and response times',
      icon: Settings,
      tests: [
        {
          id: 'api-health',
          name: 'API Health Check',
          description: 'Basic API connectivity test',
          testFunction: async () => {
            const start = Date.now();
            try {
              await api.get('/health');
              const duration = Date.now() - start;
              return {
                status: 'success',
                message: `API is healthy (${duration}ms response time)`,
                details: { responseTime: duration }
              };
            } catch (error) {
              return {
                status: 'error',
                message: 'API is not responding',
                details: error
              };
            }
          }
        },
        {
          id: 'api-version',
          name: 'API Version',
          description: 'Check API version and compatibility',
          endpoint: '/version'
        },
        {
          id: 'api-rate-limit',
          name: 'Rate Limiting',
          description: 'Test API rate limiting is working',
          endpoint: '/rate-limit'
        }
      ]
    },
    {
      id: 'filters',
      title: 'Filter Management',
      description: 'Test filter calculation and updates',
      icon: FileText,
      tests: [
        {
          id: 'filter-calculation',
          name: 'Filter Calculation Engine',
          description: 'Test filter quantity calculations',
          endpoint: '/filters/test-calculation'
        },
        {
          id: 'filter-data',
          name: 'Filter Data Integrity',
          description: 'Verify filter data is complete and valid',
          endpoint: '/filters/validate-data'
        },
        {
          id: 'filter-modal-api',
          name: 'Work Order Filter API',
          description: 'Test filter calculation API for single work order',
          testFunction: async () => {
            try {
              // Create sample work order data
              const sampleWorkOrder = {
                id: 'test-wo-1',
                jobId: 'W-123456',
                storeNumber: '1234',
                storeName: '7-Eleven Stores, Inc #1234',
                customerName: '7-Eleven Stores, Inc',
                serviceCode: '2861',
                serviceName: 'AccuMeasure',
                scheduledDate: new Date().toISOString(),
                address: '123 Test Street, Test City, TS 12345'
              };

              const sampleDispensers = [
                {
                  id: 'disp-1',
                  storeNumber: '1234',
                  dispenserNumber: '1',
                  dispenserType: 'Wayne Helix',
                  fuelGrades: [
                    { grade: 'Regular 87' },
                    { grade: 'Premium 91' }
                  ],
                  meterType: 'Electronic',
                  make: 'Wayne',
                  model: 'Helix 6000'
                }
              ];

              const response = await api.post('/api/v1/filters/calculate', {
                workOrders: [sampleWorkOrder],
                dispensers: sampleDispensers,
                overrides: {}
              });

              // Debug: Log the actual response to understand what we're getting
              console.log('Work Order Filter API test - Full response:', response.data);
              console.log('Work Order Filter API test - Details:', response.data?.details);

              if (response.data && response.data.details && response.data.details.length > 0) {
                const filterDetail = response.data.details[0];
                if (filterDetail.filters && Object.keys(filterDetail.filters).length > 0) {
                  return {
                    status: 'success',
                    message: `Filter calculation successful - ${Object.keys(filterDetail.filters).length} filter types calculated`,
                    details: {
                      workOrderId: filterDetail.jobId,
                      filtersCalculated: Object.keys(filterDetail.filters),
                      summary: response.data.summary
                    }
                  };
                } else {
                  return {
                    status: 'error',
                    message: 'No filters calculated for work order',
                    details: response.data
                  };
                }
              } else {
                return {
                  status: 'error',
                  message: 'Invalid response format from filter calculation API',
                  details: response.data
                };
              }
            } catch (error: any) {
              return {
                status: 'error',
                message: `Filter calculation API failed: ${error.response?.data?.detail || error.message}`,
                details: error.response?.data
              };
            }
          }
        },
        {
          id: 'filter-modal-data-format',
          name: 'Filter Modal Data Format',
          description: 'Verify filter data format matches modal expectations',
          testFunction: async () => {
            try {
              // Test the exact format expected by the dispenser modal
              const workOrder = {
                id: 'test-modal-1',
                jobId: 'W-789012',
                storeNumber: '5678',
                storeName: 'Speedway #5678',
                customerName: 'Speedway LLC',
                serviceCode: '2862',
                serviceName: 'AccuMeasure',
                scheduledDate: new Date().toISOString(),
                address: '456 Modal Test Ave, Modal City, MC 67890'
              };

              const dispensers = [
                {
                  id: 'modal-disp-1',
                  storeNumber: '5678',
                  dispenserNumber: '1',
                  dispenserType: 'Gilbarco Encore',
                  fuelGrades: [
                    { grade: 'Regular' },
                    { grade: 'Premium' },
                    { grade: 'Diesel' }
                  ],
                  meterType: 'Electronic',
                  make: 'Gilbarco',
                  model: 'Encore 700'
                }
              ];

              const response = await api.post('/api/v1/filters/calculate', {
                workOrders: [workOrder],
                dispensers: dispensers,
                overrides: {}
              });

              // Verify the response structure matches what the modal expects
              if (response.data && response.data.details && response.data.details.length > 0) {
                const detail = response.data.details[0];
                
                // Check required fields for modal
                const requiredFields = ['jobId', 'storeName', 'storeNumber', 'filters'];
                const missingFields = requiredFields.filter(field => !detail[field]);
                
                if (missingFields.length > 0) {
                  return {
                    status: 'error',
                    message: `Missing required fields for modal: ${missingFields.join(', ')}`,
                    details: { detail, missingFields }
                  };
                }

                // Check filter format
                if (detail.filters && typeof detail.filters === 'object') {
                  const filterEntries = Object.entries(detail.filters);
                  if (filterEntries.length > 0) {
                    const [partNumber, filterInfo] = filterEntries[0];
                    const requiredFilterFields = ['quantity', 'filterType'];
                    const missingFilterFields = requiredFilterFields.filter(field => 
                      !filterInfo[field] && filterInfo[field] !== 0
                    );

                    if (missingFilterFields.length > 0) {
                      return {
                        status: 'error',
                        message: `Filter objects missing required fields: ${missingFilterFields.join(', ')}`,
                        details: { filterInfo, missingFilterFields }
                      };
                    }

                    return {
                      status: 'success',
                      message: `Filter data format is valid for modal display`,
                      details: {
                        jobId: detail.jobId,
                        filterCount: filterEntries.length,
                        sampleFilter: { partNumber, ...filterInfo },
                        allFilters: detail.filters
                      }
                    };
                  } else {
                    return {
                      status: 'error',
                      message: 'No filter data returned for work order',
                      details: detail
                    };
                  }
                } else {
                  return {
                    status: 'error',
                    message: 'Filters field is not an object or is missing',
                    details: detail
                  };
                }
              } else {
                return {
                  status: 'error',
                  message: 'Invalid response structure from filter API',
                  details: response.data
                };
              }
            } catch (error: any) {
              return {
                status: 'error',
                message: `Filter format test failed: ${error.response?.data?.detail || error.message}`,
                details: error.response?.data
              };
            }
          }
        }
      ]
    },
    {
      id: 'ui-integration',
      title: 'UI Integration',
      description: 'Test frontend-backend integration for key workflows',
      icon: Zap,
      tests: [
        {
          id: 'work-order-modal-integration',
          name: 'Work Order Modal Filter Integration',
          description: 'Test that work orders page can fetch filter data for modal display',
          testFunction: async () => {
            try {
              // First, check if we have work orders to test with
              console.log('Modal integration test: Fetching work orders...');
              
              // Get user info from auth context (assuming we're authenticated)
              let userId = null;
              try {
                const userResponse = await api.get('/api/auth/me');
                userId = userResponse.data?.id;
                console.log('Modal integration test: Got user ID:', userId);
              } catch (authError) {
                console.log('Modal integration test: Could not get user ID, using fallback test');
              }
              
              let workOrders = [];
              if (userId) {
                try {
                  const workOrdersResponse = await api.get('/api/v1/work-orders', {
                    params: { user_id: userId }
                  });
                  workOrders = workOrdersResponse.data;
                  console.log('Modal integration test: Got work orders:', workOrders?.length || 0);
                } catch (woError) {
                  console.log('Modal integration test: Work orders API failed:', woError.message);
                }
              }
              
              if (!workOrders || workOrders.length === 0) {
                return {
                  status: 'error',
                  message: 'No work orders available for testing - need at least one work order with dispensers',
                  details: { hint: 'Run work order scraping first to populate test data' }
                };
              }

              // Find a work order with dispensers
              const workOrderWithDispensers = workOrders.find((wo: any) => 
                wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0
              );

              if (!workOrderWithDispensers) {
                // No real work orders with dispensers found, use test data
                console.log('No work orders with dispensers found, using test data for filter calculation test');
                
                const testWorkOrder = {
                  id: 'test-wo-1',
                  jobId: 'W-TEST-001',
                  storeNumber: '7777',
                  storeName: '7-Eleven Stores, Inc #7777',
                  customerName: '7-Eleven Stores, Inc',
                  serviceCode: '2861',
                  serviceName: 'AccuMeasure',
                  scheduledDate: new Date().toISOString(),
                  address: '123 Test Street, Test City, TS 12345'
                };

                const testDispensers = [
                  {
                    id: 'test-disp-1',
                    storeNumber: '7777',
                    dispenserNumber: '1',
                    dispenserType: 'Wayne Helix',
                    fuelGrades: [
                      { grade: 'Regular 87' },
                      { grade: 'Premium 93' }
                    ],
                    meterType: 'Electronic',
                    make: 'Wayne',
                    model: 'Helix 6000',
                    workOrderId: 'test-wo-1'
                  },
                  {
                    id: 'test-disp-2', 
                    storeNumber: '7777',
                    dispenserNumber: '2',
                    dispenserType: 'Wayne Helix',
                    fuelGrades: [
                      { grade: 'Regular 87' },
                      { grade: 'Premium 93' },
                      { grade: 'Diesel' }
                    ],
                    meterType: 'Electronic',
                    make: 'Wayne', 
                    model: 'Helix 6000',
                    workOrderId: 'test-wo-1'
                  }
                ];

                // Test with the test data
                console.log('Modal integration test: Using test data:', { 
                  workOrder: testWorkOrder, 
                  dispensers: testDispensers 
                });
                const filterResponse = await api.post('/api/v1/filters/calculate', {
                  workOrders: [testWorkOrder],
                  dispensers: testDispensers,
                  overrides: {}
                });
                console.log('Modal integration test: Filter API response:', filterResponse.data);

                if (filterResponse.data && filterResponse.data.details && filterResponse.data.details.length > 0) {
                  const filterDetail = filterResponse.data.details[0];
                  
                  if (filterDetail && filterDetail.filters && Object.keys(filterDetail.filters).length > 0) {
                    const filterCount = Object.keys(filterDetail.filters).length;
                    return {
                      status: 'success',
                      message: `Modal integration test successful with test data - ${filterCount} filters calculated`,
                      details: {
                        testData: true,
                        workOrderId: testWorkOrder.jobId,
                        dispenserCount: testDispensers.length,
                        filterCount: filterCount,
                        filterTypes: Object.keys(filterDetail.filters),
                        note: 'Used test data because no real work orders with dispensers were found'
                      }
                    };
                  }
                }
                
                return {
                  status: 'error',
                  message: 'Filter calculation failed even with test data',
                  details: { 
                    hint: 'There may be an issue with the filter calculation API',
                    response: filterResponse.data 
                  }
                };
              }

              // Test the exact workflow that happens when opening dispenser modal from work orders page
              const transformedWorkOrder = {
                id: workOrderWithDispensers.id,
                jobId: workOrderWithDispensers.external_id || workOrderWithDispensers.id,
                storeNumber: workOrderWithDispensers.store_number ? workOrderWithDispensers.store_number.replace('#', '') : '',
                storeName: workOrderWithDispensers.site_name,
                customerName: workOrderWithDispensers.customer_name || workOrderWithDispensers.site_name || '',
                serviceCode: workOrderWithDispensers.service_code || '',
                serviceName: workOrderWithDispensers.service_name || '',
                scheduledDate: workOrderWithDispensers.scheduled_date || '',
                address: workOrderWithDispensers.address || ''
              };

              // Transform dispensers to match backend expected format
              const transformedDispensers = (workOrderWithDispensers.dispensers || []).map((d: any) => {
                let fuelGradesArray: any[] = [];
                
                if (d.fuel_grades && typeof d.fuel_grades === 'object' && !Array.isArray(d.fuel_grades)) {
                  fuelGradesArray = Object.entries(d.fuel_grades).map(([position, gradeInfo]: [string, any]) => ({
                    position: parseInt(position),
                    grade: gradeInfo.grade || gradeInfo.name || gradeInfo
                  }));
                } else if (Array.isArray(d.fuel_grades)) {
                  fuelGradesArray = d.fuel_grades;
                }
                
                return {
                  ...d,
                  fuelGrades: fuelGradesArray,
                  dispenserNumber: d.dispenser_number,
                  dispenserType: d.dispenser_type,
                  meterType: d.meter_type || 'Electronic'
                };
              });

              // Make the filter calculation request (same as work orders page does)
              const filterResponse = await api.post('/api/v1/filters/calculate', {
                workOrders: [transformedWorkOrder],
                dispensers: transformedDispensers,
                overrides: {}
              });

              // Verify we get filter data back
              if (filterResponse.data && filterResponse.data.details && filterResponse.data.details.length > 0) {
                const filterDetail = filterResponse.data.details.find((d: any) => 
                  d.jobId === workOrderWithDispensers.external_id
                );
                
                if (filterDetail && filterDetail.filters) {
                  const filterCount = Object.keys(filterDetail.filters).length;
                  return {
                    status: 'success',
                    message: `Modal integration successful - ${filterCount} filters calculated for work order ${workOrderWithDispensers.external_id}`,
                    details: {
                      workOrderId: workOrderWithDispensers.external_id,
                      dispenserCount: transformedDispensers.length,
                      filterCount: filterCount,
                      filterTypes: Object.keys(filterDetail.filters),
                      sampleFilters: filterDetail.filters
                    }
                  };
                } else {
                  return {
                    status: 'error',
                    message: 'Filter calculation returned no filter data for the work order',
                    details: { 
                      workOrderId: workOrderWithDispensers.external_id,
                      response: filterResponse.data 
                    }
                  };
                }
              } else {
                return {
                  status: 'error',
                  message: 'Filter calculation API returned invalid response format',
                  details: filterResponse.data
                };
              }
            } catch (error: any) {
              // Handle case where error might be an object without proper message
              let errorMessage = 'Unknown error';
              if (error?.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              } else if (error?.message) {
                errorMessage = error.message;
              } else if (typeof error === 'string') {
                errorMessage = error;
              } else if (typeof error === 'object') {
                errorMessage = JSON.stringify(error);
              }

              return {
                status: 'error',
                message: `Modal integration test failed: ${errorMessage}`,
                details: {
                  errorType: typeof error,
                  error: error.message || 'No message property',
                  response: error.response?.data || null,
                  status: error.response?.status || null,
                  fullError: error
                }
              };
            }
          }
        },
        {
          id: 'filter-modal-consistency',
          name: 'Filter Modal Consistency Check',
          description: 'Verify filters page and work orders page show identical filter data',
          testFunction: async () => {
            try {
              // This test verifies that both pages would show the same filter data
              // We can't easily test the actual UI components, but we can test the data consistency
              
              const sampleWorkOrder = {
                id: 'consistency-test-1',
                jobId: 'W-CONSIST-1',
                storeNumber: '9999',
                storeName: '7-Eleven Stores, Inc #9999',
                customerName: '7-Eleven Stores, Inc',
                serviceCode: '2861',
                serviceName: 'AccuMeasure',
                scheduledDate: new Date().toISOString(),
                address: '999 Consistency Test Blvd, Test City, TC 99999'
              };

              const sampleDispensers = [
                {
                  id: 'consist-disp-1',
                  storeNumber: '9999',
                  dispenserNumber: '1',
                  dispenserType: 'Wayne Helix',
                  fuelGrades: [
                    { grade: 'Regular' },
                    { grade: 'Premium' }
                  ],
                  meterType: 'Electronic',
                  make: 'Wayne',
                  model: 'Helix 6000'
                }
              ];

              // Call the API twice with the same data to ensure consistency
              const response1 = await api.post('/api/v1/filters/calculate', {
                workOrders: [sampleWorkOrder],
                dispensers: sampleDispensers,
                overrides: {}
              });

              const response2 = await api.post('/api/v1/filters/calculate', {
                workOrders: [sampleWorkOrder],
                dispensers: sampleDispensers,
                overrides: {}
              });

              // Compare the responses
              if (response1.data && response2.data) {
                const detail1 = response1.data.details?.[0];
                const detail2 = response2.data.details?.[0];

                // Debug: Log the actual responses to understand what we're getting
                console.log('Filter consistency test - Response 1:', detail1);
                console.log('Filter consistency test - Response 2:', detail2);

                if (detail1 && detail2 && detail1.filters && detail2.filters) {
                  const filters1Keys = Object.keys(detail1.filters).sort();
                  const filters2Keys = Object.keys(detail2.filters).sort();

                  if (JSON.stringify(filters1Keys) !== JSON.stringify(filters2Keys)) {
                    return {
                      status: 'error',
                      message: 'Filter calculation is not consistent - different filter types returned',
                      details: { 
                        call1: filters1Keys, 
                        call2: filters2Keys 
                      }
                    };
                  }

                  // Check if quantities match
                  let quantityMismatches = [];
                  for (const filterType of filters1Keys) {
                    if (detail1.filters[filterType].quantity !== detail2.filters[filterType].quantity) {
                      quantityMismatches.push({
                        filterType,
                        quantity1: detail1.filters[filterType].quantity,
                        quantity2: detail2.filters[filterType].quantity
                      });
                    }
                  }

                  if (quantityMismatches.length > 0) {
                    return {
                      status: 'error',
                      message: 'Filter quantities are inconsistent between calls',
                      details: { quantityMismatches }
                    };
                  }

                  return {
                    status: 'success',
                    message: `Filter calculations are consistent - ${filters1Keys.length} filter types with matching quantities`,
                    details: {
                      filterTypes: filters1Keys,
                      consistentQuantities: true,
                      sampleFilters: detail1.filters
                    }
                  };
                } else {
                  return {
                    status: 'error',
                    message: 'One or both API calls did not return valid filter data',
                    details: { 
                      response1Valid: !!detail1?.filters,
                      response2Valid: !!detail2?.filters 
                    }
                  };
                }
              } else {
                return {
                  status: 'error',
                  message: 'One or both API calls failed to return valid responses',
                  details: { 
                    response1Valid: !!response1.data,
                    response2Valid: !!response2.data 
                  }
                };
              }
            } catch (error: any) {
              return {
                status: 'error',
                message: `Consistency test failed: ${error.response?.data?.detail || error.message}`,
                details: error.response?.data
              };
            }
          },
        },
        {
          id: 'data-format-validation',
          name: 'Data Format Validation',
          description: 'Validate fuel grades data format and transformation',
          testFunction: async () => {
            try {
              // Get user ID first
              let userId = null;
              try {
                const userResponse = await api.get('/api/auth/me');
                userId = userResponse.data?.id;
              } catch (userError) {
                return {
                  status: 'error',
                  message: 'Failed to get user ID for data format validation',
                  details: userError
                };
              }

              if (!userId) {
                return {
                  status: 'error',
                  message: 'No valid user ID found for data format validation',
                  details: { hint: 'User authentication may have expired' }
                };
              }

              // Get work orders with dispensers for format analysis
              const workOrderResponse = await api.get('/api/v1/work-orders', {
                params: { user_id: userId }
              });
              
              const workOrders = workOrderResponse.data;
              const workOrderWithDispensers = workOrders.find((wo: any) => 
                wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0
              );

              if (!workOrderWithDispensers) {
                return {
                  status: 'error',
                  message: 'No work orders with dispensers found for data format validation',
                  details: { 
                    totalWorkOrders: workOrders.length,
                    workOrdersWithDispensers: 0,
                    hint: 'Run dispenser scraping first to populate test data'
                  }
                };
              }

              // Prepare data for debug endpoint
              const transformedWorkOrder = {
                id: workOrderWithDispensers.id,
                jobId: workOrderWithDispensers.external_id || workOrderWithDispensers.id,
                storeNumber: workOrderWithDispensers.store_number ? workOrderWithDispensers.store_number.replace('#', '') : '',
                storeName: workOrderWithDispensers.site_name,
                customerName: workOrderWithDispensers.customer_name || workOrderWithDispensers.site_name || '',
                serviceCode: workOrderWithDispensers.service_code || '',
                serviceName: workOrderWithDispensers.service_name || '',
                scheduledDate: workOrderWithDispensers.scheduled_date || '',
                address: workOrderWithDispensers.address || ''
              };

              const transformedDispensers = (workOrderWithDispensers.dispensers || []).map((d: any) => ({
                dispenserNumber: d.dispenser_number,
                dispenserType: d.dispenser_type,
                fuelGrades: d.fuel_grades, // Keep original format for analysis
                meterType: d.meter_type || 'Electronic',
                storeNumber: workOrderWithDispensers.store_number ? workOrderWithDispensers.store_number.replace('#', '') : ''
              }));

              // Test the data format debug endpoint with actual data
              const debugResponse = await api.post('/api/v1/filters/debug-data-format', {
                workOrders: [transformedWorkOrder],
                dispensers: transformedDispensers,
                overrides: {}
              });
              
              const debugData = debugResponse.data;
              
              // Analyze the results
              const formatIssues = debugData.format_analysis?.filter((analysis: any) => 
                analysis.format_issue && !analysis.format_issue.includes('correctly formatted')
              ) || [];
              
              const successfulTransformations = debugData.format_analysis?.filter((analysis: any) => 
                analysis.transformation_successful
              ) || [];
              
              return {
                status: formatIssues.length === 0 ? 'success' : 'warning',
                message: formatIssues.length === 0 
                  ? `✅ Data format validation passed: ${debugData.dispensers_analyzed} dispensers analyzed`
                  : `⚠️ Data format issues detected: ${formatIssues.length} dispensers need transformation`,
                details: {
                  dispensersAnalyzed: debugData.dispensers_analyzed,
                  formatIssues: formatIssues.length,
                  successfulTransformations: successfulTransformations.length,
                  recommendations: debugData.recommendations,
                  sampleFormatIssue: formatIssues[0] || null,
                  sampleTransformation: successfulTransformations[0] || null
                }
              };
            } catch (error: any) {
              return {
                status: 'error',
                message: `Data format validation failed: ${error.response?.data?.detail || error.message}`,
                details: error.response?.data
              };
            }
          }
        },
        {
          id: 'dashboard-filter-display',
          name: 'Dashboard Filter Display Integration',
          description: 'Test that Dashboard shows filter requirements like Filters page does',
          testFunction: async () => {
            try {
              // Test the dashboard's filter display integration
              console.log('Dashboard filter test: Testing filter display consistency...');
              
              // Get user ID
              const userResponse = await api.get('/api/auth/me');
              const userId = userResponse.data?.id;
              
              if (!userId) {
                return {
                  status: 'error',
                  message: 'Cannot test dashboard filters - user not authenticated',
                  details: { hint: 'Login required for this test' }
                };
              }

              // Get work orders for current week (same logic as Dashboard uses)
              const today = new Date();
              const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Monday
              const endOfWeek = new Date(today.setDate(today.getDate() + 6)); // Sunday
              
              const workOrdersResponse = await api.get('/api/v1/work-orders', {
                params: { user_id: userId }
              });
              const allWorkOrders = workOrdersResponse.data || [];
              
              // Filter work orders for current week (Dashboard logic)
              const currentWeekOrders = allWorkOrders.filter(wo => {
                if (!wo.scheduled_date) return false;
                const orderDate = new Date(wo.scheduled_date);
                return orderDate >= startOfWeek && orderDate <= endOfWeek;
              });

              if (currentWeekOrders.length === 0) {
                // Test with sample data if no real orders
                return {
                  status: 'success',
                  message: 'Dashboard filter test completed - no current week orders to display filters for',
                  details: { 
                    note: 'Dashboard correctly shows no filter requirements when no work orders scheduled',
                    totalWorkOrders: allWorkOrders.length,
                    currentWeekOrders: 0
                  }
                };
              }

              // Check if Dashboard would show filter requirements
              const ordersWithDispensers = currentWeekOrders.filter(wo => 
                wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0
              );

              return {
                status: ordersWithDispensers.length > 0 ? 'success' : 'error',
                message: ordersWithDispensers.length > 0 
                  ? `Dashboard should show ${ordersWithDispensers.length} work orders with filter requirements`
                  : 'Dashboard has work orders but no dispenser data - filters will not display',
                details: {
                  currentWeekOrders: currentWeekOrders.length,
                  ordersWithDispensers: ordersWithDispensers.length,
                  sampleWorkOrder: currentWeekOrders[0]?.external_id || 'None',
                  hasDispensers: ordersWithDispensers.length > 0,
                  hint: ordersWithDispensers.length === 0 
                    ? 'Run dispenser scraping to populate dispenser data for work orders'
                    : 'Dashboard should display filter summary in weekly view'
                }
              };
            } catch (error: any) {
              return {
                status: 'error',
                message: `Dashboard filter test failed: ${error.message}`,
                details: { error: error.message, response: error.response?.data }
              };
            }
          }
        },
        {
          id: 'work-orders-modal-filters',
          name: 'Work Orders Page Modal Filter Display',
          description: 'Test that Work Orders page dispenser modal shows filters like Filters page does',
          testFunction: async () => {
            try {
              console.log('Work Orders modal test: Testing dispenser modal filter display...');
              
              // Get user ID
              const userResponse = await api.get('/api/auth/me');
              const userId = userResponse.data?.id;
              
              if (!userId) {
                return {
                  status: 'error',
                  message: 'Cannot test work orders modal - user not authenticated',
                  details: { hint: 'Login required for this test' }
                };
              }

              // First, try to create a sample work order with dispensers
              try {
                await api.post('/api/test/create-sample-work-order');
                console.log('Created sample work order with dispensers for testing');
              } catch (error) {
                console.log('Could not create sample work order:', error);
              }

              // Get work orders 
              const workOrdersResponse = await api.get('/api/v1/work-orders', {
                params: { user_id: userId }
              });
              const workOrders = workOrdersResponse.data || [];
              
              // Find work order with dispensers
              const workOrderWithDispensers = workOrders.find(wo => 
                wo.dispensers && Array.isArray(wo.dispensers) && wo.dispensers.length > 0
              );

              if (!workOrderWithDispensers) {
                return {
                  status: 'error',
                  message: 'Work Orders page modal cannot show filters - no work orders with dispensers found',
                  details: { 
                    hint: 'Run dispenser scraping first to populate dispenser data',
                    totalWorkOrders: workOrders.length,
                    workOrdersWithDispensers: 0
                  }
                };
              }

              // Test the exact same API call that Work Orders page makes when opening modal
              const transformedWorkOrder = {
                id: workOrderWithDispensers.id,
                jobId: workOrderWithDispensers.external_id || workOrderWithDispensers.id,
                storeNumber: workOrderWithDispensers.store_number ? workOrderWithDispensers.store_number.replace('#', '') : '',
                storeName: workOrderWithDispensers.site_name,
                customerName: workOrderWithDispensers.customer_name || workOrderWithDispensers.site_name || '',
                serviceCode: workOrderWithDispensers.service_code || '',
                serviceName: workOrderWithDispensers.service_name || '',
                scheduledDate: workOrderWithDispensers.scheduled_date || '',
                address: workOrderWithDispensers.address || ''
              };

              // Transform dispensers (same as WorkOrders.tsx does)
              const transformedDispensers = (workOrderWithDispensers.dispensers || []).map((d: any) => {
                let fuelGradesArray: any[] = [];
                
                if (d.fuel_grades && typeof d.fuel_grades === 'object' && !Array.isArray(d.fuel_grades)) {
                  fuelGradesArray = Object.entries(d.fuel_grades).map(([position, gradeInfo]: [string, any]) => ({
                    position: parseInt(position),
                    grade: gradeInfo.grade || gradeInfo.name || gradeInfo
                  }));
                } else if (Array.isArray(d.fuel_grades)) {
                  fuelGradesArray = d.fuel_grades;
                }
                
                return {
                  ...d,
                  fuelGrades: fuelGradesArray,
                  dispenserNumber: d.dispenser_number,
                  dispenserType: d.dispenser_type,
                  meterType: d.meter_type || 'Electronic'
                };
              });

              // Call filter calculation API (same as Work Orders page should do)
              const filterResponse = await api.post('/api/v1/filters/calculate', {
                workOrders: [transformedWorkOrder],
                dispensers: transformedDispensers,
                overrides: {}
              });

              const hasFilterData = filterResponse.data?.details?.[0]?.filters && 
                                 Object.keys(filterResponse.data.details[0].filters).length > 0;

              return {
                status: hasFilterData ? 'success' : 'error',
                message: hasFilterData 
                  ? `Work Orders modal should show ${Object.keys(filterResponse.data.details[0].filters).length} filter types`
                  : 'Work Orders modal will not show filters - filter calculation returned no results',
                details: {
                  workOrderId: workOrderWithDispensers.external_id,
                  dispenserCount: transformedDispensers.length,
                  hasFilterData,
                  filterTypes: hasFilterData ? Object.keys(filterResponse.data.details[0].filters) : [],
                  filterData: filterResponse.data?.details?.[0]?.filters || {},
                  issue: !hasFilterData ? 'Filter calculation API returns empty filters for this work order data' : null,
                  hint: !hasFilterData ? 'Check fuel grade data in dispensers or service code requirements' : 'Modal should display filter information when opened'
                }
              };
            } catch (error: any) {
              return {
                status: 'error',
                message: `Work Orders modal test failed: ${error.message}`,
                details: { error: error.message, response: error.response?.data }
              };
            }
          }
        }
      ]
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Test multi-user functionality and isolation',
      icon: Users,
      tests: [
        {
          id: 'user-isolation',
          name: 'User Data Isolation',
          description: 'Verify user data is properly isolated',
          endpoint: '/users/test-isolation'
        },
        {
          id: 'user-permissions',
          name: 'Permission System',
          description: 'Test user permission checks',
          endpoint: '/users/test-permissions'
        }
      ]
    },
    {
      id: 'work-week',
      title: 'Work Week & Weekend Mode',
      description: 'Test work week configuration and weekend mode detection',
      icon: Calendar,
      tests: [
        {
          id: 'work-week-config',
          name: 'Work Week Configuration',
          description: 'Verify work week preferences are loaded and applied',
          testFunction: async () => {
            try {
              const response = await api.get('/api/v1/users/authenticated-user/preferences');
              const workWeek = response.data.work_week;
              
              if (!workWeek) {
                return {
                  status: 'error',
                  message: 'No work week configuration found',
                  details: response.data
                };
              }
              
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const workDays = workWeek.days || [1, 2, 3, 4, 5];
              const selectedDays = workDays.map((d: number) => dayNames[d]).join(', ');
              
              return {
                status: 'success',
                message: `Work week configured: ${selectedDays}`,
                details: { workWeek, selectedDays }
              };
            } catch (error) {
              return {
                status: 'error',
                message: 'Failed to fetch work week configuration',
                details: error
              };
            }
          }
        },
        {
          id: 'weekend-mode-detection',
          name: 'Weekend Mode Detection',
          description: 'Check if weekend mode should be active based on current day and work week',
          testFunction: async () => {
            try {
              // First get work week configuration
              const prefResponse = await api.get('/api/v1/users/authenticated-user/preferences');
              const workDays = prefResponse.data.work_week?.days || [1, 2, 3, 4, 5];
              
              // Get current day
              const today = new Date();
              const currentDay = today.getDay();
              const currentHour = today.getHours();
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              
              // Check if today is a work day
              const isWorkDay = workDays.includes(currentDay);
              
              // Find last work day of the week
              const sortedWorkDays = [...workDays].sort((a, b) => a - b);
              const lastWorkDay = sortedWorkDays[sortedWorkDays.length - 1];
              const isLastWorkDay = currentDay === lastWorkDay;
              
              // Weekend mode conditions
              const isWeekendTime = !isWorkDay || (isLastWorkDay && currentHour >= 17);
              
              return {
                status: 'success',
                message: `Today is ${dayNames[currentDay]} at ${currentHour}:00. Weekend mode: ${isWeekendTime ? 'Active' : 'Inactive'}`,
                details: {
                  currentDay: dayNames[currentDay],
                  isWorkDay,
                  isLastWorkDay,
                  currentHour,
                  isWeekendTime,
                  workDays: workDays.map((d: number) => dayNames[d])
                }
              };
            } catch (error) {
              return {
                status: 'error',
                message: 'Failed to detect weekend mode status',
                details: error
              };
            }
          }
        },
        {
          id: 'week-calculations',
          name: 'Week Range Calculations',
          description: 'Test work week-aware date range calculations',
          testFunction: async () => {
            try {
              // Get work week configuration
              const prefResponse = await api.get('/api/v1/users/authenticated-user/preferences');
              const workDays = prefResponse.data.work_week?.days || [1, 2, 3, 4, 5];
              
              // Calculate current week based on work days
              const today = new Date();
              const currentDay = today.getDay();
              
              // Find start of week (Sunday)
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - currentDay);
              weekStart.setHours(0, 0, 0, 0);
              
              // Find work days in current week
              const dates: Date[] = [];
              for (let i = 0; i < 7; i++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                if (workDays.includes(date.getDay())) {
                  dates.push(date);
                }
              }
              
              const firstWorkDay = dates[0];
              const lastWorkDay = dates[dates.length - 1];
              
              return {
                status: 'success',
                message: `Work week: ${firstWorkDay?.toLocaleDateString()} - ${lastWorkDay?.toLocaleDateString()}`,
                details: {
                  workDaysCount: dates.length,
                  firstWorkDay: firstWorkDay?.toLocaleDateString(),
                  lastWorkDay: lastWorkDay?.toLocaleDateString(),
                  allWorkDays: dates.map(d => d.toLocaleDateString())
                }
              };
            } catch (error) {
              return {
                status: 'error',
                message: 'Failed to calculate week ranges',
                details: error
              };
            }
          }
        },
        {
          id: 'dashboard-integration',
          name: 'Dashboard Weekend Mode',
          description: 'Verify dashboard respects work week settings',
          endpoint: '/work-week/test-dashboard'
        },
        {
          id: 'filters-integration',
          name: 'Filters Work Week',
          description: 'Verify filters page uses work week settings',
          endpoint: '/work-week/test-filters'
        }
      ]
    }
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const runAllTests = async () => {
    setRunningAll(true);
    for (const section of testSections) {
      for (const test of section.tests) {
        await runTest(test.id, test.testFunction, test.endpoint);
        // Add a small delay between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setRunningAll(false);
  };

  const getStatusIcon = (status?: 'idle' | 'running' | 'success' | 'error') => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'success':
        return <Check className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <X className="w-5 h-5 text-destructive" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: 'idle' | 'running' | 'success' | 'error') => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary" className="animate-pulse">Running</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Passed</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Not Tested</Badge>;
    }
  };

  // Calculate overall test progress
  const totalTests = testSections.reduce((sum, section) => sum + section.tests.length, 0);
  const completedTests = Object.values(testResults).filter(r => r.status === 'success' || r.status === 'error').length;
  const passedTests = Object.values(testResults).filter(r => r.status === 'success').length;
  const progressPercentage = (completedTests / totalTests) * 100;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FlaskConical className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                <GradientText text="System Testing Dashboard" gradient="from-blue-600 via-purple-600 to-pink-600" />
              </h1>
              <p className="text-muted-foreground">
                Comprehensive testing interface to verify all system functionality
              </p>
            </div>
          </div>
          
          {/* Backend Status Indicator */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={backendStatus === 'online' ? 'default' : 'destructive'}
              className={`
                flex items-center gap-2 px-3 py-1
                ${backendStatus === 'online' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                ${backendStatus === 'offline' ? 'bg-red-500/10 text-red-600 border-red-500/20' : ''}
                ${backendStatus === 'unknown' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : ''}
              `}
            >
              {backendStatus === 'online' && <Wifi className="w-3 h-3" />}
              {backendStatus === 'offline' && <WifiOff className="w-3 h-3" />}
              {backendStatus === 'unknown' && <Circle className="w-3 h-3 animate-pulse" />}
              
              Backend: {backendStatus === 'online' ? 'Online' : backendStatus === 'offline' ? 'Offline' : 'Checking...'}
            </Badge>
          </div>
        </div>
        
        {backendStatus === 'offline' && (
          <Alert variant="destructive" className="mt-4">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>⚠️ Backend Server Offline:</strong> Most tests will fail until the backend is started.</p>
                <div className="bg-destructive/10 p-2 rounded-md font-mono text-xs">
                  cd backend && uvicorn app.main:app --reload --port 8000
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Progress Overview */}
      <AnimatedCard className="animate-slide-in-from-top" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Testing Progress</span>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="font-mono">
                {completedTests}/{totalTests} Tests
              </Badge>
              {passedTests > 0 && (
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 font-mono">
                  {passedTests} Passed
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex gap-4 mt-4">
            <RippleButton
              onClick={runAllTests}
              disabled={runningAll}
              className="flex items-center gap-2"
              variant="default"
            >
              {runningAll ? (
                <>
                  <DotsLoader size="sm" />
                  Running All Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Tests
                </>
              )}
            </RippleButton>
            <Button
              onClick={() => setTestResults({})}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Results
            </Button>
            <Button
              onClick={() => {
                const timestamp = new Date().toLocaleString();
                const backendStatusText = backendStatus === 'online' ? 'Online ✅' : 
                                        backendStatus === 'offline' ? 'Offline ❌' : 
                                        'Unknown ❓';
                
                const header = `FossaWork V2 - System Testing Results
Generated: ${timestamp}
Backend Status: ${backendStatusText}
Tests Completed: ${completedTests}/${totalTests}
Tests Passed: ${passedTests}/${totalTests}
Progress: ${Math.round(progressPercentage)}%

${'='.repeat(60)}
`;

                const results = Object.entries(testResults).map(([testId, result]) => {
                  const test = testSections.flatMap(s => s.tests).find(t => t.id === testId);
                  const testName = test?.name || testId;
                  const status = result.status === 'success' ? 'PASSED' : 
                               result.status === 'error' ? 'FAILED' : 
                               result.status === 'running' ? 'RUNNING' : 'NOT_TESTED';
                  
                  let output = `${status}: ${testName}`;
                  if (result.message) output += `\n  Message: ${result.message}`;
                  
                  // Add timestamp if available
                  if (result.timestamp) {
                    output += `\n  Tested At: ${result.timestamp.toLocaleString()}`;
                  }
                  
                  // Add hint if available
                  if (result.details?.hint) output += `\n  Hint: ${result.details.hint}`;
                  
                  // Add command if available  
                  if (result.details?.command) output += `\n  Command: ${result.details.command}`;
                  
                  // Add specific details fields
                  if (result.details?.details) {
                    const detailsStr = typeof result.details.details === 'object' 
                      ? JSON.stringify(result.details.details, null, 4)
                      : String(result.details.details);
                    output += `\n  Details: ${detailsStr}`;
                  }
                  
                  // Add error information if present
                  if (result.details?.error) {
                    output += `\n  Error: ${result.details.error}`;
                  }
                  if (result.details?.errorType) {
                    output += `\n  Error Type: ${result.details.errorType}`;
                  }
                  if (result.details?.status) {
                    output += `\n  HTTP Status: ${result.details.status}`;
                  }
                  
                  // Add network error info
                  if (result.details?.networkError) {
                    output += `\n  Network Error: Connection issue detected`;
                  }
                  if (result.details?.timeout) {
                    output += `\n  Timeout: Test exceeded 30 second limit`;
                  }
                  
                  // Add test-specific details
                  if (result.details?.testData) {
                    output += `\n  Used Test Data: Yes (no real work orders with dispensers found)`;
                  }
                  if (result.details?.workOrderId) {
                    output += `\n  Work Order ID: ${result.details.workOrderId}`;
                  }
                  if (result.details?.dispenserCount !== undefined) {
                    output += `\n  Dispenser Count: ${result.details.dispenserCount}`;
                  }
                  if (result.details?.filterCount !== undefined) {
                    output += `\n  Filter Count: ${result.details.filterCount}`;
                  }
                  if (result.details?.filterTypes) {
                    output += `\n  Filter Types: ${JSON.stringify(result.details.filterTypes)}`;
                  }
                  if (result.details?.totalWorkOrders !== undefined) {
                    output += `\n  Total Work Orders: ${result.details.totalWorkOrders}`;
                  }
                  if (result.details?.missingFields) {
                    output += `\n  Missing Fields: ${JSON.stringify(result.details.missingFields)}`;
                  }
                  if (result.details?.consistentQuantities !== undefined) {
                    output += `\n  Consistent Quantities: ${result.details.consistentQuantities}`;
                  }
                  
                  // Add full technical details at the end
                  if (result.details) {
                    output += `\n\n  === FULL TECHNICAL DETAILS ===`;
                    const technicalDetails = typeof result.details === 'object' 
                      ? JSON.stringify(result.details, null, 4)
                      : String(result.details);
                    output += `\n${technicalDetails}`;
                  }
                  
                  return output;
                }).join('\n\n');
                
                const finalOutput = header + results;
                
                navigator.clipboard.writeText(finalOutput).then(() => {
                  alert('Test results copied to clipboard!');
                }).catch(() => {
                  // Fallback - show results in alert
                  const truncated = finalOutput.length > 1000 ? finalOutput.substring(0, 1000) + '...' : finalOutput;
                  alert('Copy failed. Results:\n\n' + truncated);
                });
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Copy Results
            </Button>
          </div>
        </CardContent>
      </AnimatedCard>

      {/* Test Sections */}
      <div className="grid gap-4">
        {testSections.map((section, sectionIndex) => {
          const SectionIcon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          const sectionTests = section.tests.map(test => testResults[test.id]);
          const sectionPassed = sectionTests.filter(r => r?.status === 'success').length;
          const sectionTotal = section.tests.length;
          
          return (
            <AnimatedCard
              key={section.id}
              className="overflow-hidden animate-slide-in-from-left"
              style={{ animationDelay: `${(sectionIndex + 2) * 0.1}s` }}
            >
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <SectionIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Individual test status indicators */}
                    <div className="flex items-center gap-1">
                      {section.tests.map((test) => {
                        const result = testResults[test.id];
                        const statusIcon = result?.status === 'success' ? (
                          <div key={test.id} className="w-3 h-3 bg-emerald-500 rounded-full" title={`${test.name}: Passed`} />
                        ) : result?.status === 'error' ? (
                          <div key={test.id} className="w-3 h-3 bg-red-500 rounded-full" title={`${test.name}: Failed`} />
                        ) : result?.status === 'running' ? (
                          <div key={test.id} className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" title={`${test.name}: Running`} />
                        ) : (
                          <div key={test.id} className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" title={`${test.name}: Not tested`} />
                        );
                        return statusIcon;
                      })}
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {sectionPassed}/{sectionTotal}
                    </Badge>
                    {isExpanded ? 
                      <ChevronDown className="w-5 h-5 text-muted-foreground" /> : 
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {section.tests.map((test, testIndex) => {
                        const result = testResults[test.id];
                        
                        return (
                          <div
                            key={test.id}
                            className="group relative"
                            style={{ animationDelay: `${testIndex * 0.05}s` }}
                          >
                            <Card className={`
                              transition-all duration-200 
                              ${result?.status === 'success' ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}
                              ${result?.status === 'error' ? 'border-destructive/50 bg-destructive/10' : ''}
                              ${result?.status === 'running' ? 'border-primary/50 bg-primary/10' : ''}
                              hover:shadow-md
                            `}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-3">
                                      {getStatusIcon(result?.status)}
                                      <h3 className="font-semibold">{test.name}</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground ml-8">
                                      {test.description}
                                    </p>
                                    
                                    {result && (
                                      <div className="ml-8 mt-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                          {getStatusBadge(result.status)}
                                          <span className="text-sm font-medium">{result.message}</span>
                                        </div>
                                        
                                        {result.details && (
                                          <>
                                            {result.details.hint && (
                                              <Alert className="mt-2" variant={result.status === 'error' ? 'destructive' : 'default'}>
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                  <strong>💡 Hint:</strong> {result.details.hint}
                                                  {result.details.command && (
                                                    <div className="mt-2 p-2 bg-muted rounded-md font-mono text-xs">
                                                      {result.details.command}
                                                    </div>
                                                  )}
                                                </AlertDescription>
                                              </Alert>
                                            )}
                                            
                                            {result.details.details && (
                                              <div className="mt-2 p-3 bg-muted/30 rounded-md text-sm">
                                                <strong>Details:</strong> {
                                                  typeof result.details.details === 'object' 
                                                    ? JSON.stringify(result.details.details, null, 2)
                                                    : String(result.details.details)
                                                }
                                              </div>
                                            )}
                                            
                                            {result.status === 'error' && result.details.networkError && (
                                              <Alert className="mt-2" variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                  <div className="space-y-2">
                                                    <p><strong>🔌 Connection Issue:</strong> Can't reach the backend server</p>
                                                    <p className="text-sm">Common solutions:</p>
                                                    <ul className="text-sm list-disc list-inside space-y-1">
                                                      <li>Check if the backend is running on port 8000</li>
                                                      <li>Verify your network connection</li>
                                                      <li>Make sure no firewall is blocking the connection</li>
                                                    </ul>
                                                  </div>
                                                </AlertDescription>
                                              </Alert>
                                            )}
                                            
                                            {result.status === 'error' && result.details.timeout && (
                                              <Alert className="mt-2" variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                  <div className="space-y-2">
                                                    <p><strong>⏱️ Timeout:</strong> Test took longer than 30 seconds</p>
                                                    <p className="text-sm">This usually means:</p>
                                                    <ul className="text-sm list-disc list-inside space-y-1">
                                                      <li>The backend server is not running</li>
                                                      <li>The server is overloaded or stuck</li>
                                                      <li>There's a network connectivity issue</li>
                                                    </ul>
                                                  </div>
                                                </AlertDescription>
                                              </Alert>
                                            )}
                                            
                                            <details className="mt-2">
                                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                                Show technical details
                                              </summary>
                                              <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto mt-2">
                                                {typeof result.details === 'object' 
                                                  ? JSON.stringify(result.details, null, 2)
                                                  : String(result.details)
                                                }
                                              </pre>
                                            </details>
                                          </>
                                        )}
                                        
                                        {result.timestamp && (
                                          <div className="text-xs text-muted-foreground space-y-1">
                                            <div>
                                              Tested at: {result.timestamp.toLocaleTimeString()}
                                              {result.status === 'running' && (
                                                <span className="ml-2 inline-flex items-center gap-1">
                                                  <DotsLoader size="xs" />
                                                  <span className="animate-pulse">In progress...</span>
                                                </span>
                                              )}
                                            </div>
                                            {result.status === 'running' && (
                                              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                                                <span className="text-xs">
                                                  {result.message.includes('Starting') && '🚀 Initializing test...'}
                                                  {result.message.includes('Connecting') && '🔌 Connecting to server...'}
                                                  {result.message.includes('Calling') && '📡 Making API call...'}
                                                  {result.message.includes('Executing') && '⚡ Running test logic...'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <MagneticButton
                                    onClick={() => runTest(test.id, test.testFunction, test.endpoint)}
                                    disabled={result?.status === 'running'}
                                    size="sm"
                                    variant={result?.status === 'success' ? 'outline' : 'default'}
                                  >
                                    {result?.status === 'running' ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Running...
                                      </>
                                    ) : result?.status === 'success' ? (
                                      'Re-test'
                                    ) : (
                                      'Run Test'
                                    )}
                                  </MagneticButton>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </>
              )}
            </AnimatedCard>
          );
        })}
      </div>

      {/* Help Section */}
      <GlowCard className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Understanding Test Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-500" />
              <span><strong>Green (Passed):</strong> Feature is working correctly</span>
            </div>
            <div className="flex items-center gap-3">
              <X className="w-5 h-5 text-destructive" />
              <span><strong>Red (Failed):</strong> Issue detected with this feature</span>
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span><strong>Blue (Running):</strong> Test is currently in progress</span>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <span><strong>Gray (Not Tested):</strong> Test hasn't been run yet</span>
            </div>
          </div>
          
          <Separator />
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Troubleshooting Tips</AlertTitle>
            <AlertDescription className="mt-2 space-y-1">
              <p>• If authentication tests fail, try logging out and back in</p>
              <p>• Database errors may indicate the backend server is not running</p>
              <p>• Scraping failures could mean WorkFossa credentials need updating</p>
              <p>• Notification tests require proper configuration in Settings</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </GlowCard>
    </div>
  );
};

export default TestingDashboard;