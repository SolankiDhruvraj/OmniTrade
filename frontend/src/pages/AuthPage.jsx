import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'

export const AuthPage = () => {
  const navigate = useNavigate()
  const { login, verifyTwoFactorLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [challengeToken, setChallengeToken] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (challengeToken) {
        await verifyTwoFactorLogin(challengeToken, code)
      } else {
        const result = await login({ email, password })
        if (result.requiresTwoFactor) {
          setChallengeToken(result.challengeToken)
          setSubmitting(false)
          return
        }
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const restartLogin = () => {
    setChallengeToken('')
    setCode('')
    setPassword('')
    setError('')
  }

  return (
    <div className="auth-layout">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-icon"><LockKeyhole size={22} /></div>
        <h1>{challengeToken ? 'Two-step verification' : 'Welcome back'}</h1>
        <p>{challengeToken ? 'Enter the current code from your authenticator app.' : 'Sign in to your F&O Console account.'}</p>

        {!challengeToken && (
          <>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password</span>
                <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--kite-orange)', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
          </>
        )}

        {challengeToken && (
          <label>
            Authenticator code or recovery code
            <input
              autoComplete="one-time-code"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              inputMode="text"
              value={code}
              onChange={(event) => setCode(event.target.value.trim().toUpperCase())}
              required
            />
          </label>
        )}

        {error && <div className="alert error">{error}</div>}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? (
            <>
              <Loader2 className="spinning" size={16} /> Signing in...
            </>
          ) : challengeToken ? (
            'Verify and sign in'
          ) : (
            'Login'
          )}
        </button>

        {challengeToken ? (
          <button className="ghost-button" onClick={restartLogin} type="button">Use a different account</button>
        ) : <small className="muted">Access is by invitation only.</small>}
      </form>
    </div>
  )
}