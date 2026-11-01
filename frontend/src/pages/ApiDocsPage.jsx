import { useState } from 'react'
import { BookOpen, Check, Copy, ExternalLink, HelpCircle, Key, Layers, ShieldAlert, ShieldCheck } from 'lucide-react'

export const ApiDocsPage = () => {
  const [activeTab, setActiveTab] = useState('fyers')
  const [copiedKey, setCopiedKey] = useState('')

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  const fyersRedirectUrl = `${window.location.origin.replace(/\/$/, '')}/api/v1/broker-accounts/fyers/callback`
  const zerodhaRedirectUrl = `${window.location.origin.replace(/\/$/, '')}/api/v1/broker-accounts/zerodha/callback`

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <BookOpen size={22} color="var(--kite-orange)" />
            <h1 style={{ margin: 0 }}>API Credentials Setup Guide</h1>
          </div>
          <p>Complete step-by-step instructions to create apps and get API credentials for Fyers &amp; Zerodha Kite.</p>
        </div>
      </div>

      {/* Broker Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('fyers')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'fyers' ? '2px solid var(--kite-orange)' : '2px solid transparent',
            color: activeTab === 'fyers' ? 'var(--kite-orange)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Fyers API v3
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('zerodha')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'zerodha' ? '2px solid var(--kite-orange)' : '2px solid transparent',
            color: activeTab === 'zerodha' ? 'var(--kite-orange)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Zerodha Kite Connect
        </button>
      </div>

      {/* Fyers Guide */}
      {activeTab === 'fyers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel">
            <h2 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="var(--kite-orange)" />
              Steps to Generate Fyers App ID &amp; Secret Key
            </h2>

            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', lineHeight: 1.6 }}>
              <li>
                <strong>Log into Fyers API Dashboard:</strong>
                <div style={{ marginTop: '4px' }}>
                  Open{' '}
                  <a href="https://myapi.fyers.in/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>
                    myapi.fyers.in/dashboard <ExternalLink size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>{' '}
                  and sign in using your Fyers client credentials (Mobile + OTP/PIN).
                </div>
              </li>

              <li>
                <strong>Create a New App:</strong>
                <div style={{ marginTop: '4px' }}>
                  Click on <strong>"Create API"</strong> or <strong>"+ Create New App"</strong> button.
                </div>
              </li>

              <li>
                <strong>Fill Application Details:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div>• <strong>App Name:</strong> <code>F&amp;O Trading Console</code> (or any name you prefer)</div>
                  <div>
                    • <strong>Redirect URL:</strong> Copy and paste this exact URL:
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', border: '1px solid #cbd5e1', flex: 1, wordBreak: 'break-all' }}>
                        {fyersRedirectUrl}
                      </code>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => copyToClipboard(fyersRedirectUrl, 'fyers-redirect')}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {copiedKey === 'fyers-redirect' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                      </button>
                    </div>
                  </div>
                  <div>• <strong>Permissions:</strong> Select <strong>Orders</strong>, <strong>Holdings</strong>, and <strong>Positions</strong>.</div>
                </div>
              </li>

              <li>
                <strong>Copy Your Credentials:</strong>
                <div style={{ marginTop: '4px' }}>
                  Once created, you will see:
                  <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    <li><strong>App ID:</strong> Format looks like <code>CZ9QZ5NGVU-100</code></li>
                    <li><strong>Secret Key:</strong> A 16-character alphanumeric string</li>
                  </ul>
                </div>
              </li>

              <li>
                <strong>Connect Your Account:</strong>
                <div style={{ marginTop: '4px' }}>
                  Go to <a href="/accounts" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>Accounts</a> in this console and click <strong>"Connect Fyers"</strong>. You will be redirected to log in and approve permissions. That's it!
                </div>
              </li>
            </ol>
          </div>

          {/* Multiple Fyers Accounts Guide */}
          <div className="panel" style={{ borderLeft: '4px solid var(--kite-blue)' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
              <ShieldAlert size={18} color="var(--kite-blue)" />
              How to Connect Multiple Fyers Accounts
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              By default, if you are already logged in to Fyers in your browser, clicking <strong>"Connect Fyers"</strong> will automatically authorize the existing logged-in account without prompting for new login credentials. Follow any one of the 3 options below to link additional Fyers accounts:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              {/* Option 1 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px' }}>
                <strong style={{ color: 'var(--kite-blue)', display: 'block', marginBottom: '6px' }}>
                  Option 1: Incognito / Private Window (Recommended)
                </strong>
                <ol style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.6, color: '#334155' }}>
                  <li>Open an <strong>Incognito / Private Window</strong> in your browser (since incognito windows don't share cookies).</li>
                  <li>Go to your OmniTrade console: <a href="https://omnitrade-33u.pages.dev/login" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>https://omnitrade-33u.pages.dev/login</a></li>
                  <li>Sign in with your OmniTrade credentials.</li>
                  <li>Navigate to <strong>Accounts</strong> and click <strong>"Connect Fyers"</strong>.</li>
                  <li>Because there are no cached cookies, Fyers will show the clean login page. Enter <strong>Account 2's Client ID, PIN, and OTP</strong>, then authorize.</li>
                  <li>Close the Incognito window and refresh your main browser tab. Both accounts will appear side-by-side!</li>
                </ol>
              </div>

              {/* Option 2 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px' }}>
                <strong style={{ color: 'var(--kite-blue)', display: 'block', marginBottom: '6px' }}>
                  Option 2: Log Out of Fyers First
                </strong>
                <ol style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.6, color: '#334155' }}>
                  <li>Open a new tab and go to <a href="https://trade.fyers.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>trade.fyers.in <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /></a>.</li>
                  <li>Click on your profile avatar/icon at the top right &rarr; Click <strong>Logout</strong>.</li>
                  <li>Return to your OmniTrade <strong>Accounts</strong> tab and click <strong>"Connect Fyers"</strong>.</li>
                  <li>Fyers will prompt you with a blank login screen. Enter <strong>Account 2's credentials</strong> to connect!</li>
                </ol>
              </div>

              {/* Option 3 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 16px' }}>
                <strong style={{ color: 'var(--kite-blue)', display: 'block', marginBottom: '6px' }}>
                  Option 3: Use a Different Browser (e.g. Safari / Firefox / Edge)
                </strong>
                <ol style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.6, color: '#334155' }}>
                  <li>If your first account is logged in on Google Chrome, open another browser (e.g., Safari, Edge, Brave, or Firefox).</li>
                  <li>Open <a href="https://omnitrade-33u.pages.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>https://omnitrade-33u.pages.dev</a> and sign in.</li>
                  <li>Go to <strong>Accounts</strong> and click <strong>"Connect Fyers"</strong> to link Account 2.</li>
                  <li>Because all connected accounts are synchronized in your central cloud database, they will instantly show up across all your devices and browsers!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zerodha Guide */}
      {activeTab === 'zerodha' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel">
            <h2 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="var(--kite-orange)" />
              Steps to Generate Zerodha Kite API Key &amp; API Secret
            </h2>

            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', lineHeight: 1.6 }}>
              <li>
                <strong>Sign Up / Log in on Kite Connect:</strong>
                <div style={{ marginTop: '4px' }}>
                  Visit{' '}
                  <a href="https://kite.trade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>
                    kite.trade <ExternalLink size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>{' '}
                  and sign up (developer accounts are separate from Kite trading accounts).
                </div>
              </li>

              <li>
                <strong>Create a New App:</strong>
                <div style={{ marginTop: '4px' }}>
                  Click on <strong>"Create new app"</strong>.
                </div>
              </li>

              <li>
                <strong>Fill Application Details:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div>• <strong>App Type:</strong> Select <strong>Connect</strong> (₹500/month). <em>(Historical API is NOT needed).</em></div>
                  <div>• <strong>App Name:</strong> <code>F&amp;O Trading Console</code> (or any identifier)</div>
                  <div>• <strong>Zerodha Client ID:</strong> Enter the specific Zerodha User ID (e.g. <code>AB1234</code>) for the account you want to connect.</div>
                  <div>
                    • <strong>Redirect URL:</strong> Copy and paste this exact URL:
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', border: '1px solid #cbd5e1', flex: 1, wordBreak: 'break-all' }}>
                        {zerodhaRedirectUrl}
                      </code>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => copyToClipboard(zerodhaRedirectUrl, 'zerodha-redirect')}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {copiedKey === 'zerodha-redirect' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                      </button>
                    </div>
                  </div>
                </div>
              </li>

              <li>
                <strong>Copy API Key &amp; Secret:</strong>
                <div style={{ marginTop: '4px' }}>
                  Once the app is created, click on it in your dashboard:
                  <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    <li><strong>API Key:</strong> Displayed on the app overview page</li>
                    <li><strong>API Secret:</strong> Click <strong>"Show"</strong> next to API Secret to reveal and copy it</li>
                  </ul>
                </div>
              </li>

              <li>
                <strong>Connecting in this Console:</strong>
                <div style={{ marginTop: '4px' }}>
                  Go to <a href="/accounts" style={{ color: 'var(--kite-orange)', fontWeight: 600 }}>Accounts</a> and click <strong>"Connect Zerodha"</strong>. Enter your <strong>API Key</strong> and <strong>API Secret</strong> in the popup, then complete login on Kite!
                </div>
              </li>
            </ol>
          </div>

          <div className="panel" style={{ background: '#f8fafc' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--kite-orange)" />
              Connecting Multiple Zerodha Accounts
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Zerodha requires one Kite app per Client ID. If you manage 3 accounts (e.g. <code>AB1234</code>, <code>CD5678</code>, <code>EF9012</code>), create one app for each Client ID on <a href="https://kite.trade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--kite-orange)' }}>kite.trade</a>, then click <strong>"Connect Zerodha"</strong> in this console for each one with their respective API Key &amp; Secret!
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
