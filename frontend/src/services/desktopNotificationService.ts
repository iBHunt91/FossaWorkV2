/**
 * Desktop Notification Service
 * 
 * Handles desktop notifications for the Fossa Monitor application.
 * Supports both web notifications (current) and is ready for future Electron integration.
 * Based on V1 designs with professional branding and click actions.
 */

import { logger } from './fileLoggingService'
import { apiClient } from './api'

// Notification types based on backend
export interface DesktopNotification {
  id: string
  title: string
  message: string
  icon?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  sound: boolean
  autoClose?: number
  clickAction?: string
  actionData?: Record<string, any>
  timestamp: string
}

export interface DesktopNotificationSettings {
  enabled: boolean
  sound_enabled: boolean
  auto_close_time: number
  priority_threshold: 'low' | 'normal' | 'high' | 'critical'
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

export class DesktopNotificationService {
  private isInitialized = false
  private isSupported = false
  private settings: DesktopNotificationSettings = {
    enabled: true,
    sound_enabled: true,
    auto_close_time: 10,
    priority_threshold: 'normal',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00'
  }
  private pollInterval: NodeJS.Timeout | null = null
  private clickHandlers: Map<string, (data: any) => void> = new Map()

  /**
   * Initialize the desktop notification service
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if running in Electron environment
      const isElectron = navigator.userAgent.toLowerCase().includes('electron')
      
      if (isElectron) {
        // Future Electron implementation
        this.isSupported = await this.initializeElectronNotifications()
      } else {
        // Web notification fallback
        this.isSupported = await this.initializeWebNotifications()
      }

      if (this.isSupported) {
        // Load user settings
        await this.loadSettings()
        
        // Start polling for pending notifications
        this.startPolling()
        
        // Set up default click handlers
        this.setupDefaultClickHandlers()
        
        logger.info('desktopNotifications.init', 'Desktop notification service initialized', {
          supported: this.isSupported,
          environment: isElectron ? 'electron' : 'web'
        })
      }

      this.isInitialized = true
      return this.isSupported
    } catch (error) {
      logger.error('desktopNotifications.init', 'Failed to initialize desktop notifications', { error })
      return false
    }
  }

  /**
   * Initialize Electron-based notifications (future implementation)
   */
  private async initializeElectronNotifications(): Promise<boolean> {
    // Future Electron implementation
    // Would use ipcRenderer to communicate with main process
    return false
  }

  /**
   * Initialize web notifications
   */
  private async initializeWebNotifications(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('desktopNotifications.web', 'Web notifications not supported')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      logger.warn('desktopNotifications.web', 'Notification permission denied')
      return false
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission()
      const isGranted = permission === 'granted'
      
      logger.info('desktopNotifications.web', 'Notification permission requested', {
        permission,
        granted: isGranted
      })
      
      return isGranted
    } catch (error) {
      logger.error('desktopNotifications.web', 'Error requesting notification permission', { error })
      return false
    }
  }

  /**
   * Load user notification settings
   */
  private async loadSettings(): Promise<void> {
    try {
      const response = await apiClient.get('/api/notifications/desktop/settings')
      if (response.data.success) {
        this.settings = { ...this.settings, ...response.data.settings }
      }
    } catch (error) {
      logger.warn('desktopNotifications.settings', 'Failed to load settings, using defaults', { error })
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<DesktopNotificationSettings>): Promise<boolean> {
    try {
      const response = await apiClient.put('/api/notifications/desktop/settings', newSettings)
      
      if (response.data.success) {
        this.settings = { ...this.settings, ...newSettings }
        logger.info('desktopNotifications.settings', 'Settings updated successfully')
        return true
      }
      
      return false
    } catch (error) {
      logger.error('desktopNotifications.settings', 'Failed to update settings', { error })
      return false
    }
  }

  /**
   * Get current settings
   */
  getSettings(): DesktopNotificationSettings {
    return { ...this.settings }
  }

  /**
   * Start polling for pending notifications
   */
  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }

    this.pollInterval = setInterval(async () => {
      await this.checkPendingNotifications()
    }, 3000) // Poll every 3 seconds

    // Check immediately
    this.checkPendingNotifications()
  }

  /**
   * Stop polling for notifications
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Check for pending notifications from backend
   */
  private async checkPendingNotifications(): Promise<void> {
    if (!this.settings.enabled) {
      return
    }

    try {
      const response = await apiClient.get('/api/notifications/desktop/pending')
      
      if (response.data.success && response.data.notifications.length > 0) {
        for (const notification of response.data.notifications) {
          await this.displayNotification(notification)
        }
      }
    } catch (error) {
      // Silent fail to avoid log spam
      if (error.response?.status !== 401) {
        logger.debug('desktopNotifications.poll', 'Failed to check pending notifications', { error })
      }
    }
  }

  /**
   * Display a notification
   */
  private async displayNotification(notification: DesktopNotification): Promise<void> {
    try {
      // Check if notification should be shown based on settings
      if (!this.shouldShowNotification(notification)) {
        return
      }

      // Create web notification
      const webNotification = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.priority),
        tag: notification.id,
        requireInteraction: notification.priority === 'critical',
        silent: !notification.sound || !this.settings.sound_enabled
      })

      // Set up click handler
      webNotification.onclick = () => {
        this.handleNotificationClick(notification.id, notification.clickAction, notification.actionData)
        webNotification.close()
      }

      // Auto-close after specified time
      if (notification.autoClose && notification.priority !== 'critical') {
        setTimeout(() => {
          webNotification.close()
        }, notification.autoClose * 1000)
      } else if (this.settings.auto_close_time > 0 && notification.priority !== 'critical') {
        setTimeout(() => {
          webNotification.close()
        }, this.settings.auto_close_time * 1000)
      }

      logger.info('desktopNotifications.display', 'Notification displayed', {
        id: notification.id,
        title: notification.title,
        priority: notification.priority
      })

    } catch (error) {
      logger.error('desktopNotifications.display', 'Failed to display notification', { error, notification })
    }
  }

  /**
   * Check if notification should be shown based on settings
   */
  private shouldShowNotification(notification: DesktopNotification): boolean {
    // Check if notifications are enabled
    if (!this.settings.enabled) {
      return false
    }

    // Check priority threshold
    const priorities = ['low', 'normal', 'high', 'critical']
    const notificationPriority = priorities.indexOf(notification.priority)
    const thresholdPriority = priorities.indexOf(this.settings.priority_threshold)
    
    if (notificationPriority < thresholdPriority) {
      return false
    }

    // Check quiet hours
    if (this.settings.quiet_hours_enabled && this.isQuietHours()) {
      // Only show critical notifications during quiet hours
      return notification.priority === 'critical'
    }

    return true
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    try {
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes()
      
      const [startHour, startMin] = this.settings.quiet_hours_start.split(':').map(Number)
      const [endHour, endMin] = this.settings.quiet_hours_end.split(':').map(Number)
      
      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin
      
      if (startTime <= endTime) {
        // Same day (e.g., 10:00 - 18:00)
        return currentTime >= startTime && currentTime <= endTime
      } else {
        // Overnight (e.g., 22:00 - 07:00)
        return currentTime >= startTime || currentTime <= endTime
      }
    } catch (error) {
      logger.warn('desktopNotifications.quietHours', 'Error checking quiet hours', { error })
      return false
    }
  }

  /**
   * Get notification icon based on priority
   */
  private getNotificationIcon(priority: string): string {
    // V1-style icon paths (would be updated for actual icon locations)
    const iconBase = '/assets/images/'
    
    switch (priority) {
      case 'critical':
        return `${iconBase}fossa-critical.png`
      case 'high':
        return `${iconBase}fossa-high.png`
      case 'low':
        return `${iconBase}fossa-low.png`
      default:
        return `${iconBase}fossa-normal.png`
    }
  }

  /**
   * Handle notification click
   */
  private async handleNotificationClick(notificationId: string, action?: string, data?: any): Promise<void> {
    try {
      // Notify backend about click
      await apiClient.post(`/api/notifications/desktop/click/${notificationId}`)
      
      // Execute local click handler
      if (action && this.clickHandlers.has(action)) {
        const handler = this.clickHandlers.get(action)!
        handler(data)
      }

      logger.info('desktopNotifications.click', 'Notification clicked', {
        id: notificationId,
        action,
        data
      })

    } catch (error) {
      logger.error('desktopNotifications.click', 'Failed to handle notification click', { error })
    }
  }

  /**
   * Set up default click handlers
   */
  private setupDefaultClickHandlers(): void {
    // Open dashboard
    this.clickHandlers.set('open_dashboard', () => {
      window.location.hash = '/dashboard'
      window.focus()
    })

    // View work order
    this.clickHandlers.set('view_work_order', (data) => {
      if (data?.work_order_id) {
        window.location.hash = `/work-orders?highlight=${data.work_order_id}`
      } else {
        window.location.hash = '/work-orders'
      }
      window.focus()
    })

    // View schedule
    this.clickHandlers.set('view_schedule', () => {
      window.location.hash = '/automation'
      window.focus()
    })

    // Open settings
    this.clickHandlers.set('open_settings', () => {
      window.location.hash = '/settings'
      window.focus()
    })

    // Dismiss (no action)
    this.clickHandlers.set('dismiss', () => {
      // Just bring window to front
      window.focus()
    })
  }

  /**
   * Register a custom click handler
   */
  registerClickHandler(action: string, handler: (data: any) => void): void {
    this.clickHandlers.set(action, handler)
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(title?: string, message?: string, priority?: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/api/notifications/desktop/test', {
        title: title || 'Test Desktop Notification',
        message: message || 'This is a test notification from Fossa Monitor.',
        priority: priority || 'normal'
      })

      return response.data.success
    } catch (error) {
      logger.error('desktopNotifications.test', 'Failed to send test notification', { error })
      return false
    }
  }

  /**
   * Get notification history
   */
  async getHistory(limit = 50): Promise<DesktopNotification[]> {
    try {
      const response = await apiClient.get(`/api/notifications/desktop/history?limit=${limit}`)
      
      if (response.data.success) {
        return response.data.history
      }
      
      return []
    } catch (error) {
      logger.error('desktopNotifications.history', 'Failed to get notification history', { error })
      return []
    }
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.isSupported
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    this.stopPolling()
    this.clickHandlers.clear()
    this.isInitialized = false
    
    logger.info('desktopNotifications.cleanup', 'Desktop notification service cleaned up')
  }
}

// Export singleton instance
export const desktopNotificationService = new DesktopNotificationService()

// Auto-initialize when module loads
desktopNotificationService.initialize().catch(error => {
  logger.error('desktopNotifications.autoInit', 'Failed to auto-initialize desktop notifications', { error })
})