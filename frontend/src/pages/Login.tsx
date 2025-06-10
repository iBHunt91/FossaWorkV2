import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react'

interface SetupStatus {
  setup_required: boolean
  user_count: number
  message: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/setup/status')
      if (response.ok) {
        const data = await response.json()
        setSetupStatus(data)
      } else {
        setError('Unable to connect to server. Please ensure the backend is running.')
      }
    } catch (err) {
      setError('Unable to connect to server. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    console.log('[LOGIN] Form submitted with credentials:', { username: credentials.username, password: '***' })
    console.log('[LOGIN] Setup status:', setupStatus)

    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password')
      setSubmitting(false)
      return
    }

    try {
      const endpoint = setupStatus?.setup_required 
        ? 'http://localhost:8000/api/setup/initialize'
        : 'http://localhost:8000/api/auth/login'

      console.log('[LOGIN] Using endpoint:', endpoint)
      console.log('[LOGIN] Sending request body:', JSON.stringify(credentials))

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      console.log('[LOGIN] Response status:', response.status)
      console.log('[LOGIN] Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        const token = data.access_token

        if (token) {
          // Store the JWT token
          localStorage.setItem('authToken', token)
          
          if (setupStatus?.setup_required) {
            setSuccess('Account created successfully! Redirecting to dashboard...')
          } else {
            setSuccess('Login successful! Redirecting to dashboard...')
          }

          // Redirect to dashboard after a brief delay
          setTimeout(() => {
            navigate('/dashboard')
          }, 1500)
        } else {
          setError('Authentication successful but no token received')
        }
      } else {
        const errorData = await response.json()
        if (response.status === 401) {
          setError('Invalid WorkFossa credentials. Please check your username and password.')
        } else if (response.status === 400) {
          setError(errorData.detail || 'Invalid request. Please check your input.')
        } else {
          setError(errorData.detail || 'Authentication failed. Please try again.')
        }
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Checking system status...</span>
        </div>
      </div>
    )
  }

  const isFirstTimeSetup = setupStatus?.setup_required

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-4 text-3xl font-bold text-gray-900">
            FossaWork V2
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Fuel Dispenser Automation System
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {isFirstTimeSetup ? (
                <>
                  <UserPlus className="h-5 w-5" />
                  <span>First Time Setup</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isFirstTimeSetup ? (
                <>
                  Welcome! Enter your WorkFossa credentials to create your account.
                  Your credentials will be verified with WorkFossa before creating your profile.
                </>
              ) : (
                <>
                  Sign in with your WorkFossa credentials
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">WorkFossa Username/Email</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your@email.com"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">WorkFossa Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                    disabled={submitting}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={submitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isFirstTimeSetup ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  <>
                    {isFirstTimeSetup ? (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </>
                )}
              </Button>
            </form>

            {isFirstTimeSetup && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your WorkFossa credentials will be verified in real-time. 
                  If successful, your account will be created automatically.
                </p>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                System Status: {setupStatus?.user_count || 0} users registered
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Login