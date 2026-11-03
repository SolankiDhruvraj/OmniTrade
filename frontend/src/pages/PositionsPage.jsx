import { useEffect, useState } from 'react'
import { Activity, AlertOctagon, AlertTriangle, BarChart2, Loader2, LogIn, RefreshCcw, ShieldAlert, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { useAuth } from '../context/useAuth.js'
import { StockChartModal } from '../components/StockChartModal.jsx'

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0)

const selectionKey = ({ brokerAccountId, positionId }) => `${brokerAccountId}:${positionId}`

export const PositionsPage = () => {
  const { user } = useAuth()
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState([])
  const [results, setResults] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exiting, setExiting] = useState(false)
  const [killingSwitch, setKillingSwitch] = useState(false)
  const [killMessage, setKillMessage] = useState('')
  const [selectedChartSymbol, setSelectedChartSymbol] = useState(null)
  const [error, setError] = useState('')

  const loadPositions = async (allUsers = showAllUsers) => {
    setLoading(true)
    setError('')
    try {
      const url = user?.isAdmin && allUsers ? '/broker-accounts/positions?allUsers=true' : '/broker-accounts/positions'
      const data = await apiRequest(url)
      setAccounts(data.accounts)
      setUpdatedAt(data.updatedAt)
      setSelected((current) => current.filter((item) => (
        data.accounts.some((account) => account.positions.some((position) => (
          account.brokerAccountId === item.brokerAccountId && position.id === item.positionId
        )))
      )))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => loadPositions(showAllUsers))
  }, [showAllUsers])

  const handleKillSwitch = async () => {
    const confirmation = window.prompt(
      '⚠️ CONSOLE KILL SWITCH ⚠️\n\nThis will cancel open orders and market square-off open positions that were PLACED USING THIS CONSOLE across all linked broker accounts.\n\nOrders placed directly on Kite or Fyers web/mobile apps will remain untouched.\n\nType "SQUARE OFF" to confirm:'
    )
    if (confirmation !== 'SQUARE OFF') {
      return
    }

    setKillingSwitch(true)
    setError('')
    setKillMessage('')
    try {
      const res = await apiRequest('/broker-accounts/kill-switch', { method: 'POST' })
      setKillMessage(res.message || 'Kill switch executed successfully.')
      await loadPositions()
    } catch (err) {
      setError(err.message)
    } finally {
      setKillingSwitch(false)
    }
  }

  const togglePosition = (brokerAccountId, positionId) => {
    const item = { brokerAccountId, positionId }
    const key = selectionKey(item)
    setSelected((current) => current.some((selectedItem) => selectionKey(selectedItem) === key)
      ? current.filter((selectedItem) => selectionKey(selectedItem) !== key)
      : [...current, item])
  }

  const exitSinglePosition = async (brokerAccountId, position) => {
    const actionLabel = position.netQty > 0 ? 'Sell / Exit' : 'Buy / Cover'
    if (!window.confirm(`${actionLabel} position for ${position.symbol} (${Math.abs(position.netQty)} qty) in this account?`)) return

    setExiting(true)
    setError('')
    try {
      const data = await apiRequest('/broker-accounts/positions/exit', {
        method: 'POST',
        body: JSON.stringify({ positions: [{ brokerAccountId, positionId: position.id }] }),
      })
      setResults(data.results || [])
      setSelected((prev) => prev.filter((item) => selectionKey(item) !== selectionKey({ brokerAccountId, positionId: position.id })))
      await loadPositions()
    } catch (err) {
      setError(err.message || 'Failed to exit position')
    } finally {
      setExiting(false)
    }
  }

  const exitSelected = async () => {
    if (!window.confirm(`Submit exit requests for ${selected.length} selected position(s)? The broker determines final fill prices.`)) return

    setExiting(true)
    setError('')
    setResults([])
    try {
      const data = await apiRequest('/broker-accounts/positions/exit', {
        method: 'POST',
        body: JSON.stringify({ positions: selected }),
      })
      setResults(data.results)
      setSelected([])
      await loadPositions()
    } catch (err) {
      setError(err.message)
    } finally {
      setExiting(false)
    }
  }

  const positionCount = accounts.reduce((count, account) => count + account.positions.length, 0)

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Positions</h1>
          <p>Live open positions across connected broker accounts.</p>
        </div>
        <div className="toolbar">
          {user?.isAdmin && (
            <button
              className={showAllUsers ? "primary-button" : "secondary-button"}
              onClick={() => setShowAllUsers((prev) => !prev)}
              type="button"
              style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Toggle between your accounts and all users in the system"
            >
              <Users size={15} /> {showAllUsers ? 'Viewing All Users' : 'View All Users'}
            </button>
          )}
          <button className="secondary-button" disabled={loading || exiting} onClick={() => loadPositions(showAllUsers)} title="Refresh positions" type="button">
            <RefreshCcw className={loading ? 'spinning' : ''} size={16} />
          </button>
          <button className="danger-button" disabled={!selected.length || exiting} onClick={exitSelected} type="button">
            {exiting ? <Loader2 className="spinning" size={16} /> : <X size={16} />}
            {exiting ? 'Submitting...' : `Exit selected (${selected.length})`}
          </button>
          <button
            className="danger-button"
            style={{ background: '#b71c1c', borderColor: '#b71c1c', color: '#fff', fontWeight: 700 }}
            disabled={killingSwitch || loading}
            onClick={handleKillSwitch}
            type="button"
            title="Panic Square Off: Cancel all open orders and square off all open positions"
          >
            {killingSwitch ? <Loader2 className="spinning" size={16} /> : <AlertOctagon size={16} />}
            {killingSwitch ? 'Executing Kill Switch...' : 'Kill Switch (Square Off All)'}
          </button>
        </div>
      </div>

      {killMessage && <div className="alert success">{killMessage}</div>}
      <p className="position-note">Exits use official broker position-exit APIs for Fyers &amp; Zerodha. “Submitted” means the broker accepted the request. Refresh to verify the position is closed.</p>
      {updatedAt && <small className="muted">Last refreshed {new Date(updatedAt).toLocaleTimeString()}</small>}
      {error && <div className="alert error">{error}</div>}

      {results.length > 0 && (
        <div className="panel result-list">
          <h2>Exit request results</h2>
          {results.map((result) => (
            <div className="result-row" key={`${result.brokerAccountId}:${result.positionId}`}>
              <strong>{result.accountName || result.brokerAccountId}</strong>
              <span>{result.symbol || result.positionId}</span>
              <span className={`status ${result.status === 'submitted' ? 'success' : 'failed'}`}>{result.status}</span>
              {result.error && <small>{result.error}</small>}
            </div>
          ))}
        </div>
      )}

      <div className="panel table-wrap">
        {loading ? (
          <div className="center-state" style={{ minHeight: '160px' }}>
            <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
            <span>Fetching live positions across accounts...</span>
          </div>
        ) : positionCount === 0 ? (
          <div className="empty-state">
            <Activity size={30} />
            <strong>No open positions</strong>
            <span>Fyers accounts with open positions will appear here.</span>
          </div>
        ) : (
          <>
            <table className="desktop-positions-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Select</th>
                  <th>Account</th>
                  <th>Symbol</th>
                  <th>Net quantity</th>
                  <th>Average</th>
                  <th>Unrealized P&amp;L</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.flatMap((account) => account.positions.map((position) => {
                  const item = { brokerAccountId: account.brokerAccountId, positionId: position.id }
                  const isSelected = selected.some((selectedItem) => selectionKey(selectedItem) === selectionKey(item))
                  const canExit = Boolean(position.id) && (account.broker === 'fyers' || account.broker === 'zerodha')

                  return (
                    <tr key={selectionKey(item)}>
                      <td>
                        <input
                          aria-label={`Select ${position.symbol} in ${account.displayName} for exit`}
                          checked={isSelected}
                          disabled={!canExit}
                          onChange={() => togglePosition(account.brokerAccountId, position.id)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <div>{account.displayName}</div>
                        {account.user?.email && (
                          <small style={{ color: '#64748b', fontSize: '11px' }}>{account.user.name || account.user.email}</small>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSelectedChartSymbol(position.symbol)}
                          style={{
                            padding: '2px 6px',
                            minHeight: 'auto',
                            fontWeight: 600,
                            color: 'var(--kite-blue)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="View historical price chart"
                        >
                          <BarChart2 size={13} />
                          {position.symbol}
                        </button>
                      </td>
                      <td>{position.netQty}</td>
                      <td>{formatMoney(position.netAvg)}</td>
                      <td className={position.unrealizedProfit < 0 ? 'negative-value' : 'positive-value'}>{formatMoney(position.unrealizedProfit)}</td>
                      <td>{position.productType}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={exiting || !canExit}
                          onClick={() => exitSinglePosition(account.brokerAccountId, position)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {position.netQty > 0 ? 'Sell / Exit' : 'Exit / Cover'}
                        </button>
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>

            {/* Mobile Responsive Cards */}
            <div className="mobile-positions-cards">
              {accounts.flatMap((account) => account.positions.map((position) => {
                const item = { brokerAccountId: account.brokerAccountId, positionId: position.id }
                const isSelected = selected.some((selectedItem) => selectionKey(selectedItem) === selectionKey(item))
                const canExit = Boolean(position.id) && (account.broker === 'fyers' || account.broker === 'zerodha')

                return (
                  <div
                    className={`position-card-mobile ${isSelected ? 'selected' : ''}`}
                    key={`mobile-${selectionKey(item)}`}
                  >
                    <div className="card-top">
                      <div className="card-top-left">
                        <input
                          aria-label={`Select ${position.symbol} in ${account.displayName} for exit`}
                          checked={isSelected}
                          disabled={!canExit}
                          onChange={() => togglePosition(account.brokerAccountId, position.id)}
                          type="checkbox"
                        />
                        <div>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setSelectedChartSymbol(position.symbol)}
                            style={{
                              padding: '0',
                              minHeight: 'auto',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'var(--kite-blue)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              textAlign: 'left',
                            }}
                            title="View historical price chart"
                          >
                            <BarChart2 size={13} />
                            {position.symbol}
                          </button>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                            {account.displayName} &bull; {position.productType}
                          </span>
                        </div>
                      </div>
                      <span className={`status ${position.unrealizedProfit < 0 ? 'failed' : 'success'}`} style={{ fontSize: '11px', fontWeight: 600 }}>
                        {formatMoney(position.unrealizedProfit)}
                      </span>
                    </div>

                    <div className="card-meta">
                      <div>
                        <small>Net Qty</small>
                        <span>{position.netQty}</span>
                      </div>
                      <div>
                        <small>Avg Price</small>
                        <span>{formatMoney(position.netAvg)}</span>
                      </div>
                      <div>
                        <small>P&amp;L</small>
                        <span className={position.unrealizedProfit < 0 ? 'negative-value' : 'positive-value'}>
                          {formatMoney(position.unrealizedProfit)}
                        </span>
                      </div>
                      <div>
                        <small>Product</small>
                        <span>{position.productType}</span>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className="danger-button"
                        disabled={exiting || !canExit}
                        onClick={() => exitSinglePosition(account.brokerAccountId, position)}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderRadius: '4px',
                        }}
                      >
                        {position.netQty > 0 ? 'Sell / Exit' : 'Exit / Cover'}
                      </button>
                    </div>
                  </div>
                )
              }))}
            </div>
          </>
        )}
        {!loading && accounts.some((account) => account.error) && (
          <div className="position-errors" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {accounts.filter((account) => account.error).map((account) => (
              <div
                className={`alert ${account.authExpired ? 'warning' : 'error'}`}
                key={account.brokerAccountId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: account.authExpired ? '#fef2f2' : undefined,
                  borderColor: account.authExpired ? '#fca5a5' : undefined,
                  color: account.authExpired ? '#991b1b' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {account.authExpired ? <AlertTriangle size={18} color="#dc2626" /> : null}
                  <span>
                    <strong>{account.displayName}</strong>: {account.error}
                  </span>
                </div>
                {account.authExpired && (
                  <Link
                    to="/accounts"
                    className="primary-button"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#dc2626',
                      borderColor: '#b91c1c',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}
                  >
                    <LogIn size={13} /> Re-authenticate
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedChartSymbol && (
        <StockChartModal
          symbol={selectedChartSymbol}
          onClose={() => setSelectedChartSymbol(null)}
        />
      )}
    </section>
  )
}