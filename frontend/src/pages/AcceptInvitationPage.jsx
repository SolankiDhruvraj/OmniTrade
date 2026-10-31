import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/useAuth.js'

export const AcceptInvitationPage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { acceptInvitation } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(Boolean(token))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(token ? '' : 'This invitation link is invalid or incomplete.')

  useEffect(() => {
    let active = true
    if (!token) return () => { active = false }

    apiRequest(`/auth/invitations/validate?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (active) setEmail(data.email)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await acceptInvitation({ token, name, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-icon"><KeyRound size={22} /></div>
        <h1>Accept invitation</h1>
        {loading ? <p>Checking invitation...</p> : email ? (
          <>
            <p>Create your account for <strong>{email}</strong>.</p>
            <label>
              Name
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required />
            </label>
            <label>
              Password
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
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
              Confirm password
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={12}
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
          </>
        ) : <p>This invitation can’t be used. Ask the administrator for a new link.</p>}

        {error && <div className="alert error">{error}</div>}

        {email && (
          <button className="primary-button" disabled={submitting || loading} type="submit">
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        )}
      </form>
    </div>
  )
}