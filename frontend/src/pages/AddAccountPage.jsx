import { useMemo, useState } from 'react'
import { ArrowLeft, KeyRound, Save, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client.js'
import { CustomSelect } from '../components/CustomSelect.jsx'

const brokerOptions = [
  { value: 'fyers', label: 'Fyers', fields: ['apiKey', 'apiSecret', 'accessToken', 'refreshToken'] },
  { value: 'zerodha', label: 'Zerodha', fields: ['apiKey', 'apiSecret', 'accessToken'] },
]

const credentialLabels = {
  apiKey: 'App ID / API Key (e.g. XC12345-100)',
  apiSecret: 'App Secret Key',
  accessToken: 'Access Token (Optional if you have API Key & Secret)',
  refreshToken: 'Refresh Token (Optional)',
  totpSecret: 'TOTP Secret (Optional)',
  password: 'Password (Optional)',
  pin: 'PIN (Optional)',
}

const emptyCredentials = {
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  refreshToken: '',
  totpSecret: '',
  password: '',
  pin: '',
}

export const AddAccountPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    broker: 'fyers',
    accountId: '',
    displayName: '',
    credentials: emptyCredentials,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedBroker = useMemo(
    () => brokerOptions.find((broker) => broker.value === form.broker) || brokerOptions[0],
    [form.broker],
  )

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateCredential = (field, value) => {
    setForm((current) => ({
      ...current,
      credentials: { ...current.credentials, [field]: value },
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      await apiRequest('/broker-accounts', {
        method: 'POST',
        body: JSON.stringify({
          broker: form.broker,
          accountId: form.accountId,
          displayName: form.displayName,
          credentials: form.credentials,
          notes: form.notes,
        }),
      })
      navigate('/accounts', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <h1>Add broker account</h1>
          <p>Add your own App ID, Secret Key, and tokens to trade directly through your broker account.</p>
        </div>
        <Link className="secondary-button" to="/accounts"><ArrowLeft size={16} /> Back</Link>
      </div>

      {error && <div className="alert error">{error}</div>}

      <form className="account-form-grid" onSubmit={handleSubmit}>
        <div className="panel form-panel">
          <div className="section-title compact">
            <div>
              <h2>Account details</h2>
              <p>Use the client ID shown in the broker console.</p>
            </div>
            <ShieldCheck size={19} />
          </div>

          <label>
            Broker
            <CustomSelect
              onChange={(val) => updateField('broker', val)}
              options={brokerOptions}
              value={form.broker}
            />
          </label>

          <div className="two-col">
            <label>
              Account ID
              <input
                autoComplete="off"
                required
                value={form.accountId}
                onChange={(event) => updateField('accountId', event.target.value)}
                placeholder="Client or user ID"
              />
            </label>

            <label>
              Display name
              <input
                autoComplete="off"
                required
                value={form.displayName}
                onChange={(event) => updateField('displayName', event.target.value)}
                placeholder="Main F&O account"
              />
            </label>
          </div>

          <label>
            Notes
            <input
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Optional desk, strategy, or account tag"
            />
          </label>
        </div>

        <div className="panel form-panel">
          <div className="section-title compact">
            <div>
              <h2>{selectedBroker.label} credentials</h2>
              <p>Only field names are shown after saving.</p>
            </div>
            <KeyRound size={19} />
          </div>

          <div className="credential-grid">
            {selectedBroker.fields.map((field) => (
              <label key={field}>
                {credentialLabels[field]}
                <input
                  autoComplete="off"
                  required={field === 'apiKey' || field === 'accessToken'}
                  type={field === 'pin' || field === 'password' ? 'password' : 'text'}
                  value={form.credentials[field]}
                  onChange={(event) => updateCredential(field, event.target.value)}
                  placeholder={credentialLabels[field]}
                />
              </label>
            ))}
          </div>

          <button className="primary-button full" disabled={saving} type="submit">
            <Save size={16} /> {saving ? 'Saving...' : 'Save account'}
          </button>
        </div>
      </form>
    </section>
  )
}
