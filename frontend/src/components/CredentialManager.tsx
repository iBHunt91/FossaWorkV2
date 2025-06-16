import React, { useState, useEffect } from 'react';
import { Shield, TestTube, Save, Trash2, Key, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AnimatedCard, GlowCard } from '@/components/ui/animated-card';
import { AnimatedButton, RippleButton } from '@/components/ui/animated-button';
import { AnimatedText, ShimmerText } from '@/components/ui/animated-text';
import { DotsLoader } from '@/components/ui/animated-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getErrorMessage } from '@/utils/errorHandler';

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

      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        setMessage({ type: 'error', text: getErrorMessage({ response: { data: error } }) });
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

      const response = await fetch(`${API_BASE}/api/v1/credentials/workfossa/test?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
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
    // Delete without confirmation

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
        setMessage({ type: 'error', text: getErrorMessage({ response: { data: error } }) });
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
      <AnimatedCard animate="fade" hover="none" className="glass-dark">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <DotsLoader />
            <AnimatedText text="Loading credentials..." animationType="fade" className="text-muted-foreground" />
          </div>
        </CardContent>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatedCard animate="slide" hover="lift" className="glass-dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <ShimmerText text="WorkFossa Credentials" />
          </CardTitle>
          <CardDescription>Manage your WorkFossa authentication</CardDescription>
        </CardHeader>
        <CardContent>
          {credentials?.has_credentials && (
            <div className="flex gap-2 mb-4 justify-end">
              <AnimatedButton
                onClick={testCredentials}
                disabled={testing}
                size="sm"
                variant="secondary"
                animation="pulse"
              >
                <TestTube className="w-4 h-4 mr-1" />
                {testing ? 'Testing...' : 'Test'}
              </AnimatedButton>
              <AnimatedButton
                onClick={() => setShowForm(!showForm)}
                size="sm"
                animation="shimmer"
              >
                <Key className="w-4 h-4 mr-1" />
                Update
              </AnimatedButton>
              <AnimatedButton
                onClick={deleteCredentials}
                size="sm"
                variant="destructive"
                animation="pulse"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </AnimatedButton>
            </div>
          )}

        {message && (
          <Alert
            variant={message.type === 'error' ? 'destructive' : 'default'}
            className={`mb-4 alert-modern ${message.type} animate-slide-in-from-right`}
          >
            {message.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {message.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {message.type === 'info' && <Info className="w-4 h-4" />}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {credentials?.has_credentials ? (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Username</Label>
              <div className="mt-1 text-sm font-medium">
                <AnimatedText text={credentials.username} animationType="fade" />
              </div>
            </div>
            
            {credentials.created_at && (
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <div className="mt-1 text-sm text-muted-foreground">
                  {new Date(credentials.created_at).toLocaleString()}
                </div>
              </div>
            )}
            
            {credentials.updated_at && (
              <div>
                <Label className="text-sm font-medium">Last Updated</Label>
                <div className="mt-1 text-sm text-muted-foreground">
                  {new Date(credentials.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-bounce" />
            <p className="text-muted-foreground mb-4">
              <AnimatedText text="No WorkFossa credentials stored" animationType="reveal" />
            </p>
            <RippleButton
              onClick={() => setShowForm(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              Add Credentials
            </RippleButton>
          </div>
        )}

        {showForm && (
          <div className="mt-6 pt-6 border-t border-border/50">
            <h4 className="text-md font-medium mb-4">
              <AnimatedText 
                text={credentials?.has_credentials ? 'Update Credentials' : 'Add Credentials'} 
                animationType="reveal" 
              />
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input-modern"
                  placeholder="Enter your WorkFossa username/email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-modern"
                  placeholder="Enter your WorkFossa password"
                />
              </div>
              
              <div className="flex gap-2">
                <RippleButton
                  onClick={saveCredentials}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </RippleButton>
                <AnimatedButton
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ username: credentials?.username || '', password: '' });
                  }}
                  variant="secondary"
                  animation="pulse"
                >
                  Cancel
                </AnimatedButton>
              </div>
            </div>
          </div>
        )}
        </CardContent>
      </AnimatedCard>

      {securityInfo && (
        <GlowCard className="glass-dark animate-slide-in-from-bottom" style={{animationDelay: '0.2s'}}>
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <AnimatedText text="Security Information" animationType="fade" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="font-medium">Encryption:</span>
                <Badge variant="secondary" className="ml-2">
                  {securityInfo.encryption_method}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="font-medium">Secure Storage:</span>
                <Badge 
                  variant={securityInfo.crypto_available ? 'default' : 'secondary'}
                  className={`ml-2 ${securityInfo.crypto_available ? 'badge-gradient' : ''}`}
                >
                  {securityInfo.crypto_available ? 'Available' : 'Fallback Mode'}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="font-medium">Master Key:</span>
                <Badge 
                  variant={securityInfo.master_key_set ? 'default' : 'secondary'}
                  className={`ml-2 ${securityInfo.master_key_set ? 'badge-gradient' : ''}`}
                >
                  {securityInfo.master_key_set ? 'Set' : 'Default'}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="font-medium">Stored Users:</span>
                <span className="ml-2 number-display text-sm">{securityInfo.stored_users_count}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/50">
              <h5 className="text-sm font-medium mb-3">Features</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(securityInfo.features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      enabled ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {enabled ? '✓' : '✗'}
                    </div>
                    <span className="text-sm capitalize">{feature.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </GlowCard>
      )}
    </div>
  );
};

export default CredentialManager;