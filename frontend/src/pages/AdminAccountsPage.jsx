import { useEffect, useState } from 'react'
import { Ban, CheckCircle, RefreshCcw, ShieldCheck, UserCheck, WalletCards } from 'lucide-react'
import { apiRequest } from '../api/client.js'

export const AdminAccountsPage = () => {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busyId, setBusyId] = useState(null)

  const loadAccounts = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/broker-accounts/admin/all')
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleToggleStatus = async (account) => {
    const isRevoke = account.isActive
    if (!window.confirm(`Are you sure you want to ${isRevoke ? 'revoke' : 'reactivate'} account ${account.accountId} (${account.displayName})?`)) {
      return
    }

    setBusyId(account.id)
    setError('')
    setActionMessage('')

    try {
      const endpoint = isRevoke
        ? `/broker-accounts/admin/${account.id}/revoke`
        : `/broker-accounts/admin/${account.id}/activate`

      await apiRequest(endpoint, { method: 'POST' })
      setActionMessage(`Account ${account.accountId} has been ${isRevoke ? 'revoked' : 'reactivated'}.`)
      await loadAccounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = accounts.filter((acc) => acc.isActive).length
  const revokedCount = accounts.filter((acc) => !acc.isActive).length

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Connected Broker Accounts</h1>
          <p>Supervise all broker connections across the system and revoke access if necessary.</p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" disabled={loading} onClick={loadAccounts} title="Refresh accounts" type="button">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {actionMessage && <div className="alert success">{actionMessage}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Active Accounts</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--kite-green)', marginTop: '4px' }}>{activeCount}</div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Revoked Accounts</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--kite-red)', marginTop: '4px' }}>{revokedCount}</div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Connected</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink-heading)', marginTop: '4px' }}>{accounts.length}</div>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="center-state">Loading all connected accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <WalletCards size={32} />
            <strong>No broker accounts found</strong>
            <span>No users have linked any broker accounts yet.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User / Owner</th>
                  <th>Broker</th>
                  <th>Account ID</th>
                  <th>Display Name</th>
                  <th>Status</th>
                  <th>Connected On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const isBusy = busyId === account.id
                  return (
                    <tr key={account.id} style={{ opacity: account.isActive ? 1 : 0.65 }}>
                      <td>
                        <strong>{account.user?.name || 'Unknown User'}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{account.user?.email || 'N/A'}</div>
                      </td>
                      <td>
                        <span className="badge">{account.broker}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px' }}>{account.accountId}</code>
                      </td>
                      <td>{account.displayName}</td>
                      <td>
                        {account.isActive ? (
                          <span className="status success">Active</span>
                        ) : (
                          <span className="status failed">Revoked</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {new Date(account.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {account.isActive ? (
                          <button
                            className="danger-button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(account)}
                            style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                            type="button"
                          >
                            <Ban size={14} /> {isBusy ? 'Revoking...' : 'Revoke'}
                          </button>
                        ) : (
                          <button
                            className="secondary-button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(account)}
                            style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                            type="button"
                          >
                            <CheckCircle size={14} /> {isBusy ? 'Activating...' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
