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
import NotificationSettings from '../components/NotificationSettings'
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
  const [selectedChangeTypes, setSelectedChangeTypes] = useState<Array<'add' | 'remove' | 'replace' | 'date' | 'swap'>>(['add'])
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
    
    // Validate at least one change type is selected
    if (selectedChangeTypes.length === 0) {
      setScheduleTestResult('Error: Please select at least one change type');
      addToast('error', 'Please select at least one change type', 3000);
      return;
    }
    
    setIsTestingSchedule(true);
    setScheduleTestResult('');

    try {
      console.log('==== UNIFIED NOTIFICATION SYSTEM TEST STARTED ====')
      console.log(`Testing schedule changes with types: ${selectedChangeTypes.join(', ')}, count: ${scheduleChangeCount}`)
      console.log('Using notification options:', scheduleTestPreferences)
      
      // Use the IPC bridge to call the test function in main process
      if (window.electron?.testScheduleChange) {
        const result = await window.electron.testScheduleChange({
          changeType: selectedChangeTypes[0], // For backward compatibility
          changeTypes: selectedChangeTypes,
          count: scheduleChangeCount,
          preferences: scheduleTestPreferences
        })
        
        if (result.success) {
          const changeTypesText = selectedChangeTypes.length > 1 
            ? `multiple (${selectedChangeTypes.join(', ')})` 
            : selectedChangeTypes[0];
          setScheduleTestResult(`Successfully sent ${scheduleChangeCount} ${changeTypesText} schedule change notifications through the unified alert system.`)
          // Show a toast notification as well
          addToast('success', `Sent ${scheduleChangeCount} schedule change notifications successfully`, 5000);
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
    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
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
                onClick={() => setActiveTab('notifications')}
                className={getTabButtonClass('notifications')}
              >
                <FiBell className={getTabIconClass('notifications')} />
                <span>Notifications</span>
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
            
            {/* Unified Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <NotificationSettings />
              </div>
            )}
            
            {/* Schedule Change Test Section */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FiCalendar className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                        <h3 className="text-base font-medium text-gray-900 dark:text-white">Schedule Change Test</h3>
                      </div>
                      <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full font-medium">
                        Notification Testing
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50 text-sm text-blue-800 dark:text-blue-300">
                      <FiAlertCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0" />
                      <p>
                        This tool allows you to test the unified notification system by simulating different types of schedule changes. 
                        Select the change types and notification options below to verify that the system works as expected.
                      </p>
                    </div>
                    
                    {scheduleTestResult && (
                      <div className={`${scheduleTestResult.startsWith('Error') 
                        ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                        : 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'} 
                        px-4 py-3 rounded-lg mb-6 flex items-center shadow-sm`}
                      >
                        {scheduleTestResult.startsWith('Error') ? (
                          <FiAlertCircle className="flex-shrink-0 text-red-500 mr-2 dark:text-red-400 h-5 w-5" />
                        ) : (
                          <FiCheck className="flex-shrink-0 text-green-500 mr-2 dark:text-green-400 h-5 w-5" />
                        )}
                        <span className="font-medium">{scheduleTestResult}</span>
                      </div>
                    )}
                    
                    <form onSubmit={handleScheduleChangeTest} className="space-y-6">
                      {/* Change Types Section */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center text-base">
                          <FiSettings className="h-4 w-4 text-blue-500 mr-2" />
                          Change Types
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Select one or more change types to simulate in the notification test.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="changeType-add"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={selectedChangeTypes.includes('add')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChangeTypes([...selectedChangeTypes, 'add'])
                                } else {
                                  setSelectedChangeTypes(selectedChangeTypes.filter(type => type !== 'add'))
                                }
                              }}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="changeType-add" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="font-medium">Add Job</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Simulate adding a new job</div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="changeType-remove"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={selectedChangeTypes.includes('remove')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChangeTypes([...selectedChangeTypes, 'remove'])
                                } else {
                                  setSelectedChangeTypes(selectedChangeTypes.filter(type => type !== 'remove'))
                                }
                              }}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="changeType-remove" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="font-medium">Remove Job</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Simulate removing a job</div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="changeType-replace"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={selectedChangeTypes.includes('replace')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChangeTypes([...selectedChangeTypes, 'replace'])
                                } else {
                                  setSelectedChangeTypes(selectedChangeTypes.filter(type => type !== 'replace'))
                                }
                              }}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="changeType-replace" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="font-medium">Replace Job</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Simulate replacing a job with another</div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="changeType-date"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={selectedChangeTypes.includes('date')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChangeTypes([...selectedChangeTypes, 'date'])
                                } else {
                                  setSelectedChangeTypes(selectedChangeTypes.filter(type => type !== 'date'))
                                }
                              }}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="changeType-date" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="font-medium">Date Change</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Simulate changing a job's date</div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="changeType-swap"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                              checked={selectedChangeTypes.includes('swap')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChangeTypes([...selectedChangeTypes, 'swap'])
                                } else {
                                  setSelectedChangeTypes(selectedChangeTypes.filter(type => type !== 'swap'))
                                }
                              }}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="changeType-swap" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="font-medium">Job Swap</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Simulate swapping two jobs</div>
                            </label>
                          </div>
                        </div>
                        
                        {selectedChangeTypes.length === 0 && (
                          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400 flex items-center">
                            <FiAlertTriangle className="mr-2 flex-shrink-0" /> 
                            <span>Please select at least one change type to proceed with testing</span>
                          </div>
                        )}

                        {selectedChangeTypes.length > 0 && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded text-sm text-blue-600 dark:text-blue-400 flex items-center">
                            <FiCheck className="mr-2 flex-shrink-0" /> 
                            <span>Selected {selectedChangeTypes.length} change type{selectedChangeTypes.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Test Configuration Section */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center text-base">
                          <FiSliders className="h-4 w-4 text-blue-500 mr-2" />
                          Test Configuration
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Configure the number of change events to generate for the test.
                        </p>
                        
                        <div className="bg-white dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-600">
                          <label htmlFor="changeCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Number of Changes
                          </label>
                          <div className="flex items-center flex-wrap gap-2">
                            <div className="w-full md:w-2/3 flex">
                              <button 
                                type="button"
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-l-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                                onClick={() => setScheduleChangeCount(Math.max(1, scheduleChangeCount - 1))}
                                disabled={isTestingSchedule || scheduleChangeCount <= 1}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                id="changeCount"
                                min="1"
                                max="5"
                                className="w-20 px-3 py-2 border-y border-gray-300 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-center"
                                value={scheduleChangeCount}
                                onChange={(e) => setScheduleChangeCount(parseInt(e.target.value) || 1)}
                                disabled={isTestingSchedule}
                              />
                              <button 
                                type="button"
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-r-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                                onClick={() => setScheduleChangeCount(Math.min(5, scheduleChangeCount + 1))}
                                disabled={isTestingSchedule || scheduleChangeCount >= 5}
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center ml-3 text-sm text-gray-500 dark:text-gray-400">
                              <FiAlertCircle className="mr-1 h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span>{scheduleChangeCount > 1 ? `${scheduleChangeCount} changes will be generated` : 'Only 1 change will be generated'} (Maximum: 5)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Notification Options Section */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center text-base">
                          <FiBell className="h-4 w-4 text-blue-500 mr-2" />
                          Notification Options
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Configure which notification channels to test and how notifications should be displayed.
                        </p>
                        
                        <div className="space-y-3">
                          <div className="flex items-center p-4 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="useEmailPreferences"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800"
                              checked={scheduleTestPreferences.useEmailPreferences}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                useEmailPreferences: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="useEmailPreferences" className="ml-3 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="flex items-center">
                                <FiMail className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                                <span className="font-medium">Send Email Notification</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                                Test sending schedule change notifications through email
                              </div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-4 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="usePushoverPreferences"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800"
                              checked={scheduleTestPreferences.usePushoverPreferences}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                usePushoverPreferences: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="usePushoverPreferences" className="ml-3 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="flex items-center">
                                <FiSmartphone className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                                <span className="font-medium">Send Pushover Notification</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                                Test sending schedule change notifications through Pushover mobile app
                              </div>
                            </label>
                          </div>
                          
                          <div className="flex items-center p-4 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                            <input
                              type="checkbox"
                              id="forceShowAllFields"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800"
                              checked={scheduleTestPreferences.forceShowAllFields}
                              onChange={(e) => setScheduleTestPreferences({
                                ...scheduleTestPreferences,
                                forceShowAllFields: e.target.checked
                              })}
                              disabled={isTestingSchedule}
                            />
                            <label htmlFor="forceShowAllFields" className="ml-3 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer w-full">
                              <div className="flex items-center">
                                <FiKey className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                                <span className="font-medium">Override User Preferences</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                                Show all notification details regardless of user preference settings
                              </div>
                            </label>
                          </div>
                        </div>

                        {!scheduleTestPreferences.useEmailPreferences && !scheduleTestPreferences.usePushoverPreferences && (
                          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30 rounded text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
                            <FiAlertTriangle className="mr-2 flex-shrink-0" /> 
                            <span>Warning: No notification methods selected. Test will run but no notifications will be sent.</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-blue-400 transition-colors dark:focus:ring-offset-gray-800"
                          disabled={isTestingSchedule || selectedChangeTypes.length === 0}
                        >
                          {isTestingSchedule ? (
                            <span className="flex items-center justify-center">
                              <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                              Testing Notification System...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <FiBell className="mr-2 h-5 w-5" />
                              Test Unified Notification System
                            </span>
                          )}
                        </button>
                        
                        <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                          Running this test will send actual notifications to configured users based on their preferences
                        </p>
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