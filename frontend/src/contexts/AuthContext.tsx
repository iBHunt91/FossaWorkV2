import React, { createContext, useContext, useState, useEffect } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  token: string | null
  login: (token: string) => void
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on startup
    const savedToken = localStorage.getItem('authToken')
    if (savedToken) {
      setToken(savedToken)
    }
    setLoading(false)
  }, [])

  const login = (newToken: string) => {
    setToken(newToken)
    localStorage.setItem('authToken', newToken)
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem('authToken')
  }

  const isAuthenticated = !!token

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}