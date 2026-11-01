import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, LogIn, Plus, RefreshCcw, Trash2, Unplug, WalletCards, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client.js'

const ZerodhaConnectModal = ({ onClose, onConnect }) => {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onConnect({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), label: label.trim() })
    } catch (err) {
      setError(err.message || 'Failed to start Zerodha login')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '28px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          type="button"
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', padding: '4px', display: 'flex',
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink-heading)', marginBottom: '6px' }}>
            Connect Zerodha Account
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Enter the Kite Connect API credentials for the account you want to connect.
            Each Zerodha account requires its own API Key & Secret from{' '}
            <a href="https://kite.trade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)' }}>
              kite.trade
            </a>. Don't have them? Check out our{' '}
            <Link to="/api-guide" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>
              API Setup Guide
            </Link>.
          </p>
        </div>

        {error && <div className="alert error" style={{ marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            <div>
              Account Label <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Dhruv – Trading Account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{ marginTop: '2px' }}
              maxLength={80}
            />
          </label>

          <label>
            <div>
              Kite API Key <span style={{ color: 'var(--kite-red)' }}>*</span>
            </div>
            <input
              type="text"
              placeholder="e.g. abcdef1234567890"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ marginTop: '2px', fontFamily: 'monospace', letterSpacing: '0.04em' }}
              required
              autoComplete="off"
            />
          </label>

          <label>
            <div>
              Kite API Secret <span style={{ color: 'var(--kite-red)' }}>*</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                placeholder="Your Kite API secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                style={{ width: '100%', paddingRight: '36px', fontFamily: 'monospace' }}
                required
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                style={{
                  position: 'absolute', right: '10px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', padding: 0, display: 'flex', alignItems: 'center',
                }}
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              style={{ flex: 2 }}
              disabled={busy || !apiKey.trim() || !apiSecret.trim()}
            >
              {busy ? <><Loader2 className="spinning" size={16} /> Redirecting to Zerodha...</> : <><Unplug size={16} /> Login with Zerodha</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const AccountsPage = () => {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [connectingBroker, setConnectingBroker] = useState('')
  const [showZerodhaModal, setShowZerodhaModal] = useState(false)

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const data = await apiRequest('/broker-accounts')
      setAccounts(data.accounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('connected') === 'true') {
        setMessage(`Broker account connected: ${params.get('account') || ''}`)
        window.history.replaceState({}, '', '/accounts')
      }
      if (params.get('connected') === 'false') {
        setError(params.get('message') || 'Account connection failed')
        window.history.replaceState({}, '', '/accounts')
      }
      loadAccounts()
    })
  }, [])

  const connectFyers = async () => {
    setError('')
    setConnectingBroker('fyers')
    try {
      const data = await apiRequest('/broker-accounts/fyers/auth-url')
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('Failed to generate Fyers login URL')
      }
    } catch (err) {
      setConnectingBroker('')
      setError(err.message || 'Unable to start Fyers login')
    }
  }

  const connectZerodha = async ({ apiKey, apiSecret, label }) => {
    setConnectingBroker('zerodha')
    const data = await apiRequest('/broker-accounts/zerodha/auth-url', {
      method: 'POST',
      body: JSON.stringify({ apiKey, apiSecret, label }),
    })
    if (data?.url) {
      window.location.href = data.url
    } else {
      throw new Error('Failed to generate Zerodha login URL')
    }
  }

  const [reconnectingId, setReconnectingId] = useState('')

  const reconnectAccount = async (account) => {
    setError('')
    setReconnectingId(account.id)
    try {
      const data = await apiRequest(`/broker-accounts/${account.id}/reconnect-url`)
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('Failed to generate reconnect URL')
      }
    } catch (err) {
      setReconnectingId('')
      setError(err.message || `Unable to reconnect ${account.displayName}`)
    }
  }

  const removeAccount = async (id) => {
    await apiRequest(`/broker-accounts/${id}`, { method: 'DELETE' })
    await loadAccounts()
  }

  return (
    <section className="page-stack">
      {showZerodhaModal && (
        <ZerodhaConnectModal
          onClose={() => { setShowZerodhaModal(false); setConnectingBroker('') }}
          onConnect={connectZerodha}
        />
      )}

      <div className="page-header">
        <div>
          <h1>Broker accounts</h1>
          <p>
            Connect Fyers and Zerodha accounts to execute simultaneous F&O orders across brokers.{' '}
            <Link to="/api-guide" style={{ color: 'var(--kite-orange)', fontWeight: 600, textDecoration: 'none' }}>
              Need credentials? View Guide →
            </Link>
          </p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" disabled={loading} onClick={loadAccounts} type="button">
            <RefreshCcw className={loading ? 'spinning' : ''} size={16} /> Refresh
          </button>
          <Link className="secondary-button" to="/accounts/add"><Plus size={16} /> Add manual account</Link>
          <button
            className="secondary-button"
            disabled={connectingBroker === 'zerodha'}
            onClick={() => setShowZerodhaModal(true)}
            type="button"
          >
            {connectingBroker === 'zerodha' ? <Loader2 className="spinning" size={16} /> : <Unplug size={16} />} Connect Zerodha
          </button>
          <button
            className="primary-button"
            disabled={connectingBroker === 'fyers'}
            onClick={connectFyers}
            type="button"
          >
            {connectingBroker === 'fyers' ? <Loader2 className="spinning" size={16} /> : <Unplug size={16} />} Connect Fyers
          </button>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="center-state" style={{ minHeight: '160px' }}>
            <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
            <span>Loading broker accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <WalletCards size={32} />
            <strong>No broker accounts linked</strong>
            <span>Connect a Fyers or Zerodha account before placing orders.</span>
          </div>
        ) : (
          <div className="account-grid">
            {accounts.map((account) => (
              <article className="account-card" key={account.id}>
                <div className="account-card-header">
                  <span className="badge">{account.broker}</span>
                  <button className="icon-button danger" onClick={() => removeAccount(account.id)} title="Remove account" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="account-card-body">
                  <h3>{account.displayName}</h3>
                  <p>{account.accountId}</p>
                  {account.profile?.credentialFields?.length > 0 && (
                    <small>{account.profile.credentialFields.join(', ')}</small>
                  )}
                </div>
                <div className="account-card-actions">
                  <button
                    className="secondary-button"
                    disabled={reconnectingId === account.id}
                    onClick={() => reconnectAccount(account)}
                    style={{ width: '100%', justifyContent: 'center', padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Refresh login token for today"
                    type="button"
                  >
                    {reconnectingId === account.id ? (
                      <><Loader2 className="spinning" size={14} /> Connecting...</>
                    ) : (
                      <><LogIn size={14} color="var(--kite-blue)" /> Re-connect Account</>
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
