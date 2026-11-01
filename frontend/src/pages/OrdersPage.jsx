import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, History, Loader2, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react'
import { apiRequest } from '../api/client.js'

const PAGE_SIZE = 10

export const OrdersPage = () => {
  const [activeTab, setActiveTab] = useState('broker') // 'broker' (live broker orderbook) or 'batches' (local execution batches)
  const [batches, setBatches] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  })

  // Live broker orderbook state
  const [brokerAccounts, setBrokerAccounts] = useState([])
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = async (targetPage = pagination.page) => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'batches') {
        const data = await apiRequest(`/orders?page=${targetPage}&limit=${PAGE_SIZE}`)
        setBatches(data.batches || [])
        if (data.pagination) setPagination(data.pagination)
      } else {
        const data = await apiRequest('/broker-accounts/broker-orders')
        setBrokerAccounts(data.accounts || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders(1)
  }, [activeTab])

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return
    loadOrders(newPage)
  }

  // Flatten & filter live broker orders
  const activeBrokerOrders = () => {
    const active = selectedBrokerAccountId === 'all'
      ? brokerAccounts
      : brokerAccounts.filter((acc) => acc.brokerAccountId === selectedBrokerAccountId)

    let allOrders = []
    active.forEach((acc) => {
      if (Array.isArray(acc.orders)) {
        acc.orders.forEach((o) => {
          allOrders.push({
            ...o,
            accountName: acc.displayName,
            broker: acc.broker,
            brokerAccountId: acc.brokerAccountId,
          })
        })
      }
    })

    if (statusFilter === 'open') {
      return allOrders.filter((o) => ['OPEN', 'TRIGGER PENDING', 'MODIFY PENDING', 'PUT ORDER REQ RECEIVED'].includes(o.status))
    }
    if (statusFilter === 'executed') {
      return allOrders.filter((o) => ['COMPLETE', 'EXECUTED', 'TRADED', 'FILLED'].includes(o.status))
    }
    if (statusFilter === 'rejected') {
      return allOrders.filter((o) => ['REJECTED', 'CANCELLED', 'CANCELED'].includes(o.status))
    }
    return allOrders
  }

  const renderBrokerOrderStatus = (status) => {
    const s = String(status || '').toUpperCase()
    if (['COMPLETE', 'EXECUTED', 'TRADED', 'FILLED'].includes(s)) {
      return (
        <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={13} /> {s}
        </span>
      )
    }
    if (['OPEN', 'TRIGGER PENDING', 'PENDING'].includes(s)) {
      return (
        <span className="status queued" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={13} /> {s}
        </span>
      )
    }
    if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(s)) {
      return (
        <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <XCircle size={13} /> {s}
        </span>
      )
    }
    return <span className="status">{s}</span>
  }

  const brokerOrderList = activeBrokerOrders()

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>Live exchange order book across connected brokers and batch execution history.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => loadOrders(pagination.page)} title="Refresh orders" type="button">
          <RefreshCcw className={loading ? 'spinning' : ''} size={16} />
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Top Tab Bar (Kite Style) */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #edf2f7', paddingBottom: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab('broker')}
          style={{
            border: 'none',
            background: activeTab === 'broker' ? 'var(--kite-orange)' : '#edf2f7',
            color: activeTab === 'broker' ? '#ffffff' : '#555',
            fontWeight: 600,
            fontSize: 13,
            padding: '7px 16px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <History size={15} /> Live Broker Orderbook
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          style={{
            border: 'none',
            background: activeTab === 'batches' ? 'var(--kite-orange)' : '#edf2f7',
            color: activeTab === 'batches' ? '#ffffff' : '#555',
            fontWeight: 600,
            fontSize: 13,
            padding: '7px 16px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ShieldCheck size={15} /> Console Execution Batches
        </button>
      </div>

      {/* TAB 1: Live Broker Orderbook */}
      {activeTab === 'broker' && (
        <div className="panel">
          {/* Subfilters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: 6, background: '#f1f3f6', padding: '3px 4px', borderRadius: 6 }}>
              {['all', 'executed', 'open', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    border: 'none',
                    background: statusFilter === st ? '#ffffff' : 'transparent',
                    color: statusFilter === st ? 'var(--kite-orange)' : '#666',
                    fontWeight: statusFilter === st ? 600 : 400,
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: statusFilter === st ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Account Selector */}
            {brokerAccounts.length > 1 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666' }}>Account:</span>
                <select
                  value={selectedBrokerAccountId}
                  onChange={(e) => setSelectedBrokerAccountId(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' }}
                >
                  <option value="all">All accounts</option>
                  {brokerAccounts.map((acc) => (
                    <option key={acc.brokerAccountId} value={acc.brokerAccountId}>
                      {acc.displayName} ({acc.orders?.length || 0})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="center-state" style={{ minHeight: '180px', textAlign: 'center', padding: '40px 0' }}>
              <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)', margin: '0 auto 8px' }} />
              <p style={{ color: '#666', fontSize: 13 }}>Fetching orderbook from connected brokers...</p>
            </div>
          ) : brokerOrderList.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
              <History size={36} style={{ color: '#bbb', margin: '0 auto 10px' }} />
              <strong style={{ display: 'block', fontSize: 15, color: '#333' }}>No orders found</strong>
              <span style={{ fontSize: 13, color: '#888' }}>No {statusFilter !== 'all' ? statusFilter : ''} orders recorded today for the selected accounts.</span>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Instrument</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Qty.</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th>Status</th>
                    {selectedBrokerAccountId === 'all' && <th>Account</th>}
                  </tr>
                </thead>
                <tbody>
                  {brokerOrderList.map((order, idx) => (
                    <tr key={`${order.id}-${idx}`}>
                      <td style={{ fontSize: 12, color: '#666' }}>
                        {order.orderTimestamp
                          ? new Date(order.orderTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : '—'}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 2,
                            color: order.transactionType === 'BUY' ? 'var(--kite-blue)' : 'var(--kite-red)',
                            background: order.transactionType === 'BUY' ? '#eef4fc' : '#fbeae9',
                          }}
                        >
                          {order.transactionType}
                        </span>
                      </td>
                      <td>
                        <strong>{order.symbol}</strong>
                        {order.message && (
                          <small style={{ display: 'block', color: '#c53030', fontSize: 11, maxWidth: 220 }}>
                            {order.message}
                          </small>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: '#555' }}>
                        {order.product || 'NRML'} · {order.orderType || 'MARKET'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {order.filledQuantity} / {order.quantity}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {order.averagePrice > 0 ? order.averagePrice.toFixed(2) : (order.price > 0 ? order.price.toFixed(2) : 'MKT')}
                      </td>
                      <td>{renderBrokerOrderStatus(order.status)}</td>
                      {selectedBrokerAccountId === 'all' && (
                        <td>
                          <span className="badge" style={{ textTransform: 'capitalize' }}>
                            {order.accountName || order.broker}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Console Execution Batches */}
      {activeTab === 'batches' && (
        <div className="panel">
          {loading ? (
            <div className="center-state" style={{ minHeight: '180px' }}>
              <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
              <span>Loading order batches...</span>
            </div>
          ) : batches.length === 0 ? (
            <div className="empty-state">
              <strong>No orders yet</strong>
              <span>Confirmed order batches will appear here.</span>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Accounts</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch._id}>
                        <td>{new Date(batch.createdAt).toLocaleString()}</td>
                        <td>
                          {(batch.orders?.length ? batch.orders : [batch.order]).filter(Boolean).map((order, index) => (
                            <div className="execution-line compact" key={`${order.symbol}-${index}`}>
                              <span>{order.side === 1 ? 'BUY' : 'SELL'} {order.qty} {order.symbol}</span>
                            </div>
                          ))}
                        </td>
                        <td><span className={`status ${batch.status}`}>{batch.status}</span></td>
                        <td>{batch.brokerAccountIds?.length || 0}</td>
                        <td>
                          {(batch.executions || []).map((execution) => (
                            <div className="execution-line" key={execution._id}>
                              <span>{execution.brokerAccount?.displayName || execution.broker}</span>
                              <span className={`status ${execution.status}`}>{execution.status}</span>
                              {execution.errorMessage && <small>{execution.errorMessage}</small>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalCount > 0 && (
                <div className="kite-pagination-bar">
                  <span className="kite-pagination-info">
                    Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> –{' '}
                    <strong>{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</strong> of{' '}
                    <strong>{pagination.totalCount}</strong> batches
                  </span>

                  <div className="kite-pagination-controls">
                    <button
                      className="kite-page-btn"
                      disabled={!pagination.hasPrevPage || loading}
                      onClick={() => handlePageChange(pagination.page - 1)}
                      title="Previous page"
                      type="button"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="kite-page-indicator">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <button
                      className="kite-page-btn"
                      disabled={!pagination.hasNextPage || loading}
                      onClick={() => handlePageChange(pagination.page + 1)}
                      title="Next page"
                      type="button"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

