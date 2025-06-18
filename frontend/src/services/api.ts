import axios from 'axios'
import { logger } from './fileLoggingService'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increase timeout to 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth and logging
apiClient.interceptors.request.use(
  (config) => {
    const startTime = Date.now()
    config.metadata = { startTime }
    
    // Add auth token from localStorage
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Log the API request
    logger.info('api.request', `📤 ${config.method?.toUpperCase()} ${config.url}`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data
    })
    
    return config
  },
  (error) => {
    logger.error('api.request', '❌ Request setup failed', { error: error.message })
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and logging
apiClient.interceptors.response.use(
  (response) => {
    const endTime = Date.now()
    const duration = response.config.metadata?.startTime ? endTime - response.config.metadata.startTime : 0
    
    // Log successful response
    logger.apiCall(
      response.config.method?.toUpperCase() || 'UNKNOWN',
      response.config.url || 'unknown',
      response.status,
      duration,
      {
        responseSize: JSON.stringify(response.data).length,
        headers: response.headers
      }
    )
    
    return response
  },
  (error) => {
    const endTime = Date.now()
    const duration = error.config?.metadata?.startTime ? endTime - error.config.metadata.startTime : 0
    
    // Log error response
    const status = error.response?.status || 0
    const errorMessage = error.response?.data?.detail || error.message
    
    logger.apiCall(
      error.config?.method?.toUpperCase() || 'UNKNOWN',
      error.config?.url || 'unknown',
      status,
      duration,
      {
        error: errorMessage,
        errorData: error.response?.data,
        errorType: error.code
      }
    )
    
    logger.error('api.response', `❌ API Error: ${errorMessage}`, {
      status,
      url: error.config?.url,
      method: error.config?.method,
      response: error.response?.data
    })
    
    // Handle 401 Unauthorized by clearing auth and redirecting to login
    if (status === 401 && !error.config?.url?.includes('/api/auth/login')) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

// Types
export interface HealthCheck {
  status: string
  service: string
  version: string
  database: string
  timestamp: string
  endpoints: Record<string, string>
}

export interface WorkOrder {
  id: string
  external_id: string
  site_name: string
  address: string
  street?: string
  city_state?: string
  county?: string
  scheduled_date: string | null
  status: string
  visit_url?: string
  visit_number?: string
  customer_url?: string
  service_code?: string
  service_name?: string
  service_items?: string | string[]
  created_date?: string
  created_by?: string
  instructions?: string
  created_at: string
  updated_at: string
  dispensers: Dispenser[]
}

export interface Dispenser {
  id: string
  dispenser_number: string
  dispenser_type: string
  fuel_grades: Record<string, any>
  fuel_grades_list?: string[]  // New field with clean fuel grade names
  grades_list?: string[]  // Alternative field name for fuel grades
  status: string
  progress_percentage: number
  automation_completed: boolean
  serial_number?: string
  stand_alone_code?: string
  number_of_nozzles?: number
  meter_type?: string
  make?: string  // Manufacturer
  model?: string  // Model
  title?: string  // Dispenser title
  dispenser_numbers?: string[]  // Array of dispenser numbers for dual-sided
  equipment?: {
    make?: string
    model?: string
    standalone?: boolean
    nozzles?: string[]
  }
  custom_fields?: Record<string, any>
  form_data?: Record<string, any>
  testing_requirements?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  username: string
  email: string
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  username: string
  email: string
  password: string
}

// API Functions

// Health Check
export const fetchHealthCheck = async (): Promise<HealthCheck> => {
  const response = await apiClient.get('/health')
  return response.data
}

// Work Orders
export const fetchWorkOrders = async (userId: string): Promise<WorkOrder[]> => {
  const response = await apiClient.get(`/api/v1/work-orders/?user_id=${userId}`)
  return response.data
}

export const openWorkOrderVisit = async (workOrderId: string, userId: string): Promise<{visit_url: string, auto_login_url: string}> => {
  const response = await apiClient.post(`/api/v1/work-orders/${workOrderId}/open-visit?user_id=${userId}`)
  return response.data
}

export const fetchWorkOrder = async (workOrderId: string, userId: string): Promise<WorkOrder> => {
  const response = await apiClient.get(`/api/v1/work-orders/${workOrderId}?user_id=${userId}`)
  return response.data
}

export const updateWorkOrderStatus = async (
  workOrderId: string,
  userId: string,
  status: string
): Promise<any> => {
  const response = await apiClient.patch(
    `/api/v1/work-orders/${workOrderId}/status?user_id=${userId}`,
    { status }
  )
  return response.data
}

export const triggerScrape = async (userId: string): Promise<any> => {
  // Use a longer timeout for scraping operations (5 minutes)
  const response = await apiClient.post(`/api/v1/work-orders/scrape?user_id=${userId}`, {}, {
    timeout: 300000 // 5 minutes
  })
  return response.data
}

// Get scraping progress
export const getScrapingProgress = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/work-orders/scrape/progress/${userId}`)
  return response.data
}

export const triggerBatchDispenserScrape = async (userId: string, workOrderIds?: string[], forceRefresh?: boolean): Promise<any> => {
  let url = `/api/v1/work-orders/scrape-dispensers-batch?user_id=${userId}`
  if (workOrderIds && workOrderIds.length > 0) {
    // Add work order IDs as query parameters
    const idsParams = workOrderIds.map(id => `work_order_ids=${encodeURIComponent(id)}`).join('&')
    url += `&${idsParams}`
  }
  if (forceRefresh) {
    url += `&force_refresh=true`
  }
  const response = await apiClient.post(url)
  return response.data
}

export const getDispenserScrapingProgress = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/work-orders/scrape-dispensers/progress/${userId}`)
  return response.data
}

export const deleteWorkOrder = async (workOrderId: string, userId: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/work-orders/${workOrderId}?user_id=${userId}`)
  return response.data
}

// Scrape dispensers for a specific work order
export const scrapeDispensersForWorkOrder = async (workOrderId: string, userId: string, forceRefresh?: boolean): Promise<any> => {
  let url = `/api/v1/work-orders/${workOrderId}/scrape-dispensers?user_id=${userId}`
  if (forceRefresh) {
    url += `&force_refresh=true`
  }
  const response = await apiClient.post(url, {}, {
    timeout: 60000 // 1 minute timeout
  })
  return response.data
}

// Clear dispensers for a specific work order
export const clearDispensersForWorkOrder = async (workOrderId: string, userId: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/work-orders/${workOrderId}/dispensers?user_id=${userId}`)
  return response.data
}

// Clear all work orders for a user
export const clearAllWorkOrders = async (userId: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/work-orders/clear-all?user_id=${userId}`)
  return response.data
}

// Users
export const fetchUsers = async (): Promise<User[]> => {
  const response = await apiClient.get('/api/v1/users')
  return response.data
}

export const fetchUser = async (userId: string): Promise<User> => {
  const response = await apiClient.get(`/api/v1/users/${userId}`)
  return response.data
}

export const createUser = async (userData: UserCreate): Promise<User> => {
  const response = await apiClient.post('/api/v1/users', userData)
  return response.data
}

export const loginUser = async (credentials: { username: string; password: string }): Promise<any> => {
  const response = await apiClient.post('/api/v1/users/login', credentials)
  return response.data
}

export const getUserPreferences = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/users/${userId}/preferences`)
  return response.data
}

export const setUserPreference = async (
  userId: string,
  preferenceType: string,
  preferenceData: Record<string, any>
): Promise<any> => {
  const response = await apiClient.put(`/api/v1/users/${userId}/preferences/${preferenceType}`, preferenceData)
  return response.data
}

// WorkFossa Credentials
export const saveWorkFossaCredentials = async (
  userId: string,
  credentials: { username: string; password: string }
): Promise<any> => {
  const response = await apiClient.post(`/api/v1/credentials/workfossa?user_id=${userId}`, credentials)
  return response.data
}

export const getWorkFossaCredentials = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/credentials/workfossa?user_id=${userId}`)
  return response.data
}

export const deleteWorkFossaCredentials = async (userId: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/credentials/workfossa?user_id=${userId}`)
  return response.data
}

export const testWorkFossaCredentials = async (userId: string, credentials?: { username: string; password: string }): Promise<any> => {
  const url = `/api/v1/credentials/workfossa/test?user_id=${userId}`
  const data = credentials || undefined
  const response = await apiClient.post(url, data)
  return response.data
}

// Job Queue Management
export interface QueueJob {
  job_id: string
  user_id: string
  job_type: string
  priority: number
  status: string
  queue_type: string
  work_order_id?: string
  visit_url?: string
  dispensers?: any[]
  batch_data?: any
  created_at: string
  queued_at?: string
  started_at?: string
  completed_at?: string
  execution_time_seconds: number
  retry_count: number
  error_message?: string
  resource_requirements: any
}

export interface QueueStatus {
  metrics: {
    total_jobs: number
    pending_jobs: number
    running_jobs: number
    completed_jobs: number
    failed_jobs: number
    average_execution_time: number
    resource_utilization: Record<string, number>
  }
  queue_sizes: Record<string, number>
  is_processing: boolean
  config: Record<string, any>
}

// Job Queue API Functions
export const submitJob = async (jobData: {
  user_id: string
  job_type: 'single_visit' | 'batch_processing'
  priority?: 'low' | 'normal' | 'high' | 'urgent' | 'critical'
  work_order_id?: string
  visit_url?: string
  dispensers?: any[]
  batch_data?: any
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/automation/queue/jobs', jobData)
  return response.data
}

export const getJobStatus = async (jobId: string): Promise<QueueJob> => {
  const response = await apiClient.get(`/api/v1/automation/queue/jobs/${jobId}`)
  return response.data.job
}

export const cancelJob = async (jobId: string): Promise<any> => {
  const response = await apiClient.post(`/api/v1/automation/queue/jobs/${jobId}/cancel`)
  return response.data
}

export const getQueueStatus = async (): Promise<QueueStatus> => {
  const response = await apiClient.get('/api/v1/automation/queue/status')
  return response.data.queue_status
}

export const listJobs = async (params?: {
  user_id?: string
  status?: string
  limit?: number
}): Promise<{ jobs: QueueJob[], total_count: number }> => {
  const queryParams = new URLSearchParams()
  if (params?.user_id) queryParams.append('user_id', params.user_id)
  if (params?.status) queryParams.append('status', params.status)
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  
  const response = await apiClient.get(`/api/v1/automation/queue/jobs?${queryParams.toString()}`)
  return response.data
}

export const startQueueProcessing = async (): Promise<any> => {
  const response = await apiClient.post('/api/v1/automation/queue/start')
  return response.data
}

export const stopQueueProcessing = async (): Promise<any> => {
  const response = await apiClient.post('/api/v1/automation/queue/stop')
  return response.data
}

// Automation API Functions
export const processVisitAutomation = async (automationData: {
  user_id: string
  visit_url: string
  work_order_id: string
  dispensers: any[]
  credentials?: { username: string; password: string }
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/automation/form/process-visit', automationData)
  return response.data
}

export const processBatchAutomation = async (batchData: {
  user_id: string
  visits: any[]
  credentials?: { username: string; password: string }
  batch_config?: {
    concurrent_jobs?: number
    delay_between_jobs?: number
    retry_attempts?: number
    auto_continue_on_error?: boolean
    notify_on_completion?: boolean
  }
}): Promise<any> => {
  const response = await apiClient.post('/api/v1/automation/form/process-batch', batchData)
  return response.data
}

export const getBatchStatus = async (batchId: string): Promise<any> => {
  const response = await apiClient.get(`/api/v1/automation/batch/${batchId}/status`)
  return response.data
}

export const pauseBatch = async (batchId: string): Promise<any> => {
  const response = await apiClient.post(`/api/v1/automation/batch/${batchId}/pause`)
  return response.data
}

export const resumeBatch = async (batchId: string): Promise<any> => {
  const response = await apiClient.post(`/api/v1/automation/batch/${batchId}/resume`)
  return response.data
}

export const cancelBatch = async (batchId: string): Promise<any> => {
  const response = await apiClient.post(`/api/v1/automation/batch/${batchId}/cancel`)
  return response.data
}

export const listUserBatches = async (userId: string, status?: string, limit?: number): Promise<any> => {
  const queryParams = new URLSearchParams()
  if (status) queryParams.append('status', status)
  if (limit) queryParams.append('limit', limit.toString())
  
  const response = await apiClient.get(`/api/v1/automation/batches/${userId}?${queryParams.toString()}`)
  return response.data
}

// WebSocket helper for queue updates
export const createQueueWebSocket = (userId: string, onMessage: (data: any) => void): WebSocket => {
  const wsUrl = API_BASE_URL.replace('http', 'ws') + `/api/v1/automation/queue/ws/${userId}`
  const ws = new WebSocket(wsUrl)
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }
  
  ws.onopen = () => {
    console.log('Queue WebSocket connected')
    // Send ping to test connection
    ws.send(JSON.stringify({ type: 'ping' }))
  }
  
  ws.onerror = (error) => {
    console.error('Queue WebSocket error:', error)
  }
  
  ws.onclose = () => {
    console.log('Queue WebSocket disconnected')
  }
  
  return ws
}

// Alias for backward compatibility
export const getWorkOrders = fetchWorkOrders

// ==================================
// NOTIFICATION API FUNCTIONS
// ==================================

export interface NotificationPreferences {
  email_enabled: boolean
  pushover_enabled: boolean
  automation_started: string
  automation_completed: string
  automation_failed: string
  automation_progress: string
  schedule_change: string
  daily_digest: string
  weekly_summary: string
  error_alert: string
  digest_time: string
  quiet_hours_start: string
  quiet_hours_end: string
  pushover_user_key?: string
  pushover_device?: string
  pushover_sound: string
}

export interface TestNotificationRequest {
  notification_type: string
  channel?: string
  test_data?: Record<string, any>
}

export const getNotificationPreferences = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/notifications/preferences/${userId}`)
  return response.data
}

export const updateNotificationPreferences = async (
  userId: string, 
  preferences: Partial<NotificationPreferences>
): Promise<any> => {
  const response = await apiClient.put(`/api/notifications/preferences/${userId}`, preferences)
  return response.data
}

export const sendTestNotification = async (
  userId: string, 
  testRequest: TestNotificationRequest
): Promise<any> => {
  const response = await apiClient.post(`/api/notifications/test/${userId}`, testRequest)
  return response.data
}

export const validatePushoverKey = async (
  userId: string, 
  pushoverUserKey: string
): Promise<any> => {
  const response = await apiClient.post(`/api/notifications/validate-pushover/${userId}`, null, {
    params: { pushover_user_key: pushoverUserKey }
  })
  return response.data
}

export const getNotificationStatus = async (): Promise<any> => {
  const response = await apiClient.get('/api/notifications/status')
  return response.data
}

export const sendManualDigest = async (
  userId: string, 
  digestType: 'daily' | 'weekly' = 'daily'
): Promise<any> => {
  const response = await apiClient.post(`/api/notifications/digest/${userId}?digest_type=${digestType}`)
  return response.data
}

// ==================================
// SETTINGS API FUNCTIONS
// ==================================

// SMTP Settings
export interface SMTPSettings {
  smtp_server: string
  smtp_port: number
  username: string
  password: string
  use_tls: boolean
  use_ssl: boolean
  from_email?: string
  from_name: string
  timeout: number
}

export const getSMTPSettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/smtp/${userId}`)
  return response.data
}

export const updateSMTPSettings = async (userId: string, settings: SMTPSettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/smtp/${userId}`, settings)
  return response.data
}

export const testSMTPSettings = async (userId: string, testEmail: string): Promise<any> => {
  const response = await apiClient.post(`/api/settings/smtp/${userId}/test`, null, {
    params: { test_email: testEmail }
  })
  return response.data
}

// Work Order Filter Settings
export interface WorkOrderFilterSettings {
  enabled: boolean
  filter_by_stores: string[]
  filter_by_locations: string[]
  filter_by_customers: string[]
  filter_by_service_codes: string[]
  exclude_stores: string[]
  exclude_completed: boolean
  saved_filters: Record<string, any>
}

export const getFilterSettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/filters/${userId}`)
  return response.data
}

export const updateFilterSettings = async (userId: string, settings: WorkOrderFilterSettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/filters/${userId}`, settings)
  return response.data
}

// Automation Delay Settings
export interface AutomationDelaySettings {
  form_field_delay: number
  page_navigation_delay: number
  click_action_delay: number
  dropdown_select_delay: number
  overall_speed_multiplier: number
  browser_timeout: number
  retry_delay: number
  max_retries: number
}

export const getAutomationDelays = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/automation-delays/${userId}`)
  return response.data
}

export const updateAutomationDelays = async (userId: string, settings: AutomationDelaySettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/automation-delays/${userId}`, settings)
  return response.data
}

// Prover Settings
export interface ProverPreference {
  serial_number: string
  name: string
  fuel_type_mappings: Record<string, string>
  priority: number
  is_default: boolean
  notes?: string
}

export interface ProverSettings {
  provers: ProverPreference[]
  auto_select_default: boolean
  remember_last_selection: boolean
}

export const getProverSettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/provers/${userId}`)
  return response.data
}

export const updateProverSettings = async (userId: string, settings: ProverSettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/provers/${userId}`, settings)
  return response.data
}

// Browser Settings
export interface BrowserSettings {
  headless: boolean
  browser_type: string
  enable_screenshots: boolean
  enable_debug_mode: boolean
  viewport_width: number
  viewport_height: number
  disable_images: boolean
  clear_cache_on_start: boolean
}

export const getBrowserSettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/browser/${userId}`)
  return response.data
}

export const updateBrowserSettings = async (userId: string, settings: BrowserSettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/browser/${userId}`, settings)
  return response.data
}

// Schedule Settings
export interface ScheduleSettings {
  auto_scrape_enabled: boolean
  scrape_interval_minutes: number
  scrape_times: string[]
  schedule_change_check_minutes: number
  working_hours_start: string
  working_hours_end: string
  work_on_weekends: boolean
  holiday_dates: string[]
}

export const getScheduleSettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/schedule/${userId}`)
  return response.data
}

export const updateScheduleSettings = async (userId: string, settings: ScheduleSettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/schedule/${userId}`, settings)
  return response.data
}

// Notification Display Settings
export interface NotificationDisplaySettings {
  show_job_id: boolean
  show_store_number: boolean
  show_store_name: boolean
  show_location: boolean
  show_date: boolean
  show_time: boolean
  show_dispenser_count: boolean
  show_service_code: boolean
  show_duration: boolean
  date_format: string
  time_format: string
  timezone: string
}

export const getNotificationDisplaySettings = async (userId: string): Promise<any> => {
  const response = await apiClient.get(`/api/settings/notification-display/${userId}`)
  return response.data
}

export const updateNotificationDisplaySettings = async (userId: string, settings: NotificationDisplaySettings): Promise<any> => {
  const response = await apiClient.post(`/api/settings/notification-display/${userId}`, settings)
  return response.data
}

// Export axios instance for custom requests
export { apiClient }