import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, User, Bell, Shield, Database, TestTube, Trash2, Calendar, Mail, Send, Key, CheckCircle, XCircle, AlertCircle, Settings2, Server, Clock, Gauge, Eye, EyeOff, ChevronDown, ChevronRight, Zap, Globe, AlertTriangle, Search, HelpCircle, Sparkles, ArrowRight, Activity } from 'lucide-react'
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
  validatePushoverCredentials,
  type NotificationPreferences,
  type TestNotificationRequest,
  getSMTPSettings,
  updateSMTPSettings,
  testSMTPSettings,
  type SMTPSettings,
} from '../services/api'
import { EnhancedInput, FormSection, ActionButtonGroup } from '@/components/ui/enhanced-form'
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
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button'
import { DotsLoader } from '@/components/ui/animated-loader'
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
  const [activeTab, setActiveTab] = useState('notifications')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [workfossaCredentials, setWorkfossaCredentials] = useState({
    username: '',
    password: ''
  })
  const [pushoverCredentials, setPushoverCredentials] = useState({
    userKey: '',
    apiToken: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    userKey: false,
    apiToken: false
  })
  const [credentialTestResult, setCredentialTestResult] = useState<string | null>(null)
  const [notificationTestResult, setNotificationTestResult] = useState<string | null>(null)
  const [pushoverValidationResult, setPushoverValidationResult] = useState<string | null>(null)
  const [pushoverSaveResult, setPushoverSaveResult] = useState<string | null>(null)
  const [emailSaveResult, setEmailSaveResult] = useState<string | null>(null)
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
      console.log('Email enabled value:', notificationPreferences?.preferences?.email_enabled)
      console.log('Pushover enabled value:', notificationPreferences?.preferences?.pushover_enabled)
      console.log('Channel settings:')
      console.log('- automation_started:', notificationPreferences?.preferences?.automation_started)
      console.log('- automation_completed:', notificationPreferences?.preferences?.automation_completed)
      console.log('- automation_failed:', notificationPreferences?.preferences?.automation_failed)
      console.log('- error_alert:', notificationPreferences?.preferences?.error_alert)
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

  // Sync Pushover credentials from notification preferences
  useEffect(() => {
    if (notificationPreferences?.preferences?.pushover_user_key || notificationPreferences?.preferences?.pushover_api_token) {
      setPushoverCredentials({
        userKey: notificationPreferences.preferences.pushover_user_key || '',
        apiToken: notificationPreferences.preferences.pushover_api_token || ''
      })
    }
  }, [notificationPreferences])

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', currentUserId] })
      
      // Check if this is a Pushover save (has pushover_user_key or pushover_api_token)
      if (variables.pushover_user_key !== undefined || variables.pushover_api_token !== undefined) {
        setPushoverSaveResult('✅ Pushover credentials saved successfully!')
        setTimeout(() => setPushoverSaveResult(null), 3000)
      } else {
        // For other notification updates, use the global message
        setNotificationTestResult('✅ Notification preferences updated successfully!')
        setTimeout(() => setNotificationTestResult(null), 3000)
      }
    },
    onError: (error: any, variables) => {
      // Check if this is a Pushover save error
      if (variables.pushover_user_key !== undefined || variables.pushover_api_token !== undefined) {
        setPushoverSaveResult(`❌ Failed to save: ${error.response?.data?.detail || error.message}`)
        setTimeout(() => setPushoverSaveResult(null), 5000)
      } else {
        // For other notification errors, use the global message
        setNotificationTestResult(`❌ Failed to update: ${error.response?.data?.detail || error.message}`)
        setTimeout(() => setNotificationTestResult(null), 5000)
      }
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
    mutationFn: ({ userKey, apiToken }: { userKey: string; apiToken: string }) =>
      validatePushoverCredentials(currentUserId, userKey, apiToken),
    onSuccess: (result) => {
      setPushoverValidationResult(
        result.is_valid 
          ? '✅ Pushover credentials are valid!' 
          : `❌ ${result.message || 'Pushover credentials are invalid'}`
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

  // Sync Pushover credentials from preferences to local state
  React.useEffect(() => {
    if (notificationPreferences?.preferences) {
      setPushoverCredentials({
        userKey: notificationPreferences.preferences.pushover_user_key || '',
        apiToken: notificationPreferences.preferences.pushover_api_token || ''
      })
    }
  }, [notificationPreferences])

  // Calculate setup progress with memoization to prevent excessive re-renders
  const setupProgress = useMemo(() => {
    // Always calculate progress, even if some data is still loading
    return calculateSetupProgress()
  }, [savedCredentials, smtpSettings, notificationPreferences, theme])

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'automation', label: 'Automation', icon: Zap },
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
                          'email-notifications',
                          'pushover-notifications',
                          'notification-preferences'
                        ]))
                      } else if (tab.id === 'automation') {
                        setExpandedSections(new Set([
                          'scraping-schedule'
                        ]))
                      } else if (tab.id === 'advanced') {
                        setExpandedSections(new Set(['smtp-settings']))
                      } else {
                        setExpandedSections(new Set())
                      }
                    }}
                    className={`relative flex items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all text-sm font-medium overflow-hidden group ${
                      activeTab === tab.id 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                        : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={{
                      transform: activeTab === tab.id ? 'translateY(-1px)' : 'translateY(0)',
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    {activeTab === tab.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse" />
                    )}
                    <div className={`relative z-10 flex items-center gap-2 ${
                      activeTab === tab.id ? 'scale-105' : 'scale-100'
                    } transition-transform duration-200`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </div>
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
                        'email-notifications',
                        'pushover-notifications',
                        'notification-preferences'
                      ]))
                    } else if (tab.id === 'automation') {
                      setExpandedSections(new Set([
                        'scraping-schedule'
                      ]))
                    } else if (tab.id === 'advanced') {
                      setExpandedSections(new Set(['smtp-settings']))
                    } else {
                      setExpandedSections(new Set())
                    }
                  }}
                  className={`w-full justify-start animate-slide-in-from-left border transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-lg hover:shadow-xl transform scale-105' 
                      : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 hover:scale-102'
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  strength={0.1}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'bg-white/20' 
                        : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{tab.label}</span>
                  </div>
                </MagneticButton>
              )
            })}
          </nav>

          {/* Tab Content */}
          <div className="min-h-[600px]">


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

                {/* Notification Testing Center */}
                <Card className="border-muted bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <Button
                        onClick={async () => {
                          try {
                            const result = await sendTestNotificationChannel('email')
                            if (result.success && result.results?.email === true) {
                              setNotificationTestResult('✅ Email test sent successfully!')
                              setTimeout(() => setNotificationTestResult(null), 3000)
                            } else {
                              setNotificationTestResult(`❌ Test notification failed: Unknown error occurred`)
                              setTimeout(() => setNotificationTestResult(null), 5000)
                            }
                          } catch (error: any) {
                            setNotificationTestResult(`❌ Test notification failed: ${error.response?.data?.detail || error.message}`)
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
                            {smtpSettings?.settings?.smtp_server && ' • SMTP Configured ✅'}
                          </div>
                        </div>
                      </Button>
                      
                      <Button
                        onClick={async () => {
                          try {
                            console.log(`🔔 Starting Pushover test from Testing Center at ${new Date().toISOString()}`)
                            console.log('Current preferences:', notificationPreferences?.preferences)
                            const result = await sendTestNotificationChannel('pushover')
                            console.log('📬 Pushover test response:', result)
                            console.log('Success flag:', result.success)
                            console.log('Results object:', result.results)
                            console.log('Pushover result value:', result.results?.pushover)
                            
                            if (result.success && result.results?.pushover === true) {
                              setNotificationTestResult('✅ Pushover test sent successfully!')
                              setTimeout(() => setNotificationTestResult(null), 3000)
                            } else {
                              setNotificationTestResult(`❌ Test notification failed: ${result.message || 'Unknown error occurred'}`)
                              setTimeout(() => setNotificationTestResult(null), 5000)
                            }
                          } catch (error: any) {
                            console.error('💥 Pushover test error:', error)
                            setNotificationTestResult(`❌ Test notification failed: ${error.response?.data?.detail || error.message}`)
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
                            {notificationPreferences?.preferences?.pushover_user_key && ' • User Key Set ✅'}
                          </div>
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
                              const result = await sendTestNotificationChannel('email')
                              if (result.success && result.results?.email === true) {
                                results.push('Email ✅')
                              } else {
                                results.push('Email ❌')
                              }
                            } catch {
                              results.push('Email ❌')
                            }
                          }
                          
                          if (notificationPreferences?.preferences?.pushover_enabled) {
                            try {
                              const result = await sendTestNotificationChannel('pushover')
                              if (result.success && result.results?.pushover === true) {
                                results.push('Pushover ✅')
                              } else {
                                results.push('Pushover ❌')
                              }
                            } catch {
                              results.push('Pushover ❌')
                            }
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

                
                {/* Debug helper - expand all sections button */}
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allSections = [
                        'email-notifications',
                        'pushover-notifications', 
                        'notification-preferences',
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
                    {expandedSections.size >= 4 ? 'Collapse All' : 'Expand All'}
                  </Button>
                </div>
                
                {/* Email Configuration */}
                <GlowCard className="group border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/30 dark:to-indigo-950/20" glowColor="rgba(59, 130, 246, 0.3)">
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 group-hover:scale-110 transition-transform duration-300">
                          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Email Notifications
                          </h3>
                          <p className="text-sm text-muted-foreground">Configure email alerts and delivery preferences</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {notificationPreferences?.preferences?.email_enabled === true ? 'Enabled' : 'Disabled'}
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Email toggle clicked, current value:', notificationPreferences?.preferences?.email_enabled)
                              const currentValue = notificationPreferences?.preferences?.email_enabled === true
                              updateNotificationMutation.mutate({ 
                                email_enabled: !currentValue
                              })
                            }}
                            className="relative flex h-6 w-11 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out"
                            style={{
                              backgroundColor: notificationPreferences?.preferences?.email_enabled === true
                                ? (theme === 'dark' ? '#3b82f6' : '#2563eb') // blue-500 / blue-600
                                : (theme === 'dark' ? '#374151' : '#e5e7eb') // gray-700 / gray-200
                            }}
                            disabled={updateNotificationMutation.isPending}
                          >
                            <span 
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                                notificationPreferences?.preferences?.email_enabled === true
                                  ? 'translate-x-5' 
                                  : 'translate-x-0'
                              }`} 
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Form Fields */}
                    <div className="grid gap-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-800/50 p-4">
                          <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                            <Mail className="w-4 h-4 inline mr-2" />
                            Recipient Email
                          </label>
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
                            placeholder="Your email address"
                          />
                          <p className="text-xs text-gray-500 mt-1">Email notifications will be sent to your account email address</p>
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-800/50 p-4">
                          <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                            <Clock className="w-4 h-4 inline mr-2" />
                            Daily Digest Time
                          </label>
                          <input
                            type="time"
                            value={notificationPreferences?.preferences?.digest_time || '08:00'}
                            onChange={(e) => updateNotificationMutation.mutate({ digest_time: e.target.value })}
                            disabled={updateNotificationMutation.isPending}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          />
                          <p className="text-xs text-gray-500 mt-1">Time to receive daily summary emails</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-800/50 p-4">
                            <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                              <Clock className="w-4 h-4 inline mr-2" />
                              Quiet Hours Start
                            </label>
                            <input
                              type="time"
                              value={notificationPreferences?.preferences?.quiet_hours_start || '22:00'}
                              onChange={(e) => updateNotificationMutation.mutate({ quiet_hours_start: e.target.value })}
                              disabled={updateNotificationMutation.isPending}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            />
                            <p className="text-xs text-gray-500 mt-1">Start of quiet period</p>
                          </div>
                        </div>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-blue-200/50 dark:border-blue-800/50 p-4">
                            <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                              <Clock className="w-4 h-4 inline mr-2" />
                              Quiet Hours End
                            </label>
                            <input
                              type="time"
                              value={notificationPreferences?.preferences?.quiet_hours_end || '07:00'}
                              onChange={(e) => updateNotificationMutation.mutate({ quiet_hours_end: e.target.value })}
                              disabled={updateNotificationMutation.isPending}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            />
                            <p className="text-xs text-gray-500 mt-1">End of quiet period</p>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </GlowCard>

                {/* Pushover Configuration */}
                <AnimatedCard 
                  className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/50 to-red-50/30 dark:from-orange-950/30 dark:to-red-950/20" 
                  hover="glow"
                  animate="slide"
                  delay={0.1}
                >
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 group-hover:rotate-12 transition-transform duration-300">
                          <Send className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                            Pushover Notifications
                          </h3>
                          <p className="text-sm text-muted-foreground">Real-time push notifications for instant alerts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-orange-700 dark:text-orange-300">
                          {notificationPreferences?.preferences?.pushover_enabled === true ? 'Enabled' : 'Disabled'}
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Pushover toggle clicked, current value:', notificationPreferences?.preferences?.pushover_enabled)
                              const currentValue = notificationPreferences?.preferences?.pushover_enabled === true
                              updateNotificationMutation.mutate({ 
                                pushover_enabled: !currentValue,
                                pushover_user_key: pushoverCredentials.userKey || notificationPreferences?.preferences?.pushover_user_key || '',
                                pushover_api_token: pushoverCredentials.apiToken || notificationPreferences?.preferences?.pushover_api_token || ''
                              })
                            }}
                            className="relative flex h-6 w-11 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out"
                            style={{
                              backgroundColor: notificationPreferences?.preferences?.pushover_enabled === true
                                ? (theme === 'dark' ? '#f97316' : '#ea580c') // orange-500 / orange-600
                                : (theme === 'dark' ? '#374151' : '#e5e7eb') // gray-700 / gray-200
                            }}
                            aria-label={`Pushover notifications ${notificationPreferences?.preferences?.pushover_enabled === true ? 'enabled' : 'disabled'}`}
                            data-pushover-enabled={notificationPreferences?.preferences?.pushover_enabled}
                            disabled={updateNotificationMutation.isPending}
                          >
                            <span 
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                                notificationPreferences?.preferences?.pushover_enabled === true
                                  ? 'translate-x-5' 
                                  : 'translate-x-0'
                              }`} 
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Form Fields with Enhanced Styling */}
                    <div className="grid gap-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-orange-800/50 p-4">
                          <label className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                            <Key className="w-4 h-4 inline mr-2" />
                            Pushover User Key
                            <span className="text-red-500 ml-1">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.userKey ? 'text' : 'password'}
                              value={pushoverCredentials.userKey}
                              onChange={(e) => setPushoverCredentials(prev => ({ ...prev, userKey: e.target.value }))}
                              disabled={updateNotificationMutation.isPending}
                              className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your Pushover user key"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, userKey: !prev.userKey }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              {showPasswords.userKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Get your user key from pushover.net (30 characters)</p>
                          {pushoverValidationResult?.includes('❌') && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Invalid user key format
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-orange-800/50 p-4">
                          <label className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                            <Shield className="w-4 h-4 inline mr-2" />
                            Application Token
                            <span className="text-red-500 ml-1">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.apiToken ? 'text' : 'password'}
                              value={pushoverCredentials.apiToken}
                              onChange={(e) => setPushoverCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
                              disabled={updateNotificationMutation.isPending}
                              className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your application token"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, apiToken: !prev.apiToken }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              {showPasswords.apiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Create an application at pushover.net to get this token (30 characters)</p>
                        </div>
                      </div>
                    </div>

                    {/* Validation Status */}
                    {pushoverValidationResult?.includes('✅') && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Both user key and application token validated successfully
                        </p>
                      </div>
                    )}

                    {/* Save Result Message */}
                    {pushoverSaveResult && (
                      <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                        pushoverSaveResult.includes('✅') 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                      }`}>
                        {pushoverSaveResult.includes('✅') ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{pushoverSaveResult}</span>
                      </div>
                    )}

                    {/* Action Buttons with Enhanced Styling */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-orange-200/50 dark:border-orange-800/50">
                      <MagneticButton
                        onClick={() => {
                          updateNotificationMutation.mutate({ 
                            pushover_user_key: pushoverCredentials.userKey,
                            pushover_api_token: pushoverCredentials.apiToken
                          })
                        }}
                        disabled={updateNotificationMutation.isPending || !pushoverCredentials.userKey?.trim() || !pushoverCredentials.apiToken?.trim()}
                        className="flex-1 sm:flex-none bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateNotificationMutation.isPending ? 'Saving...' : 'Save Credentials'}
                      </MagneticButton>
                      
                      <RippleButton
                        onClick={() => {
                          if (pushoverCredentials.userKey && pushoverCredentials.apiToken) {
                            validatePushoverMutation.mutate({ 
                              userKey: pushoverCredentials.userKey, 
                              apiToken: pushoverCredentials.apiToken 
                            })
                          }
                        }}
                        disabled={validatePushoverMutation.isPending || !pushoverCredentials.userKey?.trim() || !pushoverCredentials.apiToken?.trim()}
                        className="flex-1 sm:flex-none border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-all duration-300"
                        variant="outline"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {validatePushoverMutation.isPending ? 'Validating...' : 'Validate'}
                      </RippleButton>
                      
                      <Button
                        onClick={() => window.open('https://pushover.net', '_blank')}
                        variant="ghost"
                        size="sm"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/50"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Get Keys
                      </Button>
                    </div>
                    
                  </div>
                </AnimatedCard>


                {/* Notification Type Configuration */}
                <AnimatedCard 
                  className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-purple-950/30 dark:to-pink-950/20" 
                  hover="lift"
                  animate="fade"
                  delay={0.2}
                >
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 group-hover:pulse transition-all duration-300">
                        <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          Notification Preferences
                        </h3>
                        <p className="text-sm text-muted-foreground">Choose which channels to use for each notification type</p>
                      </div>
                    </div>
                    
                    {/* Notification Types */}
                    <div className="grid gap-4">
                      {[
                        { key: 'automation_started', label: 'Automation Started', description: 'When a new automation job begins', icon: Zap, color: 'blue' },
                        { key: 'automation_completed', label: 'Automation Completed', description: 'When an automation job finishes successfully', icon: CheckCircle, color: 'green' },
                        { key: 'automation_failed', label: 'Automation Failed', description: 'When an automation job encounters an error', icon: AlertTriangle, color: 'red' },
                        { key: 'error_alert', label: 'System Errors', description: 'Critical system errors and alerts', icon: Shield, color: 'red' }
                      ].map((notification) => {
                        const Icon = notification.icon
                        return (
                          <div key={notification.key} className="group relative">
                            <div className={`absolute inset-0 bg-gradient-to-r from-${notification.color}-500/10 to-${notification.color}-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm`}></div>
                            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-700/50 p-4 transition-all duration-200 group-hover:border-gray-300 dark:group-hover:border-gray-600">
                              <div className="flex items-start gap-3 mb-4">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-${notification.color}-100 dark:bg-${notification.color}-900/50`}>
                                  <Icon className={`w-4 h-4 text-${notification.color}-600 dark:text-${notification.color}-400`} />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{notification.label}</h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{notification.description}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {['email', 'pushover', 'all', 'none'].map((channel) => {
                                  const currentValue = notificationPreferences?.preferences?.[notification.key] || 'email'
                                  const isSelected = currentValue === channel
                                  
                                  // Debug first notification type
                                  if (notification.key === 'automation_started' && channel === 'email') {
                                    console.log(`${notification.key} - Current: '${currentValue}', Default: 'email', Selected: ${isSelected}`)
                                  }
                                  
                                  return (
                                    <label key={channel} className={`flex items-center space-x-2 cursor-pointer group/radio px-3 py-2 rounded-md transition-all duration-200 border-2 ${
                                      isSelected 
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-400' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}>
                                      <div className="relative">
                                        <input
                                          type="radio"
                                          name={`${notification.key}_channel`}
                                          value={channel}
                                          checked={isSelected}
                                          onChange={(e) => {
                                            console.log(`Updating ${notification.key} to ${e.target.value}`)
                                            // Only update the specific notification preference
                                            updateNotificationMutation.mutate({ [notification.key]: e.target.value })
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center relative ${
                                          isSelected 
                                            ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500' 
                                            : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-700'
                                        }`}>
                                          {isSelected && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                          )}
                                        </div>
                                      </div>
                                      <span className={`text-sm capitalize transition-colors duration-200 ${
                                        isSelected 
                                          ? 'text-gray-900 dark:text-gray-100 font-semibold' 
                                          : 'text-gray-600 dark:text-gray-400'
                                      }`}>
                                        {channel}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </AnimatedCard>


              </div>
            )}

            {activeTab === 'automation' && (
              <div className="space-y-4">
                {/* Work Order Sync Schedule */}
                <AnimatedCard 
                  className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50/50 to-teal-50/30 dark:from-cyan-950/30 dark:to-teal-950/20" 
                  hover="glow"
                  animate="slide"
                  delay={0.1}
                >
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50">
                        <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                          Work Order Sync Schedule
                        </h3>
                        <p className="text-sm text-muted-foreground">Configure automatic work order synchronization</p>
                      </div>
                    </div>

                    {/* Schedule Component */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-cyan-200/50 dark:border-cyan-700/50 p-6">
                      <ScrapingScheduleEnhanced />
                    </div>
                  </div>
                </AnimatedCard>

              </div>
            )}


            {activeTab === 'advanced' && (
              <div className="space-y-4">
                {/* SMTP Email Server Configuration */}
                <FormSection
                  title="SMTP Email Server"
                  description="Configure SMTP server for email notifications"
                  icon={Server}
                  loading={updateSMTPMutation.isPending || testSMTPMutation.isPending}
                  error={smtpTestResult?.includes('❌') ? smtpTestResult : null}
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
                    <div className="grid gap-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                          <div className="space-y-4">
                            <EnhancedInput
                              label="SMTP Server"
                              value={localSMTPSettings?.smtp_server || smtpSettings?.smtp_server || ''}
                              onChange={(value) => {
                                const currentSettings = localSMTPSettings || smtpSettings || {}
                                setLocalSMTPSettings({
                                  ...currentSettings,
                                  smtp_server: value
                                })
                              }}
                              validation={['required', 'url']}
                              placeholder="smtp.gmail.com"
                              helpText="Your email provider's SMTP server address"
                              required
                              leftIcon={Server}
                              loading={updateSMTPMutation.isPending}
                              success={smtpTestResult?.includes('✅')}
                              error={smtpTestResult?.includes('❌')}
                            />
                            
                            <EnhancedInput
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
                              leftIcon={Globe}
                              loading={updateSMTPMutation.isPending}
                              success={smtpTestResult?.includes('✅')}
                              error={smtpTestResult?.includes('❌')}
                            />
                          </div>
                          <div className="space-y-4">
                            <EnhancedInput
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
                              type="email"
                              placeholder="your-email@example.com"
                              helpText="Your email address used for authentication"
                              required
                              leftIcon={User}
                              loading={updateSMTPMutation.isPending}
                              success={smtpTestResult?.includes('✅')}
                              error={smtpTestResult?.includes('❌')}
                            />
                            
                            <EnhancedInput
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
                              showToggleVisibility
                              leftIcon={Key}
                              loading={updateSMTPMutation.isPending}
                              success={smtpTestResult?.includes('✅')}
                              error={smtpTestResult?.includes('❌')}
                            />
                          </div>
                      </div>
                      
                      {/* Security Settings */}
                      <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-muted">
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
                        
                      
                      {/* SMTP Save Result Message */}
                      {smtpTestResult && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                          smtpTestResult.includes('✅') 
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                            : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                        }`}>
                          {smtpTestResult.includes('✅') ? (
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span>{smtpTestResult}</span>
                        </div>
                      )}
                      
                      <ActionButtonGroup align="left">
                        <AnimatedButton
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
                          variant="default"
                          animation="scale"
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
                        </AnimatedButton>
                        
                      </ActionButtonGroup>
                    </div>
                  </div>
                </FormSection>
                    
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
