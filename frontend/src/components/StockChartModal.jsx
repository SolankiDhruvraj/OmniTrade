import { useEffect, useMemo, useRef, useState } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { ExternalLink, Layers, LineChart, Loader2, RefreshCcw, X } from 'lucide-react'
import { apiRequest } from '../api/client.js'

export const parseSymbolDetails = (rawSymbol) => {
  if (!rawSymbol) return { root: 'NIFTY', isIndex: true, nseSymbol: 'NSE:NIFTY' }
  let s = String(rawSymbol).trim().toUpperCase()

  if (s.startsWith('BSE:')) s = s.replace('BSE:', '')
  else if (s.startsWith('NSE:')) s = s.replace('NSE:', '')

  if (s.includes('NIFTY50') || s === 'NIFTY') return { root: 'NIFTY', isIndex: true, nseSymbol: 'NSE:NIFTY' }
  if (s.includes('BANKNIFTY') || s.includes('NIFTYBANK')) return { root: 'BANKNIFTY', isIndex: true, nseSymbol: 'NSE:BANKNIFTY' }
  if (s.includes('FINNIFTY')) return { root: 'FINNIFTY', isIndex: true, nseSymbol: 'NSE:FINNIFTY' }
  if (s.includes('MIDCPNIFTY')) return { root: 'MIDCPNIFTY', isIndex: true, nseSymbol: 'NSE:MIDCPNIFTY' }

  s = s.replace(/-EQ$/, '').replace(/-INDEX$/, '').replace(/-BE$/, '')

  const derivativeMatch = s.match(/^([A-Z]+)\d{2}[A-Z]{3}/)
  if (derivativeMatch && derivativeMatch[1]) {
    s = derivativeMatch[1]
    if (s === 'NIFTY') return { root: 'NIFTY', isIndex: true, nseSymbol: 'NSE:NIFTY' }
    if (s === 'BANKNIFTY') return { root: 'BANKNIFTY', isIndex: true, nseSymbol: 'NSE:BANKNIFTY' }
  }

  return { root: s, isIndex: false, nseSymbol: `NSE:${s}` }
}

const timeframes = [
  { label: '5m', res: '5' },
  { label: '15m', res: '15' },
  { label: '1h', res: '60' },
  { label: '1D', res: 'D' },
]

export const StockChartModal = ({ symbol, initialTab = 'chart', onSelectContract, onClose }) => {
  const chartContainerRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)

  const details = useMemo(() => parseSymbolDetails(symbol), [symbol])

  const [activeTab, setActiveTab] = useState(initialTab) // 'chart' | 'chain'
  const [resolution, setResolution] = useState('D')

  // Candle data state
  const [candles, setCandles] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState('')

  // Option chain state
  const [optionChain, setOptionChain] = useState(null)
  const [chainLoading, setChainLoading] = useState(false)
  const [chainError, setChainError] = useState('')

  // Fetch native historical candles from Fyers API
  const fetchCandles = async (res = resolution) => {
    setChartLoading(true)
    setChartError('')
    try {
      const data = await apiRequest(`/instruments/candles?symbol=${encodeURIComponent(symbol)}&resolution=${res}&broker=fyers`)
      setCandles(data.candles || [])
    } catch (err) {
      setChartError(err.message || 'Unable to load candles from Fyers')
    } finally {
      setChartLoading(false)
    }
  }

  // Fetch option chain
  const fetchOptionChain = async () => {
    setChainLoading(true)
    setChainError('')
    try {
      const data = await apiRequest(`/instruments/option-chain?symbol=${encodeURIComponent(details.root)}&broker=fyers`)
      setOptionChain(data.chain)
    } catch (err) {
      setChainError(err.message || 'Unable to fetch option chain')
    } finally {
      setChainLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'chart') {
      fetchCandles(resolution)
    } else if (activeTab === 'chain' && !optionChain && !chainLoading) {
      fetchOptionChain()
    }
  }, [activeTab, resolution, symbol])

  // Initialize and render Lightweight Charts HTML5 Canvas
  useEffect(() => {
    if (activeTab !== 'chart' || !chartContainerRef.current) return

    // Clean up old chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove()
      chartInstanceRef.current = null
    }

    const container = chartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth || 900,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155',
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: 1, // Magnet mode
      },
      timeScale: {
        borderColor: '#cbd5e1',
        timeVisible: resolution !== 'D',
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#cbd5e1',
        autoScale: true,
      },
    })

    // Candlestick series (Up is Kite Green, Down is Kite Red)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    // Volume histogram at the bottom
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#cbd5e1',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartInstanceRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Handle responsive resizing
    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove()
        chartInstanceRef.current = null
      }
    }
  }, [activeTab, resolution])

  // Feed candles and volume data to the canvas chart
  useEffect(() => {
    if (!candles.length || !candleSeriesRef.current || !chartInstanceRef.current) return

    // Sort by timestamp
    const sorted = [...candles].sort((a, b) => a.time - b.time)

    // Filter duplicates
    const unique = []
    let lastTime = 0
    for (const c of sorted) {
      if (c.time > lastTime) {
        unique.push(c)
        lastTime = c.time
      }
    }

    candleSeriesRef.current.setData(unique)

    if (volumeSeriesRef.current) {
      const volData = unique.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
      }))
      volumeSeriesRef.current.setData(volData)
    }

    chartInstanceRef.current.timeScale().fitContent()
  }, [candles])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Process Option Chain
  const chainLadder = useMemo(() => {
    const source = optionChain?.data?.optionsChain || optionChain?.data || optionChain?.optionsChain || []
    if (!Array.isArray(source) || !source.length) return { ladder: [], spotPrice: null, atmStrike: null }

    const strikesMap = new Map()
    let spotPrice = null

    for (const row of source) {
      const strike = Number(row.strike_price ?? row.strike)
      const optType = String(row.option_type || row.optionType || row.type || '').toUpperCase()

      if (strike === -1 || !optType) {
        if (row.ltp || row.fp || row.last_price) spotPrice = Number(row.ltp || row.fp || row.last_price)
        continue
      }

      if (!strikesMap.has(strike)) {
        strikesMap.set(strike, { strike, call: null, put: null })
      }
      const strikeObj = strikesMap.get(strike)
      if (optType === 'CE' || optType === 'CALL') strikeObj.call = row
      else if (optType === 'PE' || optType === 'PUT') strikeObj.put = row
    }

    const sorted = Array.from(strikesMap.values()).sort((a, b) => a.strike - b.strike)
    let atmStrike = null
    if (spotPrice && sorted.length > 0) {
      let minDiff = Infinity
      for (const item of sorted) {
        const diff = Math.abs(item.strike - spotPrice)
        if (diff < minDiff) {
          minDiff = diff
          atmStrike = item.strike
        }
      }
    } else if (sorted.length > 0) {
      atmStrike = sorted[Math.floor(sorted.length / 2)].strike
    }

    return { ladder: sorted, spotPrice, atmStrike }
  }, [optionChain])

  const latestCandle = candles[candles.length - 1]

  return (
    <div
      className="stock-chart-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="stock-chart-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: '1100px',
          height: '85vh',
          maxHeight: '750px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        {/* Modal Header */}
        <div
          className="stock-chart-modal-header"
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{symbol}</strong>
              {latestCandle && activeTab === 'chart' && (
                <span style={{ fontSize: '12px', marginLeft: '8px', fontWeight: 600, color: latestCandle.close >= latestCandle.open ? '#26a69a' : '#ef5350' }}>
                  ₹{latestCandle.close.toFixed(2)}
                </span>
              )}
            </div>

            {/* View Mode Tabs: Chart vs Option Chain */}
            <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '5px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: activeTab === 'chart' ? '#ffffff' : 'transparent',
                  color: activeTab === 'chart' ? 'var(--kite-blue)' : '#64748b',
                  boxShadow: activeTab === 'chart' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <LineChart size={13} /> Chart
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chain')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: activeTab === 'chain' ? '#ffffff' : 'transparent',
                  color: activeTab === 'chain' ? 'var(--kite-blue)' : '#64748b',
                  boxShadow: activeTab === 'chain' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Layers size={13} /> Chain
              </button>
            </div>

            {/* Resolution Timeframe Buttons */}
            {activeTab === 'chart' && (
              <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '4px' }}>
                {timeframes.map((tf) => (
                  <button
                    key={tf.res}
                    type="button"
                    onClick={() => setResolution(tf.res)}
                    style={{
                      padding: '2px 7px',
                      fontSize: '10px',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: resolution === tf.res ? '#ffffff' : 'transparent',
                      color: resolution === tf.res ? 'var(--kite-blue)' : '#64748b',
                      boxShadow: resolution === tf.res ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="ghost-button"
              onClick={() => {
                if (activeTab === 'chart') fetchCandles(resolution)
                else fetchOptionChain()
              }}
              style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Refresh chart data"
              type="button"
            >
              <RefreshCcw size={12} className={chartLoading || chainLoading ? 'spinning' : ''} />
            </button>
            <a
              href={`https://in.tradingview.com/chart/?symbol=${encodeURIComponent(details.nseSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ghost-button"
              style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Open on TradingView.com"
            >
              <ExternalLink size={13} /> <span className="external-link-text">TradingView</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="icon-button"
              style={{ minHeight: '30px', width: '30px', padding: 0 }}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {activeTab === 'chart' ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {chartLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.7)',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  <Loader2 className="spinning" size={20} color="var(--kite-blue)" />
                  Loading Fyers live candles...
                </div>
              )}

              {chartError && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="alert error" style={{ maxWidth: '500px', margin: '0 auto 12px' }}>
                    {chartError}
                  </div>
                  <button className="secondary-button" onClick={() => fetchCandles(resolution)} type="button">
                    <RefreshCcw size={14} /> Retry
                  </button>
                </div>
              )}

              <div
                ref={chartContainerRef}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
              {chainLoading ? (
                <div className="center-state" style={{ minHeight: '300px' }}>
                  <Loader2 className="spinning" size={26} style={{ color: 'var(--kite-blue)' }} />
                  <span>Loading live option chain for {details.root}...</span>
                </div>
              ) : chainError ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div className="alert error" style={{ maxWidth: '500px', margin: '0 auto 12px' }}>
                    {chainError}
                  </div>
                  <button className="secondary-button" onClick={fetchOptionChain} type="button">
                    <RefreshCcw size={14} /> Retry
                  </button>
                </div>
              ) : chainLadder.ladder.length > 0 ? (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <div className="kite-option-chain-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                    <div className="kite-chain-scroll" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                      <table className="kite-chain-table">
                        <thead>
                          <tr>
                            <th colSpan={3} className="side-calls">CALLS (CE)</th>
                            <th className="strike-header">STRIKE</th>
                            <th colSpan={3} className="side-puts">PUTS (PE)</th>
                          </tr>
                          <tr>
                            <th style={{ textAlign: 'right' }}>OI</th>
                            <th style={{ textAlign: 'right' }}>Chg%</th>
                            <th style={{ textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>LTP</th>
                            <th style={{ textAlign: 'center', background: '#e2e8f0', color: '#0f172a' }}>Strike</th>
                            <th style={{ textAlign: 'left', borderLeft: '1px solid #cbd5e1' }}>LTP</th>
                            <th style={{ textAlign: 'left' }}>Chg%</th>
                            <th style={{ textAlign: 'left' }}>OI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chainLadder.ladder.map(({ strike, call, put }) => {
                            const isAtm = strike === chainLadder.atmStrike
                            const callLtp = call?.ltp ?? call?.last_price ?? call?.price
                            const callChg = call?.chp ?? call?.change_percent ?? call?.ch
                            const callOi = call?.oi ?? call?.open_interest

                            const putLtp = put?.ltp ?? put?.last_price ?? put?.price
                            const putChg = put?.chp ?? put?.change_percent ?? put?.ch
                            const putOi = put?.oi ?? put?.open_interest

                            return (
                              <tr key={`modal-strike-${strike}`} className={isAtm ? 'atm-row' : ''}>
                                <td>{callOi ? Number(callOi).toLocaleString('en-IN') : '—'}</td>
                                <td className={callChg > 0 ? 'positive-value' : callChg < 0 ? 'negative-value' : ''}>
                                  {callChg !== undefined && callChg !== null ? `${Number(callChg).toFixed(2)}%` : '—'}
                                </td>
                                <td
                                  className={`calls-ltp ${call && onSelectContract ? 'clickable-cell' : ''}`}
                                  onClick={() => {
                                    if (call && onSelectContract) {
                                      onSelectContract(call)
                                      onClose()
                                    }
                                  }}
                                  title={call ? `Select ${call.symbol || call.fyToken || ''} (Call)` : ''}
                                >
                                  {callLtp !== undefined && callLtp !== null ? `₹${callLtp}` : '—'}
                                </td>

                                <td className="strike-cell">
                                  {strike.toLocaleString('en-IN')}
                                  {isAtm && <span style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#a16207' }}>ATM</span>}
                                </td>

                                <td
                                  className={`puts-ltp ${put && onSelectContract ? 'clickable-cell' : ''}`}
                                  onClick={() => {
                                    if (put && onSelectContract) {
                                      onSelectContract(put)
                                      onClose()
                                    }
                                  }}
                                  title={put ? `Select ${put.symbol || put.fyToken || ''} (Put)` : ''}
                                >
                                  {putLtp !== undefined && putLtp !== null ? `₹${putLtp}` : '—'}
                                </td>
                                <td className={`puts-cell ${putChg > 0 ? 'positive-value' : putChg < 0 ? 'negative-value' : ''}`}>
                                  {putChg !== undefined && putChg !== null ? `${Number(putChg).toFixed(2)}%` : '—'}
                                </td>
                                <td className="puts-cell">{putOi ? Number(putOi).toLocaleString('en-IN') : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <strong>No option chain data available for {details.root}</strong>
                  <span>This instrument might not have active exchange-traded options.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
