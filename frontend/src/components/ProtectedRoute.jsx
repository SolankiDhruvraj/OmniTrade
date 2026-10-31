import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="center-state">Loading session...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
