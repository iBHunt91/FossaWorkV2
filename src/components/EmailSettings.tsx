import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface EmailSettingsProps {}

interface EmailPreferences {
  recipientEmail: string;
  showJobId: boolean;
  showStoreNumber: boolean;
  showStoreName: boolean;
  showLocation: boolean;
  showDate: boolean;
  showDispensers: boolean;
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
  });
  
  const [saveStatus, setSaveStatus] = useState<{ loading?: boolean; success?: boolean; message?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [sampleJobResult, setSampleJobResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSendingSample, setIsSendingSample] = useState(false);
  
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

  const handleTestSampleJob = async () => {
    setIsSendingSample(true);
    setSampleJobResult(null);
    
    try {
      const response = await axios.post('/api/settings/email/sample-job', {
        recipientEmail: preferences.recipientEmail,
        preferences
      });
      
      if (response.data && response.data.success) {
        setSampleJobResult({ success: true, message: 'Sample job email sent successfully' });
      } else {
        setSampleJobResult({ 
          success: false, 
          message: response.data?.message || 'Failed to send sample job email' 
        });
      }
    } catch (error: any) {
      setSampleJobResult({ 
        success: false, 
        message: error.response?.data?.message || 'Error sending sample job email' 
      });
    } finally {
      setIsSendingSample(false);
      setTimeout(() => {
        setSampleJobResult(null);
      }, 5000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Email Notifications</h2>
      
      {!preferences.recipientEmail ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">No Email Settings Configured</h3>
          <p className="text-center text-gray-500 dark:text-gray-400 max-w-md">
            Configure your email notification settings to receive alerts about schedule changes and important events.
          </p>
          <div className="w-full max-w-md pt-4">
            <label htmlFor="emptyEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {saveStatus?.loading ? 'Saving...' : 'Save Email Settings'}
            </button>
            
            {saveStatus && (
              <div className={`mt-3 p-3 rounded-md text-sm ${saveStatus.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {saveStatus.message}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Configure email notification settings and job information to display.
          </p>
      
          <div className="space-y-4">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter email recipient address"
              />
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
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
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="showDispensers" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Dispensers
                  </label>
                </div>
              </div>
            </div>
          
            <div className="flex flex-wrap justify-between mt-6 gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={handleSave}
                  disabled={saveStatus?.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {saveStatus?.loading ? 'Saving...' : 'Save Settings'}
                </button>
            
                {saveStatus && (
                  <div className={`mt-2 p-2 text-sm rounded ${saveStatus.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {saveStatus.message}
                  </div>
                )}
              </div>
            
              <div className="flex space-x-3">
                <button
                  onClick={handleTest}
                  disabled={isTesting || !preferences.recipientEmail}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isTesting ? 'Sending...' : 'Send Test Email'}
                </button>
              
                <button
                  onClick={handleTestSampleJob}
                  disabled={isSendingSample || !preferences.recipientEmail}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSendingSample ? 'Sending...' : 'Send Sample Job'}
                </button>
              </div>
            </div>
          
            {testResult && (
              <div className={`mt-4 p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {testResult.message}
              </div>
            )}
          
            {sampleJobResult && (
              <div className={`mt-4 p-3 rounded-md ${sampleJobResult.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {sampleJobResult.message}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EmailSettings; 