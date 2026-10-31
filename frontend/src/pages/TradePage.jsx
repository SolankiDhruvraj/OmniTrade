import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, RefreshCcw, Search, Send, ShieldAlert, Trash2, X } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { CustomSelect } from '../components/CustomSelect.jsx'

const sideOptions = [
  { value: 1, label: 'Buy' },
  { value: -1, label: 'Sell' },
]

const typeOptions = [
  { value: 2, label: 'Market' },
  { value: 1, label: 'Limit' },
  { value: 3, label: 'Stop' },
  { value: 4, label: 'Stop limit' },
]

const productTypeOptions = [
  { value: 'INTRADAY', label: 'INTRADAY (MIS)' },
  { value: 'MARGIN', label: 'MARGIN (NRML)' },
  { value: 'CNC', label: 'CNC (Delivery)' },
]

const validityOptions = [
  { value: 'DAY', label: 'DAY' },
  { value: 'IOC', label: 'IOC' },
]

const defaultOrder = {
  symbol: '',
  qty: 1,
  type: 2,
  side: 1,
  productType: 'INTRADAY',
  limitPrice: 0,
  stopPrice: 0,
  validity: 'DAY',
  disclosedQty: 0,
  offlineOrder: false,
}

const orderTypeLabel = {
  1: 'Limit',
  2: 'Market',
  3: 'Stop',
  4: 'Stop limit',
}

const getChainRows = (chain) => {
  const source = chain?.data || chain
  if (Array.isArray(source)) return source
  if (Array.isArray(source?.optionsChain)) return source.optionsChain
  if (Array.isArray(source?.options_chain)) return source.options_chain
  if (Array.isArray(source?.chain)) return source.chain
  return []
}

const getChainSymbol = (row) => row.symbol || row.fyToken || row.call_symbol || row.put_symbol || ''

export const TradePage = () => {
  const [accounts, setAccounts] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [accountMultipliers, setAccountMultipliers] = useState({})
  const [accountFunds, setAccountFunds] = useState({})
  const [loadingFunds, setLoadingFunds] = useState(false)
  const [query, setQuery] = useState('')
  const [instruments, setInstruments] = useState([])
  const [searchMeta, setSearchMeta] = useState(null)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [order, setOrder] = useState(defaultOrder)
  const [basket, setBasket] = useState([])
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [optionChain, setOptionChain] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedAccountObjects = useMemo(
    () => accounts.filter((account) => selectedAccounts.includes(account.id)),
    [accounts, selectedAccounts],
  )

  const chainRows = useMemo(() => getChainRows(optionChain), [optionChain])
  const activeOrders = basket.length > 0 ? basket : order.symbol ? [order] : []

  const loadAccounts = async () => {
    const data = await apiRequest('/broker-accounts')
    setAccounts(data.accounts)
    setSelectedAccounts((current) => current.filter((id) => data.accounts.some((account) => account.id === id && (account.broker === 'fyers' || account.broker === 'zerodha'))))

    // Automatically load funds & margin for accounts
    setLoadingFunds(true)
    apiRequest('/broker-accounts/funds')
      .then((fundsRes) => {
        const fundsMap = {}
        ;(fundsRes.accounts || []).forEach((item) => {
          fundsMap[item.brokerAccountId] = item.funds
        })
        setAccountFunds(fundsMap)
      })
      .catch(() => {})
      .finally(() => setLoadingFunds(false))
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadAccounts().catch((err) => setError(err.message))
    })
  }, [])

  const resetConfirmation = () => {
    setPreview(null)
    setResult(null)
  }

  const syncInstruments = async () => {
    setError('')
    setSyncMessage('')
    setSyncProgress({ stage: 'queued', processed: 0, total: 0 })
    setSyncing(true)
    try {
      const queuedJob = await apiRequest('/instruments/sync/fyers', { method: 'POST' })
      let status

      for (let attempt = 0; attempt < 300; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 1000))
        status = await apiRequest(`/instruments/sync/fyers/${encodeURIComponent(queuedJob.jobId)}`)
        setSyncProgress(status.progress || { stage: status.status, processed: 0, total: 0 })

        if (status.status === 'completed') break
        if (status.status === 'failed') throw new Error(status.error || 'Fyers instrument sync failed')
      }

      if (status?.status !== 'completed') {
        throw new Error('Instrument sync is still running. Please try again shortly.')
      }

      if (query) await searchInstruments()
      setSyncMessage(`Synced ${status.result?.total || 0} F&O instruments.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleQueryChange = (val) => {
    setQuery(val)
    if (!val.trim()) {
      setInstruments([])
      setSearchMeta(null)
      setError('')
    }
  }

  const clearSearch = () => {
    setQuery('')
    setInstruments([])
    setSearchMeta(null)
    setError('')
  }

  const searchInstruments = async (event) => {
    event?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setSyncMessage('')
    try {
      const data = await apiRequest(`/instruments/search?q=${encodeURIComponent(query.trim())}&broker=fyers`)
      setInstruments(data.instruments)
      setSearchMeta(data.meta)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectInstrument = (instrument) => {
    setOrder((current) => ({ ...current, symbol: instrument.symbol, qty: instrument.lotSize || current.qty }))
    resetConfirmation()
  }

  const selectChainRow = (row) => {
    const symbol = getChainSymbol(row)
    if (!symbol) return
    setOrder((current) => ({
      ...current,
      symbol,
      qty: Number(row.lotSize || row.lot_size || current.qty || 1),
    }))
    resetConfirmation()
  }

  const loadOptionChain = async () => {
    const accountId = selectedAccounts[0]
    if (!accountId || !order.symbol) {
      setError('Select one linked account and a symbol before loading option chain')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest(`/instruments/option-chain?broker=fyers&accountId=${accountId}&symbol=${encodeURIComponent(order.symbol)}`)
      setOptionChain(data.chain)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateOrder = (field, value) => {
    setOrder((current) => ({ ...current, [field]: value }))
    resetConfirmation()
  }

  const addLeg = () => {
    if (!order.symbol) {
      setError('Select or enter a F&O symbol before adding a leg')
      return
    }
    setBasket((current) => [...current, { ...order }])
    setOrder(defaultOrder)
    setError('')
    resetConfirmation()
  }

  const removeLeg = (index) => {
    setBasket((current) => current.filter((_, legIndex) => legIndex !== index))
    resetConfirmation()
  }

  const toggleAccount = (id) => {
    setSelectedAccounts((current) => (
      current.includes(id) ? current.filter((accountId) => accountId !== id) : [...current, id]
    ))
    resetConfirmation()
  }

  const previewOrder = async (event) => {
    event.preventDefault()
    setError('')
    setResult(null)

    if (activeOrders.length === 0) {
      setError('Add at least one F&O order to preview')
      return
    }

    try {
      const data = await apiRequest('/orders/preview', {
        method: 'POST',
        body: JSON.stringify({
          brokerAccountIds: selectedAccounts,
          orders: activeOrders,
          accountMultipliers,
        }),
      })
      setPreview(data.batch)
    } catch (err) {
      setError(err.message)
    }
  }

  const confirmOrder = async () => {
    if (!preview) return
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest(`/orders/${preview._id}/confirm`, { method: 'POST' })
      setResult(data)
      setPreview(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="trade-grid">
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h1>F&O basket</h1>
            <p>Search options and futures, build multiple legs, then place them across selected accounts.</p>
          </div>
          <button className="secondary-button" disabled={syncing || loading} onClick={syncInstruments} type="button">
            <RefreshCcw className={syncing ? 'sync-icon spinning' : 'sync-icon'} size={16} /> {syncing ? 'Syncing F&O...' : 'Sync F&O'}
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {syncMessage && <div className="alert success">{syncMessage}</div>}
        {syncing && (
          <div className="sync-progress" role="status" aria-live="polite">
            <div className="sync-progress-heading">
              <strong>{syncProgress?.stage === 'queued' ? 'Queued' : 'Updating F&O instruments'}</strong>
              {syncProgress?.total > 0 && <span>{Math.round((syncProgress.processed / syncProgress.total) * 100)}%</span>}
            </div>
            <progress
              max="100"
              value={syncProgress?.total > 0 ? (syncProgress.processed / syncProgress.total) * 100 : 0}
              aria-label="F&O instrument sync progress"
            />
            {syncProgress?.total > 0 && (
              <small>{syncProgress.processed.toLocaleString()} of {syncProgress.total.toLocaleString()} rows processed</small>
            )}
          </div>
        )}

        <div className="panel">
          <form className="search-bar" onSubmit={searchInstruments}>
            <Search size={18} />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Search NIFTY, RELIANCE, CE, PE, FUT..."
                style={{ paddingRight: query ? '32px' : '12px' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
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
            <button className="primary-button" disabled={loading || !query.trim()} type="submit">
              {loading ? (
                <>
                  <Loader2 className="spinning" size={15} /> Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </form>

          <div className="results-list">
            {loading && (
              <div className="center-state compact" style={{ minHeight: '120px' }}>
                <Loader2 className="spinning" size={24} style={{ color: 'var(--kite-blue)' }} />
                <span>Searching symbols for "{query}"...</span>
              </div>
            )}
            {!loading && instruments.map((instrument) => (
              <button className={order.symbol === instrument.symbol ? 'instrument-row selected' : 'instrument-row'} key={instrument._id} onClick={() => selectInstrument(instrument)} type="button">
                <span>
                  <strong>{instrument.symbol}</strong>
                  <small>{instrument.name || instrument.underlying}</small>
                </span>
                <span>{instrument.optionType || instrument.instrumentType || 'FUT'}</span>
                <span>{instrument.lotSize ? `Lot ${instrument.lotSize}` : ''}</span>
              </button>
            ))}
            {!loading && searchMeta && instruments.length === 0 && (
              <div className="empty-state compact">
                <strong>{searchMeta.hasCache ? 'No matching F&O contracts' : 'Sync F&O first'}</strong>
                <span>
                  {searchMeta.hasCache
                    ? `No cached Fyers F&O instruments matched "${searchMeta.query}".`
                    : 'No Fyers F&O instruments are cached yet. Press Sync F&O, then search again.'}
                </span>
              </div>
            )}
            {!loading && !searchMeta && instruments.length === 0 && (
              <div className="empty-state compact">
                <strong>Search options or futures</strong>
                <span>Try RELIANCE FUT, NIFTY CE, BANKNIFTY PE, or expiry fragments after syncing F&O.</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="section-title">
            <h2>Linked accounts</h2>
            <button className="ghost-button" onClick={loadAccounts} type="button"><RefreshCcw size={14} /> Refresh</button>
          </div>
          {accounts.length === 0 ? (
            <div className="empty-state compact">Connect a Fyers or Zerodha account from the Accounts page.</div>
          ) : (
            <div className="checkbox-grid">
              {accounts.map((account) => {
                const isSelected = selectedAccounts.includes(account.id)
                const funds = accountFunds[account.id]
                const multiplier = accountMultipliers[account.id] || 1

                return (
                  <div
                    key={account.id}
                    className={`check-card ${isSelected ? 'selected' : ''}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', width: '100%' }}>
                      <input
                        checked={isSelected}
                        onChange={() => toggleAccount(account.id)}
                        type="checkbox"
                      />
                      <div className="check-card-body" style={{ flex: 1 }}>
                        <div className="check-card-top">
                          <strong className="check-card-title">{account.displayName}</strong>
                          <span className="check-card-broker-badge">{account.broker}</span>
                        </div>
                        <small className="check-card-id">{account.accountId}</small>
                      </div>
                    </label>

                    {/* Funds & Smart Multiplier Controls */}
                    <div
                      style={{
                        paddingTop: 8,
                        marginTop: 4,
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ color: '#555' }}>
                        <span style={{ color: '#888' }}>Margin: </span>
                        <strong>
                          {funds ? `₹${Math.round(funds.availableMargin || funds.availableCash || 0).toLocaleString('en-IN')}` : (loadingFunds ? '...' : '—')}
                        </strong>
                      </div>

                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#888', fontSize: 11 }}>Multiplier:</span>
                          <select
                            value={multiplier}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 1
                              setAccountMultipliers((prev) => ({ ...prev, [account.id]: val }))
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 4,
                              border: '1px solid #ccc',
                              background: '#fff',
                            }}
                          >
                            <option value={1}>1×</option>
                            <option value={2}>2×</option>
                            <option value={3}>3×</option>
                            <option value={4}>4×</option>
                            <option value={5}>5×</option>
                            <option value={10}>10×</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {optionChain && (
          <div className="panel option-chain">
            <div className="section-title">
              <h2>Option chain</h2>
              <span className="badge">{chainRows.length || 'Raw'} rows</span>
            </div>
            {chainRows.length > 0 ? (
              <div className="chain-grid">
                {chainRows.slice(0, 80).map((row, index) => (
                  <button className="chain-row" key={`${getChainSymbol(row)}-${index}`} onClick={() => selectChainRow(row)} type="button">
                    <strong>{getChainSymbol(row) || row.strike_price || row.strike || 'Contract'}</strong>
                    <span>{row.option_type || row.optionType || row.type || ''}</span>
                    <span>{row.ltp || row.last_price || row.price || ''}</span>
                  </button>
                ))}
              </div>
            ) : (
              <pre>{JSON.stringify(optionChain?.data || optionChain, null, 2)}</pre>
            )}
          </div>
        )}
      </div>

      <aside className="ticket-column">
        <form className="panel order-ticket" onSubmit={previewOrder}>
          <h2>Order leg</h2>
          <label>
            Symbol
            <input value={order.symbol} onChange={(event) => updateOrder('symbol', event.target.value)} placeholder='e.g. NIFTY24OCT24500CE or select from search'/>
          </label>
          <div className="two-col">
            <label>
              Side
              <CustomSelect
                onChange={(val) => updateOrder('side', Number(val))}
                options={sideOptions}
                value={order.side}
              />
            </label>
            <label>
              Type
              <CustomSelect
                onChange={(val) => updateOrder('type', Number(val))}
                options={typeOptions}
                value={order.type}
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Quantity
              <input min="1" type="number" value={order.qty} onChange={(event) => updateOrder('qty', Number(event.target.value))} />
            </label>
            <label>
              Product
              <CustomSelect
                onChange={(val) => updateOrder('productType', val)}
                options={productTypeOptions}
                value={order.productType}
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Limit price
              <input min="0" step="0.05" type="number" value={order.limitPrice} onChange={(event) => updateOrder('limitPrice', Number(event.target.value))} />
            </label>
            <label>
              Stop price
              <input min="0" step="0.05" type="number" value={order.stopPrice} onChange={(event) => updateOrder('stopPrice', Number(event.target.value))} />
            </label>
          </div>
          <label>
            Validity
            <CustomSelect
              onChange={(val) => updateOrder('validity', val)}
              options={validityOptions}
              value={order.validity}
            />
          </label>

          <div className="two-col">
            <button className="secondary-button full" onClick={loadOptionChain} type="button">Option chain</button>
            <button className="secondary-button full" onClick={addLeg} type="button"><Plus size={16} /> Add leg</button>
          </div>

          <button className="primary-button full" disabled={selectedAccounts.length === 0 || activeOrders.length === 0} type="submit">
            <ShieldAlert size={16} /> Preview basket
          </button>
        </form>

        <div className="panel basket-panel">
          <div className="section-title">
            <h2>Basket</h2>
            <span className="badge">{activeOrders.length} leg{activeOrders.length === 1 ? '' : 's'}</span>
          </div>
          {basket.length === 0 ? (
            <div className="empty-state compact">Add multiple F&O legs, or preview the current symbol as a single-leg basket.</div>
          ) : (
            <div className="basket-list">
              {basket.map((leg, index) => (
                <div className="basket-row" key={`${leg.symbol}-${index}`}>
                  <span>
                    <strong>{leg.side === 1 ? 'BUY' : 'SELL'} {leg.qty} {leg.symbol}</strong>
                    <small>{orderTypeLabel[leg.type]} · {leg.productType}</small>
                  </span>
                  <button className="icon-button danger" onClick={() => removeLeg(index)} type="button" title="Remove leg"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {preview && (
          <div className="panel confirm-panel">
            <h2>Confirm live basket</h2>
            <p>This will send {preview.orders?.length || activeOrders.length} order{(preview.orders?.length || activeOrders.length) === 1 ? '' : 's'} to {selectedAccountObjects.length} linked account{selectedAccountObjects.length === 1 ? '' : 's'}.</p>
            <div className="summary-box">
              <strong>{(preview.orders?.length || activeOrders.length) * selectedAccountObjects.length} broker request{((preview.orders?.length || activeOrders.length) * selectedAccountObjects.length) === 1 ? '' : 's'}</strong>
              <span>Queued through Redis/BullMQ and processed in parallel.</span>
              <span>The same order details and limit price are sent to each account. Market-order fill prices can differ.</span>
            </div>
            <button className="danger-button full" disabled={loading} onClick={confirmOrder} type="button">
              <Send size={16} /> Confirm and place
            </button>
          </div>
        )}

        {result && (
          <div className="panel">
            <h2>Order result</h2>
            <div className="result-list">
              {result.executions.map((execution) => (
                <div className="result-row" key={execution._id}>
                  <CheckCircle2 size={17} />
                  <span>{execution.broker}</span>
                  <strong className={`status ${execution.status}`}>{execution.status}</strong>
                  {execution.errorMessage && <small>{execution.errorMessage}</small>}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </section>
  )
}
