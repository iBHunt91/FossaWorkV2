import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  username: string
}

interface AuthContextType {
  isAuthenticated: boolean
  token: string | null
  user: User | null
  login: (token: string, userId: string, email: string) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper function to extract user from token
  const extractUserFromToken = (tokenString: string): User | null => {
    try {
      const payload = JSON.parse(atob(tokenString.split('.')[1]))
      if (payload.sub && payload.email && payload.exp > Date.now() / 1000) {
        return {
          id: payload.sub,
          email: payload.email,
          username: payload.email
        }
      }
    } catch (error) {
      // Invalid token format
    }
    return null
  }

  // Initialize auth state from localStorage on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    if (savedToken) {
      const extractedUser = extractUserFromToken(savedToken)
      if (extractedUser) {
        setToken(savedToken)
        setUser(extractedUser)
      } else {
        localStorage.removeItem('authToken')
      }
    }
    setLoading(false)
  }, [])

  // Listen for auth logout events from API interceptor
  useEffect(() => {
    const handleAuthLogout = () => {
      setToken(null)
      setUser(null)
      localStorage.removeItem('authToken')
    }

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout)
    }
  }, [])

  const login = (newToken: string, userId: string, email: string) => {
    const newUser = {
      id: userId,
      email: email,
      username: email
    }
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('authToken', newToken)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('authToken')
  }

  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}