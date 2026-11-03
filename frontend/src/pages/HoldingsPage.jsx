import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart2, Briefcase, ChevronRight, Layers, Loader2, LogIn, RefreshCcw, Search, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { StockChartModal } from '../components/StockChartModal.jsx'

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0)

const formatPercent = (value) => `${Number.isFinite(value) && value > 0 ? '+' : ''}${(Number.isFinite(value) ? value : 0).toFixed(2)}%`

export const HoldingsPage = () => {
  const [accountData, setAccountData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedChartSymbol, setSelectedChartSymbol] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const loadHoldings = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/broker-accounts/holdings')
      const accounts = data.accounts || []
      setAccountData(accounts)
      setUpdatedAt(data.updatedAt)
      if (accounts.length > 0) {
        setSelectedAccountId((curr) => {
          if (curr && accounts.some((a) => a.brokerAccountId === curr)) return curr
          return accounts[0].brokerAccountId
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHoldings()
  }, [])

  // Currently selected broker account
  const currentAccount = useMemo(() => {
    return accountData.find((acc) => acc.brokerAccountId === selectedAccountId) || null
  }, [accountData, selectedAccountId])

  // Portfolio metrics strictly for the selected broker account
  const portfolio = useMemo(() => {
    if (!currentAccount) {
      return { totalInvested: 0, totalCurrent: 0, totalPnl: 0, totalPnlPercentage: 0, holdings: [], totalCount: 0 }
    }

    const rawHoldings = currentAccount.holdings || []
    const totalInvested = currentAccount.summary?.totalInvested || 0
    const totalCurrent = currentAccount.summary?.totalCurrent || 0
    const totalPnl = totalCurrent - totalInvested
    const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

    const filteredHoldings = searchTerm.trim()
      ? rawHoldings.filter((h) => h.symbol.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      : rawHoldings

    return {
      totalInvested,
      totalCurrent,
      totalPnl,
      totalPnlPercentage,
      holdings: filteredHoldings,
      totalCount: rawHoldings.length,
    }
  }, [currentAccount, searchTerm])

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Holdings</h1>
          <p>Real-time equity portfolio and demat holdings for each connected broker account.</p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" disabled={loading} onClick={loadHoldings} title="Refresh holdings" type="button">
            <RefreshCcw className={loading ? 'spinning' : ''} size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Account Selector Tabs (Only separate accounts, no 'all') */}
      {accountData.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Account:</span>
          {accountData.map((acc) => {
            const isSelected = selectedAccountId === acc.brokerAccountId
            return (
              <button
                key={acc.brokerAccountId}
                type="button"
                onClick={() => setSelectedAccountId(acc.brokerAccountId)}
                style={{
                  border: 'none',
                  background: isSelected ? 'var(--kite-orange)' : '#edf2f7',
                  color: isSelected ? '#ffffff' : '#444',
                  fontWeight: isSelected ? 600 : 500,
                  fontSize: 13,
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <span>{acc.displayName || acc.accountId}</span>
                <span
                  style={{
                    fontSize: 11,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    padding: '1px 5px',
                    borderRadius: 10,
                  }}
                >
                  {acc.broker.toUpperCase()} · {acc.holdings?.length || 0}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Kite-style Portfolio Summary Banner */}
      <div className="kite-stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 16,
      }}>
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-dark)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Total Investment
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-heading)', marginTop: 4 }}>
            {formatMoney(portfolio.totalInvested)}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-dark)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Current Value
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-heading)', marginTop: 4 }}>
            {formatMoney(portfolio.totalCurrent)}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-dark)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Total P&amp;L
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: portfolio.totalPnl >= 0 ? 'var(--kite-green)' : 'var(--kite-red)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}>
            <span>{formatMoney(portfolio.totalPnl)}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              ({formatPercent(portfolio.totalPnlPercentage)})
            </span>
          </div>
        </div>
      </div>

      {/* Account Holdings Panel & Search Bar */}
      <div className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-heading)' }}>
            {currentAccount?.displayName || 'Account'} Holdings ({portfolio.totalCount})
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
            <input
              type="text"
              placeholder="Filter by symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                fontSize: 13,
                border: '1px solid #d0d7de',
                borderRadius: 4,
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Holdings Data Table */}
        {loading ? (
          <div className="center-state" style={{ minHeight: '200px', textAlign: 'center', padding: '40px 0' }}>
            <Loader2 className="spinning" size={28} style={{ color: 'var(--kite-blue)', margin: '0 auto 8px' }} />
            <p style={{ color: '#666', fontSize: 13 }}>Loading holdings from broker...</p>
          </div>
        ) : currentAccount?.authExpired ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#fff5f5', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <AlertTriangle size={36} style={{ color: '#dc2626', margin: '0 auto 10px' }} />
            <strong style={{ display: 'block', fontSize: 15, color: '#991b1b' }}>
              Auth expired for {currentAccount.displayName}
            </strong>
            <span style={{ fontSize: 13, color: '#7f1d1d', margin: '6px 0 16px', display: 'block' }}>
              Auth expired, please authenticate your broker account again to view live holdings.
            </span>
            <Link
              to="/accounts"
              className="primary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                borderColor: '#b91c1c',
                color: '#ffffff',
                textDecoration: 'none',
              }}
            >
              <LogIn size={15} /> Re-authenticate Account
            </Link>
          </div>
        ) : !currentAccount ? (
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <Briefcase size={36} style={{ color: '#bbb', margin: '0 auto 10px' }} />
            <strong style={{ display: 'block', fontSize: 15, color: '#333' }}>No broker accounts linked</strong>
            <span style={{ fontSize: 13, color: '#888' }}>Connect a Fyers or Zerodha account to view its holdings.</span>
          </div>
        ) : portfolio.holdings.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <Briefcase size={36} style={{ color: '#bbb', margin: '0 auto 10px' }} />
            <strong style={{ display: 'block', fontSize: 15, color: '#333' }}>
              No holdings in {currentAccount.displayName}
            </strong>
            <span style={{ fontSize: 13, color: '#888' }}>
              {searchTerm
                ? `No holdings matching "${searchTerm}" in this account.`
                : `Account ${currentAccount.accountId} currently holds no demat equity positions.`}
            </span>
          </div>
        ) : (
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th style={{ textAlign: 'right' }}>Qty.</th>
                  <th style={{ textAlign: 'right' }}>Avg. cost</th>
                  <th style={{ textAlign: 'right' }}>LTP</th>
                  <th style={{ textAlign: 'right' }}>Cur. val</th>
                  <th style={{ textAlign: 'right' }}>P&amp;L</th>
                  <th style={{ textAlign: 'right' }}>Net chg.</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h, idx) => {
                  const pnl = h.pnl !== undefined ? h.pnl : (h.currentValue - h.investedValue)
                  const pnlPercent = h.investedValue > 0 ? (pnl / h.investedValue) * 100 : (h.pnlPercentage || 0)
                  const isProfit = pnl >= 0

                  return (
                    <tr key={`${h.symbol}-${idx}`}>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSelectedChartSymbol(h.symbol)}
                          style={{
                            padding: 0,
                            minHeight: 'auto',
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
                          {h.symbol}
                        </button>
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                          {h.exchange}
                        </small>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {h.quantity}
                        {h.t1Quantity > 0 && (
                          <small style={{ display: 'block', color: '#888', fontSize: 10 }}>+{h.t1Quantity} T1</small>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: '#555' }}>
                        {h.averagePrice.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {h.lastPrice.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink-heading)' }}>
                        {formatMoney(h.currentValue)}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: isProfit ? 'var(--kite-green)' : 'var(--kite-red)',
                      }}>
                        {formatMoney(pnl)}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: isProfit ? 'var(--kite-green)' : 'var(--kite-red)',
                      }}>
                        {formatPercent(pnlPercent)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
