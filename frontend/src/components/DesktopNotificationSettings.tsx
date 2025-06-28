import React, { useState, useEffect } from 'react'
import { Bell, BellOff, Volume2, VolumeX, Clock, Moon, TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { desktopNotificationService, type DesktopNotificationSettings } from '../services/desktopNotificationService'
import { logger } from '../services/fileLoggingService'

interface DesktopNotificationSettingsProps {
  className?: string
}

export default function DesktopNotificationSettings({ className }: DesktopNotificationSettingsProps) {
  const [settings, setSettings] = useState<DesktopNotificationSettings>({
    enabled: true,
    sound_enabled: true,
    auto_close_time: 10,
    priority_threshold: 'normal',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00'
  })
  
  const [loading, setLoading] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [isSupported, setIsSupported] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)

  useEffect(() => {
    loadSettings()
    checkNotificationSupport()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const currentSettings = desktopNotificationService.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      logger.error('desktopSettings.load', 'Failed to load settings', { error })
    } finally {
      setLoading(false)
    }
  }

  const checkNotificationSupport = () => {
    const supported = desktopNotificationService.isNotificationSupported()
    setIsSupported(supported)
    
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted')
    }
  }

  const handleSettingsChange = (field: keyof DesktopNotificationSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const saveSettings = async () => {
    try {
      setSaveStatus('saving')
      
      const success = await desktopNotificationService.updateSettings(settings)
      
      if (success) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      logger.error('desktopSettings.save', 'Failed to save settings', { error })
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const sendTestNotification = async () => {
    try {
      setTestStatus('sending')
      
      const success = await desktopNotificationService.sendTestNotification(
        'Fossa Monitor Test',
        'Desktop notifications are working correctly! This is a test from your settings page.',
        settings.priority_threshold
      )
      
      if (success) {
        setTestStatus('success')
        setTimeout(() => setTestStatus('idle'), 3000)
      } else {
        setTestStatus('error')
        setTimeout(() => setTestStatus('idle'), 3000)
      }
    } catch (error) {
      logger.error('desktopSettings.test', 'Failed to send test notification', { error })
      setTestStatus('error')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        setPermissionGranted(permission === 'granted')
        
        if (permission === 'granted') {
          // Re-initialize the service
          await desktopNotificationService.initialize()
          checkNotificationSupport()
        }
      } catch (error) {
        logger.error('desktopSettings.permission', 'Failed to request permission', { error })
      }
    }
  }

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...'
      case 'success': return 'Saved!'
      case 'error': return 'Failed to save'
      default: return 'Save Settings'
    }
  }

  const getTestButtonText = () => {
    switch (testStatus) {
      case 'sending': return 'Sending...'
      case 'success': return 'Test sent!'
      case 'error': return 'Test failed'
      default: return 'Send Test'
    }
  }

  const getSaveButtonIcon = () => {
    switch (saveStatus) {
      case 'saving': return <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
      case 'success': return <CheckCircle className="w-4 h-4" />
      case 'error': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const getTestButtonIcon = () => {
    switch (testStatus) {
      case 'sending': return <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
      case 'success': return <CheckCircle className="w-4 h-4" />
      case 'error': return <XCircle className="w-4 h-4" />
      default: return <TestTube className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Desktop Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    )
  }

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5 text-gray-400" />
            Desktop Notifications
          </CardTitle>
          <CardDescription>
            Desktop notifications are not supported in this environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Desktop notifications require a modern browser or Electron environment.
              Your current browser doesn't support this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!permissionGranted) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Desktop Notifications
          </CardTitle>
          <CardDescription>
            Permission required to show desktop notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Desktop notifications are blocked. Please grant permission to receive notifications.
            </AlertDescription>
          </Alert>
          
          <Button onClick={requestPermission} className="w-full">
            <Bell className="w-4 h-4 mr-2" />
            Enable Desktop Notifications
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Desktop Notifications
          {settings.enabled && <Badge variant="secondary" className="ml-2">Enabled</Badge>}
        </CardTitle>
        <CardDescription>
          Configure desktop notification preferences and behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notifications-enabled">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show desktop notifications for automation events
              </p>
            </div>
            <Button
              variant={settings.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsChange('enabled', !settings.enabled)}
              className="ml-4"
            >
              {settings.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sound-enabled">Sound Effects</Label>
              <p className="text-sm text-muted-foreground">
                Play sound when notifications appear
              </p>
            </div>
            <Button
              variant={settings.sound_enabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsChange('sound_enabled', !settings.sound_enabled)}
              disabled={!settings.enabled}
              className="ml-4"
            >
              {settings.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="auto-close-time">Auto-close Time (seconds)</Label>
              <Input
                id="auto-close-time"
                type="number"
                min="0"
                max="60"
                value={settings.auto_close_time}
                onChange={(e) => handleSettingsChange('auto_close_time', parseInt(e.target.value) || 0)}
                disabled={!settings.enabled}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                0 = Manual dismissal only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority-threshold">Priority Threshold</Label>
              <select
                id="priority-threshold"
                value={settings.priority_threshold}
                onChange={(e) => handleSettingsChange('priority_threshold', e.target.value as any)}
                disabled={!settings.enabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="low">All notifications</option>
                <option value="normal">Normal and above</option>
                <option value="high">High priority only</option>
                <option value="critical">Critical only</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Minimum priority level to show
              </p>
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Quiet Hours
              </Label>
              <p className="text-sm text-muted-foreground">
                Suppress non-critical notifications during specified hours
              </p>
            </div>
            <Button
              variant={settings.quiet_hours_enabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsChange('quiet_hours_enabled', !settings.quiet_hours_enabled)}
              disabled={!settings.enabled}
              className="ml-4"
            >
              {settings.quiet_hours_enabled ? <Moon className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </Button>
          </div>

          {settings.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-gray-200">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={settings.quiet_hours_start}
                  onChange={(e) => handleSettingsChange('quiet_hours_start', e.target.value)}
                  disabled={!settings.enabled || !settings.quiet_hours_enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={settings.quiet_hours_end}
                  onChange={(e) => handleSettingsChange('quiet_hours_end', e.target.value)}
                  disabled={!settings.enabled || !settings.quiet_hours_enabled}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button 
            onClick={saveSettings}
            disabled={saveStatus === 'saving'}
            className="flex-1"
            variant={saveStatus === 'success' ? 'default' : saveStatus === 'error' ? 'destructive' : 'default'}
          >
            {getSaveButtonIcon()}
            <span className="ml-2">{getSaveButtonText()}</span>
          </Button>
          
          <Button 
            onClick={sendTestNotification}
            disabled={!settings.enabled || testStatus === 'sending'}
            variant="outline"
            className="flex-1"
          >
            {getTestButtonIcon()}
            <span className="ml-2">{getTestButtonText()}</span>
          </Button>
        </div>

        {/* Status Messages */}
        {saveStatus === 'error' && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              Failed to save notification settings. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {testStatus === 'error' && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              Failed to send test notification. Check your notification settings and permissions.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}