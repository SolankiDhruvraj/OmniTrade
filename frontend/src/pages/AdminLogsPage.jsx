import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Info,
  KeyRound,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react'
import { apiRequest } from '../api/client.js'

const PAGE_SIZE = 20

export const AdminLogsPage = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
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

  const loadLogs = async (targetPage = 1, search = appliedSearch, cat = categoryFilter, stat = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit: PAGE_SIZE,
      })
      if (cat !== 'all') params.append('category', cat)
      if (stat !== 'all') params.append('status', stat)
      if (search.trim()) params.append('search', search.trim())

      const data = await apiRequest(`/admin/logs?${params.toString()}`)
      setLogs(data.logs || [])
      if (data.pagination) setPagination(data.pagination)
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs(1, appliedSearch, categoryFilter, statusFilter)
  }, [categoryFilter, statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchTerm)
    loadLogs(1, searchTerm, categoryFilter, statusFilter)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearch('')
    loadLogs(1, '', categoryFilter, statusFilter)
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return
    loadLogs(newPage, appliedSearch, categoryFilter, statusFilter)
  }

  const getActionBadge = (action, category) => {
    switch (action) {
      case 'user_login':
      case 'user_2fa_login':
        return <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><KeyRound size={12} /> Login</span>
      case 'user_login_failed':
        return <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} /> Login Failed</span>
      case 'user_logout':
        return <span className="status queued" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> Logout</span>
      case 'broker_account_authenticated':
        return <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><WalletCards size={12} /> Broker Auth</span>
      case 'broker_account_added':
        return <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><WalletCards size={12} /> Broker Added</span>
      case 'broker_auth_expired':
        return <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> Auth Expired</span>
      case 'order_batch_confirmed':
        return <span className="status queued" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingUp size={12} /> Order Placed</span>
      case 'order_execution_success':
        return <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Order Filled</span>
      case 'order_execution_failed':
        return <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> Order Failed</span>
      case 'position_exit_submitted':
        return <span className="status queued" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingUp size={12} /> Position Exit</span>
      case 'kill_switch_triggered':
        return <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}><ShieldAlert size={12} /> Kill Switch</span>
      default:
        return <span className="status">{action}</span>
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="status success">SUCCESS</span>
      case 'failed':
        return <span className="status failed">FAILED</span>
      case 'warning':
        return <span className="status" style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>WARNING</span>
      default:
        return <span className="status queued">INFO</span>
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Audit &amp; Activity Logs</h1>
          <p>Real-time audit trail of user logins, broker authentications, order placements, and security events.</p>
        </div>
        <div className="toolbar">
          <button
            className="secondary-button"
            disabled={loading}
            onClick={() => loadLogs(pagination.page, appliedSearch, categoryFilter, statusFilter)}
            title="Refresh logs"
            type="button"
          >
            <RefreshCcw className={loading ? 'spinning' : ''} size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* KPI Stats Grid */}
      <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Recorded Logs</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink-heading)', marginTop: '4px' }}>
            {pagination.totalCount}
          </div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Category</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--kite-blue)', marginTop: '6px', textTransform: 'capitalize' }}>
            {categoryFilter === 'all' ? 'All Activities' : categoryFilter}
          </div>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Status Filter</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--kite-orange)', marginTop: '6px', textTransform: 'capitalize' }}>
            {statusFilter === 'all' ? 'All Outcomes' : statusFilter}
          </div>
        </div>
      </div>

      <div className="panel">
        {/* Search & Category Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 6, background: '#f1f3f6', padding: '3px 4px', borderRadius: 6 }}>
            {[
              { id: 'all', label: 'All Logs' },
              { id: 'auth', label: 'Auth & Login' },
              { id: 'broker', label: 'Broker Accounts' },
              { id: 'order', label: 'Orders & Trading' },
              { id: 'security', label: 'Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                style={{
                  border: 'none',
                  background: categoryFilter === tab.id ? '#ffffff' : 'transparent',
                  color: categoryFilter === tab.id ? 'var(--kite-orange)' : '#666',
                  fontWeight: categoryFilter === tab.id ? 600 : 400,
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: categoryFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user, IP, action, message..."
                style={{
                  width: '100%',
                  padding: '6px 28px 6px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid #d0d7de',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button className="primary-button" type="submit" style={{ padding: '6px 12px', fontSize: 12 }}>
              <Search size={13} />
            </button>
          </form>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="center-state" style={{ minHeight: '200px' }}>
            <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
            <span>Loading audit log trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Info size={32} />
            <strong>No audit logs found</strong>
            <span>{appliedSearch ? `No logs matched "${appliedSearch}".` : 'No activity logs have been recorded yet.'}</span>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Event Description</th>
                    <th>IP / Client</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: 'var(--ink-heading)', display: 'block' }}>
                          {log.user?.name || log.user?.email || 'System / Anonymous'}
                        </strong>
                        {log.user?.email && log.user?.name && (
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>{log.user.email}</small>
                        )}
                      </td>
                      <td>{getActionBadge(log.action, log.category)}</td>
                      <td>
                        <span className="badge" style={{ textTransform: 'capitalize', fontSize: 11 }}>
                          {log.category}
                        </span>
                      </td>
                      <td>{getStatusBadge(log.status)}</td>
                      <td style={{ fontSize: 12, color: '#334155', maxWidth: 380 }}>
                        <div>{log.message}</div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 2 }}>
                            {log.metadata.broker && `${log.metadata.broker.toUpperCase()} · `}
                            {log.metadata.symbol && `${log.metadata.symbol} · `}
                            {log.metadata.accountId && `Account: ${log.metadata.accountId}`}
                          </small>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                        <div>{log.ip || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalCount > 0 && (
              <div className="kite-pagination-bar" style={{ marginTop: 16 }}>
                <span className="kite-pagination-info">
                  Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> –{' '}
                  <strong>{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</strong> of{' '}
                  <strong>{pagination.totalCount}</strong> events
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
