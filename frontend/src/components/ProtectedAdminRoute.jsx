import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="center-state">Checking credentials...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
