import React, { useState } from 'react';
import EmailSettings from './EmailSettings';
import PushoverSettings from './PushoverSettings';
import { FiMail, FiSmartphone, FiInfo, FiCheckCircle, FiAlertTriangle, FiBell } from 'react-icons/fi';

const NotificationSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'pushover'>('email');

  const getTabButtonClass = (tab: 'email' | 'pushover') => {
    return activeTab === tab
      ? "flex items-center px-6 py-3 text-primary-600 bg-primary-50 border-b-2 border-primary-600 font-medium rounded-t-lg dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400"
      : "flex items-center px-6 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium rounded-t-lg dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800/30";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-md">
      <div className="px-6 py-5 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-3">
            <FiBell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notification Settings</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Configure how you receive notifications about schedule changes and important events
            </p>
          </div>
        </div>
      </div>
      
      {/* Method Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div 
          className={`flex items-center p-4 rounded-lg cursor-pointer transition-all border ${
            activeTab === 'email' 
              ? 'border-primary-200 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30' 
              : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'
          }`}
          onClick={() => setActiveTab('email')}
        >
          <div className={`p-3 rounded-full mr-4 ${
            activeTab === 'email' 
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-800/70 dark:text-primary-300' 
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            <FiMail className="h-6 w-6" />
          </div>
          <div>
            <h4 className={`font-medium ${
              activeTab === 'email' 
                ? 'text-primary-700 dark:text-primary-300' 
                : 'text-gray-800 dark:text-gray-300'
            }`}>
              Email Notifications
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send alerts to your email address
            </p>
          </div>
        </div>
        
        <div 
          className={`flex items-center p-4 rounded-lg cursor-pointer transition-all border ${
            activeTab === 'pushover' 
              ? 'border-primary-200 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30' 
              : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'
          }`}
          onClick={() => setActiveTab('pushover')}
        >
          <div className={`p-3 rounded-full mr-4 ${
            activeTab === 'pushover' 
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-800/70 dark:text-primary-300' 
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            <FiSmartphone className="h-6 w-6" />
          </div>
          <div>
            <h4 className={`font-medium ${
              activeTab === 'pushover' 
                ? 'text-primary-700 dark:text-primary-300' 
                : 'text-gray-800 dark:text-gray-300'
            }`}>
              Pushover Notifications
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time alerts on your devices
            </p>
          </div>
        </div>
      </div>
      
      {/* Info Section */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 dark:bg-gray-800/30 dark:border-gray-700 flex items-center">
        <FiInfo className="h-5 w-5 text-primary-500 mr-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {activeTab === 'email' 
            ? 'Configure your email notification settings below. Emails will be sent for schedule changes and important events.'
            : 'Set up Pushover for instant push notifications on your devices. Requires a Pushover account.'}
        </p>
      </div>
      
      {/* Settings Content */}
      <div className="p-6">
        {activeTab === 'email' && <EmailSettings />}
        {activeTab === 'pushover' && <PushoverSettings />}
      </div>
    </div>
  );
};

export default NotificationSettings; 