import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Lock, RefreshCcw, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../api/client.js'

export const SecurityPage = () => {
  const [enabled, setEnabled] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // In-app Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [changePwBusy, setChangePwBusy] = useState(false)
  const [changePwError, setChangePwError] = useState('')
  const [changePwSuccess, setChangePwSuccess] = useState('')

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setChangePwError('')
    setChangePwSuccess('')

    if (newPassword !== confirmPassword) {
      setChangePwError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setChangePwError('New password must be at least 8 characters long')
      return
    }

    setChangePwBusy(true)
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setChangePwSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setChangePwError(err.message || 'Failed to change password')
    } finally {
      setChangePwBusy(false)
    }
  }

  useEffect(() => {
    apiRequest('/auth/2fa/status')
      .then((data) => setEnabled(data.enabled))
      .catch((err) => setError(err.message))
  }, [])

  const startSetup = async () => {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const data = await apiRequest('/auth/2fa/setup', { method: 'POST' })
      setQrCode(data.qrCode)
      setToken('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const enableTwoFactor = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiRequest('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      setEnabled(true)
      setRecoveryCodes(data.recoveryCodes)
      setQrCode('')
      setToken('')
      setMessage('Authenticator verification is enabled.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const disableTwoFactor = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiRequest('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password, token }),
      })
      setEnabled(false)
      setPassword('')
      setToken('')
      setRecoveryCodes([])
      setMessage('Authenticator verification is disabled.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const updateToken = (value) => setToken(value.replace(/\D/g, '').slice(0, 6))

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Security</h1>
          <p>Manage the second factor used to protect your account.</p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="panel security-panel">
        <div className="security-state">
          <KeyRound size={20} />
          <h2>Authenticator app</h2>
          {enabled !== null && <span className={`status ${enabled ? 'success' : ''}`}>{enabled ? 'Enabled' : 'Disabled'}</span>}
        </div>

        {enabled === null ? (
          <div className="center-state">Loading security settings...</div>
        ) : enabled ? (
          <>
            <p>Use a current six-digit code from your authenticator app when signing in.</p>
            <form className="security-form" onSubmit={disableTwoFactor}>
              <label>
                Password
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
              <label>
                Authenticator or recovery code
                <input inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value.trim().toUpperCase())} maxLength={32} required />
              </label>
              <button className="danger-button" disabled={busy} type="submit">{busy ? 'Please wait...' : 'Disable two-factor authentication'}</button>
            </form>
          </>
        ) : (
          <div className="security-setup">
            <p>Scan the QR code with Google Authenticator or another TOTP-compatible app, then verify a code to finish setup.</p>
            {qrCode ? (
              <>
                <img className="security-qr" src={qrCode} alt="Authenticator setup QR code" />
                <form className="security-form" onSubmit={enableTwoFactor}>
                  <label>
                    Six-digit authenticator code
                    <input inputMode="numeric" autoComplete="one-time-code" autoFocus value={token} onChange={(event) => updateToken(event.target.value)} pattern="[0-9]{6}" maxLength={6} required />
                  </label>
                  <button className="primary-button" disabled={busy || token.length !== 6} type="submit">
                    <ShieldCheck size={16} /> {busy ? 'Please wait...' : 'Verify and enable'}
                  </button>
                </form>
                <button className="secondary-button" disabled={busy} onClick={startSetup} type="button">
                  <RefreshCcw size={16} /> Generate a new QR code
                </button>
              </>
            ) : (
              <button className="primary-button" disabled={busy} onClick={startSetup} type="button">
                <KeyRound size={16} /> {busy ? 'Please wait...' : 'Set up authenticator app'}
              </button>
            )}
          </div>
        )}
      </section>

      {recoveryCodes.length > 0 && (
        <section className="panel recovery-panel">
          <h2>Recovery codes</h2>
          <p>Each code works once. Save these somewhere private; they will not be shown again.</p>
          <ul className="recovery-codes">
            {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
        </section>
      )}

      {/* Password Reset / Change Section */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Lock size={20} color="var(--kite-teal)" />
          <h2 style={{ margin: 0 }}>Change Password</h2>
        </div>
        <p className="muted" style={{ marginBottom: '16px' }}>
          Update your account password. Ensure your new password is at least 8 characters long.
        </p>

        {changePwError && <div className="alert error" style={{ marginBottom: '16px' }}>{changePwError}</div>}
        {changePwSuccess && <div className="alert success" style={{ marginBottom: '16px' }}>{changePwSuccess}</div>}

        <form onSubmit={handleChangePassword} style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            Current password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
              <input
                type={showCurrentPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '36px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw((prev) => !prev)}
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
                title={showCurrentPw ? 'Hide password' : 'Show password'}
              >
                {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label>
            New password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '36px' }}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw((prev) => !prev)}
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
                title={showNewPw ? 'Hide password' : 'Show password'}
              >
                {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', marginTop: '4px' }}
              minLength={8}
              required
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={changePwBusy || !currentPassword || !newPassword || !confirmPassword}
            style={{ width: 'fit-content', marginTop: '6px' }}
          >
            {changePwBusy ? 'Updating password...' : 'Update Password'}
          </button>
        </form>
      </section>
    </section>
  )
}