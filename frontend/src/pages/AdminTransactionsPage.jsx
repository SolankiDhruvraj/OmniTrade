import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search, ShieldCheck, X } from 'lucide-react'
import { apiRequest } from '../api/client.js'

const PAGE_SIZE = 15

export const AdminTransactionsPage = () => {
  const [batches, setBatches] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAllOrders = async (targetPage = 1, search = appliedSearch) => {
    setLoading(true)
    setError('')
    try {
      const queryParam = search.trim() ? `&brokerAccount=${encodeURIComponent(search.trim())}` : ''
      const data = await apiRequest(`/orders/admin/all?page=${targetPage}&limit=${PAGE_SIZE}${queryParam}`)
      setBatches(data.batches || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllOrders(1, '')
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchTerm)
    loadAllOrders(1, searchTerm)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearch('')
    loadAllOrders(1, '')
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return
    loadAllOrders(newPage, appliedSearch)
  }

  const successCount = batches.filter((b) => b.status === 'completed').length
  const failedCount = batches.filter((b) => b.status === 'failed' || b.status === 'partially_failed').length

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>System Transactions</h1>
          <p>Global audit log of all order executions and simultaneous broker attempts across all users.</p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" disabled={loading} onClick={() => loadAllOrders(pagination.page, appliedSearch)} title="Refresh transactions" type="button">
            <RefreshCcw className={loading ? 'spinning' : ''} size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Order Batches</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink-heading)', marginTop: '4px' }}>
            {pagination.totalCount}
          </div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Completed on Page</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--kite-green)', marginTop: '4px' }}>
            {successCount}
          </div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Failed on Page</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--kite-red)', marginTop: '4px' }}>
            {failedCount}
          </div>
        </div>
      </div>

      <div className="panel">
        {/* Search Bar for Broker Account */}
        <form className="search-bar" onSubmit={handleSearchSubmit} style={{ marginBottom: '16px' }}>
          <Search size={18} />
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              placeholder="Search by broker account ID, display name, or broker (e.g. FY1234, Zerodha)..."
              style={{ paddingRight: searchTerm ? '32px' : '12px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#888888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spinning" size={15} /> : 'Filter'}
          </button>
        </form>

        {appliedSearch && (
          <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--muted-dark)' }}>
            Filtering by broker account: <strong>"{appliedSearch}"</strong> (
            <button
              onClick={handleClearSearch}
              style={{ background: 'none', border: 'none', color: 'var(--kite-blue)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              type="button"
            >
              Reset filter
            </button>
            )
          </div>
        )}

        {loading ? (
          <div className="center-state" style={{ minHeight: '180px' }}>
            <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
            <span>Loading transactions...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <strong>No transactions found</strong>
            <span>{appliedSearch ? `No orders matched broker account "${appliedSearch}".` : 'Orders submitted by any user will be recorded here.'}</span>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Date &amp; Time</th>
                    <th>Orders / Legs</th>
                    <th>Batch Status</th>
                    <th>Linked Accounts</th>
                    <th>Broker Execution Details</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch._id}>
                      <td>
                        <strong>{batch.user?.name || 'Unknown User'}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{batch.user?.email || 'N/A'}</div>
                      </td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(batch.createdAt).toLocaleString()}
                      </td>
                      <td>
                        {(batch.orders?.length ? batch.orders : [batch.order]).filter(Boolean).map((ord, index) => (
                          <div className="execution-line compact" key={`${ord.symbol}-${index}`}>
                            <span style={{ fontWeight: 500 }}>
                              <span style={{ color: ord.side === 1 ? 'var(--kite-blue)' : 'var(--kite-red)' }}>
                                {ord.side === 1 ? 'BUY' : 'SELL'}
                              </span>{' '}
                              {ord.qty} qty · {ord.symbol} ({ord.productType || 'INTRADAY'})
                            </span>
                          </div>
                        ))}
                      </td>
                      <td>
                        <span className={`status ${batch.status}`}>{batch.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge">{batch.brokerAccountIds?.length || 0}</span>
                      </td>
                      <td>
                        {(batch.executions || []).map((exec) => (
                          <div className="execution-line" key={exec._id} style={{ marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span>{exec.brokerAccount?.displayName || exec.broker}</span>
                              <span className={`status ${exec.status}`}>{exec.status}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '6px' }}>
                              <span>{exec.brokerAccount?.accountId || exec.broker}</span>
                              {exec.brokerOrderId && <span>· ID: {exec.brokerOrderId}</span>}
                            </div>
                            {exec.errorMessage && (
                              <small style={{ color: 'var(--kite-red)' }}>{exec.errorMessage}</small>
                            )}
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
                  <strong>{pagination.totalCount}</strong> transactions
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
    </section>
  )
}
