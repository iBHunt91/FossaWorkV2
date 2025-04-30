import React, { useState, useEffect, useRef } from 'react'
import { 
  FiKey, 
  FiCheck, 
  FiLoader, 
  FiAlertCircle, 
  FiCalendar, 
  FiMail, 
  FiSmartphone, 
  FiSettings,
  FiBell,
  FiSliders,
  FiSave,
  FiRefreshCw,
  FiDroplet,
  FiUser,
  FiAlertTriangle
} from 'react-icons/fi'
import { updateFossaCredentials } from '../services/ipcService'
import EmailSettings from '../components/EmailSettings'
import PushoverSettings from '../components/PushoverSettings'
import ProverPreferences from '../components/ProverPreferences'
import UserManagement from '../components/UserManagement'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'

const Settings: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('users');
  const [testScheduleType, setTestScheduleType] = useState("new");
  const [testScheduleDelay, setTestScheduleDelay] = useState("30");
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const { addToast } = useToast();

  // Schedule change test states
  const [scheduleChangeType, setScheduleChangeType] = useState<'add' | 'remove' | 'replace' | 'date' | 'swap'>('add')
  const [scheduleChangeCount, setScheduleChangeCount] = useState(1)
  const [scheduleTestResult, setScheduleTestResult] = useState('')
  const [isTestingSchedule, setIsTestingSchedule] = useState(false)
  
  // Display preferences for schedule tests
  const [scheduleTestPreferences, setScheduleTestPreferences] = useState({
    useEmailPreferences: true,
    usePushoverPreferences: true,
    forceShowAllFields: false
  })

  // Reset status after 30 seconds of success or error to avoid refresh issues
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (verificationStatus === 'success' || verificationStatus === 'error') {
      timer = setTimeout(() => {
        if (verificationStatus === 'success') {
          setMessage('');
        } else if (verificationStatus === 'error') {
          setError('');
        }
        setVerificationStatus('idle');
      }, 30000); // 30 seconds
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [verificationStatus]);

  // Reset test results after 30 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (scheduleTestResult) {
      timer = setTimeout(() => {
        setScheduleTestResult('');
      }, 30000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [scheduleTestResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')
    setVerificationStatus('verifying')

    try {
      console.log('==== VERIFICATION PROCESS STARTED ====')
      console.log(`Submitting credentials for verification - Email: ${email}`)
      console.log(`Password length: ${password.length} characters`)
      
      // First, validate inputs
      if (!email.includes('@')) {
        throw new Error('Invalid email format')
      }
      
      if (password.length < 5) {
        throw new Error('Password must be at least 5 characters')
      }

      console.log('Calling updateFossaCredentials service function...')
      const result = await updateFossaCredentials(email, password)
      console.log(`Got result: success=${result.success}, message=${result.message}`)
      
      if (result.success) {
        console.log('Credentials verified and updated successfully')
        setMessage(result.message || 'Work Fossa credentials verified and updated successfully')
        setVerificationStatus('success')
        // Clear the form
        setEmail('')
        setPassword('')
      } else {
        console.log(`Credential verification failed: ${result.message}`)
        throw new Error(result.message || 'Failed to verify credentials')
      }
      console.log('==== VERIFICATION PROCESS COMPLETED ====')
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update Work Fossa credentials'
      console.error(`ERROR: ${errorMsg}`)
      
      // Set a user-friendly error message
      let userFriendlyError = 'Invalid credentials. Please check your email and password and try again.'
      
      if (errorMsg.includes('Timeout') || errorMsg.includes('navigation')) {
        userFriendlyError = 'Unable to connect to Work Fossa. Please try again later.'
      }
      
      setError(userFriendlyError)
      setVerificationStatus('error')
      console.log('==== VERIFICATION PROCESS FAILED ====')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle schedule change test
  const handleScheduleChangeTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingSchedule(true);
    setScheduleTestResult('');

    try {
      console.log('==== UNIFIED NOTIFICATION SYSTEM TEST STARTED ====')
      console.log(`Testing schedule change with type: ${scheduleChangeType}, count: ${scheduleChangeCount}`)
      console.log('Using notification options:', scheduleTestPreferences)
      
      // Use the IPC bridge to call the test function in main process
      if (window.electron?.testScheduleChange) {
        const result = await window.electron.testScheduleChange({
          changeType: scheduleChangeType,
          count: scheduleChangeCount,
          preferences: scheduleTestPreferences
        })
        
        if (result.success) {
          setScheduleTestResult(`Successfully sent ${scheduleChangeCount} ${scheduleChangeType} schedule change notifications through the unified alert system.`)
          // Show a toast notification as well
          addToast('success', `Sent ${scheduleChangeCount} ${scheduleChangeType} schedule change notifications successfully`, 5000);
        } else {
          throw new Error(result.message || 'Failed to send test notifications')
        }
      } else {
        throw new Error('Notification test functionality not available')
      }
      
      console.log('==== UNIFIED NOTIFICATION SYSTEM TEST COMPLETED ====')
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to test notifications'
      console.error(`ERROR: ${errorMsg}`)
      setScheduleTestResult(`Error: ${errorMsg}`)
      // Show a toast notification for the error as well
      addToast('error', errorMsg, 5000);
    } finally {
      setIsTestingSchedule(false)
    }
  }

  const getTabButtonClass = (tab: string) => {
    return activeTab === tab
      ? "flex items-center py-3 px-4 bg-blue-50 text-blue-600 font-medium rounded-lg dark:bg-blue-900/20 dark:text-blue-400"
      : "flex items-center py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800/50";
  };

  const getTabIconClass = (tab: string) => {
    return activeTab === tab
      ? "mr-2 text-blue-600 dark:text-blue-400"
      : "mr-2 text-gray-500 dark:text-gray-400";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center">
            <FiSettings className="h-6 w-6 text-blue-500 mr-3" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure your Fossa Monitor application preferences
          </p>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Sidebar Navigation */}
          <div className="md:w-64 px-4 py-6 border-r border-gray-200 dark:border-gray-700">
            <nav className="space-y-2">
              <button 
                onClick={() => setActiveTab('users')}
                className={getTabButtonClass('users')}
              >
                <FiUser className={getTabIconClass('users')} />
                <span>User Management</span>
              </button>
              <button
                onClick={() => setActiveTab('email')}
                className={getTabButtonClass('email')}
              >
                <FiMail className={getTabIconClass('email')} />
                <span>Email Notifications</span>
              </button>
              <button
                onClick={() => setActiveTab('pushover')}
                className={getTabButtonClass('pushover')}
              >
                <FiSmartphone className={getTabIconClass('pushover')} />
                <span>Pushover Notifications</span>
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={getTabButtonClass('schedule')}
              >
                <FiCalendar className={getTabIconClass('schedule')} />
                <span>Schedule Tests</span>
              </button>
              <button
                onClick={() => setActiveTab('provers')}
                className={getTabButtonClass('provers')}
              >
                <FiDroplet className={getTabIconClass('provers')} />
                <span>Prover Preferences</span>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 px-4 md:px-6 py-6">
            {/* Fossa Credentials Section */}
            {activeTab === 'credentials' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <FiKey className="h-5 w-5 text-blue-500 mr-2" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">Work Fossa Credentials</h3>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Update your Work Fossa account credentials. These will be verified before saving to the .env file.
                    </p>
                    
                    {message && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
                        <FiCheck className="flex-shrink-0 text-green-500 mr-2" />
                        <span>{message}</span>
                      </div>
                    )}
                    
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
                        <FiAlertCircle className="flex-shrink-0 text-red-500 mr-2 dark:text-red-400" />
                        <span>{error}</span>
                      </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="Enter your Fossa email"
                          disabled={isLoading}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          id="password"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Enter your Fossa password"
                          disabled={isLoading}
                        />
                      </div>
                      
                      <div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center transition-colors"
                          disabled={isLoading}
                        >
                          {isLoading && verificationStatus === 'verifying' ? (
                            <>
                              <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                              Verifying...
                            </>
                          ) : isLoading ? (
                            <>
                              <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <FiSave className="mr-2 h-4 w-4" />
                              Verify & Update Credentials
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            
            {/* User Management Section */}
            {activeTab === 'users' && (
              <UserManagement />
            )}
            
            {/* Email Notification Settings */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <FiMail className="h-5 w-5 text-blue-500 mr-2" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">Email Notification Settings</h3>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <EmailSettings />
                  </div>
                </div>
              </div>
            )}
            
            {/* Pushover Notification Settings */}
            {activeTab === 'pushover' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <FiSmartphone className="h-5 w-5 text-blue-500 mr-2" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">Pushover Notification Settings</h3>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <PushoverSettings />
                  </div>
                </div>
              </div>
            )}
            
            {/* Schedule Change Test Section */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <FiCalendar className="h-5 w-5 text-blue-500 mr-2" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">Schedule Change Test</h3>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Test the unified notification system by simulating different types of schedule changes.
                    </p>
                    
                    {scheduleTestResult && (
                      <div className={`${scheduleTestResult.startsWith('Error') 
                        ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                        : 'bg-green-50 border border-green-200 text-green-700'} 
                        px-4 py-3 rounded-lg mb-4 flex items-center`}
                      >
                        {scheduleTestResult.startsWith('Error') ? (
                          <FiAlertCircle className="flex-shrink-0 text-red-500 mr-2 dark:text-red-400" />
                        ) : (
                          <FiCheck className="flex-shrink-0 text-green-500 mr-2" />
                        )}
                        <span>{scheduleTestResult}</span>
                      </div>
                    )}
                    
                    <form onSubmit={handleScheduleChangeTest} className="space-y-4">
                      <div>
                        <label htmlFor="changeType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Change Type
                        </label>
                        <select
                          id="changeType"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          value={scheduleChangeType}
                          onChange={(e) => setScheduleChangeType(e.target.value as any)}
                          disabled={isTestingSchedule}
                        >
                          <option value="add">Add Job</option>
                          <option value="remove">Remove Job</option>
                          <option value="replace">Replace Job</option>
                          <option value="date">Date Change</option>
                          <option value="swap">Job Swap</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="changeCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Number of Changes
                        </label>
                        <input
                          type="number"
                          id="changeCount"
                          min="1"
                          max="5"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          value={scheduleChangeCount}
                          onChange={(e) => setScheduleChangeCount(parseInt(e.target.value) || 1)}
                          disabled={isTestingSchedule}
                        />
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Notification Options</h4>
                        
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="useEmailPreferences"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={scheduleTestPreferences.useEmailPreferences}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                useEmailPreferences: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="useEmailPreferences" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                              Send Email notification
                            </label>
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="usePushoverPreferences"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={scheduleTestPreferences.usePushoverPreferences}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                usePushoverPreferences: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="usePushoverPreferences" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                              Send Pushover notification
                            </label>
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="forceShowAllFields"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={scheduleTestPreferences.forceShowAllFields}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                forceShowAllFields: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="forceShowAllFields" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                              Show all notification details (override user preferences)
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center transition-colors"
                          disabled={isTestingSchedule}
                        >
                          {isTestingSchedule ? (
                            <>
                              <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                              Sending Notifications...
                            </>
                          ) : (
                            <>
                              <FiBell className="mr-2 h-4 w-4" />
                              Test Unified Notification System
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Prover Preferences Section */}
            {activeTab === 'provers' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <FiDroplet className="h-5 w-5 text-blue-500 mr-2" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">Prover Preferences</h3>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <ProverPreferences />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings 