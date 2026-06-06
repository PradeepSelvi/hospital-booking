import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Still loading auth state
  if (loading) {
    return <LoadingSpinner fullPage text="Verifying access..." />
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but profile not loaded yet — this is a critical security gate
  // We must NOT render protected content without a confirmed role
  if (!profile) {
    return <LoadingSpinner fullPage text="Loading your profile..." />
  }

  // Profile loaded but user's role is not in the allowed list
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const roleRoutes = {
      PATIENT: '/patient/dashboard',
      DOCTOR: '/doctor/dashboard',
      ADMIN: '/admin/dashboard'
    }
    return <Navigate to={roleRoutes[profile.role] ?? '/'} replace />
  }

  // All checks passed
  return children
}
