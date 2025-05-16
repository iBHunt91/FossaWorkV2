import React, { useState, useEffect } from 'react';
import { FiSmartphone, FiSend, FiCheck, FiAlertCircle, FiRefreshCw, FiList, FiEye, FiEyeOff, FiExternalLink, FiDownload, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { 
  getPushoverSettings, 
  savePushoverSettings, 
  testPushoverNotification,
  setupPushoverOpenClient,
  startPushoverOpenClient,
  stopPushoverOpenClient,
  getPushoverOpenClientStatus,
  removePushoverSettings
} from '../services/ipcService';

const PushoverSettings = () => {
  const [appToken, setAppToken] = useState('');
  const [userKey, setUserKey] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  
  // Open Client states
  const [openClientEnabled, setOpenClientEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [openClientStatus, setOpenClientStatus] = useState(null);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [isSettingUpClient, setIsSettingUpClient] = useState(false);
  
  // Notification content preferences
  const [preferences, setPreferences] = useState({
    showJobId: true,
    showStoreNumber: true,
    showStoreName: true,
    showLocation: true,
    showDate: true,
    showDispensers: true,
    enabled: true
  });
  
  // Add state for remove confirmation
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  
  // Load current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getPushoverSettings();
        if (response && response.success) {
          setAppToken(response.appToken || '');
          setUserKey(response.userKey || '');
          
          // Load preferences if available
          if (response.preferences) {
            setPreferences({
              ...preferences,
              ...response.preferences,
              enabled: response.preferences.enabled !== false
            });
          }
          
          // Check if Open Client is enabled
          if (response.openClientSetup) {
            // Only set as enabled if not marked as needing reconnect
            setOpenClientEnabled(response.openClientEnabled && !response.openClientNeedsReconnect);
            
            // If it needs reconnect, show a notification
            if (response.openClientNeedsReconnect) {
              setOpenClientStatus({
                success: false,
                message: 'Pushover connection requires re-authentication. Please enter your email and password again.'
              });
            } else {
              // Check status if enabled
              checkOpenClientStatus();
            }
          }
        }
      } catch (error) {
        console.error('Error fetching Pushover settings:', error);
      }
    };
    
    fetchSettings();
  }, []);

  // Add status check interval
  useEffect(() => {
    let intervalId;
    
    if (openClientEnabled) {
      // Check status every 10 seconds when enabled
      intervalId = setInterval(() => {
        checkOpenClientStatus();
      }, 10000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [openClientEnabled]);
  
  const handlePreferenceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences({
      ...preferences,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSave = async () => {
    try {
      setSaveStatus({ loading: true });
      
      const response = await savePushoverSettings({
        appToken,
        userKey,
        preferences
      });
      
      if (response && response.success) {
        setSaveStatus({ success: true, message: 'Pushover settings saved successfully' });
      } else {
        setSaveStatus({ success: false, message: response?.message || 'Failed to save Pushover settings' });
      }
    } catch (error) {
      setSaveStatus({ 
        success: false, 
        message: error.message || 'Error saving Pushover settings' 
      });
    } finally {
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    }
  };
  
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await testPushoverNotification({
        appToken,
        userKey,
        preferences
      });
      
      if (response && response.success) {
        setTestResult({ success: true, message: 'Test notification sent successfully' });
      } else {
        setTestResult({ 
          success: false, 
          message: response?.message || 'Failed to send test notification' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error.message || 'Error sending test notification' 
      });
    } finally {
      setIsTesting(false);
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    }
  };

  // Setup Open Client to receive messages
  const setupOpenClient = async () => {
    if (!email || !password) {
      setOpenClientStatus({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    setIsSettingUpClient(true);
    setOpenClientStatus(null);

    try {
      // First, ensure we stop any existing client
      await stopPushoverOpenClient();
      
      const response = await setupPushoverOpenClient(email, password);

      if (response && response.success) {
        setOpenClientEnabled(true);
        setOpenClientStatus({ 
          success: true, 
          message: 'Pushover Open Client set up successfully! You can now send job numbers from your phone.' 
        });
        // Clear sensitive data
        setEmail('');
        setPassword('');
      } else {
        setOpenClientStatus({ 
          success: false, 
          message: response?.message || 'Failed to set up Pushover Open Client' 
        });
      }
    } catch (error) {
      setOpenClientStatus({ 
        success: false, 
        message: error.message || 'Error setting up Pushover Open Client' 
      });
    } finally {
      setIsSettingUpClient(false);
    }
  };

  // Check the status of the Open Client
  const checkOpenClientStatus = async () => {
    try {
      const response = await getPushoverOpenClientStatus();
      
      if (response && response.success) {
        setOpenClientEnabled(response.enabled);
        
        // Update received messages if any
        if (response.messages && response.messages.length > 0) {
          setReceivedMessages(response.messages);
        }
      }
    } catch (error) {
      console.error('Error checking Open Client status:', error);
    }
  };

  // Toggle Open Client
  const toggleOpenClient = async () => {
    try {
      const response = openClientEnabled 
        ? await stopPushoverOpenClient()
        : await startPushoverOpenClient();
      
      if (response && response.success) {
        setOpenClientEnabled(!openClientEnabled);
        setOpenClientStatus({ 
          success: true, 
          message: `Pushover Open Client ${openClientEnabled ? 'stopped' : 'started'} successfully` 
        });
      } else {
        setOpenClientStatus({ 
          success: false, 
          message: response?.message || `Failed to ${openClientEnabled ? 'stop' : 'start'} Pushover Open Client` 
        });
      }
    } catch (error) {
      setOpenClientStatus({ 
        success: false, 
        message: error.message || `Error ${openClientEnabled ? 'stopping' : 'starting'} Pushover Open Client` 
      });
    }
  };

  // Add function to remove Pushover credentials
  const handleRemoveSettings = async () => {
    try {
      setSaveStatus({ loading: true });
      
      const response = await removePushoverSettings();
      
      if (response && response.success) {
        setSaveStatus({ success: true, message: 'Pushover settings removed successfully' });
        // Reset state to default values
        setAppToken('');
        setUserKey('');
        setPreferences({
          showJobId: true,
          showStoreNumber: true,
          showStoreName: true,
          showLocation: true,
          showDate: true,
          showDispensers: true,
          enabled: true
        });
        setOpenClientEnabled(false);
        setShowRemoveConfirm(false);
      } else {
        setSaveStatus({ 
          success: false, 
          message: response?.message || 'Failed to remove Pushover settings' 
        });
      }
    } catch (error) {
      setSaveStatus({ 
        success: false, 
        message: error.message || 'Error removing Pushover settings' 
      });
    } finally {
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    }
  };
  
  return (
    <>
      {!appToken || !userKey ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-5">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <FiSmartphone className="h-12 w-12 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">No Pushover Configuration</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 max-w-md">
            Configure Pushover to receive instant push notifications on your devices for schedule changes and important events.
          </p>
          
          <div className="mt-2 mb-4 flex items-center justify-center">
            <a 
              href="https://pushover.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm font-medium"
            >
              Visit Pushover.net
              <FiExternalLink className="ml-1 h-4 w-4" />
            </a>
          </div>
          
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="space-y-4 mb-4">
              <div>
                <label htmlFor="appToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Application Token
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="appToken"
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your Pushover application token"
                />
              </div>
              
              <div>
                <label htmlFor="userKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Key
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="userKey"
                  value={userKey}
                  onChange={(e) => setUserKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your Pushover user key"
                />
              </div>
              
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <>
                      <FiEyeOff className="mr-1 h-4 w-4" />
                      Hide credentials
                    </>
                  ) : (
                    <>
                      <FiEye className="mr-1 h-4 w-4" />
                      Show credentials
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={!appToken || !userKey || (saveStatus?.loading || false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
            >
              {saveStatus?.loading ? (
                <>
                  <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiSmartphone className="mr-2 h-4 w-4" />
                  <span>Save Pushover Settings</span>
                </>
              )}
            </button>
            
            {saveStatus && (
              <div className={`mt-3 p-3 rounded-md text-sm flex items-start ${
                saveStatus.success 
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {saveStatus.success ? (
                  <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                ) : (
                  <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                )}
                <span>{saveStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pushover Status Card */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/10 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-800/70 rounded-full mr-3">
                <FiSmartphone className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Pushover Notification Status</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Connected to Pushover</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  name="enabled"
                  id="pushover-notifications-toggle"
                  checked={preferences.enabled}
                  onChange={handlePreferenceChange}
                  className="sr-only peer"
                />
                <div className="h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {preferences.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 dark:bg-blue-900/20 dark:border-blue-500 rounded-r-md">
            <h3 className="text-blue-800 dark:text-blue-400 font-medium mb-2 flex items-center">
              <FiAlertCircle className="mr-2 h-5 w-5" />
              Pushover Configuration
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Your Pushover connection is active. To change your configuration or get a new Pushover account, visit{' '}
              <a 
                href="https://pushover.net" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-blue-800 dark:hover:text-blue-200"
              >
                pushover.net
              </a>
            </p>
          </div>
      
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pushover Configuration */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <FiSmartphone className="h-5 w-5 text-blue-500 mr-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Pushover Configuration</h3>
                </div>
                {!showRemoveConfirm ? (
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 flex items-center"
                  >
                    <FiTrash2 className="mr-1 h-3 w-3" />
                    Remove
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleRemoveSettings}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 flex items-center"
                    >
                      <FiTrash2 className="mr-1 h-3 w-3" />
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(false)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 mb-4">
                <div>
                  <label htmlFor="appToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Application Token
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="appToken"
                    value={appToken}
                    onChange={(e) => setAppToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your Pushover application token"
                  />
                </div>
                
                <div>
                  <label htmlFor="userKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    User Key
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="userKey"
                    value={userKey}
                    onChange={(e) => setUserKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your Pushover user key"
                  />
                </div>
                
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <>
                        <FiEyeOff className="mr-1 h-4 w-4" />
                        Hide credentials
                      </>
                    ) : (
                      <>
                        <FiEye className="mr-1 h-4 w-4" />
                        Show credentials
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSave}
                  disabled={!appToken || !userKey || (saveStatus?.loading || false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
                >
                  {saveStatus?.loading ? (
                    <>
                      <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck className="mr-2 h-4 w-4" />
                      <span>Save</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleTest}
                  disabled={!appToken || !userKey || isTesting || !preferences.enabled}
                  className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-md font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center"
                >
                  {isTesting ? (
                    <>
                      <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <FiSend className="mr-2 h-4 w-4" />
                      <span>Test Notification</span>
                    </>
                  )}
                </button>
              </div>
              
              {testResult && (
                <div className={`mt-3 p-3 rounded-md text-sm flex items-start ${
                  testResult.success 
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {testResult.success ? (
                    <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                  ) : (
                    <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
              
              {saveStatus && saveStatus.message && (
                <div className={`mt-3 p-3 rounded-md text-sm flex items-start ${
                  saveStatus.success 
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {saveStatus.success ? (
                    <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                  ) : (
                    <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  )}
                  <span>{saveStatus.message}</span>
                </div>
              )}
            </div>
            
            {/* Notification Content */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center mb-4">
                <FiList className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-900 dark:text-white">Job Information to Display</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showJobId"
                    name="showJobId"
                    checked={preferences.showJobId}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showJobId" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Visit Number
                  </label>
                </div>
                
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showStoreNumber"
                    name="showStoreNumber"
                    checked={preferences.showStoreNumber}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showStoreNumber" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Store Number
                  </label>
                </div>
                
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showStoreName"
                    name="showStoreName"
                    checked={preferences.showStoreName}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showStoreName" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Store Name
                  </label>
                </div>
                
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showLocation"
                    name="showLocation"
                    checked={preferences.showLocation}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showLocation" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Location
                  </label>
                </div>
                
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showDate"
                    name="showDate"
                    checked={preferences.showDate}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showDate" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Date Information
                  </label>
                </div>
                
                <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md group">
                  <input
                    type="checkbox"
                    id="showDispensers"
                    name="showDispensers"
                    checked={preferences.showDispensers}
                    onChange={handlePreferenceChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showDispensers" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Dispenser Details
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* NEW SECTION: Pushover Open Client for Job Automation */}
          <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Job Automation via Pushover
              </h3>
              
              {openClientEnabled && (
                <div className="flex items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mr-2 ${openClientEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {openClientEnabled ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              )}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set up your phone to trigger job automation by sending a message with format <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">JOB:12345</code> to your Pushover account.
            </p>
            
            {!openClientEnabled ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Set Up Message Receiver</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Enter your Pushover account credentials to enable job automation from your phone.
                </p>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label htmlFor="pushover-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pushover Email
                    </label>
                    <input
                      type="email"
                      id="pushover-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter your Pushover email"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="pushover-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pushover Password
                    </label>
                    <input
                      type="password"
                      id="pushover-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter your Pushover password"
                    />
                  </div>
                </div>
                
                <button
                  onClick={setupOpenClient}
                  disabled={!email || !password || isSettingUpClient}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md font-medium disabled:opacity-50 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center"
                >
                  {isSettingUpClient ? (
                    <>
                      <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                      <span>Setting Up...</span>
                    </>
                  ) : (
                    <>
                      <FiDownload className="mr-2 h-4 w-4" />
                      <span>Set Up Message Receiver</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">Message Receiver Status</h4>
                    <button
                      onClick={toggleOpenClient}
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        openClientEnabled 
                          ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' 
                          : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                      }`}
                    >
                      {openClientEnabled ? 'Stop Receiver' : 'Start Receiver'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your phone can now trigger job automation. Send a message in format <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">JOB:12345</code> from your Pushover app.
                  </p>
                </div>
                
                {/* Received Messages */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">Recent Messages</h4>
                    <button
                      onClick={checkOpenClientStatus}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Refresh Messages"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {receivedMessages.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {receivedMessages.map((msg, index) => (
                          <li key={index} className="py-3">
                            <div className="flex items-start">
                              <FiMessageSquare className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {msg.message}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </p>
                                {msg.jobNumber && (
                                  <div className="mt-1.5 flex">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                      Job: {msg.jobNumber}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500 dark:text-gray-400">
                      <FiMessageSquare className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No messages received yet</p>
                      <p className="text-xs mt-1">Send a message from your Pushover app to trigger automation</p>
                    </div>
                  )}
                </div>
                
                {/* How to Use Guide */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">How to Use</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>Open the Pushover app on your phone</li>
                    <li>Create a new message</li>
                    <li>Type <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">JOB:12345</code> (replace 12345 with your job number)</li>
                    <li>Send the message to yourself</li>
                    <li>The desktop app will automatically process the job</li>
                  </ol>
                </div>
              </div>
            )}
            
            {openClientStatus && (
              <div className={`mt-4 p-3 rounded-md text-sm flex items-start ${
                openClientStatus.success 
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {openClientStatus.success ? (
                  <FiCheck className="h-5 w-5 mr-2 flex-shrink-0" />
                ) : (
                  <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                )}
                <span>{openClientStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PushoverSettings; 