import axios from 'axios'
import { logger } from './fileLoggingService'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth and logging
apiClient.interceptors.request.use(
  (config) => {
    const startTime = Date.now()
    config.metadata = { startTime }
    
    // Log the API request
    logger.info('api.request', `📤 ${config.method?.toUpperCase()} ${config.url}`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data
    })
    
    // TODO: Add auth token when implemented
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
  scheduled_date: string | null
  status: string
  visit_url?: string
  created_at: string
  updated_at: string
  dispensers: Dispenser[]
}

export interface Dispenser {
  id: string
  dispenser_number: string
  dispenser_type: string
  fuel_grades: Record<string, any>
  status: string
  progress_percentage: number
  automation_completed: boolean
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
  const response = await apiClient.get(`/api/v1/work-orders?user_id=${userId}`)
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
  const response = await apiClient.post(`/api/v1/work-orders/scrape?user_id=${userId}`)
  return response.data
}

export const deleteWorkOrder = async (workOrderId: string, userId: string): Promise<any> => {
  const response = await apiClient.delete(`/api/v1/work-orders/${workOrderId}?user_id=${userId}`)
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

// Export axios instance for custom requests
export { apiClient }