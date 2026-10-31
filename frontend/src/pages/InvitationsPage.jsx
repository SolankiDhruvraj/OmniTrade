import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Clock, Copy, Loader2, RefreshCcw, Search, Trash2, UserPlus, X, XCircle } from 'lucide-react'
import { apiRequest } from '../api/client.js'

const PAGE_SIZE = 10

export const InvitationsPage = () => {
  const [email, setEmail] = useState('')
  const [invitation, setInvitation] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revokingId, setRevokingId] = useState(null)

  // Invitations list state
  const [invitations, setInvitations] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  })

  const loadInvitations = async (targetPage = 1, status = selectedStatus, search = appliedSearch) => {
    setLoadingList(true)
    try {
      const statusParam = status !== 'all' ? `&status=${encodeURIComponent(status)}` : ''
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
      const data = await apiRequest(`/auth/invitations?page=${targetPage}&limit=${PAGE_SIZE}${statusParam}${searchParam}`)
      setInvitations(data.invitations || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadInvitations(1, selectedStatus, appliedSearch)
  }, [selectedStatus, appliedSearch])

  const createInvitation = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setInvitation(null)
    setBusy(true)
    try {
      const result = await apiRequest('/auth/invitations', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setInvitation(result)
      if (result.emailSent) {
        setMessage(`Invitation email successfully sent to ${result.email}! (Expires in 15 mins)`)
      } else {
        setMessage(`Invitation created. You can share the link manually below. (Expires in 15 mins)`)
      }
      setEmail('')
      loadInvitations(1, selectedStatus, appliedSearch)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (id, invEmail) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${invEmail}?`)) {
      return
    }
    setRevokingId(id)
    setError('')
    setMessage('')
    try {
      await apiRequest(`/auth/invitations/${id}`, { method: 'DELETE' })
      setMessage(`Invitation for ${invEmail} has been revoked.`)
      loadInvitations(pagination.page, selectedStatus, appliedSearch)
    } catch (err) {
      setError(err.message)
    } finally {
      setRevokingId(null)
    }
  }

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitation.invitationUrl)
      setMessage('Invitation link copied.')
    } catch {
      setMessage('Select and copy the invitation link.')
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchTerm)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearch('')
  }

  const renderStatusBadge = (status) => {
    const s = String(status || '').toLowerCase()
    switch (s) {
      case 'accepted':
        return (
          <span className="status success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={13} /> Accepted
          </span>
        )
      case 'pending':
        return (
          <span className="status queued" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} /> Pending
          </span>
        )
      case 'expired':
        return (
          <span className="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f5f5', color: '#777' }}>
            <XCircle size={13} /> Expired
          </span>
        )
      case 'revoked':
        return (
          <span className="status failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ffebee', color: '#d32f2f' }}>
            <Ban size={13} /> Revoked
          </span>
        )
      default:
        return <span className="status">{s || 'Unknown'}</span>
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>User invitations</h1>
          <p>Send and manage single-use registration invitations (15-minute validity).</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="panel invitation-panel" onSubmit={createInvitation}>
        <label>
          Invitee email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
            placeholder="Enter Invitee Email"
          />
        </label>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? (
            <>
              <Loader2 className="spinning" size={16} /> Sending invitation...
            </>
          ) : (
            <>
              <UserPlus size={16} /> Send invitation email
            </>
          )}
        </button>
      </form>

      {invitation && (
        <section className="panel invitation-panel">
          <h2>Active link for {invitation.email}</h2>
          <p>Share this link with the invitee. It expires {new Date(invitation.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} and can be used once.</p>
          <div className="invitation-link-row">
            <input aria-label="Invitation link" readOnly value={invitation.invitationUrl} onFocus={(event) => event.target.select()} />
            <button className="secondary-button" onClick={copyInvitation} type="button">
              <Copy size={16} /> Copy
            </button>
          </div>
        </section>
      )}

      {/* Invitations History & Supervision Table */}
      <section className="panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Sent invitations</h2>
            <button
              className="icon-button"
              onClick={() => loadInvitations(pagination.page, selectedStatus, appliedSearch)}
              title="Refresh list"
              disabled={loadingList}
            >
              <RefreshCcw size={14} className={loadingList ? 'spinning' : ''} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filter by Status */}
            <div style={{ display: 'flex', gap: 6, background: '#f1f3f6', padding: '3px 4px', borderRadius: 6 }}>
              {['all', 'pending', 'accepted', 'expired', 'revoked'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  style={{
                    border: 'none',
                    background: selectedStatus === st ? '#ffffff' : 'transparent',
                    color: selectedStatus === st ? 'var(--kite-orange)' : '#666',
                    fontWeight: selectedStatus === st ? 600 : 400,
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: selectedStatus === st ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search by Email */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '6px 28px 6px 10px',
                  fontSize: 13,
                  border: '1px solid #d0d7de',
                  borderRadius: 4,
                  minWidth: 180,
                }}
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              ) : (
                <Search size={14} style={{ position: 'absolute', right: 8, color: '#888', pointerEvents: 'none' }} />
              )}
            </form>
          </div>
        </div>

        {loadingList ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#666' }}>
            <Loader2 className="spinning" size={24} style={{ margin: '0 auto 8px' }} />
            <p>Loading invitations...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#888' }}>
            <p>No invitations found{appliedSearch ? ` matching "${appliedSearch}"` : ''}.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invitee Email</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Expires / Accepted At</th>
                  <th>Invited By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 500 }}>{inv.email}</td>
                    <td>{renderStatusBadge(inv.status)}</td>
                    <td style={{ fontSize: 13, color: '#555' }}>
                      {new Date(inv.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td style={{ fontSize: 13, color: '#555' }}>
                      {inv.status === 'accepted' && inv.usedAt ? (
                        <span title="Accepted timestamp">
                          {new Date(inv.usedAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      ) : (
                        <span title="Expiration timestamp">
                          {new Date(inv.expiresAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: '#555' }}>
                      {inv.createdBy?.name || inv.createdBy?.email || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {inv.status === 'pending' ? (
                        <button
                          className="secondary-button"
                          onClick={() => handleRevoke(inv._id, inv.email)}
                          disabled={revokingId === inv._id}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            color: '#d32f2f',
                            borderColor: '#ffcdd2',
                            background: '#ffebee',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {revokingId === inv._id ? (
                            <Loader2 size={12} className="spinning" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Revoke
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#999' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #edf2f7',
                }}
              >
                <div style={{ fontSize: 13, color: '#666' }}>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="secondary-button"
                    onClick={() => loadInvitations(pagination.page - 1, selectedStatus, appliedSearch)}
                    disabled={pagination.page <= 1 || loadingList}
                    style={{ padding: '4px 12px', fontSize: 12 }}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => loadInvitations(pagination.page + 1, selectedStatus, appliedSearch)}
                    disabled={pagination.page >= pagination.totalPages || loadingList}
                    style={{ padding: '4px 12px', fontSize: 12 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
