import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, BookOpen, Briefcase, ChevronDown, FileText, History, KeyRound, LogOut, Menu, Search, ShieldAlert, ShieldCheck, User, UserCheck, UserPlus, WalletCards, X } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'

export const Shell = () => {
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const location = useLocation()

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Close mobile menu and dropdown on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setDropdownOpen(false)
  }, [location.pathname])

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const show2faBanner = Boolean(user && !user.totpEnabled && !bannerDismissed && location.pathname !== '/security')

  return (
    <div className="kite-app">
      {/* 2FA Reminder Banner for unconfigured accounts */}
      {show2faBanner && (
        <aside
          aria-label="Security notification"
          style={{
            background: '#ffe1e1',
            borderBottom: '1px solid #ed1a1a',
            padding: '8px 16px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ShieldAlert size={16} style={{ color: '#f57c00', flexShrink: 0 }} />
            <span>
              <strong>Protect your account:</strong> Two-factor authentication (2FA) is currently disabled.
            </span>
            <Link
              to="/security"
              style={{
                color: '#e65100',
                fontWeight: 600,
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                marginLeft: 4,
              }}
            >
              Enable 2FA now <ArrowRight size={13} />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss banner"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#8d6e63',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </aside>
      )}

      <header className="kite-header">
        <div className="kite-header-left">
          <button
            aria-label="Toggle navigation menu"
            className="kite-hamburger-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link className="kite-brand" to="/">
            <span className="brand-mark">D</span>
            <div className="kite-brand-text">
              <strong>Console</strong>
              <small>Multi-account</small>
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="kite-nav desktop-only">
          <NavLink to="/" end><Search size={15} /> Trade</NavLink>
          <NavLink to="/accounts"><WalletCards size={15} /> Accounts</NavLink>
          <NavLink to="/orders"><ShieldCheck size={15} /> Orders</NavLink>
          <NavLink to="/holdings"><Briefcase size={15} /> Holdings</NavLink>
          <NavLink to="/positions"><Activity size={15} /> Positions</NavLink>
          {user?.isAdmin && (
            <>
              <NavLink to="/admin/accounts"><UserCheck size={15} /> All Accounts</NavLink>
              <NavLink to="/admin/transactions"><History size={15} /> All Transactions</NavLink>
              <NavLink to="/admin/logs"><FileText size={15} /> Logs</NavLink>
              <NavLink to="/admin/invitations"><UserPlus size={15} /> Invitations</NavLink>
            </>
          )}
        </nav>

        <div className="kite-header-right">
          {/* User Profile Avatar with Kite-style Dropdown */}
          <div className="kite-avatar-menu-wrap" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="kite-user-profile-btn"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-label="User account menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: dropdownOpen ? '#f0f4f8' : 'transparent',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'background 120ms ease',
              }}
            >
              <span className="kite-user-avatar">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
              <span className="kite-user-name" style={{ fontWeight: 500 }}>{user?.name || user?.email?.split('@')[0]}</span>
              <ChevronDown size={14} style={{ color: '#777', transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
            </button>

            {/* Profile Dropdown Menu */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 220,
                  background: '#ffffff',
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                  padding: '8px 0',
                  zIndex: 1000,
                }}
              >
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-heading)' }}>{user?.name || 'User'}</div>
                  <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{user?.email}</div>
                  {user?.isAdmin && (
                    <span className="badge" style={{ marginTop: 6, fontSize: 10 }}>Administrator</span>
                  )}
                </div>

                <Link
                  to="/security"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    color: '#444',
                    textDecoration: 'none',
                    transition: 'background 100ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f9fa' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <KeyRound size={15} style={{ color: '#666' }} /> Security &amp; 2FA
                </Link>

                <Link
                  to="/api-guide"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    color: '#444',
                    textDecoration: 'none',
                    transition: 'background 100ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f9fa' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <BookOpen size={15} style={{ color: '#666' }} /> API Setup Guide
                </Link>

                <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false)
                    logout()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 16px',
                    fontSize: 13,
                    color: 'var(--kite-red)',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 100ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="kite-mobile-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="kite-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="kite-mobile-drawer-header">
              <div className="kite-user-profile">
                <span className="kite-user-avatar">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
                <div>
                  <strong className="kite-user-name">{user?.name || 'User'}</strong>
                  <small className="kite-user-email">{user?.email}</small>
                </div>
              </div>
              <button
                aria-label="Close menu"
                className="icon-button"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="kite-mobile-nav">
              <NavLink to="/" end><Search size={18} /> Trade</NavLink>
              <NavLink to="/accounts"><WalletCards size={18} /> Accounts</NavLink>
              <NavLink to="/orders"><ShieldCheck size={18} /> Orders</NavLink>
              <NavLink to="/holdings"><Briefcase size={18} /> Holdings</NavLink>
              <NavLink to="/positions"><Activity size={18} /> Positions</NavLink>
              <NavLink to="/api-guide"><BookOpen size={18} /> API Setup Guide</NavLink>
              <NavLink to="/security"><KeyRound size={18} /> Security &amp; 2FA</NavLink>
              {user?.isAdmin && (
                <>
                  <NavLink to="/admin/accounts"><UserCheck size={18} /> All Accounts</NavLink>
                  <NavLink to="/admin/transactions"><History size={18} /> All Transactions</NavLink>
                  <NavLink to="/admin/logs"><FileText size={18} /> Activity Logs</NavLink>
                  <NavLink to="/admin/invitations"><UserPlus size={18} /> Invitations</NavLink>
                </>
              )}
            </nav>

            <div className="kite-mobile-drawer-footer">
              <button className="danger-button full" onClick={logout} type="button">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="kite-main-content">
        <Outlet />
      </main>
    </div>
  )
}
