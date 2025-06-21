import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, User, Bell, Shield, Database, TestTube, Trash2, Moon, Sun, Monitor, Palette, Calendar, Mail, Send, Key, CheckCircle, XCircle, AlertCircle, Settings2, Server, Filter, Clock, Gauge, Eye, ChevronDown, ChevronRight, Zap, Globe } from 'lucide-react'
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
import ScrapingSchedule from '../components/ScrapingSchedule'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card'
import { AnimatedButton, RippleButton, MagneticButton } from '@/components/ui/animated-button'
import { DotsLoader } from '@/components/ui/animated-loader'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import CollapsibleSection from '../components/CollapsibleSection'

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('profile')
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
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  
  const currentUserId = user?.id || 'demo' // Fallback to demo user if not authenticated
  
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
        // For direct tab navigation (like scraping), expand the main section
        if (tabParam === 'scraping') {
          setExpandedSections(new Set(['scraping-schedule']))
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

  const { data: notificationPreferences, isLoading: notificationLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ['notification-preferences', currentUserId],
    queryFn: () => getNotificationPreferences(currentUserId),
    onSuccess: (data) => {
      console.log('Notification preferences loaded:', data)
    },
    onError: (error) => {
      console.error('Failed to load notification preferences:', error)
    }
  })

  const { data: smtpSettings, isLoading: smtpLoading, refetch: refetchSMTP } = useQuery({
    queryKey: ['smtp-settings', currentUserId],
    queryFn: () => getSMTPSettings(currentUserId),
    onSuccess: (data) => {
      console.log('SMTP settings loaded:', data)
    },
    onError: (error) => {
      console.error('Failed to load SMTP settings:', error)
    }
  })

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

  const updateFilterMutation = useMutation({
    mutationFn: (settings: WorkOrderFilterSettings) =>
      updateFilterSettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-settings', currentUserId] })
    }
  })

  const updateDelayMutation = useMutation({
    mutationFn: (settings: AutomationDelaySettings) =>
      updateAutomationDelays(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-delays', currentUserId] })
    }
  })

  const updateDisplayMutation = useMutation({
    mutationFn: (settings: NotificationDisplaySettings) =>
      updateNotificationDisplaySettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-display', currentUserId] })
    }
  })

  const updateBrowserMutation = useMutation({
    mutationFn: (settings: BrowserSettings) =>
      updateBrowserSettings(currentUserId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['browser-settings', currentUserId] })
      refetchBrowserSettings()
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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'system', label: 'System', icon: Database },
    { id: 'scraping', label: 'Scraping', icon: Clock },
    { id: 'advanced', label: 'Advanced', icon: Settings2 },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <DotsLoader />
          <AnimatedText text="Loading settings..." animationType="fade" className="text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="animate-slide-in-from-top">
          <h1 className="text-4xl font-bold mb-2">
            <GradientText text="Settings" gradient="from-blue-600 via-purple-600 to-pink-600" />
          </h1>
          <p className="text-muted-foreground text-lg">
            <AnimatedText text="Configure your FossaWork V2 preferences" animationType="split" delay={0.2} />
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
          {/* Tab Navigation */}
          <nav className="space-y-2">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              return (
                <MagneticButton
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <CollapsibleSection
                  id="profile-info"
                  title="Profile Information"
                  description="Manage your account information"
                  icon={User}
                  isExpanded={expandedSections.has('profile-info')}
                  onToggle={() => toggleSection('profile-info')}
                >
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        value={user?.username || user?.email || ''} 
                        disabled 
                        className="input-modern" 
                        placeholder="Your username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={user?.email || ''} 
                        disabled 
                        className="input-modern" 
                        placeholder="Your email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input 
                        id="displayName" 
                        placeholder="Enter display name" 
                        className="input-modern" 
                      />
                    </div>
                  </div>
                  <RippleButton className="w-full sm:w-auto">
                    <Save className="w-4 h-4 mr-2" />
                    Save Profile
                  </RippleButton>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <CollapsibleSection
                  id="theme-settings"
                  title="Theme Settings"
                  description="Customize how FossaWork looks"
                  icon={Palette}
                  isExpanded={expandedSections.has('theme-settings')}
                  onToggle={() => toggleSection('theme-settings')}
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-4">Theme Mode</h3>
                      <div className="grid grid-cols-3 gap-4">
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
                              className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all card-hover ${
                                theme === option.value 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <Icon className={`w-8 h-8 mb-2 ${theme === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
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
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="email-recipient">Recipient Email</Label>
                        <Input 
                          id="email-recipient" 
                          type="email" 
                          value={user?.email || ''} 
                          disabled 
                          className="input-modern" 
                          placeholder="Your email address"
                        />
                        <p className="text-xs text-muted-foreground">
                          Email notifications will be sent to your account email address
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="digest-time">Daily Digest Time</Label>
                        <Input 
                          id="digest-time" 
                          type="time" 
                          value={notificationPreferences?.preferences?.digest_time || '08:00'}
                          onChange={(e) => updateNotificationMutation.mutate({ digest_time: e.target.value })}
                          className="input-modern" 
                        />
                        <p className="text-xs text-muted-foreground">
                          Time to receive daily summary emails
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="quiet-start">Quiet Hours Start</Label>
                          <Input 
                            id="quiet-start" 
                            type="time" 
                            value={notificationPreferences?.preferences?.quiet_hours_start || '22:00'}
                            onChange={(e) => updateNotificationMutation.mutate({ quiet_hours_start: e.target.value })}
                            className="input-modern" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quiet-end">Quiet Hours End</Label>
                          <Input 
                            id="quiet-end" 
                            type="time" 
                            value={notificationPreferences?.preferences?.quiet_hours_end || '07:00'}
                            onChange={(e) => updateNotificationMutation.mutate({ quiet_hours_end: e.target.value })}
                            className="input-modern" 
                          />
                        </div>
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="pushover-key">Pushover User Key</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="pushover-key" 
                            type="password" 
                            value={notificationPreferences?.preferences?.pushover_user_key || ''}
                            onChange={(e) => updateNotificationMutation.mutate({ pushover_user_key: e.target.value })}
                            className="input-modern flex-1" 
                            placeholder="Enter your Pushover user key"
                          />
                          <Button
                            onClick={() => {
                              const key = notificationPreferences?.preferences?.pushover_user_key
                              if (key) {
                                validatePushoverMutation.mutate(key)
                              }
                            }}
                            disabled={validatePushoverMutation.isPending || !notificationPreferences?.preferences?.pushover_user_key}
                            variant="outline"
                          >
                            <Key className="w-4 h-4 mr-2" />
                            Validate
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get your user key from <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pushover.net</a>
                        </p>
                        {pushoverValidationResult && (
                          <Alert className={pushoverValidationResult.includes('✅') ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                            <AlertDescription>{pushoverValidationResult}</AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pushover-device">Device (Optional)</Label>
                        <Input 
                          id="pushover-device" 
                          value={notificationPreferences?.preferences?.pushover_device || ''}
                          onChange={(e) => updateNotificationMutation.mutate({ pushover_device: e.target.value })}
                          className="input-modern" 
                          placeholder="Leave blank for all devices"
                        />
                        <p className="text-xs text-muted-foreground">
                          Specify a device name to send notifications to a specific device only
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pushover-sound">Notification Sound</Label>
                        <select 
                          id="pushover-sound" 
                          value={notificationPreferences?.preferences?.pushover_sound || 'pushover'}
                          onChange={(e) => updateNotificationMutation.mutate({ pushover_sound: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
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
                    </div>
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
                            {['email', 'pushover', 'both', 'none'].map((channel) => (
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

                    {notificationTestResult && (
                      <Alert className={notificationTestResult.includes('✅') ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                        <AlertDescription>{notificationTestResult}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <AnimatedButton
                        onClick={() => testNotificationMutation.mutate({ 
                          notification_type: 'automation_completed',
                          channel: 'both'
                        })}
                        disabled={testNotificationMutation.isPending}
                        animation="shimmer"
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Both Channels
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <CollapsibleSection
                  id="password-settings"
                  title="Password Settings"
                  description="Manage your account security"
                  icon={Shield}
                  isExpanded={expandedSections.has('password-settings')}
                  onToggle={() => toggleSection('password-settings')}
                >
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Password</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-password">Current Password</Label>
                          <Input 
                            id="current-password" 
                            type="password" 
                            className="input-modern" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input 
                            id="new-password" 
                            type="password" 
                            className="input-modern" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm New Password</Label>
                          <Input 
                            id="confirm-password" 
                            type="password" 
                            className="input-modern" 
                          />
                        </div>
                      </div>
                      <AnimatedButton variant="secondary" animation="pulse">
                        Update Password
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                  id="workfossa-credentials"
                  title="WorkFossa Credentials"
                  description="Manage your WorkFossa login credentials"
                  icon={Key}
                  isExpanded={expandedSections.has('workfossa-credentials')}
                  onToggle={() => toggleSection('workfossa-credentials')}
                >
                  <CredentialManager 
                    userId={currentUserId}
                    onCredentialsUpdated={() => {
                      queryClient.invalidateQueries({ queryKey: ['workfossa-credentials'] })
                    }}
                  />
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-4">
                <CollapsibleSection
                  id="automation-settings"
                  title="Automation Settings"
                  description="Configure automated behaviors"
                  icon={Zap}
                  isExpanded={expandedSections.has('automation-settings')}
                  onToggle={() => toggleSection('automation-settings')}
                >
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium mb-4">Automation</h3>
                      <div className="space-y-3">
                        {[
                          { id: 'auto-scrape', label: 'Auto-scrape work orders every hour', defaultChecked: true },
                          { id: 'auto-start', label: 'Auto-start dispensers when ready', defaultChecked: true },
                          { id: 'send-notifications', label: 'Send notifications on completion', defaultChecked: false }
                        ].map((option, index) => (
                          <label 
                            key={option.id} 
                            className="flex items-center space-x-3 cursor-pointer animate-slide-in-from-left"
                            style={{ animationDelay: `${index * 0.1}s` }}
                          >
                            <input 
                              type="checkbox" 
                              defaultChecked={option.defaultChecked}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                            />
                            <span className="text-sm">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
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
                        <AnimatedButton variant="destructive" animation="pulse">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear All Data
                        </AnimatedButton>
                  </div>
                </CollapsibleSection>
                    
                <CollapsibleSection
                  id="work-week"
                  title="Work Week Configuration"
                  description="Set your working days and schedule preferences"
                  icon={Calendar}
                  isExpanded={expandedSections.has('work-week')}
                  onToggle={() => toggleSection('work-week')}
                >
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <Label>Select Your Work Days</Label>
                          <div className="grid grid-cols-7 gap-2">
                            {[
                              { day: 0, label: 'Sun' },
                              { day: 1, label: 'Mon' },
                              { day: 2, label: 'Tue' },
                              { day: 3, label: 'Wed' },
                              { day: 4, label: 'Thu' },
                              { day: 5, label: 'Fri' },
                              { day: 6, label: 'Sat' }
                            ].map((dayInfo) => {
                              // Get current work week days with proper fallback
                              const currentWorkWeekDays = preferences?.work_week?.days || [1, 2, 3, 4, 5]
                              const isSelected = currentWorkWeekDays.includes(dayInfo.day)
                              
                              const handleDayClick = () => {
                                if (updatePreferenceMutation.isPending) {
                                  console.log('Update in progress, ignoring click')
                                  return
                                }
                                
                                console.log('Day clicked:', dayInfo.day, 'Currently selected:', isSelected)
                                
                                let newDays: number[]
                                
                                if (!isSelected) {
                                  // Add the day and sort
                                  newDays = [...currentWorkWeekDays, dayInfo.day]
                                    .filter((day, index, arr) => arr.indexOf(day) === index) // Remove duplicates
                                    .sort((a, b) => a - b)
                                } else {
                                  // Remove the day
                                  newDays = currentWorkWeekDays.filter(d => d !== dayInfo.day)
                                }
                                
                                // Ensure at least one day is selected
                                if (newDays.length === 0) {
                                  console.log('Cannot remove last day, keeping selection')
                                  return
                                }
                                
                                console.log('Workweek update:', { currentDays: currentWorkWeekDays, newDays, dayClicked: dayInfo.day })
                                
                                handlePreferenceUpdate('work_week', {
                                  days: newDays,
                                  custom: true
                                })
                              }
                              
                              return (
                                <div 
                                  key={dayInfo.day}
                                  onClick={handleDayClick}
                                  className={`
                                    relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all
                                    ${updatePreferenceMutation.isPending ? 'opacity-50 cursor-wait' : ''}
                                    ${isSelected 
                                      ? 'border-primary bg-primary/10 text-primary' 
                                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                                    }
                                  `}
                                >
                                  <span className="text-xs font-medium">{dayInfo.label}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
                                  {updatePreferenceMutation.isPending && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Select which days constitute your work week. This determines which days are included when calculating "current week" and "next week" on the dashboard.
                        </p>
                      </div>
                </CollapsibleSection>
                    
                <CollapsibleSection
                  id="api-config"
                  title="API Configuration"
                  description="Configure API settings and timeouts"
                  icon={Globe}
                  isExpanded={expandedSections.has('api-config')}
                  onToggle={() => toggleSection('api-config')}
                >
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="api-url">API Base URL</Label>
                        <Input 
                          id="api-url" 
                          value="http://localhost:8000" 
                          className="input-modern" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timeout">Request Timeout (seconds)</Label>
                        <Input 
                          id="timeout" 
                          type="number" 
                          value="10" 
                          className="input-modern" 
                        />
                      </div>
                    </div>
                    <AnimatedButton
                      onClick={() => handlePreferenceUpdate('system', {
                        auto_scrape: true,
                        auto_start: true,
                        cleanup_days: 30
                      })}
                      disabled={updatePreferenceMutation.isPending}
                      animation="shimmer"
                      className="w-full sm:w-auto"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save System Settings
                    </AnimatedButton>
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'scraping' && (
              <div className="space-y-4">
                <CollapsibleSection
                  id="scraping-schedule"
                  title="Work Order Sync Schedule"
                  description="Configure automatic work order synchronization"
                  icon={Clock}
                  isExpanded={expandedSections.has('scraping-schedule')}
                  onToggle={() => toggleSection('scraping-schedule')}
                >
                  <ScrapingSchedule />
                </CollapsibleSection>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-4">
                {/* SMTP Email Server Configuration */}
                <CollapsibleSection
                  id="smtp-settings"
                  title="SMTP Email Server"
                  description="Configure custom SMTP server for sending email notifications"
                  icon={Server}
                  isExpanded={expandedSections.has('smtp-settings')}
                  onToggle={() => toggleSection('smtp-settings')}
                >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-server">SMTP Server</Label>
                          <Input 
                            id="smtp-server" 
                            value={smtpSettings?.settings?.smtp_server || ''}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              smtp_server: e.target.value
                            })}
                            className="input-modern" 
                            placeholder="smtp.gmail.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtp-port">Port</Label>
                          <Input 
                            id="smtp-port" 
                            type="number"
                            value={smtpSettings?.settings?.smtp_port || 587}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              smtp_port: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            placeholder="587"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-username">Username</Label>
                          <Input 
                            id="smtp-username" 
                            value={smtpSettings?.settings?.username || ''}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              username: e.target.value
                            })}
                            className="input-modern" 
                            placeholder="your-email@gmail.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtp-password">Password</Label>
                          <Input 
                            id="smtp-password" 
                            type="password"
                            value={smtpSettings?.settings?.password || ''}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              password: e.target.value
                            })}
                            className="input-modern" 
                            placeholder="App-specific password"
                          />
                          <p className="text-xs text-muted-foreground">
                            For Gmail, use an app-specific password
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="from-email">From Email</Label>
                          <Input 
                            id="from-email" 
                            type="email"
                            value={smtpSettings?.settings?.from_email || ''}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              from_email: e.target.value
                            })}
                            className="input-modern" 
                            placeholder="noreply@yourdomain.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="from-name">From Name</Label>
                          <Input 
                            id="from-name" 
                            value={smtpSettings?.settings?.from_name || 'FossaWork Automation'}
                            onChange={(e) => updateSMTPMutation.mutate({
                              ...smtpSettings?.settings,
                              from_name: e.target.value
                            })}
                            className="input-modern" 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Security Settings</Label>
                        <div className="flex items-center space-x-6">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={smtpSettings?.settings?.use_tls ?? true}
                              onChange={(e) => updateSMTPMutation.mutate({
                                ...smtpSettings?.settings,
                                use_tls: e.target.checked
                              })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                            />
                            <span className="text-sm">Use TLS</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={smtpSettings?.settings?.use_ssl ?? false}
                              onChange={(e) => updateSMTPMutation.mutate({
                                ...smtpSettings?.settings,
                                use_ssl: e.target.checked
                              })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                            />
                            <span className="text-sm">Use SSL</span>
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Port 587: TLS, Port 465: SSL, Port 25: None
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="smtp-test-email">Test Email Address</Label>
                        <div className="flex gap-2">
                          <Input 
                            id="smtp-test-email" 
                            type="email"
                            value={smtpTestEmail}
                            onChange={(e) => setSMTPTestEmail(e.target.value)}
                            className="input-modern flex-1" 
                            placeholder="test@example.com"
                          />
                          <AnimatedButton
                            onClick={() => {
                              if (smtpTestEmail) {
                                testSMTPMutation.mutate(smtpTestEmail)
                              }
                            }}
                            disabled={testSMTPMutation.isPending || !smtpTestEmail}
                            variant="secondary"
                            animation="pulse"
                          >
                            <TestTube className="w-4 h-4 mr-2" />
                            Test SMTP
                          </AnimatedButton>
                        </div>
                      </div>

                      {smtpTestResult && (
                        <Alert className={smtpTestResult.includes('✅') ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                          <AlertDescription>{smtpTestResult}</AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <AnimatedButton
                        onClick={() => {
                          if (smtpSettings?.settings) {
                            updateSMTPMutation.mutate(smtpSettings.settings)
                          }
                        }}
                        disabled={updateSMTPMutation.isPending}
                        animation="shimmer"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save SMTP Settings
                      </AnimatedButton>
                    </div>
                </CollapsibleSection>

                {/* Work Order Filter Settings */}
                <CollapsibleSection
                  id="filter-settings"
                  title="Work Order Filters"
                  description="Configure filters to automatically include or exclude specific work orders"
                  icon={Filter}
                  isExpanded={expandedSections.has('filter-settings')}
                  onToggle={() => toggleSection('filter-settings')}
                >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Enable Filtering</Label>
                        <input 
                          type="checkbox" 
                          checked={filterSettings?.settings?.enabled ?? true}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            enabled: e.target.checked
                          })}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Include Store Numbers</Label>
                        <Input 
                          value={filterSettings?.settings?.filter_by_stores?.join(', ') || ''}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            filter_by_stores: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="input-modern" 
                          placeholder="001, 002, 003 (comma separated)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Only show work orders for these store numbers
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Include Locations</Label>
                        <Input 
                          value={filterSettings?.settings?.filter_by_locations?.join(', ') || ''}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            filter_by_locations: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="input-modern" 
                          placeholder="Dallas, Houston, Austin (comma separated)"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Customer Types</Label>
                        <Input 
                          value={filterSettings?.settings?.filter_by_customers?.join(', ') || ''}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            filter_by_customers: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="input-modern" 
                          placeholder="7-Eleven, Circle K, Wawa (comma separated)"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Service Codes</Label>
                        <Input 
                          value={filterSettings?.settings?.filter_by_service_codes?.join(', ') || ''}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            filter_by_service_codes: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="input-modern" 
                          placeholder="2861, 2862, 3002, 3146 (comma separated)"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Exclude Store Numbers</Label>
                        <Input 
                          value={filterSettings?.settings?.exclude_stores?.join(', ') || ''}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            exclude_stores: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="input-modern" 
                          placeholder="999, 998 (comma separated)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Never show work orders for these store numbers
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="exclude-completed"
                          checked={filterSettings?.settings?.exclude_completed ?? true}
                          onChange={(e) => updateFilterMutation.mutate({
                            ...filterSettings?.settings,
                            exclude_completed: e.target.checked
                          })}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                        />
                        <Label htmlFor="exclude-completed" className="text-sm cursor-pointer">
                          Exclude completed work orders
                        </Label>
                      </div>
                    </div>

                    <AnimatedButton
                      onClick={() => {
                        if (filterSettings?.settings) {
                          updateFilterMutation.mutate(filterSettings.settings)
                        }
                      }}
                      disabled={updateFilterMutation.isPending}
                      animation="shimmer"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Filter Settings
                    </AnimatedButton>
                </CollapsibleSection>

                {/* Automation Delay Settings */}
                <CollapsibleSection
                  id="automation-delays"
                  title="Automation Delays"
                  description="Fine-tune automation speed and timing for optimal performance"
                  icon={Clock}
                  isExpanded={expandedSections.has('automation-delays')}
                  onToggle={() => toggleSection('automation-delays')}
                >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="field-delay">Form Field Delay (ms)</Label>
                          <Input 
                            id="field-delay"
                            type="number"
                            value={automationDelays?.settings?.form_field_delay || 500}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              form_field_delay: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="0"
                            max="5000"
                          />
                          <p className="text-xs text-muted-foreground">
                            Delay between filling form fields
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="nav-delay">Page Navigation Delay (ms)</Label>
                          <Input 
                            id="nav-delay"
                            type="number"
                            value={automationDelays?.settings?.page_navigation_delay || 2000}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              page_navigation_delay: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="0"
                            max="10000"
                          />
                          <p className="text-xs text-muted-foreground">
                            Wait time after page navigation
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="click-delay">Click Action Delay (ms)</Label>
                          <Input 
                            id="click-delay"
                            type="number"
                            value={automationDelays?.settings?.click_action_delay || 300}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              click_action_delay: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="0"
                            max="2000"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dropdown-delay">Dropdown Select Delay (ms)</Label>
                          <Input 
                            id="dropdown-delay"
                            type="number"
                            value={automationDelays?.settings?.dropdown_select_delay || 500}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              dropdown_select_delay: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="0"
                            max="2000"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="speed-multiplier">Overall Speed Multiplier</Label>
                        <div className="flex items-center gap-4">
                          <Input 
                            id="speed-multiplier"
                            type="range"
                            value={automationDelays?.settings?.overall_speed_multiplier || 1.0}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              overall_speed_multiplier: parseFloat(e.target.value)
                            })}
                            className="flex-1" 
                            min="0.1"
                            max="5.0"
                            step="0.1"
                          />
                          <span className="text-sm font-medium w-12">
                            {automationDelays?.settings?.overall_speed_multiplier || 1.0}x
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          0.5x = Twice as fast, 2.0x = Twice as slow
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="browser-timeout">Browser Timeout (ms)</Label>
                          <Input 
                            id="browser-timeout"
                            type="number"
                            value={automationDelays?.settings?.browser_timeout || 30000}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              browser_timeout: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="5000"
                            max="120000"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-retries">Max Retry Attempts</Label>
                          <Input 
                            id="max-retries"
                            type="number"
                            value={automationDelays?.settings?.max_retries || 3}
                            onChange={(e) => updateDelayMutation.mutate({
                              ...automationDelays?.settings,
                              max_retries: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="0"
                            max="10"
                          />
                        </div>
                      </div>
                    </div>

                    <AnimatedButton
                      onClick={() => {
                        if (automationDelays?.settings) {
                          updateDelayMutation.mutate(automationDelays.settings)
                        }
                      }}
                      disabled={updateDelayMutation.isPending}
                      animation="shimmer"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Delay Settings
                    </AnimatedButton>
                </CollapsibleSection>

                {/* Browser Settings */}
                <CollapsibleSection
                  id="browser-settings"
                  title="Browser Settings"
                  description="Configure browser behavior for web scraping and automation"
                  icon={Monitor}
                  isExpanded={expandedSections.has('browser-settings')}
                  onToggle={() => toggleSection('browser-settings')}
                >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Browser Visibility</Label>
                          <p className="text-xs text-muted-foreground">
                            Show browser window during scraping (useful for debugging)
                          </p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={!browserSettings?.settings?.headless}
                          onChange={(e) => {
                            const newSettings = {
                              ...browserSettings?.settings,
                              headless: !e.target.checked
                            }
                            updateBrowserMutation.mutate(newSettings)
                          }}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Browser Type</Label>
                        <select 
                          value={browserSettings?.settings?.browser_type || 'chromium'}
                          onChange={(e) => updateBrowserMutation.mutate({
                            ...browserSettings?.settings,
                            browser_type: e.target.value
                          })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
                        >
                          <option value="chromium">Chromium (Recommended)</option>
                          <option value="firefox">Firefox</option>
                          <option value="webkit">WebKit (Safari)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="viewport-width">Viewport Width</Label>
                          <Input 
                            id="viewport-width"
                            type="number"
                            value={browserSettings?.settings?.viewport_width || 1280}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              viewport_width: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="800"
                            max="3840"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="viewport-height">Viewport Height</Label>
                          <Input 
                            id="viewport-height"
                            type="number"
                            value={browserSettings?.settings?.viewport_height || 720}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              viewport_height: parseInt(e.target.value)
                            })}
                            className="input-modern" 
                            min="600"
                            max="2160"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Performance Options</h4>
                        
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={browserSettings?.settings?.enable_screenshots ?? true}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              enable_screenshots: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                          />
                          <span className="text-sm">Capture screenshots on errors</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={browserSettings?.settings?.disable_images ?? false}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              disable_images: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                          />
                          <span className="text-sm">Disable image loading (faster scraping)</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={browserSettings?.settings?.clear_cache_on_start ?? true}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              clear_cache_on_start: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                          />
                          <span className="text-sm">Clear browser cache on startup</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={browserSettings?.settings?.enable_debug_mode ?? false}
                            onChange={(e) => updateBrowserMutation.mutate({
                              ...browserSettings?.settings,
                              enable_debug_mode: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                          />
                          <span className="text-sm">Enable debug logging</span>
                        </label>
                      </div>
                    </div>

                    <AnimatedButton
                      onClick={() => {
                        if (browserSettings?.settings) {
                          updateBrowserMutation.mutate(browserSettings.settings)
                        }
                      }}
                      disabled={updateBrowserMutation.isPending}
                      animation="shimmer"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Browser Settings
                    </AnimatedButton>
                </CollapsibleSection>

                {/* Notification Display Settings */}
                <CollapsibleSection
                  id="notification-display"
                  title="Notification Display"
                  description="Choose what information appears in your notifications"
                  icon={Eye}
                  isExpanded={expandedSections.has('notification-display')}
                  onToggle={() => toggleSection('notification-display')}
                >
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Show in Notifications</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'show_job_id', label: 'Job ID' },
                          { key: 'show_store_number', label: 'Store Number' },
                          { key: 'show_store_name', label: 'Store Name' },
                          { key: 'show_location', label: 'Location' },
                          { key: 'show_date', label: 'Date' },
                          { key: 'show_time', label: 'Time' },
                          { key: 'show_dispenser_count', label: 'Dispenser Count' },
                          { key: 'show_service_code', label: 'Service Code' },
                          { key: 'show_duration', label: 'Duration' }
                        ].map((field) => (
                          <label key={field.key} className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={displaySettings?.settings?.[field.key] ?? true}
                              onChange={(e) => updateDisplayMutation.mutate({
                                ...displaySettings?.settings,
                                [field.key]: e.target.checked
                              })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" 
                            />
                            <span className="text-sm">{field.label}</span>
                          </label>
                        ))}
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="date-format">Date Format</Label>
                          <select 
                            id="date-format" 
                            value={displaySettings?.settings?.date_format || 'MM/DD/YYYY'}
                            onChange={(e) => updateDisplayMutation.mutate({
                              ...displaySettings?.settings,
                              date_format: e.target.value
                            })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            <option value="MMM DD, YYYY">MMM DD, YYYY</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="time-format">Time Format</Label>
                          <select 
                            id="time-format" 
                            value={displaySettings?.settings?.time_format || '12h'}
                            onChange={(e) => updateDisplayMutation.mutate({
                              ...displaySettings?.settings,
                              time_format: e.target.value
                            })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
                          >
                            <option value="12h">12-hour (1:30 PM)</option>
                            <option value="24h">24-hour (13:30)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <select 
                          id="timezone" 
                          value={displaySettings?.settings?.timezone || 'America/New_York'}
                          onChange={(e) => updateDisplayMutation.mutate({
                            ...displaySettings?.settings,
                            timezone: e.target.value
                          })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring input-modern"
                        >
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>

                    <AnimatedButton
                      onClick={() => {
                        if (displaySettings?.settings) {
                          updateDisplayMutation.mutate(displaySettings.settings)
                        }
                      }}
                      disabled={updateDisplayMutation.isPending}
                      animation="shimmer"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Display Settings
                    </AnimatedButton>
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