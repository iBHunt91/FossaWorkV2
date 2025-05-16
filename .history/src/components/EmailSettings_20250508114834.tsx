import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiSend, FiCheck, FiAlertCircle, FiRefreshCw, FiMail, FiList, FiToggleRight, FiClock, FiInfo, FiTrash2 } from 'react-icons/fi';

interface EmailSettingsProps {}

interface EmailPreferences {
  recipientEmail: string;
  showJobId: boolean;
  showStoreNumber: boolean;
  showStoreName: boolean;
  showLocation: boolean;
  showDate: boolean;
  showDispensers: boolean;
  enabled: boolean;
  frequency: 'immediate' | 'daily';
  deliveryTime: string;
}

const EmailSettings: React.FC<EmailSettingsProps> = () => {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    recipientEmail: '',
    showJobId: true,
    showStoreNumber: true,
    showStoreName: true,
    showLocation: true,
    showDate: true,
    showDispensers: true,
    enabled: true,
    frequency: 'immediate',
    deliveryTime: '18:00',
  });
  
  const [saveStatus, setSaveStatus] = useState<{ loading?: boolean; success?: boolean; message?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  // Add new state for remove confirmation
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  
  // Load current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/settings/email');
        if (response.data && response.data.success) {
          setPreferences({
            recipientEmail: response.data.recipientEmail || '',
            showJobId: response.data.showJobId !== false,
            showStoreNumber: response.data.showStoreNumber !== false,
            showStoreName: response.data.showStoreName !== false,
            showLocation: response.data.showLocation !== false,
            showDate: response.data.showDate !== false,
            showDispensers: response.data.showDispensers !== false,
            enabled: response.data.enabled !== false,
            frequency: response.data.frequency || 'immediate',
            deliveryTime: response.data.deliveryTime || '18:00',
          });
        }
      } catch (error) {
        console.error('Error fetching email settings:', error);
      }
    };
    
    fetchSettings();
  }, []);
  
  const handleSave = async () => {
    try {
      setSaveStatus({ loading: true });
      
      const response = await axios.post('/api/settings/email', {
        ...preferences,
        preventReload: true
      });
      
      if (response.data && response.data.success) {
        setSaveStatus({ success: true, message: 'Email settings saved successfully' });
      } else {
        setSaveStatus({ success: false, message: 'Failed to save email settings' });
      }
    } catch (error: any) {
      setSaveStatus({ 
        success: false, 
        message: error.response?.data?.message || 'Error saving email settings' 
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
      const response = await axios.post('/api/settings/email/test', preferences);
      
      if (response.data && response.data.success) {
        setTestResult({ success: true, message: 'Test email sent successfully' });
      } else {
        setTestResult({ 
          success: false, 
          message: response.data?.message || 'Failed to send test email' 
        });
      }
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.response?.data?.message || 'Error sending test email' 
      });
    } finally {
      setIsTesting(false);
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleRemoveEmailSettings = async () => {
    try {
      setSaveStatus({ loading: true });
      
      const response = await axios.delete('/api/settings/email');
      
      if (response.data && response.data.success) {
        setSaveStatus({ success: true, message: 'Email settings removed successfully' });
        // Reset the form state
        setPreferences({
          recipientEmail: '',
          showJobId: true,
          showStoreNumber: true,
          showStoreName: true,
          showLocation: true,
          showDate: true,
          showDispensers: true,
          enabled: true,
          frequency: 'immediate',
          deliveryTime: '18:00',
        });
        setShowRemoveConfirm(false);
      } else {
        setSaveStatus({ success: false, message: 'Failed to remove email settings' });
      }
    } catch (error: any) {
      setSaveStatus({ 
        success: false, 
        message: error.response?.data?.message || 'Error removing email settings' 
      });
    } finally {
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    }
  };

  return (
    <>
      {!preferences.recipientEmail ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-5">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <FiMail className="h-12 w-12 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">No Email Settings Configured</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 max-w-md">
            Configure your email notification settings to receive alerts about schedule changes and important events.
          </p>
          <div className="w-full max-w-md pt-4 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <label htmlFor="emptyEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recipient Email
            </label>
            <input
              type="email"
              id="emptyEmail"
              name="recipientEmail"
              value={preferences.recipientEmail}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter email recipient address"
            />
            <button
              onClick={handleSave}
              disabled={!preferences.recipientEmail || (saveStatus?.loading || false)}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
            >
              {saveStatus?.loading ? (
                <>
                  <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiMail className="mr-2 h-4 w-4" />
                  <span>Save Email Settings</span>
                </>
              )}
            </button>
            
            {saveStatus && (
              <div className={`mt-3 p-3 rounded-md text-sm ${saveStatus.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {saveStatus.message}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Email Status Card */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-800/70 rounded-full mr-3">
                <FiMail className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Email Notification Status</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{preferences.recipientEmail}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center">
                <label htmlFor="email-notifications-toggle" className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabled"
                    id="email-notifications-toggle"
                    checked={preferences.enabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 dark:after:border-gray-600"></div>
                </label>
                <span className={`ml-2 text-sm font-medium ${preferences.enabled ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`}>
                  {preferences.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 dark:bg-amber-900/20 dark:border-amber-500 rounded-r-md">
            <h3 className="text-amber-800 dark:text-amber-400 font-medium mb-2 flex items-center">
              <FiAlertCircle className="mr-2 h-5 w-5" />
              Email Delivery Notice
            </h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm mb-2">
              Notification emails may be filtered to your spam/junk folder, especially when first setting up.
            </p>
            <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-sm space-y-1">
              <li>Check your spam/junk folder if you don't receive notifications</li>
              <li>Add the sender email address to your contacts</li>
              <li>Mark emails from this system as "Not Spam" when received</li>
            </ul>
          </div>
      
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Configuration */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <FiMail className="h-5 w-5 text-blue-500 mr-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Email Configuration</h3>
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
                      onClick={handleRemoveEmailSettings}
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
              
              <div>
                <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  id="recipientEmail"
                  name="recipientEmail"
                  value={preferences.recipientEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white mb-4"
                  placeholder="Enter email recipient address"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notification Frequency
                </label>
                <select
                  id="frequency"
                  name="frequency"
                  value={preferences.frequency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="immediate">Immediate (as changes are detected)</option>
                  <option value="daily">Daily Digest (once per day)</option>
                </select>
              </div>

              {preferences.frequency === 'daily' && (
                <>
                  <div className="mb-4">
                    <label htmlFor="deliveryTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                      <FiClock className="h-4 w-4 mr-1" />
                      Daily Delivery Time
                    </label>
                    <input
                      type="time"
                      id="deliveryTime"
                      name="deliveryTime"
                      value={preferences.deliveryTime}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      All schedule changes will be collected and sent at this time each day
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4 flex items-start">
                    <FiInfo className="text-blue-500 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0 h-4 w-4" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium mb-1">Daily Digest Mode</p>
                      <p>Instead of receiving individual notifications as changes occur, you'll receive a single email at your specified time containing all changes detected over the past 24 hours.</p>
                    </div>
                  </div>
                </>
              )}
              
              {preferences.frequency === 'immediate' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4 flex items-start">
                  <FiInfo className="text-blue-500 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0 h-4 w-4" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Immediate Notification Mode</p>
                    <p>You'll receive individual email notifications in real-time as schedule changes are detected.</p>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSave}
                  disabled={!preferences.recipientEmail || (saveStatus?.loading || false)}
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
                  disabled={!preferences.recipientEmail || isTesting || !preferences.enabled}
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
                      <span>Test Email</span>
                    </>
                  )}
                </button>
                
                {preferences.frequency === 'daily' && (
                  <button
                    onClick={async () => {
                      setIsTesting(true);
                      setTestResult(null);
                      try {
                        const response = await axios.post('/api/settings/email/test-digest');
                        if (response.data && response.data.success) {
                          setTestResult({ 
                            success: true, 
                            message: response.data.result.sent 
                              ? `Daily digest sent with ${response.data.result.changesCount || 0} changes` 
                              : response.data.result.reason === 'no_digest_file' 
                                ? 'No pending changes to include in digest'
                                : 'No digest was sent' 
                          });
                        } else {
                          setTestResult({ 
                            success: false, 
                            message: response.data?.message || 'Failed to test daily digest' 
                          });
                        }
                      } catch (error: any) {
                        setTestResult({ 
                          success: false, 
                          message: error.response?.data?.message || 'Error testing daily digest' 
                        });
                      } finally {
                        setIsTesting(false);
                        setTimeout(() => {
                          setTestResult(null);
                        }, 5000);
                      }
                    }}
                    disabled={!preferences.recipientEmail || isTesting || !preferences.enabled}
                    className="px-4 py-2 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 rounded-md font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center"
                  >
                    {isTesting ? (
                      <>
                        <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <FiClock className="mr-2 h-4 w-4" />
                        <span>Test Digest</span>
                      </>
                    )}
                  </button>
                )}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 mr-3"
                  />
                  <label htmlFor="showDispensers" className="text-sm text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer">
                    Dispenser Details
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmailSettings; 