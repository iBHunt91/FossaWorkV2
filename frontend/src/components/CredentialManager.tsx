import React, { useState, useEffect } from 'react';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';

interface CredentialInfo {
  has_credentials: boolean;
  username: string;
  created_at?: string;
  updated_at?: string;
}

interface SecurityInfo {
  crypto_available: boolean;
  encryption_method: string;
  master_key_set: boolean;
  stored_users_count: number;
  storage_path: string;
  features: {
    secure_file_storage: boolean;
    database_fallback: boolean;
    credential_validation: boolean;
    usage_tracking: boolean;
  };
}

interface Props {
  userId: string;
  onCredentialsUpdated?: () => void;
}

const CredentialManager: React.FC<Props> = ({ userId, onCredentialsUpdated }) => {
  const [credentials, setCredentials] = useState<CredentialInfo | null>(null);
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    loadCredentials();
    loadSecurityInfo();
  }, [userId]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa?user_id=${userId}`);
      const data = await response.json();
      setCredentials(data);
      
      // Set form data if credentials exist
      if (data.has_credentials) {
        setFormData(prev => ({ ...prev, username: data.username }));
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      setMessage({ type: 'error', text: 'Failed to load credentials' });
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/credentials/security/info`);
      const data = await response.json();
      setSecurityInfo(data);
    } catch (error) {
      console.error('Failed to load security info:', error);
    }
  };

  const saveCredentials = async () => {
    if (!formData.username || !formData.password) {
      setMessage({ type: 'error', text: 'Username and password are required' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          username: formData.username,
          password: formData.password
        })
      });

      if (response.ok) {
        const result = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Credentials saved successfully using ${result.encryption_method}` 
        });
        setShowForm(false);
        setFormData({ username: formData.username, password: '' }); // Clear password
        await loadCredentials();
        await loadSecurityInfo();
        onCredentialsUpdated?.();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to save credentials' });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: 'Network error while saving credentials' });
    } finally {
      setSaving(false);
    }
  };

  const testCredentials = async () => {
    try {
      setTesting(true);
      setMessage(null);

      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId
        })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Test error:', error);
      setMessage({ type: 'error', text: 'Failed to test credentials' });
    } finally {
      setTesting(false);
    }
  };

  const deleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete these credentials?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa?user_id=${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Credentials deleted successfully' });
        setFormData({ username: '', password: '' });
        await loadCredentials();
        await loadSecurityInfo();
        onCredentialsUpdated?.();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to delete credentials' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: 'Network error while deleting credentials' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !credentials) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="medium" />
          <span className="ml-2">Loading credentials...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">WorkFossa Credentials</h3>
          {credentials?.has_credentials && (
            <div className="flex gap-2">
              <button
                onClick={testCredentials}
                disabled={testing}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Update
              </button>
              <button
                onClick={deleteCredentials}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className={`p-3 rounded mb-4 ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {credentials?.has_credentials ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1 text-sm text-gray-900">{credentials.username}</div>
            </div>
            
            {credentials.created_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <div className="mt-1 text-sm text-gray-500">
                  {new Date(credentials.created_at).toLocaleString()}
                </div>
              </div>
            )}
            
            {credentials.updated_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                <div className="mt-1 text-sm text-gray-500">
                  {new Date(credentials.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No WorkFossa credentials stored</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Credentials
            </button>
          </div>
        )}

        {showForm && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-md font-medium mb-4">
              {credentials?.has_credentials ? 'Update Credentials' : 'Add Credentials'}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Username/Email
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your WorkFossa username/email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your WorkFossa password"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={saveCredentials}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ username: credentials?.username || '', password: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {securityInfo && (
        <Card className="p-6">
          <h4 className="text-md font-medium mb-3">Security Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Encryption:</span> {securityInfo.encryption_method}
            </div>
            <div>
              <span className="font-medium">Secure Storage:</span> 
              <span className={securityInfo.crypto_available ? 'text-green-600' : 'text-orange-600'}>
                {securityInfo.crypto_available ? ' Available' : ' Fallback Mode'}
              </span>
            </div>
            <div>
              <span className="font-medium">Master Key:</span> 
              <span className={securityInfo.master_key_set ? 'text-green-600' : 'text-orange-600'}>
                {securityInfo.master_key_set ? ' Set' : ' Default'}
              </span>
            </div>
            <div>
              <span className="font-medium">Stored Users:</span> {securityInfo.stored_users_count}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-medium mb-2">Features</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(securityInfo.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center">
                  <span className={`mr-2 ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {enabled ? '✓' : '✗'}
                  </span>
                  <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CredentialManager;