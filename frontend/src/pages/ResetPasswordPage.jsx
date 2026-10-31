import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { apiRequest } from '../api/client.js'

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 1. Forgot Password Request (send link to email)
  const handleRequestReset = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(data.message)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Perform Reset with Token
  const handlePerformReset = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const data = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setMessage(data.message)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <form className="auth-card" onSubmit={token ? handlePerformReset : handleRequestReset}>
        <div className="auth-icon"><KeyRound size={22} /></div>
        <h1>{token ? 'Set new password' : 'Reset password'}</h1>
        <p>
          {token
            ? 'Enter and confirm your new account password.'
            : 'Enter your account email to receive a password reset link.'}
        </p>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        {/* State A: Token provided (Set new password) */}
        {token && !success && (
          <>
            <label>
              New password
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  style={{ width: '100%', paddingRight: '36px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label>
              Confirm new password
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  style={{ width: '100%', paddingRight: '36px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinning" /> Updating password...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </>
        )}

        {/* State B: No token provided (Request reset link) */}
        {!token && !success && (
          <>
            <label>
              Account email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </label>

            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <Loader2 size={16} className="spinning" /> Sending reset link...
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </>
        )}

        {success && token && (
          <p style={{ textAlign: 'center', color: '#666', fontSize: 13, marginTop: 12 }}>
            Redirecting you to the sign-in page...
          </p>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--kite-orange)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  )
}
