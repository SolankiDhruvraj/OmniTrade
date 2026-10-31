import { useEffect, useMemo, useState } from 'react'
import { apiRequest, setAuthToken, setCsrfToken } from '../api/client.js'
import { AuthContext } from './auth-context.js'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => {
        setCsrfToken(data.csrfToken)
        setUser(data.user)
      })
      .catch(() => {
        setCsrfToken('')
        setAuthToken('')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (payload) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (data.requiresTwoFactor) return data

    if (data.token) setAuthToken(data.token)
    setCsrfToken(data.csrfToken)
    setUser(data.user)
    return data.user
  }

  const acceptInvitation = async (payload) => {
    const data = await apiRequest('/auth/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (data.token) setAuthToken(data.token)
    setCsrfToken(data.csrfToken)
    setUser(data.user)
    return data.user
  }

  const verifyTwoFactorLogin = async (challengeToken, code) => {
    const data = await apiRequest('/auth/2fa/login', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    })
    if (data.token) setAuthToken(data.token)
    setCsrfToken(data.csrfToken)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout should still complete if the server session is already gone.
    }
    setAuthToken('')
    setCsrfToken('')
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, verifyTwoFactorLogin, acceptInvitation, logout }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
