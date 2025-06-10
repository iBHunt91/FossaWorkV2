import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, User, Bell, Shield, Database, TestTube, Trash2 } from 'lucide-react'
import { 
  getUserPreferences, 
  setUserPreference,
  saveWorkFossaCredentials,
  getWorkFossaCredentials,
  deleteWorkFossaCredentials,
  testWorkFossaCredentials
} from '../services/api'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import CredentialManager from '../components/CredentialManager'

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const [workfossaCredentials, setWorkfossaCredentials] = useState({
    username: '',
    password: ''
  })
  const [credentialTestResult, setCredentialTestResult] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // TODO: Get from auth context
  const currentUserId = 'demo-user'

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences', currentUserId],
    queryFn: () => getUserPreferences(currentUserId),
  })

  const { data: savedCredentials } = useQuery({
    queryKey: ['workfossa-credentials', currentUserId],
    queryFn: () => getWorkFossaCredentials(currentUserId),
  })

  const updatePreferenceMutation = useMutation({
    mutationFn: ({ type, data }: { type: string; data: any }) =>
      setUserPreference(currentUserId, type, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
    },
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

  const handlePreferenceUpdate = (type: string, data: any) => {
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
    if (window.confirm('Are you sure you want to delete your WorkFossa credentials?')) {
      deleteCredentialsMutation.mutate()
    }
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
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'system', label: 'System', icon: Database },
  ]

  if (isLoading) {
    return <LoadingSpinner message="Loading settings..." />
  }

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>Settings</h1>
        <p>Configure your FossaWork V2 preferences</p>
      </header>

      <div className="settings-container">
        {/* Tab Navigation */}
        <nav className="settings-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon className="tab-icon" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Tab Content */}
        <div className="settings-content">
          {activeTab === 'profile' && (
            <Card>
              <h2>Profile Settings</h2>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value="testuser" disabled className="form-input" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value="test@example.com" disabled className="form-input" />
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input type="text" placeholder="Enter display name" className="form-input" />
              </div>
              <button className="action-button primary">
                <Save className="icon" />
                Save Profile
              </button>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <h2>Notification Settings</h2>
              <div className="settings-section">
                <h3>Email Notifications</h3>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Work order completion
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    System errors
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Daily summary
                  </label>
                </div>
              </div>
              
              <div className="settings-section">
                <h3>Push Notifications</h3>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Real-time progress updates
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Schedule changes
                  </label>
                </div>
              </div>

              <button
                className="action-button primary"
                onClick={() => handlePreferenceUpdate('notifications', {
                  email_enabled: true,
                  push_enabled: true,
                  frequency: 'immediate'
                })}
                disabled={updatePreferenceMutation.isPending}
              >
                <Save className="icon" />
                Save Notifications
              </button>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <h2>Security Settings</h2>
              <div className="settings-section">
                <h3>Password</h3>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" className="form-input" />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" className="form-input" />
                </div>
                <button className="action-button secondary">Update Password</button>
              </div>

              <CredentialManager 
                userId={currentUserId}
                onCredentialsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['workfossa-credentials'] })
                }}
              />
            </Card>
          )}

          {activeTab === 'system' && (
            <Card>
              <h2>System Settings</h2>
              <div className="settings-section">
                <h3>Automation</h3>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Auto-scrape work orders every hour
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Auto-start dispensers when ready
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Send notifications on completion
                  </label>
                </div>
              </div>

              <div className="settings-section">
                <h3>Data Management</h3>
                <div className="form-group">
                  <label>Auto-cleanup completed jobs after</label>
                  <select className="form-select">
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                <button className="action-button secondary">Clear All Data</button>
              </div>

              <div className="settings-section">
                <h3>API Configuration</h3>
                <div className="form-group">
                  <label>API Base URL</label>
                  <input 
                    type="text" 
                    value="http://localhost:8000" 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Request Timeout (seconds)</label>
                  <input type="number" value="10" className="form-input" />
                </div>
              </div>

              <button
                className="action-button primary"
                onClick={() => handlePreferenceUpdate('system', {
                  auto_scrape: true,
                  auto_start: true,
                  cleanup_days: 30
                })}
                disabled={updatePreferenceMutation.isPending}
              >
                <Save className="icon" />
                Save System Settings
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings