import { useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const KIOSK_ID = 'kiosk-001'

const SCREENS = { IDLE: 'idle', OTP: 'otp', PRINTING: 'printing', SUCCESS: 'success', ERROR: 'error' }

export default function App() {
  const [screen, setScreen] = useState(SCREENS.IDLE)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [jobInfo, setJobInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleNum = (n) => {
    if (otp.length >= 6) return
    setError('')
    setOtp(prev => prev + n)
  }

  const handleDelete = () => setOtp(prev => prev.slice(0, -1))

  const handleClear = () => { setOtp(''); setError('') }

  const handleVerify = async () => {
    if (otp.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${API}/otp/verify`, { otp, kioskId: KIOSK_ID })
      if (!data.success) throw new Error(data.error)
      setJobInfo(data)
      setScreen(SCREENS.PRINTING)
      setTimeout(() => setScreen(SCREENS.SUCCESS), 4000)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setScreen(SCREENS.IDLE)
    setOtp('')
    setError('')
    setJobInfo(null)
  }

  if (screen === SCREENS.IDLE) return (
    <div className="screen">
      <div className="logo">
        <h1>🖨 PrintPod</h1>
        <p>Smart Cloud Printing Kiosk</p>
      </div>
      <div className="status-card">
        <div className="status-icon">📱</div>
        <div className="status-title">Ready to Print</div>
        <div className="status-sub">
          Scan the QR code on your phone<br />
          Upload your document and get an OTP<br />
          Then tap below to enter your OTP
        </div>
      </div>
      <button className="print-btn" onClick={() => setScreen(SCREENS.OTP)}>
        Enter OTP to Print
      </button>
    </div>
  )

  if (screen === SCREENS.OTP) return (
    <div className="screen">
      <div className="logo">
        <h1>🖨 PrintPod</h1>
      </div>

      <div style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>Enter your 6-digit OTP</div>
      <div className="hint">Check your phone or web portal for the OTP</div>

      <div className="otp-display">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`otp-digit ${i < otp.length ? 'filled' : ''} ${i === otp.length ? 'active' : ''}`}>
            {otp[i] || ''}
          </div>
        ))}
      </div>

      <div className="error-text">{error}</div>

      <div className="numpad" style={{ marginTop: 16 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} className="num-btn" onClick={() => handleNum(String(n))}>{n}</button>
        ))}
        <button className="num-btn delete" onClick={handleClear}>CLR</button>
        <button className="num-btn zero" onClick={() => handleNum('0')}>0</button>
        <button className="num-btn delete" onClick={handleDelete}>⌫</button>
      </div>

      <button
        className="print-btn"
        onClick={handleVerify}
        disabled={otp.length !== 6 || loading}
        style={{ marginTop: 24 }}
      >
        {loading ? 'Verifying...' : '🖨 Print Now'}
      </button>

      <button onClick={reset}
        style={{ background:'none', border:'none', color:'#64748b',
          fontSize:14, marginTop:16, cursor:'pointer' }}>
        ← Back
      </button>
    </div>
  )

  if (screen === SCREENS.PRINTING) return (
    <div className="screen">
      <div className="logo"><h1>🖨 PrintPod</h1></div>
      <div className="status-card">
        <div className="status-icon">⚙️</div>
        <div className="status-title">Printing...</div>
        <div className="status-sub">
          Please wait while your document is being printed.<br />
          Do not leave the kiosk.
        </div>
        <div className="progress-bar">
          <div className="progress-fill" />
        </div>
      </div>
    </div>
  )

  if (screen === SCREENS.SUCCESS) return (
    <div className="screen">
      <div className="logo"><h1>🖨 PrintPod</h1></div>
      <div className="status-card">
        <div className="status-icon">✅</div>
        <div className="status-title">Print Complete!</div>
        <div className="status-sub">
          Your document has been printed.<br />
          Please collect it from the tray below.
        </div>
      </div>
      <button className="print-btn" onClick={reset}>
        Done — Back to Home
      </button>
    </div>
  )

  return null
}
