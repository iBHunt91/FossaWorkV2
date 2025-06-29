import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, UserPlus, LogIn, Eye, EyeOff, Info, Activity } from 'lucide-react'
import { AnimatedText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard } from '@/components/ui/animated-card'
import { RippleButton } from '@/components/ui/animated-button'
import { Spinner } from '@/components/ui/animated-loader'

interface SetupStatus {
  setup_required: boolean
  user_count: number
  message: string
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<{
    status: string
    message: string
    progress: number
  } | null>(null)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/setup/status', {
        credentials: 'include',
        // Add a timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000)
      })
      if (response.ok) {
        const data = await response.json()
        setSetupStatus(data)
      } else if (response.status === 429) {
        // Rate limit hit - just set a default status
        setSetupStatus({ setup_required: false, user_count: 0, message: 'System ready' })
      } else {
        setError('Unable to connect to server. Please ensure the backend is running.')
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Timeout - set default status
        setSetupStatus({ setup_required: false, user_count: 0, message: 'System ready' })
      } else {
        setError('Unable to connect to server. Please ensure the backend is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    setVerificationStatus(null)

    console.log('[LOGIN] Form submitted with credentials:', { username: credentials.username, password: '***' })
    console.log('[LOGIN] Setup status:', setupStatus)

    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password')
      setSubmitting(false)
      return
    }

    try {
      // Always use the auth/login endpoint - it handles both new and existing users
      const endpoint = 'http://localhost:8000/api/auth/login'

      console.log('[LOGIN] Using endpoint:', endpoint)
      console.log('[LOGIN] Authenticating user:', credentials.username)

      // Show initial verification status
      setVerificationStatus({
        status: 'pending',
        message: 'Starting WorkFossa verification...',
        progress: 0
      })

      // Start the login request
      const loginPromise = fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      })

      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        try {
          // Since we don't have the verification ID yet, we'll simulate progress
          setVerificationStatus(prev => {
            if (!prev) return null
            const progress = Math.min(prev.progress + 10, 90)
            let status = 'pending'
            let message = 'Starting WorkFossa verification...'
            
            if (progress >= 20) {
              status = 'checking'
              message = 'Connecting to WorkFossa...'
            }
            if (progress >= 40) {
              status = 'launching'
              message = 'Launching secure browser...'
            }
            if (progress >= 60) {
              status = 'navigating'
              message = 'Navigating to WorkFossa...'
            }
            if (progress >= 70) {
              status = 'logging_in'
              message = 'Verifying your credentials...'
            }
            if (progress >= 80) {
              status = 'verifying'
              message = 'Confirming authentication...'
            }
            
            return { status, message, progress }
          })
        } catch (err) {
          console.error('[LOGIN] Status polling error:', err)
        }
      }, 500)

      const response = await loginPromise
      clearInterval(pollInterval)

      console.log('[LOGIN] Response status:', response.status)
      console.log('[LOGIN] Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        const token = data.access_token
        const userId = data.user_id
        const email = data.email

        if (token && userId && email) {
          // Use the auth context to properly login with simplified response
          login(token, userId, email)
          
          if (setupStatus?.setup_required) {
            setSuccess('Account created successfully! Redirecting to dashboard...')
          } else {
            setSuccess('Login successful! Redirecting to dashboard...')
          }

          // Complete verification
          setVerificationStatus({
            status: 'success',
            message: 'Verification successful!',
            progress: 100
          })

          // Redirect to dashboard after a brief delay
          setTimeout(() => {
            navigate('/dashboard')
          }, 1500)
        } else {
          setError('Authentication successful but no token received')
        }
      } else {
        const errorData = await response.json()
        setVerificationStatus(null) // Clear verification status on error
        
        let errorMessage = 'Authentication failed. Please try again.'
        
        if (response.status === 401) {
          errorMessage = 'Invalid WorkFossa credentials. Please check your username and password.'
        } else if (response.status === 400) {
          errorMessage = errorData.detail || 'Invalid request. Please check your input.'
        } else if (response.status === 422) {
          // Handle FastAPI validation errors
          if (Array.isArray(errorData.detail)) {
            // Extract meaningful error messages from Pydantic validation errors
            const errorMessages = errorData.detail.map((err: any) => {
              if (err.msg) {
                return err.msg
              }
              return `Invalid ${err.loc?.join(' ') || 'input'}`
            })
            errorMessage = errorMessages.join('. ')
          } else {
            errorMessage = errorData.detail || 'Validation error. Please check your input.'
          }
        } else {
          errorMessage = errorData.detail || errorData.message || 'Authentication failed. Please try again.'
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      setVerificationStatus(null) // Clear verification status on error
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="lg" />
          <AnimatedText text="Checking system status..." animationType="fade" className="text-muted-foreground" />
        </div>
      </div>
    )
  }

  const isFirstTimeSetup = setupStatus?.setup_required

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <Shield className="relative mx-auto h-12 w-12 text-primary animate-bounce-in" />
          </div>
          <h2 className="mt-4 text-3xl font-bold">
            <GradientText text="FossaWork V2" gradient="from-blue-600 to-purple-600" />
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <AnimatedText text="Fuel Dispenser Automation System" animationType="split" delay={0.3} />
          </p>
        </div>

        <AnimatedCard hover="glow" animate="slide" delay={0.5}>
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
                  Welcome! Enter your WorkFossa credentials to get started.
                  Your account will be created automatically after verification.
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
                  onChange={(e) => {
                    // Remove any mailto: prefix if it exists
                    const cleanValue = e.target.value.replace(/^mailto:/i, '');
                    setCredentials(prev => ({ ...prev, username: cleanValue }))
                  }}
                  required
                  disabled={submitting}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
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

              {verificationStatus && (
                <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{verificationStatus.message}</span>
                    <span className="text-xs text-muted-foreground">{verificationStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-out rounded-full animate-pulse"
                      style={{ width: `${verificationStatus.progress}%` }}
                    />
                  </div>
                  {verificationStatus.status === 'launching' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Initializing secure browser session...</span>
                    </div>
                  )}
                  {verificationStatus.status === 'navigating' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Connecting to WorkFossa servers...</span>
                    </div>
                  )}
                  {verificationStatus.status === 'logging_in' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="w-3 h-3 animate-pulse" />
                      <span>Verifying your credentials securely...</span>
                    </div>
                  )}
                  {verificationStatus.status === 'verifying' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>Confirming authentication status...</span>
                    </div>
                  )}
                </div>
              )}

              <RippleButton
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
              </RippleButton>
              
              {/* Demo login button - DEVELOPMENT ONLY */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4"
                    onClick={async () => {
                      setSubmitting(true)
                      setError('')
                      try {
                        const response = await fetch('http://localhost:8000/api/auth/demo-login', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                        })
                        
                        if (response.ok) {
                          const data = await response.json()
                          login(data.access_token, data.user_id, data.email)
                          navigate('/work-orders')
                        } else {
                          setError('Demo login failed')
                        }
                      } catch (err) {
                        setError('Demo login error')
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                    disabled={submitting}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Demo Login (Development Only)
                  </Button>
                </div>
              )}
            </form>


            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                System Status: <span className="font-medium">{setupStatus?.user_count || 0}</span> users registered
              </p>
            </div>
          </CardContent>
        </AnimatedCard>
      </div>
    </div>
  )
}

export default Login