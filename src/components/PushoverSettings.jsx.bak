import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PushoverSettings = () => {
  const [appToken, setAppToken] = useState('');
  const [userKey, setUserKey] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [sampleJobResult, setSampleJobResult] = useState(null);
  const [isSendingSample, setIsSendingSample] = useState(false);
  
  // Notification content preferences
  const [preferences, setPreferences] = useState({
    showJobId: true,
    showStoreNumber: true,
    showStoreName: true,
    showLocation: true,
    showDate: true,
    showDispensers: true
  });
  
  // Load current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/settings/pushover');
        if (response.data && response.data.success) {
          setAppToken(response.data.appToken || '');
          setUserKey(response.data.userKey || '');
          
          // Load preferences if available
          if (response.data.preferences) {
            setPreferences({
              ...preferences,
              ...response.data.preferences
            });
          }
        }
      } catch (error) {
        console.error('Error fetching Pushover settings:', error);
      }
    };
    
    fetchSettings();
  }, []);
  
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
      
      const response = await axios.post('/api/settings/pushover', {
        appToken,
        userKey,
        preferences,
        preventReload: true
      });
      
      if (response.data && response.data.success) {
        setSaveStatus({ success: true, message: 'Pushover settings saved successfully' });
      } else {
        setSaveStatus({ success: false, message: 'Failed to save Pushover settings' });
      }
    } catch (error) {
      setSaveStatus({ 
        success: false, 
        message: error.response?.data?.message || 'Error saving Pushover settings' 
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
      const response = await axios.post('/api/settings/pushover/test', {
        appToken,
        userKey,
        preferences
      });
      
      if (response.data && response.data.success) {
        setTestResult({ success: true, message: 'Test notification sent successfully' });
      } else {
        setTestResult({ 
          success: false, 
          message: response.data?.message || 'Failed to send test notification' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error.response?.data?.message || 'Error sending test notification' 
      });
    } finally {
      setIsTesting(false);
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    }
  };
  
  const handleTestSampleJob = async () => {
    setIsSendingSample(true);
    setSampleJobResult(null);
    
    try {
      const response = await axios.post('/api/settings/pushover/sample-job', {
        appToken,
        userKey,
        preferences
      });
      
      if (response.data && response.data.success) {
        setSampleJobResult({ success: true, message: 'Sample job notification sent successfully' });
      } else {
        setSampleJobResult({ 
          success: false, 
          message: response.data?.message || 'Failed to send sample job notification' 
        });
      }
    } catch (error) {
      setSampleJobResult({ 
        success: false, 
        message: error.response?.data?.message || 'Error sending sample job notification' 
      });
    } finally {
      setIsSendingSample(false);
      setTimeout(() => {
        setSampleJobResult(null);
      }, 5000);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Pushover Notifications</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Configure Pushover to receive notifications on your devices. Visit <a 
          href="https://pushover.net" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          pushover.net
        </a> to create an account and get your credentials.
      </p>
      
      <div className="space-y-4">
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
          <input
            type="checkbox"
            id="showPassword"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
          />
          <label htmlFor="showPassword" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
            Show credentials
          </label>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Job Information to Display</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showJobId"
                name="showJobId"
                checked={preferences.showJobId}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showJobId" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Visit Number
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showStoreNumber"
                name="showStoreNumber"
                checked={preferences.showStoreNumber}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showStoreNumber" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Store Number
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showStoreName"
                name="showStoreName"
                checked={preferences.showStoreName}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showStoreName" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Store Name
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showLocation"
                name="showLocation"
                checked={preferences.showLocation}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showLocation" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Location
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showDate"
                name="showDate"
                checked={preferences.showDate}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showDate" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Date
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showDispensers"
                name="showDispensers"
                checked={preferences.showDispensers}
                onChange={handlePreferenceChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
              />
              <label htmlFor="showDispensers" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Dispensers Count
              </label>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-4 pt-4">
          <button
            onClick={handleSave}
            disabled={saveStatus?.loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
          >
            {saveStatus?.loading ? 'Saving...' : 'Save Settings'}
          </button>
          
          <button
            onClick={handleTest}
            disabled={isTesting || !appToken || !userKey}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
          >
            {isTesting ? 'Sending...' : 'Test Notification'}
          </button>
          
          <button
            onClick={handleTestSampleJob}
            disabled={isSendingSample || !appToken || !userKey}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
          >
            {isSendingSample ? 'Sending...' : 'Sample Job'}
          </button>
        </div>
        
        {saveStatus && !saveStatus.loading && (
          <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {saveStatus.message}
          </div>
        )}
        
        {testResult && (
          <div className={`mt-2 text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {testResult.message}
          </div>
        )}
        
        {sampleJobResult && (
          <div className={`mt-2 text-sm ${sampleJobResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {sampleJobResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default PushoverSettings; 