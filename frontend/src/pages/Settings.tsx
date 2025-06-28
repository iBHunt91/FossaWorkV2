import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, User, Bell, Shield, Database, TestTube, Trash2, Moon, Sun, Monitor, Palette, Calendar, Mail, Send, Key, CheckCircle, XCircle, AlertCircle, Settings2, Server, Filter, Clock, Gauge, Eye, ChevronDown, ChevronRight, Zap, Globe, Download, Upload, AlertTriangle, Search, HelpCircle, Sparkles, ArrowRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { 
  getUserPreferences, 
  setUserPreference,
  saveWorkFossaCredentials,
  getWorkFossaCredentials,
  deleteWorkFossaCredentials,
  testWorkFossaCredentials,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
  sendTestNotificationChannel,
  getNotificationChannelsStatus,
  validatePushoverKey,
  type NotificationPreferences,
  type TestNotificationRequest,
  getSMTPSettings,
  updateSMTPSettings,
  testSMTPSettings,
  type SMTPSettings,
  getFilterSettings,
  updateFilterSettings,
  type WorkOrderFilterSettings,
  getAutomationDelays,
  updateAutomationDelays,
  type AutomationDelaySettings,
  getNotificationDisplaySettings,
  updateNotificationDisplaySettings,
  type NotificationDisplaySettings,
  getBrowserSettings,
  updateBrowserSettings,
  type BrowserSettings
} from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import LoadingSpinner from '../components/LoadingSpinner'
import CredentialManager from '../components/CredentialManager'
import ScrapingScheduleEnhanced from '../components/ScrapingScheduleEnhanced'
import DesktopNotificationSettings from '../components/DesktopNotificationSettings'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button'
import { DotsLoader } from '@/components/ui/animated-loader'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import CollapsibleSection from '../components/CollapsibleSection'
import { detectSMTPProvider, type SMTPProviderConfig } from '../services/smtpProviders'

// Form validation utilities
const validationRules = {
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? null : 'Please enter a valid email address'
  },
  port: (value: string) => {
    const port = parseInt(value)
    return (port >= 1 && port <= 65535) ? null : 'Port must be between 1 and 65535'
  },
  required: (value: string) => {
    return value.trim() ? null : 'This field is required'
  },
  url: (value: string) => {
    try {
      new URL(value)
      return null
    } catch {
      return 'Please enter a valid URL'
    }
  },
  timeout: (value: string) => {
    const num = parseInt(value)
    return (num >= 5000 && num <= 60000) ? null : 'Timeout must be between 5000 and 60000 ms'
  },
  delay: (value: string) => {
    const num = parseInt(value)
    return (num >= 0 && num <= 10000) ? null : 'Delay must be between 0 and 10000 ms'
  },
  multiplier: (value: string) => {
    const num = parseFloat(value)
    return (num >= 0.5 && num <= 3.0) ? null : 'Multiplier must be between 0.5 and 3.0'
  },
  retries: (value: string) => {
    const num = parseInt(value)
    return (num >= 1 && num <= 10) ? null : 'Retries must be between 1 and 10'
  }
}

// Enhanced input component with validation
const ValidatedInput: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  validation?: string[]
  type?: string
  placeholder?: string
  required?: boolean
  helpText?: string
}> = ({ label, value, onChange, onBlur, validation = [], type = 'text', placeholder, required, helpText }) => {
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const validate = (val: string) => {
    for (const rule of validation) {
      const validationFunc = validationRules[rule as keyof typeof validationRules]
      if (validationFunc) {
        const result = validationFunc(val)
        if (result) {
          setError(result)
          return
        }
      }
    }
    setError(null)
  }

  const handleBlur = () => {
    setTouched(true)
    validate(value)
    onBlur?.()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    if (touched) {
      validate(newValue)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={label.toLowerCase().replace(/\s+/g, '-')} className="flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        {helpText && (
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
              {helpText}
            </div>
          </div>
        )}
      </div>
      <Input
        id={label.toLowerCase().replace(/\s+/g, '-')}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={error ? 'border-red-500 focus:border-red-500' : ''}
      />
      {error && touched && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  )
}

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('appearance')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [workfossaCredentials, setWorkfossaCredentials] = useState({
    username: '',
    password: ''
  })
  const [credentialTestResult, setCredentialTestResult] = useState<string | null>(null)
  const [notificationTestResult, setNotificationTestResult] = useState<string | null>(null)
  const [pushoverValidationResult, setPushoverValidationResult] = useState<string | null>(null)
  const [smtpTestResult, setSMTPTestResult] = useState<string | null>(null)
  const [smtpTestEmail, setSMTPTestEmail] = useState('')
  const [channelTestResult, setChannelTestResult] = useState<string | null>(null)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [localSMTPSettings, setLocalSMTPSettings] = useState<SMTPSettings | null>(null)
  const [detectedProvider, setDetectedProvider] = useState<SMTPProviderConfig | null>(null)
  const [emailForDetection, setEmailForDetection] = useState('')
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  
  const currentUserId = user?.id || 'demo' // Fallback to demo user if not authenticated
  
  // Calculate setup completion progress with better guidance
  const calculateSetupProgress = () => {
    const checks = [
      { 
        name: 'Theme Selected', 
        completed: !!theme,
        description: 'Choose your preferred visual appearance',
        action: 'Go to Appearance tab',
        tab: 'appearance',
        section: null
      },
      { 
        name: 'Logged In', 
        completed: !!user?.id && user?.id !== 'demo',
        description: 'Sign in with your WorkFossa account',
        action: 'Already logged in via login screen',
        tab: null,
        section: null
      },
      { 
        name: 'Email Configured', 
        completed: !!smtpSettings?.smtp_server,
        description: 'Set up email notifications for important updates',
        action: 'Go to Technical tab → SMTP Configuration',
        tab: 'advanced',
        section: 'smtp-settings'
      },
      { 
        name: 'Notifications Setup', 
        completed: !!notificationPreferences?.preferences?.email_enabled || !!notificationPreferences?.preferences?.pushover_enabled,
        description: 'Enable at least one notification channel',
        action: 'Go to Notifications tab',
        tab: 'notifications',
        section: 'notification-preferences'
      },
      { 
        name: 'Automation Ready', 
        completed: !!automationDelays?.form_field_delay,
        description: 'Configure automation timing and behavior',
        action: 'Go to Automation tab',
        tab: 'automation',
        section: 'automation-delays'
      }
    ]
    
    const completed = checks.filter(check => check.completed).length
    const total = checks.length
    const percentage = Math.round((completed / total) * 100)
    
    return { checks, completed, total, percentage }
  }

  
  // Debug logging
  console.log('Settings page - Current user:', user)
  console.log('Settings page - Current user ID:', currentUserId)

  // Handle URL parameters
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const sectionParam = searchParams.get('section')
    
    if (tabParam) {
      setActiveTab(tabParam)
      
      // If a specific section is requested, expand it
      if (sectionParam) {
        setExpandedSections(new Set([sectionParam]))
      } else {
        // For direct tab navigation, expand relevant sections
        if (tabParam === 'notifications') {
          // Expand all notification sections by default for better UX
          setExpandedSections(new Set([
            'email-notifications',
            'pushover-notifications',
            'notification-preferences'
          ]))
        }
      }
    }
  }, [searchParams])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const { data: preferences, isLoading, refetch } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
    onSuccess: (data) => {
      console.log('User preferences loaded:', data)
    },
    onError: (error) => {
      console.error('Failed to load user preferences:', error)
    }
  })

  const { data: savedCredentials } = useQuery({
    queryKey: ['workfossa-credentials', currentUserId],
    queryFn: () => getWorkFossaCredentials(currentUserId),
  })

  const { data: notificationPreferences, isLoading: notificationLoading, refetch: refetchNotifications, error: notificationError } = useQuery({
    queryKey: ['notification-preferences', currentUserId],
    queryFn: () => getNotificationPreferences(currentUserId),
    onSuccess: (data) => {
      console.log('Notification preferences loaded:', data)
    },
    onError: (error) => {
      console.error('Failed to load notification preferences:', error)
    }
  })
  
  // Debug notification preferences
  useEffect(() => {
    if (notificationPreferences) {
      console.log('Current notification preferences state:', notificationPreferences)
    }
    if (notificationError) {
      console.error('Notification preferences error:', notificationError)
    }
  }, [notificationPreferences, notificationError])

  const { data: smtpSettings, isLoading: smtpLoading, refetch: refetchSMTP, error: smtpError } = useQuery({
    queryKey: ['smtp-settings', currentUserId],
    queryFn: () => getSMTPSettings(currentUserId),
    onSuccess: (data) => {
      console.log('SMTP settings loaded:', data)
    },
    onError: (error) => {
      console.error('Failed to load SMTP settings:', error)
    }
  })
  
  // Debug SMTP loading state
  useEffect(() => {
    console.log('SMTP Debug:', {
      isLoading: smtpLoading,
      error: smtpError,
      data: smtpSettings,
      localSMTPSettings,
      currentUserId
    })
  }, [smtpLoading, smtpError, smtpSettings, localSMTPSettings, currentUserId])

  const { data: filterSettings } = useQuery({
    queryKey: ['filter-settings', currentUserId],
    queryFn: () => getFilterSettings(currentUserId),
  })

  const { data: automationDelays } = useQuery({
    queryKey: ['automation-delays', currentUserId],
    queryFn: () => getAutomationDelays(currentUserId),
  })

  const { data: displaySettings } = useQuery({
    queryKey: ['notification-display', currentUserId],
    queryFn: () => getNotificationDisplaySettings(currentUserId),
  })

  const { data: browserSettings, refetch: refetchBrowserSettings } = useQuery({
    queryKey: ['browser-settings', currentUserId],
    queryFn: () => getBrowserSettings(currentUserId),
  })

  // Sync SMTP settings to local state
  useEffect(() => {
    if (smtpSettings && !localSMTPSettings) {
      setLocalSMTPSettings(smtpSettings)
    } else if (!smtpSettings && !localSMTPSettings) {
      // Initialize with default values if no settings exist
      setLocalSMTPSettings({
        smtp_server: '',
        smtp_port: 587,
        username: '',
        password: '',
        use_tls: true,
        use_ssl: false,
        from_email: '',
        from_name: 'FossaWork Automation',
        timeout: 30
      })
    }
  }, [smtpSettings, localSMTPSettings])

  const updatePreferenceMutation = useMutation({
    mutationFn: ({ type, data }: { type: string; data: any }) =>
      setUserPreference(currentUserId, type, data),
    onSuccess: (response, variables) => {
      console.log('Preference update successful:', variables, response)
      // Invalidate with the specific user ID
      queryClient.invalidateQueries({ queryKey: ['user-preferences', currentUserId] })
      // Force refetch
      queryClient.refetchQueries({ queryKey: ['user-preferences', currentUserId] })
    },
    onError: (error, variables) => {
      console.error('Preference update failed:', variables, error)
    }
  })

  const saveCredentialsMutation = useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      saveWorkFossaCredentials(currentUserId, credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workfossa-credentials'] })
      setCredentialTestResult('✅ Credentials verified and saved successfully!')
      setTimeout(() => setCredentialTestResult(null), 3000)
    },
    onError: (error: any) => {
      setCredentialTestResult(`❌ Failed to save: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setCredentialTestResult(null), 5000)
    }
  })

  const testCredentialsMutation = useMutation({
    mutationFn: () => testWorkFossaCredentials(currentUserId),
    onSuccess: (result) => {
      setCredentialTestResult(
        result.status === 'success' 
          ? '✅ Login test successful!' 
          : `❌ ${result.message}`
      )
      setTimeout(() => setCredentialTestResult(null), 5000)
    },
    onError: (error: any) => {
      setCredentialTestResult(`❌ Test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setCredentialTestResult(null), 5000)
    }
  })

  const deleteCredentialsMutation = useMutation({
    mutationFn: () => deleteWorkFossaCredentials(currentUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workfossa-credentials'] })
      setWorkfossaCredentials({ username: '', password: '' })
      setCredentialTestResult('Credentials deleted successfully!')
      setTimeout(() => setCredentialTestResult(null), 3000)
    }
  })

  const updateNotificationMutation = useMutation({
    mutationFn: (preferences: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(currentUserId, preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', currentUserId] })
      setNotificationTestResult('✅ Notification preferences updated successfully!')
      setTimeout(() => setNotificationTestResult(null), 3000)
    },
    onError: (error: any) => {
      setNotificationTestResult(`❌ Failed to update: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setNotificationTestResult(null), 5000)
    }
  })

  const testNotificationMutation = useMutation({
    mutationFn: (testRequest: TestNotificationRequest) =>
      sendTestNotification(currentUserId, testRequest),
    onSuccess: () => {
      setNotificationTestResult('✅ Test notification sent successfully!')
      setTimeout(() => setNotificationTestResult(null), 3000)
    },
    onError: (error: any) => {
      setNotificationTestResult(`❌ Test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setNotificationTestResult(null), 5000)
    }
  })

  const validatePushoverMutation = useMutation({
    mutationFn: (pushoverKey: string) =>
      validatePushoverKey(currentUserId, pushoverKey),
    onSuccess: (result) => {
      setPushoverValidationResult(
        result.is_valid 
          ? '✅ Pushover key is valid!' 
          : '❌ Pushover key is invalid'
      )
      setTimeout(() => setPushoverValidationResult(null), 5000)
    },
    onError: (error: any) => {
      setPushoverValidationResult(`❌ Validation failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setPushoverValidationResult(null), 5000)
    }
  })

  const updateSMTPMutation = useMutation({
    mutationFn: (settings: SMTPSettings) =>
      updateSMTPSettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtp-settings', currentUserId] })
      setSMTPTestResult('✅ SMTP settings saved successfully!')
      setTimeout(() => setSMTPTestResult(null), 3000)
    },
    onError: (error: any) => {
      setSMTPTestResult(`❌ Failed to save: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setSMTPTestResult(null), 5000)
    }
  })

  const testSMTPMutation = useMutation({
    mutationFn: (testEmail: string) =>
      testSMTPSettings(currentUserId, testEmail),
    onSuccess: () => {
      setSMTPTestResult('✅ Test email sent successfully!')
      setTimeout(() => setSMTPTestResult(null), 3000)
    },
    onError: (error: any) => {
      setSMTPTestResult(`❌ SMTP test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setSMTPTestResult(null), 5000)
    }
  })

  const updateFilterSettingsMutation = useMutation({
    mutationFn: (settings: WorkOrderFilterSettings) =>
      updateFilterSettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-settings', currentUserId] })
    }
  })

  const updateAutomationDelaysMutation = useMutation({
    mutationFn: (settings: AutomationDelaySettings) =>
      updateAutomationDelays(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-delays', currentUserId] })
    }
  })

  const updateDisplaySettingsMutation = useMutation({
    mutationFn: (settings: NotificationDisplaySettings) =>
      updateNotificationDisplaySettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-display', currentUserId] })
    }
  })

  const updateBrowserSettingsMutation = useMutation({
    mutationFn: (settings: BrowserSettings) =>
      updateBrowserSettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-settings', currentUserId] })
      refetchBrowserSettings()
    }
  })

  const testChannelMutation = useMutation({
    mutationFn: (channel: string) => sendTestNotificationChannel(channel),
    onSuccess: (data, channel) => {
      setChannelTestResult(`✅ ${channel.charAt(0).toUpperCase() + channel.slice(1)} test sent successfully!`)
      setTimeout(() => setChannelTestResult(null), 3000)
    },
    onError: (error: any, channel) => {
      setChannelTestResult(`❌ ${channel.charAt(0).toUpperCase() + channel.slice(1)} test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setChannelTestResult(null), 5000)
    }
  })

  const handlePreferenceUpdate = (type: string, data: any) => {
    console.log('handlePreferenceUpdate called:', { type, data, userId: currentUserId })
    updatePreferenceMutation.mutate({ type, data })
  }

  const handleSaveCredentials = async () => {
    if (!workfossaCredentials.username.trim() || !workfossaCredentials.password.trim()) {
      setCredentialTestResult('❌ Please enter both username and password')
      setTimeout(() => setCredentialTestResult(null), 3000)
      return
    }
    
    // Test credentials against app.workfossa.com BEFORE saving
    setCredentialTestResult('🔍 Testing credentials against app.workfossa.com...')
    
    try {
      const testResult = await testWorkFossaCredentials(currentUserId, workfossaCredentials)
      
      if (testResult.status === 'success') {
        setCredentialTestResult('✅ Credentials verified! Saving...')
        // Credentials are valid, now save them
        saveCredentialsMutation.mutate(workfossaCredentials)
      } else {
        setCredentialTestResult(`❌ Invalid credentials: ${testResult.message}`)
        setTimeout(() => setCredentialTestResult(null), 5000)
      }
    } catch (error: any) {
      setCredentialTestResult(`❌ Test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setCredentialTestResult(null), 5000)
    }
  }

  const handleTestCredentials = async () => {
    if (!savedCredentials?.has_credentials) {
      setCredentialTestResult('❌ Please save credentials first')
      setTimeout(() => setCredentialTestResult(null), 3000)
      return
    }
    
    setCredentialTestResult('🔍 Testing saved credentials against app.workfossa.com...')
    
    try {
      const testResult = await testWorkFossaCredentials(currentUserId)
      setCredentialTestResult(
        testResult.status === 'success' 
          ? `✅ ${testResult.message}` 
          : `❌ ${testResult.message}`
      )
      setTimeout(() => setCredentialTestResult(null), 5000)
    } catch (error: any) {
      setCredentialTestResult(`❌ Test failed: ${error.response?.data?.detail || error.message}`)
      setTimeout(() => setCredentialTestResult(null), 5000)
    }
  }

  const handleDeleteCredentials = () => {
    // Delete without confirmation
    deleteCredentialsMutation.mutate()
  }

  // Load saved credentials into form when available
  React.useEffect(() => {
    if (savedCredentials?.has_credentials) {
      setWorkfossaCredentials(prev => ({
        ...prev,
        username: savedCredentials.username
      }))
    }
  }, [savedCredentials])

  // Calculate setup progress with memoization to prevent excessive re-renders
  const setupProgress = useMemo(() => {
    // Always calculate progress, even if some data is still loading
    return calculateSetupProgress()
  }, [savedCredentials, smtpSettings, notificationPreferences, automationDelays, theme])

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'filters', label: 'Filters & Data', icon: Filter },
    { id: 'advanced', label: 'Technical', icon: Settings2 },
  ]

  // Filter tabs based on search query
  const filteredTabs = tabs.filter(tab => 
    searchQuery === '' || 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Don't block the entire UI if just some data is loading
  // The individual sections can show loading states if needed

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Enhanced Header with Progress and Search */}
        <header className="animate-slide-in-from-top space-y-4 lg:space-y-6">
          <div className="flex flex-col gap-4">
            {/* Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">
                  <GradientText text="Settings" gradient="from-blue-600 via-purple-600 to-pink-600" />
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                  <AnimatedText text="Configure your FossaWork V2 preferences" animationType="split" delay={0.2} />
                </p>
              </div>
              
              {/* Mobile Quick Actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Navigate to first incomplete item
                    const firstIncomplete = setupProgress.checks.find(check => !check.completed)
                    if (firstIncomplete) {
                      if (firstIncomplete.tab) {
                        setActiveTab(firstIncomplete.tab)
                        if (firstIncomplete.section) {
                          setExpandedSections(new Set([firstIncomplete.section]))
                          setTimeout(() => {
                            const element = document.getElementById(firstIncomplete.section)
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }
                          }, 100)
                        }
                      } else if (firstIncomplete.name === 'Logged In') {
                        window.location.href = '/login'
                      }
                    }
                  }}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Setup Guide</span>
                  <span className="sm:hidden">Setup</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/docs/guides/QUICK_START_GUIDE.md', '_blank')}
                className="hidden lg:flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Help
              </Button>
            </div>
          </div>

          {/* Setup Progress Banner */}
          {setupProgress.percentage === 100 ? (
            <Card className="border-green-500/20 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-800 dark:text-green-200">Setup Complete!</h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your FossaWork V2 is fully configured and ready to use. All core features are properly set up.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900"
                    onClick={() => window.location.href = '/dashboard'}
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : setupProgress.percentage < 100 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Setup Progress</h3>
                    <Badge variant="secondary">{setupProgress.completed}/{setupProgress.total}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{setupProgress.percentage}% complete</span>
                </div>
                
                <div className="w-full bg-secondary rounded-full h-2 mb-3">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${setupProgress.percentage}%` }}
                  />
                </div>
                
                {/* Next Steps Guidance */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Next Steps:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {setupProgress.checks
                      .filter(check => !check.completed)
                      .slice(0, 2) // Show only first 2 pending items to avoid clutter
                      .map((check, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (check.tab) {
                              setActiveTab(check.tab)
                              if (check.section) {
                                setExpandedSections(new Set([check.section]))
                                // Scroll to section after a short delay
                                setTimeout(() => {
                                  const element = document.getElementById(check.section)
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                }, 100)
                              }
                            } else if (check.name === 'Logged In') {
                              // If not logged in, redirect to login
                              window.location.href = '/login'
                            }
                          }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 hover:border-primary/50 transition-all cursor-pointer text-left w-full"
                        >
                          <div className="mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{check.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 break-words">{check.description}</div>
                            <div className="text-xs text-primary mt-1 font-medium hover:underline">{check.action}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                  
                  {setupProgress.checks.filter(check => !check.completed).length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{setupProgress.checks.filter(check => !check.completed).length - 2} more steps to complete
                    </div>
                  )}
                </div>
                
                {/* Quick Status Overview */}
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex flex-wrap gap-2">
                    {setupProgress.checks.map((check, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (!check.completed) {
                            if (check.tab) {
                              setActiveTab(check.tab)
                              if (check.section) {
                                setExpandedSections(new Set([check.section]))
                                setTimeout(() => {
                                  const element = document.getElementById(check.section)
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                }, 100)
                              }
                            } else if (check.name === 'Logged In') {
                              window.location.href = '/login'
                            }
                          }
                        }}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                          check.completed 
                            ? 'cursor-default' 
                            : 'cursor-pointer hover:bg-muted/50'
                        }`}
                        disabled={check.completed}
                      >
                        {check.completed ? (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={check.completed ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'}>
                          {check.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => {
                      // Navigate to first incomplete item
                      const firstIncomplete = setupProgress.checks.find(check => !check.completed)
                      if (firstIncomplete) {
                        if (firstIncomplete.tab) {
                          setActiveTab(firstIncomplete.tab)
                          if (firstIncomplete.section) {
                            setExpandedSections(new Set([firstIncomplete.section]))
                            setTimeout(() => {
                              const element = document.getElementById(firstIncomplete.section)
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }, 100)
                          }
                        } else if (firstIncomplete.name === 'Logged In') {
                          window.location.href = '/login'
                        }
                      }
                    }}
                    className="mt-3 w-full lg:w-auto"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continue Setup
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
          </div>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-[250px_1fr] gap-4 lg:gap-8">
          {/* Mobile Tab Navigation - Horizontal Scroll */}
          <nav className="lg:hidden">
            {searchQuery && (
              <div className="text-sm text-muted-foreground mb-3">
                {filteredTabs.length === 0 ? 'No settings found' : `${filteredTabs.length} result(s)`}
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {filteredTabs.map((tab, index) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      // Automatically expand sections for better UX
                      if (tab.id === 'notifications') {
                        setExpandedSections(new Set([
                          'notification-status',
                          'email-notifications',
                          'pushover-notifications',
                          'desktop-notifications',
                          'notification-preferences'
                        ]))
                      } else if (tab.id === 'automation') {
                        setExpandedSections(new Set([
                          'scraping-schedule',
                          'automation-delays'
                        ]))
                      } else if (tab.id === 'filters') {
                        setExpandedSections(new Set(['filter-settings']))
                      } else if (tab.id === 'advanced') {
                        setExpandedSections(new Set(['smtp-settings']))
                      } else {
                        setExpandedSections(new Set())
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all text-sm font-medium ${
                      activeTab === tab.id 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Desktop Tab Navigation - Vertical */}
          <nav className="hidden lg:block space-y-2">
            {searchQuery && (
              <div className="text-sm text-muted-foreground mb-4">
                {filteredTabs.length === 0 ? 'No settings found' : `${filteredTabs.length} result(s)`}
              </div>
            )}
            {filteredTabs.map((tab, index) => {
              const Icon = tab.icon
              return (
                <MagneticButton
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    // Automatically expand sections for better UX
                    if (tab.id === 'notifications') {
                      setExpandedSections(new Set([
                        'notification-status',
                        'email-notifications',
                        'pushover-notifications',
                        'desktop-notifications',
                        'notification-preferences'
                      ]))
                    } else if (tab.id === 'automation') {
                      setExpandedSections(new Set([
                        'scraping-schedule',
                        'automation-delays'
                      ]))
                    } else if (tab.id === 'filters') {
                      setExpandedSections(new Set(['filter-settings']))
                    } else if (tab.id === 'advanced') {
                      setExpandedSections(new Set(['smtp-settings']))
                    } else {
                      setExpandedSections(new Set())
                    }
                  }}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  className="w-full justify-start animate-slide-in-from-left"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  strength={0.1}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {tab.label}
                </MagneticButton>
              )
            })}
          </nav>

          {/* Tab Content */}
          <div className="min-h-[600px]">

            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <Card className="animate-slide-in-from-bottom">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <Palette className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle>Theme Settings</CardTitle>
                        <CardDescription>Customize how FossaWork looks</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-4">Theme Mode</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {[
                          { value: 'light' as const, icon: Sun, label: 'Light' },
                          { value: 'dark' as const, icon: Moon, label: 'Dark' },
                          { value: 'system' as const, icon: Monitor, label: 'System' }
                        ].map((option) => {
                          const Icon = option.icon
                          return (
                            <div
                              key={option.value}
                              onClick={() => setTheme(option.value)}
                              className={`relative flex flex-col sm:flex-col items-center justify-center p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all card-hover ${
                                theme === option.value 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <Icon className={`w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 ${theme === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-sm font-medium">{option.label}</span>
                              {theme === option.value && (
                                <div className="absolute top-2 right-2">
                                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-sm font-medium mb-4">Quick Toggle</h3>
                      <div className="flex items-center justify-between p-4 rounded-lg border glass">
                        <span className="text-sm">Theme Toggle Button</span>
                        <ThemeToggle />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
                {/* Show loading state if data is still loading */}
                {notificationLoading && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Loading notification settings...</AlertDescription>
                  </Alert>
                )}
                
                {/* Show error state if there's an error */}
                {notificationError && (
                  <Alert className="border-red-500 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-600">
                      Failed to load notification settings. Please refresh the page.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Notification Channels Status Overview */}
                <CollapsibleSection
                  id="notification-status"
                  title="Notification Channels Status"
                  description="Overview of your notification configuration and channel availability"
                  icon={CheckCircle}
                  isExpanded={expandedSections.has('notification-status')}
                  onToggle={() => toggleSection('notification-status')}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span className="font-medium">Email</span>
                        </div>
                        <Badge variant={notificationPreferences?.preferences?.email_enabled ? "default" : "secondary"}>
                          {notificationPreferences?.preferences?.email_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        SMTP configured: {smtpSettings?.settings?.smtp_server ? '✅' : '❌'}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        disabled={testChannelMutation.isPending}
                        onClick={() => testChannelMutation.mutate('email')}
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test
                      </Button>
                    </div>

                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          <span className="font-medium">Pushover</span>
                        </div>
                        <Badge variant={notificationPreferences?.preferences?.pushover_enabled ? "default" : "secondary"}>
                          {notificationPreferences?.preferences?.pushover_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        User key set: {notificationPreferences?.preferences?.pushover_user_key ? '✅' : '❌'}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        disabled={!notificationPreferences?.preferences?.pushover_enabled || testChannelMutation.isPending}
                        onClick={() => testChannelMutation.mutate('pushover')}
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test
                      </Button>
                    </div>

                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          <span className="font-medium">Desktop</span>
                        </div>
                        <Badge variant="default">
                          Supported
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Browser notifications available
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        disabled={testChannelMutation.isPending}
                        onClick={() => testChannelMutation.mutate('desktop')}
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <AnimatedButton
                      onClick={() => testChannelMutation.mutate('all')}
                      disabled={testChannelMutation.isPending}
                      animation="shimmer"
                      className="flex-1"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Test All Channels
                    </AnimatedButton>
                  </div>

                  {channelTestResult && (
                    <Alert className={channelTestResult.includes('✅') ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                      <AlertDescription>{channelTestResult}</AlertDescription>
                    </Alert>
                  )}
                </CollapsibleSection>
                
                {/* Debug helper - expand all sections button */}
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allSections = [
                        'notification-status',
                        'email-notifications',
                        'pushover-notifications', 
                        'desktop-notifications',
                        'notification-preferences',
                        'notification-backup',
                        'notification-help'
                      ]
                      const allExpanded = allSections.every(section => expandedSections.has(section))
                      if (allExpanded) {
                        setExpandedSections(new Set())
                      } else {
                        setExpandedSections(new Set(allSections))
                      }
                    }}
                  >
                    {expandedSections.size >= 7 ? 'Collapse All' : 'Expand All'}
                  </Button>
                </div>
                
                {/* Email Configuration */}
                <CollapsibleSection
                  id="email-notifications"
                  title="Email Notifications"
                  description="Configure email notification preferences and recipient settings"
                  icon={Mail}
                  isExpanded={expandedSections.has('email-notifications')}
                  onToggle={() => toggleSection('email-notifications')}
                >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Enable Email Notifications</Label>
                        <input 
                          type="checkbox" 
                          checked={notificationPreferences?.preferences?.email_enabled ?? true}
                          onChange={(e) => updateNotificationMutation.mutate({ email_enabled: e.target.checked })}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                        />
                      </div>
                      
                      <ValidatedInput
                        label="Recipient Email"
                        value={user?.email || ''}
                        onChange={() => {}} // Disabled field
                        validation={['email']}
                        placeholder="Your email address"
                        helpText="Email notifications will be sent to your account email address"
                      />

                      <ValidatedInput
                        label="Daily Digest Time"
                        value={notificationPreferences?.preferences?.digest_time || '08:00'}
                        onChange={(value) => updateNotificationMutation.mutate({ digest_time: value })}
                        type="time"
                        helpText="Time to receive daily summary emails"
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <ValidatedInput
                          label="Quiet Hours Start"
                          value={notificationPreferences?.preferences?.quiet_hours_start || '22:00'}
                          onChange={(value) => updateNotificationMutation.mutate({ quiet_hours_start: value })}
                          type="time"
                          helpText="Start of quiet period"
                        />
                        <ValidatedInput
                          label="Quiet Hours End"
                          value={notificationPreferences?.preferences?.quiet_hours_end || '07:00'}
                          onChange={(value) => updateNotificationMutation.mutate({ quiet_hours_end: value })}
                          type="time"
                          helpText="End of quiet period"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <AnimatedButton
                        onClick={() => testNotificationMutation.mutate({ 
                          notification_type: 'automation_completed',
                          channel: 'email'
                        })}
                        disabled={testNotificationMutation.isPending}
                        variant="secondary"
                        animation="pulse"
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Email
                      </AnimatedButton>
                      <AnimatedButton
                        onClick={async () => {
                          try {
                            await sendTestNotificationChannel('email')
                            setNotificationTestResult('✅ Email test sent successfully!')
                            setTimeout(() => setNotificationTestResult(null), 3000)
                          } catch (error: any) {
                            setNotificationTestResult(`❌ Email test failed: ${error.response?.data?.detail || error.message}`)
                            setTimeout(() => setNotificationTestResult(null), 5000)
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Quick Test
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>

                {/* Pushover Configuration */}
                <CollapsibleSection
                  id="pushover-notifications"
                  title="Pushover Notifications"
                  description="Configure Pushover real-time push notifications for instant alerts"
                  icon={Send}
                  isExpanded={expandedSections.has('pushover-notifications')}
                  onToggle={() => toggleSection('pushover-notifications')}
                >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Enable Pushover Notifications</Label>
                        <input 
                          type="checkbox" 
                          checked={notificationPreferences?.preferences?.pushover_enabled ?? false}
                          onChange={(e) => updateNotificationMutation.mutate({ pushover_enabled: e.target.checked })}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <ValidatedInput
                            label="Pushover User Key"
                            value={notificationPreferences?.preferences?.pushover_user_key || ''}
                            onChange={(value) => updateNotificationMutation.mutate({ pushover_user_key: value })}
                            type="password"
                            validation={['required']}
                            placeholder="Enter your Pushover user key"
                            helpText="Get your user key from pushover.net"
                            required
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              onClick={() => {
                                const key = notificationPreferences?.preferences?.pushover_user_key
                                if (key) {
                                  validatePushoverMutation.mutate(key)
                                }
                              }}
                              disabled={validatePushoverMutation.isPending || !notificationPreferences?.preferences?.pushover_user_key}
                              variant="outline"
                              size="sm"
                            >
                              <Key className="w-4 h-4 mr-2" />
                              {validatePushoverMutation.isPending ? 'Validating...' : 'Validate Key'}
                            </Button>
                            <Button
                              onClick={() => window.open('https://pushover.net', '_blank')}
                              variant="ghost"
                              size="sm"
                            >
                              <Globe className="w-4 h-4 mr-2" />
                              Get API Key
                            </Button>
                          </div>
                          {pushoverValidationResult && (
                            <Alert className={`mt-2 ${pushoverValidationResult.includes('✅') ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                              <AlertDescription>{pushoverValidationResult}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        <ValidatedInput
                          label="Device Name (Optional)"
                          value={notificationPreferences?.preferences?.pushover_device || ''}
                          onChange={(value) => updateNotificationMutation.mutate({ pushover_device: value })}
                          placeholder="Device name for targeting specific devices"
                          helpText="Leave empty to send to all devices, or specify a device name"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="pushover-sound" className="flex items-center gap-2">
                            Notification Sound
                            <div className="group relative">
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                Choose from Pushover's built-in sounds
                              </div>
                            </div>
                          </Label>
                        </div>
                        <select 
                          id="pushover-sound" 
                          value={notificationPreferences?.preferences?.pushover_sound || 'pushover'}
                          onChange={(e) => updateNotificationMutation.mutate({ pushover_sound: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary transition-colors"
                        >
                          <option value="pushover">Pushover (default)</option>
                          <option value="bike">Bike</option>
                          <option value="bugle">Bugle</option>
                          <option value="cashregister">Cash Register</option>
                          <option value="classical">Classical</option>
                          <option value="cosmic">Cosmic</option>
                          <option value="falling">Falling</option>
                          <option value="gamelan">Gamelan</option>
                          <option value="incoming">Incoming</option>
                          <option value="intermission">Intermission</option>
                          <option value="magic">Magic</option>
                          <option value="mechanical">Mechanical</option>
                          <option value="pianobar">Piano Bar</option>
                          <option value="siren">Siren</option>
                          <option value="spacealarm">Space Alarm</option>
                          <option value="tugboat">Tugboat</option>
                          <option value="alien">Alien Alarm (long)</option>
                          <option value="climb">Climb (long)</option>
                          <option value="persistent">Persistent (long)</option>
                          <option value="echo">Pushover Echo (long)</option>
                          <option value="updown">Up Down (long)</option>
                          <option value="none">Silent</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <AnimatedButton
                        onClick={() => testNotificationMutation.mutate({ 
                          notification_type: 'automation_completed',
                          channel: 'pushover'
                        })}
                        disabled={testNotificationMutation.isPending || !notificationPreferences?.preferences?.pushover_enabled}
                        variant="secondary"
                        animation="pulse"
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Pushover
                      </AnimatedButton>
                      <AnimatedButton
                        onClick={async () => {
                          try {
                            await sendTestNotificationChannel('pushover')
                            setNotificationTestResult('✅ Pushover test sent successfully!')
                            setTimeout(() => setNotificationTestResult(null), 3000)
                          } catch (error: any) {
                            setNotificationTestResult(`❌ Pushover test failed: ${error.response?.data?.detail || error.message}`)
                            setTimeout(() => setNotificationTestResult(null), 5000)
                          }
                        }}
                        disabled={!notificationPreferences?.preferences?.pushover_enabled}
                        variant="outline"
                        size="sm"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Quick Test
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>

                {/* Desktop Notification Configuration */}
                <CollapsibleSection
                  id="desktop-notifications"
                  title="Desktop Notifications"
                  description="Configure desktop notification behavior and appearance"
                  icon={Monitor}
                  isExpanded={expandedSections.has('desktop-notifications')}
                  onToggle={() => toggleSection('desktop-notifications')}
                >
                  <DesktopNotificationSettings className="border-0 shadow-none p-0" />
                </CollapsibleSection>

                {/* Notification Type Configuration */}
                <CollapsibleSection
                  id="notification-preferences"
                  title="Notification Preferences"
                  description="Choose which notifications to receive and through which channels"
                  icon={Bell}
                  isExpanded={expandedSections.has('notification-preferences')}
                  onToggle={() => toggleSection('notification-preferences')}
                >
                    <div className="space-y-4">
                      {[
                        { key: 'automation_started', label: 'Automation Started', description: 'When a new automation job begins' },
                        { key: 'automation_completed', label: 'Automation Completed', description: 'When an automation job finishes successfully' },
                        { key: 'automation_failed', label: 'Automation Failed', description: 'When an automation job encounters an error' },
                        { key: 'automation_progress', label: 'Progress Updates', description: 'Real-time progress during automation' },
                        { key: 'schedule_change', label: 'Schedule Changes', description: 'When work order schedules are modified' },
                        { key: 'daily_digest', label: 'Daily Digest', description: 'Daily summary of completed work' },
                        { key: 'error_alert', label: 'System Errors', description: 'Critical system errors and alerts' }
                      ].map((notification) => (
                        <div key={notification.key} className="border rounded-lg p-4 space-y-3">
                          <div>
                            <h4 className="font-medium">{notification.label}</h4>
                            <p className="text-sm text-muted-foreground">{notification.description}</p>
                          </div>
                          <div className="flex gap-2">
                            {['email', 'pushover', 'desktop', 'all', 'none'].map((channel) => (
                              <label key={channel} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`${notification.key}_channel`}
                                  value={channel}
                                  checked={notificationPreferences?.preferences?.[notification.key] === channel}
                                  onChange={(e) => updateNotificationMutation.mutate({ [notification.key]: e.target.value })}
                                  className="w-3 h-3 text-primary focus:ring-primary"
                                />
                                <span className="text-xs capitalize">{channel}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unified Testing Interface */}
                    <Card className="border-muted bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 mt-6">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <TestTube className="w-5 h-5 text-primary" />
                            <div>
                              <h4 className="font-semibold">Notification Testing Center</h4>
                              <p className="text-sm text-muted-foreground">Test all configured notification channels from one place</p>
                            </div>
                          </div>
                          <Badge variant={notificationTestResult?.includes('✅') ? 'default' : 'secondary'}>
                            {notificationTestResult?.includes('✅') ? 'Success' : 'Ready'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          <Button
                            onClick={async () => {
                              try {
                                await sendTestNotificationChannel('email')
                                setNotificationTestResult('✅ Email test sent successfully!')
                                setTimeout(() => setNotificationTestResult(null), 3000)
                              } catch (error: any) {
                                setNotificationTestResult(`❌ Email test failed: ${error.response?.data?.detail || error.message}`)
                                setTimeout(() => setNotificationTestResult(null), 5000)
                              }
                            }}
                            variant="outline"
                            className="flex items-center gap-2 h-12"
                            disabled={!notificationPreferences?.preferences?.email_enabled}
                          >
                            <Mail className="w-4 h-4" />
                            <div className="text-left">
                              <div className="font-medium">Email</div>
                              <div className="text-xs text-muted-foreground">
                                {notificationPreferences?.preferences?.email_enabled ? 'Enabled' : 'Disabled'}
                              </div>
                            </div>
                          </Button>
                          
                          <Button
                            onClick={async () => {
                              try {
                                await sendTestNotificationChannel('pushover')
                                setNotificationTestResult('✅ Pushover test sent successfully!')
                                setTimeout(() => setNotificationTestResult(null), 3000)
                              } catch (error: any) {
                                setNotificationTestResult(`❌ Pushover test failed: ${error.response?.data?.detail || error.message}`)
                                setTimeout(() => setNotificationTestResult(null), 5000)
                              }
                            }}
                            variant="outline"
                            className="flex items-center gap-2 h-12"
                            disabled={!notificationPreferences?.preferences?.pushover_enabled}
                          >
                            <Send className="w-4 h-4" />
                            <div className="text-left">
                              <div className="font-medium">Pushover</div>
                              <div className="text-xs text-muted-foreground">
                                {notificationPreferences?.preferences?.pushover_enabled ? 'Enabled' : 'Disabled'}
                              </div>
                            </div>
                          </Button>
                          
                          <Button
                            onClick={async () => {
                              try {
                                await sendTestNotificationChannel('desktop')
                                setNotificationTestResult('✅ Desktop test sent successfully!')
                                setTimeout(() => setNotificationTestResult(null), 3000)
                              } catch (error: any) {
                                setNotificationTestResult(`❌ Desktop test failed: ${error.response?.data?.detail || error.message}`)
                                setTimeout(() => setNotificationTestResult(null), 5000)
                              }
                            }}
                            variant="outline"
                            className="flex items-center gap-2 h-12"
                          >
                            <Monitor className="w-4 h-4" />
                            <div className="text-left">
                              <div className="font-medium">Desktop</div>
                              <div className="text-xs text-muted-foreground">Always Available</div>
                            </div>
                          </Button>
                        </div>
                        
                        {/* Test All Button */}
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <Button
                            onClick={async () => {
                              setNotificationTestResult('🔄 Testing all enabled channels...')
                              let results = []
                              
                              // Test each enabled channel
                              if (notificationPreferences?.preferences?.email_enabled) {
                                try {
                                  await sendTestNotificationChannel('email')
                                  results.push('Email ✅')
                                } catch {
                                  results.push('Email ❌')
                                }
                              }
                              
                              if (notificationPreferences?.preferences?.pushover_enabled) {
                                try {
                                  await sendTestNotificationChannel('pushover')
                                  results.push('Pushover ✅')
                                } catch {
                                  results.push('Pushover ❌')
                                }
                              }
                              
                              try {
                                await sendTestNotificationChannel('desktop')
                                results.push('Desktop ✅')
                              } catch {
                                results.push('Desktop ❌')
                              }
                              
                              setNotificationTestResult(`📊 Test Results: ${results.join(' | ')}`)
                              setTimeout(() => setNotificationTestResult(null), 10000)
                            }}
                            className="w-full"
                            variant="default"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Test All Enabled Channels
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {notificationTestResult && (
                      <Alert className={notificationTestResult.includes('✅') ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}>
                        <AlertDescription>{notificationTestResult}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <AnimatedButton
                        onClick={() => testNotificationMutation.mutate({ 
                          notification_type: 'automation_completed',
                          channel: 'all'
                        })}
                        disabled={testNotificationMutation.isPending}
                        animation="shimmer"
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test All Channels
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>

                {/* Import/Export Settings */}
                <CollapsibleSection
                  id="notification-backup"
                  title="Backup & Import Settings"
                  description="Export or import your notification configuration"
                  icon={Settings2}
                  isExpanded={expandedSections.has('notification-backup')}
                  onToggle={() => toggleSection('notification-backup')}
                >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">Export Settings</h4>
                          <p className="text-sm text-muted-foreground">
                            Download your current notification settings as a backup
                          </p>
                          <Button
                            onClick={() => {
                              const settings = {
                                notification_preferences: notificationPreferences,
                                smtp_settings: smtpSettings,
                                display_settings: displaySettings,
                                exported_at: new Date().toISOString(),
                                version: "2.0"
                              }
                              const blob = new Blob([JSON.stringify(settings, null, 2)], {
                                type: 'application/json'
                              })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `fossawork-notifications-${new Date().toISOString().split('T')[0]}.json`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            }}
                            variant="outline"
                            className="w-full"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Configuration
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium">Import Settings</h4>
                          <p className="text-sm text-muted-foreground">
                            Restore notification settings from a backup file
                          </p>
                          <div className="relative">
                            <input
                              type="file"
                              accept=".json"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onload = (event) => {
                                    try {
                                      const settings = JSON.parse(event.target?.result as string)
                                      
                                      // Import notification preferences
                                      if (settings.notification_preferences) {
                                        updateNotificationMutation.mutate(settings.notification_preferences.preferences)
                                      }
                                      
                                      // Import SMTP settings
                                      if (settings.smtp_settings) {
                                        updateSMTPMutation.mutate(settings.smtp_settings.settings)
                                      }
                                      
                                      // Import display settings
                                      if (settings.display_settings) {
                                        updateDisplayMutation.mutate(settings.display_settings.settings)
                                      }
                                      
                                      setNotificationTestResult('✅ Settings imported successfully!')
                                      setTimeout(() => setNotificationTestResult(null), 3000)
                                    } catch (error) {
                                      setNotificationTestResult('❌ Failed to import settings: Invalid file format')
                                      setTimeout(() => setNotificationTestResult(null), 5000)
                                    }
                                  }
                                  reader.readAsText(file)
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id="import-file"
                            />
                            <Button variant="outline" className="w-full">
                              <Upload className="w-4 h-4 mr-2" />
                              Import Configuration
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          Importing settings will overwrite your current notification configuration. 
                          Consider exporting your current settings first as a backup.
                        </AlertDescription>
                      </Alert>
                    </div>
                </CollapsibleSection>

                {/* Help & Documentation */}
                <CollapsibleSection
                  id="notification-help"
                  title="Help & Setup Guides"
                  description="Step-by-step guides for configuring notification services"
                  icon={AlertCircle}
                  isExpanded={expandedSections.has('notification-help')}
                  onToggle={() => toggleSection('notification-help')}
                >
                    <div className="space-y-6">
                      {/* Email Setup Guide */}
                      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                        <h4 className="font-medium mb-3 flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          Email Notification Setup
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p><strong>For Gmail users:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 ml-4">
                            <li>Enable 2-factor authentication on your Google account</li>
                            <li>Generate an "App Password" in Google Account settings</li>
                            <li>Use your email address as username and the app password</li>
                            <li>SMTP Server: smtp.gmail.com, Port: 587, TLS: Enabled</li>
                          </ol>
                          <p className="mt-3"><strong>For other providers:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li><strong>Outlook:</strong> smtp-mail.outlook.com:587 (TLS)</li>
                            <li><strong>Yahoo:</strong> smtp.mail.yahoo.com:587 (TLS)</li>
                            <li><strong>Custom SMTP:</strong> Contact your email provider for settings</li>
                          </ul>
                        </div>
                      </div>

                      {/* Pushover Setup Guide */}
                      <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950">
                        <h4 className="font-medium mb-3 flex items-center">
                          <Send className="w-4 h-4 mr-2" />
                          Pushover Setup Guide
                        </h4>
                        <div className="space-y-2 text-sm">
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Create a free account at <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">pushover.net</a></li>
                            <li>Download the Pushover app on your mobile device</li>
                            <li>Copy your User Key from the Pushover dashboard</li>
                            <li>Paste the User Key in the settings above</li>
                            <li>Optionally specify a device name to send to specific devices</li>
                          </ol>
                          <Alert className="mt-3">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>
                              <strong>Cost:</strong> Pushover has a one-time fee after a free trial period. 
                              Check their website for current pricing.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </div>

                      {/* Desktop Notifications Guide */}
                      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                        <h4 className="font-medium mb-3 flex items-center">
                          <Monitor className="w-4 h-4 mr-2" />
                          Desktop Notifications
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p>Desktop notifications work automatically in supported environments:</p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li><strong>Electron App:</strong> Full support with system integration</li>
                            <li><strong>Modern Browsers:</strong> Chrome, Firefox, Safari, Edge</li>
                            <li><strong>Permission Required:</strong> Browser will prompt for notification permission</li>
                          </ul>
                          <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border">
                            <p><strong>Troubleshooting:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4 text-xs">
                              <li>If blocked, check browser notification settings</li>
                              <li>Ensure "Do Not Disturb" mode is off on your system</li>
                              <li>Test notifications may not appear during quiet hours</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Notification Types Explanation */}
                      <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950">
                        <h4 className="font-medium mb-3 flex items-center">
                          <Bell className="w-4 h-4 mr-2" />
                          Notification Types Explained
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p><strong>Automation Started:</strong> When a form automation job begins</p>
                              <p><strong>Automation Completed:</strong> When a job finishes successfully</p>
                              <p><strong>Automation Failed:</strong> When a job encounters an error</p>
                              <p><strong>Progress Updates:</strong> Real-time progress during automation</p>
                            </div>
                            <div>
                              <p><strong>Schedule Changes:</strong> When work order schedules are modified</p>
                              <p><strong>Daily Digest:</strong> Summary of the day's completed work</p>
                              <p><strong>System Errors:</strong> Critical system errors and alerts</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Best Practices */}
                      <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <h4 className="font-medium mb-3 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Best Practices
                        </h4>
                        <div className="space-y-2 text-sm">
                          <ul className="list-disc list-inside space-y-1">
                            <li><strong>Test Settings:</strong> Always test each notification channel after configuration</li>
                            <li><strong>Quiet Hours:</strong> Set appropriate quiet hours to avoid disruptions</li>
                            <li><strong>Channel Selection:</strong> Use "Email" for detailed reports, "Pushover" for immediate alerts</li>
                            <li><strong>Desktop:</strong> Best for real-time progress updates when actively working</li>
                            <li><strong>Backup Settings:</strong> Export your configuration before making major changes</li>
                            <li><strong>Priority Levels:</strong> Adjust thresholds to avoid notification fatigue</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="space-y-4">
                {/* Work Order Sync Schedule */}
                <Card className="animate-slide-in-from-bottom">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle>Work Order Sync Schedule</CardTitle>
                        <CardDescription>Configure automatic work order synchronization</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrapingScheduleEnhanced />
                  </CardContent>
                </Card>

                {/* Automation Delays */}
                <CollapsibleSection
                  id="automation-delays"
                  title="Automation Timing"
                  description="Configure delays and timing for form automation"
                  icon={Gauge}
                  isExpanded={expandedSections.has('automation-delays')}
                  onToggle={() => toggleSection('automation-delays')}
                >
                  <div className="space-y-6">
                    {automationDelays && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                        <Card className="p-4">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Timing Settings
                            </CardTitle>
                            <CardDescription>Control the speed and delays for form interactions</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ValidatedInput
                              label="Form Field Delay"
                              value={automationDelays.form_field_delay?.toString() || '500'}
                              onChange={(value) => {
                                const numValue = parseInt(value)
                                if (!isNaN(numValue)) {
                                  updateAutomationDelaysMutation.mutate({
                                    ...automationDelays,
                                    form_field_delay: numValue
                                  })
                                }
                              }}
                              type="number"
                              validation={['delay']}
                              placeholder="500"
                              helpText="Delay between form field interactions (0-10000ms)"
                            />
                            <ValidatedInput
                              label="Page Navigation Delay"
                              value={automationDelays.page_navigation_delay?.toString() || '2000'}
                              onChange={(value) => {
                                const numValue = parseInt(value)
                                if (!isNaN(numValue)) {
                                  updateAutomationDelaysMutation.mutate({
                                    ...automationDelays,
                                    page_navigation_delay: numValue
                                  })
                                }
                              }}
                              type="number"
                              validation={['delay']}
                              placeholder="2000"
                              helpText="Wait time after page navigation (0-10000ms)"
                            />
                          </CardContent>
                        </Card>
                        
                        <Card className="p-4">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Gauge className="w-4 h-4" />
                              Performance Settings
                            </CardTitle>
                            <CardDescription>Adjust speed and reliability parameters</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ValidatedInput
                              label="Speed Multiplier"
                              value={automationDelays.overall_speed_multiplier?.toString() || '1.0'}
                              onChange={(value) => {
                                const numValue = parseFloat(value)
                                if (!isNaN(numValue)) {
                                  updateAutomationDelaysMutation.mutate({
                                    ...automationDelays,
                                    overall_speed_multiplier: numValue
                                  })
                                }
                              }}
                              type="number"
                              validation={['multiplier']}
                              placeholder="1.0"
                              helpText="Speed multiplier for all automation (0.5-3.0)"
                            />
                            <ValidatedInput
                              label="Max Retries"
                              value={automationDelays.max_retries?.toString() || '3'}
                              onChange={(value) => {
                                const numValue = parseInt(value)
                                if (!isNaN(numValue)) {
                                  updateAutomationDelaysMutation.mutate({
                                    ...automationDelays,
                                    max_retries: numValue
                                  })
                                }
                              }}
                              type="number"
                              validation={['retries']}
                              placeholder="3"
                              helpText="Maximum retry attempts for failed operations (1-10)"
                            />
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Browser Settings */}
                <CollapsibleSection
                  id="browser-settings"
                  title="Browser Configuration"
                  description="Configure browser automation settings"
                  icon={Globe}
                  isExpanded={expandedSections.has('browser-settings')}
                  onToggle={() => toggleSection('browser-settings')}
                >
                  <div className="space-y-6">
                    {browserSettings && (
                      <Card className="p-6">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            Browser Automation Settings
                          </CardTitle>
                          <CardDescription>Configure browser behavior for automation tasks</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <Label htmlFor="headless-mode" className="font-medium">Headless Mode</Label>
                                    <p className="text-xs text-muted-foreground">Run browser without visible window</p>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  id="headless-mode"
                                  defaultChecked={browserSettings.headless}
                                  onChange={(e) => {
                                    updateBrowserSettingsMutation.mutate({
                                      ...browserSettings,
                                      headless: e.target.checked
                                    })
                                  }}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                              </div>
                              
                              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <Label htmlFor="dev-tools" className="font-medium">Developer Tools</Label>
                                    <p className="text-xs text-muted-foreground">Open DevTools for debugging</p>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  id="dev-tools"
                                  defaultChecked={browserSettings.devtools}
                                  onChange={(e) => {
                                    updateBrowserSettingsMutation.mutate({
                                      ...browserSettings,
                                      devtools: e.target.checked
                                    })
                                  }}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <ValidatedInput
                                label="Browser Timeout"
                                value={browserSettings.timeout?.toString() || '30000'}
                                onChange={(value) => {
                                  const numValue = parseInt(value)
                                  if (!isNaN(numValue)) {
                                    updateBrowserSettingsMutation.mutate({
                                      ...browserSettings,
                                      timeout: numValue
                                    })
                                  }
                                }}
                                type="number"
                                validation={['timeout']}
                                placeholder="30000"
                                helpText="Maximum wait time for page loads (5000-60000ms)"
                              />
                              
                              <Alert>
                                <AlertCircle className="w-4 h-4" />
                                <AlertDescription className="text-sm">
                                  <strong>Note:</strong> Disabling headless mode may affect automation performance but is useful for debugging.
                                </AlertDescription>
                              </Alert>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'filters' && (
              <div className="space-y-4">
                {/* Work Order Filters */}
                <CollapsibleSection
                  id="filter-settings"
                  title="Work Order Filters"
                  description="Configure which work orders to display and process"
                  icon={Filter}
                  isExpanded={expandedSections.has('filter-settings')}
                  onToggle={() => toggleSection('filter-settings')}
                >
                  <div className="space-y-6">
                    {filterSettings && (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="filters-enabled"
                            defaultChecked={filterSettings.enabled}
                            onChange={(e) => {
                              updateFilterSettingsMutation.mutate({
                                ...filterSettings,
                                enabled: e.target.checked
                              })
                            }}
                          />
                          <Label htmlFor="filters-enabled">Enable Filtering</Label>
                        </div>
                        
                        <div>
                          <Label htmlFor="store-filter">Store Numbers (comma-separated)</Label>
                          <Input
                            id="store-filter"
                            placeholder="001, 002, 003"
                            defaultValue={filterSettings.filter_by_stores?.join(', ')}
                            onBlur={(e) => {
                              updateFilterSettingsMutation.mutate({
                                ...filterSettings,
                                filter_by_stores: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                              })
                            }}
                          />
                        </div>

                        <div>
                          <Label htmlFor="customer-filter">Customer Names (comma-separated)</Label>
                          <Input
                            id="customer-filter"
                            placeholder="7-Eleven, Wawa, Circle K"
                            defaultValue={filterSettings.filter_by_customers?.join(', ')}
                            onBlur={(e) => {
                              updateFilterSettingsMutation.mutate({
                                ...filterSettings,
                                filter_by_customers: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                              })
                            }}
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="exclude-completed"
                            defaultChecked={filterSettings.exclude_completed}
                            onChange={(e) => {
                              updateFilterSettingsMutation.mutate({
                                ...filterSettings,
                                exclude_completed: e.target.checked
                              })
                            }}
                          />
                          <Label htmlFor="exclude-completed">Exclude Completed Work Orders</Label>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Display Settings */}
                <CollapsibleSection
                  id="display-settings"
                  title="Display Preferences"
                  description="Configure how notifications and data are displayed"
                  icon={Eye}
                  isExpanded={expandedSections.has('display-settings')}
                  onToggle={() => toggleSection('display-settings')}
                >
                  <div className="space-y-6">
                    {displaySettings && (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-store-number"
                            defaultChecked={displaySettings.show_store_number}
                            onChange={(e) => {
                              updateDisplaySettingsMutation.mutate({
                                ...displaySettings,
                                show_store_number: e.target.checked
                              })
                            }}
                          />
                          <Label htmlFor="show-store-number">Show Store Numbers</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-customer-name"
                            defaultChecked={displaySettings.show_customer_name}
                            onChange={(e) => {
                              updateDisplaySettingsMutation.mutate({
                                ...displaySettings,
                                show_customer_name: e.target.checked
                              })
                            }}
                          />
                          <Label htmlFor="show-customer-name">Show Customer Names</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-service-details"
                            defaultChecked={displaySettings.show_service_details}
                            onChange={(e) => {
                              updateDisplaySettingsMutation.mutate({
                                ...displaySettings,
                                show_service_details: e.target.checked
                              })
                            }}
                          />
                          <Label htmlFor="show-service-details">Show Service Details</Label>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-4">
                {/* SMTP Email Server Configuration */}
                <CollapsibleSection
                  id="smtp-settings"
                  title="SMTP Email Server"
                  description="Configure SMTP server for email notifications"
                  icon={Mail}
                  isExpanded={expandedSections.has('smtp-settings')}
                  onToggle={() => toggleSection('smtp-settings')}
                >
                  <div className="space-y-6">
                    {/* App Password Alert */}
                    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm">
                        <strong>Important:</strong> Most email providers require an app-specific password:
                        <ul className="mt-2 space-y-1 text-xs">
                          <li>• <strong>Gmail:</strong> Enable 2FA, then create app password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/apppasswords</a></li>
                          <li>• <strong>Outlook:</strong> Create app password at <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">account.microsoft.com/security</a></li>
                          <li>• <strong>Yahoo:</strong> Generate app password in Account Security settings</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    {/* Email-based Auto-Detection */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">Auto-Detect SMTP Settings</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Enter your email address to automatically detect SMTP server settings
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              value={emailForDetection}
                              onChange={(e) => setEmailForDetection(e.target.value)}
                              placeholder="your-email@example.com"
                              className="flex-1"
                            />
                            <Button
                              onClick={() => {
                                const detected = detectSMTPProvider(emailForDetection)
                                if (detected) {
                                  setDetectedProvider(detected)
                                  // Apply detected settings
                                  const currentSettings = localSMTPSettings || smtpSettings || {}
                                  setLocalSMTPSettings({
                                    ...currentSettings,
                                    smtp_server: detected.smtp_server || currentSettings.smtp_server || '',
                                    smtp_port: detected.smtp_port || currentSettings.smtp_port || 587,
                                    use_tls: detected.use_tls !== undefined ? detected.use_tls : currentSettings.use_tls,
                                    use_ssl: detected.use_ssl !== undefined ? detected.use_ssl : currentSettings.use_ssl,
                                    username: emailForDetection, // Set the email as username
                                    from_email: emailForDetection, // Also set as from_email
                                  })
                                  setSMTPTestResult(`✅ Auto-detected settings for ${detected.name}`)
                                  setTimeout(() => setSMTPTestResult(null), 5000)
                                  
                                  // Also set the test email field for convenience
                                  if (!smtpTestEmail) {
                                    setSMTPTestEmail(emailForDetection)
                                  }
                                } else {
                                  setSMTPTestResult('❌ Unable to auto-detect settings for this email provider')
                                  setTimeout(() => setSMTPTestResult(null), 5000)
                                }
                              }}
                              disabled={!emailForDetection || !emailForDetection.includes('@')}
                              variant="secondary"
                            >
                              <Zap className="w-4 h-4 mr-2" />
                              Auto-Detect
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {detectedProvider && detectedProvider.notes && (
                        <Alert className="mt-3">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            <strong>{detectedProvider.name} Note:</strong> {detectedProvider.notes}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Manual Configuration */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                          <div className="space-y-4">
                            <ValidatedInput
                              label="SMTP Server"
                              value={localSMTPSettings?.smtp_server || smtpSettings?.smtp_server || ''}
                              onChange={(value) => {
                                const currentSettings = localSMTPSettings || smtpSettings || {}
                                setLocalSMTPSettings({
                                  ...currentSettings,
                                  smtp_server: value
                                })
                              }}
                              validation={['required']}
                              placeholder="smtp.gmail.com"
                              helpText="Your email provider's SMTP server address"
                              required
                            />
                            
                            <ValidatedInput
                              label="Port"
                              value={localSMTPSettings?.smtp_port?.toString() || smtpSettings?.smtp_port?.toString() || ''}
                              onChange={(value) => {
                                const currentSettings = localSMTPSettings || smtpSettings || {}
                                setLocalSMTPSettings({
                                  ...currentSettings,
                                  smtp_port: parseInt(value) || 587
                                })
                              }}
                              validation={['required', 'port']}
                              type="number"
                              placeholder="587"
                              helpText="Common ports: 587 (TLS), 465 (SSL), 25 (unsecured)"
                              required
                            />
                          </div>
                          <div className="space-y-4">
                            <ValidatedInput
                              label="Username"
                              value={localSMTPSettings?.username || smtpSettings?.username || ''}
                              onChange={(value) => {
                                const currentSettings = localSMTPSettings || smtpSettings || {}
                                setLocalSMTPSettings({
                                  ...currentSettings,
                                  username: value
                                })
                              }}
                              validation={['required', 'email']}
                              placeholder="your-email@example.com"
                              helpText="Your email address used for authentication"
                              required
                            />
                            
                            <ValidatedInput
                              label="App Password"
                              value={localSMTPSettings?.password || smtpSettings?.password || ''}
                              onChange={(value) => {
                                const currentSettings = localSMTPSettings || smtpSettings || {}
                                setLocalSMTPSettings({
                                  ...currentSettings,
                                  password: value
                                })
                              }}
                              validation={['required']}
                              type="password"
                              placeholder="••••••••"
                              helpText="Use an app-specific password, NOT your regular email password"
                              required
                            />
                          </div>
                        </div>
                        
                        {/* Security Settings */}
                        <div className="space-y-3 p-3 bg-muted/20 rounded-lg">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Security Settings
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="use-tls" className="text-sm cursor-pointer">Use TLS</Label>
                              <input
                                type="checkbox"
                                id="use-tls"
                                checked={localSMTPSettings?.use_tls ?? smtpSettings?.use_tls ?? true}
                                onChange={(e) => {
                                  const currentSettings = localSMTPSettings || smtpSettings || {}
                                  setLocalSMTPSettings({
                                    ...currentSettings,
                                    use_tls: e.target.checked,
                                    use_ssl: e.target.checked ? false : currentSettings.use_ssl // TLS and SSL are mutually exclusive
                                  })
                                }}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="use-ssl" className="text-sm cursor-pointer">Use SSL</Label>
                              <input
                                type="checkbox"
                                id="use-ssl"
                                checked={localSMTPSettings?.use_ssl ?? smtpSettings?.use_ssl ?? false}
                                onChange={(e) => {
                                  const currentSettings = localSMTPSettings || smtpSettings || {}
                                  setLocalSMTPSettings({
                                    ...currentSettings,
                                    use_ssl: e.target.checked,
                                    use_tls: e.target.checked ? false : currentSettings.use_tls // TLS and SSL are mutually exclusive
                                  })
                                }}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {detectedProvider ? 
                              `Auto-detected security settings for ${detectedProvider.name}` : 
                              'TLS is recommended for port 587, SSL for port 465'
                            }
                          </p>
                        </div>
                        
                        {/* Save Button */}
                        <div className="flex justify-end mt-4">
                          <Button
                            onClick={() => {
                              const currentSettings = localSMTPSettings || smtpSettings || {}
                              const settingsToSave = {
                                smtp_server: currentSettings.smtp_server || '',
                                smtp_port: currentSettings.smtp_port || 587,
                                username: currentSettings.username || '',
                                password: currentSettings.password || '',
                                use_tls: currentSettings.use_tls !== undefined ? currentSettings.use_tls : true,
                                use_ssl: currentSettings.use_ssl !== undefined ? currentSettings.use_ssl : false,
                                from_email: currentSettings.from_email || currentSettings.username || '',
                                from_name: currentSettings.from_name || 'FossaWork Notifications',
                                timeout: currentSettings.timeout || 30
                              }
                              updateSMTPMutation.mutate(settingsToSave)
                            }}
                            disabled={updateSMTPMutation.isPending || !localSMTPSettings}
                            size="sm"
                          >
                            {updateSMTPMutation.isPending ? (
                              <>
                                <DotsLoader className="mr-2" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save SMTP Settings
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    
                    {/* Enhanced Testing Interface */}
                    <Card className="border-muted bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Test Configuration</h4>
                          <Badge variant={smtpTestResult?.includes('success') ? 'default' : 'secondary'}>
                            {smtpTestResult?.includes('success') ? 'Connected' : 'Not Tested'}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <Label htmlFor="test-email">Test Email Address</Label>
                            <Input
                              id="test-email"
                              type="email"
                              value={smtpTestEmail}
                              onChange={(e) => setSMTPTestEmail(e.target.value)}
                              placeholder="test@example.com"
                              className="mt-1"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              onClick={() => testSMTPMutation.mutate(smtpTestEmail)}
                              disabled={testSMTPMutation.isPending || !smtpTestEmail}
                              size="sm"
                              className="whitespace-nowrap"
                            >
                              {testSMTPMutation.isPending ? (
                                <>
                                  <Gauge className="w-4 h-4 mr-2 animate-spin" />
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-2" />
                                  Send Test Email
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        {smtpTestResult && (
                          <Alert className={`mt-3 ${smtpTestResult.includes('success') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-center gap-2">
                              {smtpTestResult.includes('success') ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                              <AlertDescription className={smtpTestResult.includes('success') ? 'text-green-800' : 'text-red-800'}>
                                {smtpTestResult}
                              </AlertDescription>
                            </div>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CollapsibleSection>
                    
                <CollapsibleSection
                  id="data-management"
                  title="Data Management"
                  description="Control data retention and cleanup"
                  icon={Database}
                  isExpanded={expandedSections.has('data-management')}
                  onToggle={() => toggleSection('data-management')}
                >
                  <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="cleanup">Auto-cleanup completed jobs after</Label>
                          <select 
                            id="cleanup" 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
                          >
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                            <option value="never">Never</option>
                          </select>
                        </div>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear All Data
                        </Button>
                  </div>
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
