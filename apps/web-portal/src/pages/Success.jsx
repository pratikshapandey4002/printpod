import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Success() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [otp, setOtp] = useState(state?.otp || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const jobId = state?.jobId || searchParams.get('jobId')
  const totalAmount = state?.totalAmount
  const fileName = state?.fileName

  useEffect(() => {
    if (!jobId) { navigate('/'); return }
    // If coming from Dodo redirect (no otp in state), fetch it
    if (!state?.otp) {
      setLoading(true)
      const fetchOtp = async () => {
        try {
          const { data } = await axios.get(`${API}/jobs/${jobId}/otp`)
          if (data.success) setOtp(data.otp)
          else setError(data.error)
        } catch (err) {
          setError('Could not load OTP. Try again.')
        } finally {
          setLoading(false)
        }
      }
      // Poll until payment is confirmed
      const tryFetch = async () => {
        try {
          const { data } = await axios.get(`${API}/jobs/${jobId}/otp`)
          if (data.success) { setOtp(data.otp); setLoading(false) }
          else setTimeout(tryFetch, 2000)
        } catch { setTimeout(tryFetch, 2000) }
      }
      tryFetch()
    }
  }, [jobId, navigate, state])

  if (!jobId) return null

  const copyOTP = () => {
    navigator.clipboard.writeText(otp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨 PrintPod</h1>
        <p>Smart Cloud Printing</p>
      </div>

      <div className="step-indicator">
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot active" />
      </div>

      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:6 }}>Payment Successful!</div>
        {fileName && <div style={{ color:'#6b7280', fontSize:14 }}>{fileName}</div>}
        {totalAmount && <div style={{ color:'#6b7280', fontSize:14 }}>₹{totalAmount}</div>}
      </div>

      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, color:'#6b7280', marginBottom:8, fontWeight:500 }}>
          YOUR PRINT OTP
        </div>
        {loading ? (
          <div style={{ padding:'20px 0' }}>
            <div className="spinner" style={{ borderColor:'rgba(37,99,235,0.3)', borderTopColor:'#2563eb', width:32, height:32, margin:'0 auto' }} />
            <div style={{ color:'#6b7280', fontSize:14, marginTop:12 }}>Confirming payment...</div>
          </div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : otp ? (
          <>
            <div style={{
              fontSize:52, fontWeight:800, letterSpacing:12,
              color:'#2563eb', fontFamily:'monospace', margin:'12px 0',
            }}>
              {otp}
            </div>
            <button onClick={copyOTP} style={{
              background: copied ? '#16a34a' : '#eff6ff',
              color: copied ? 'white' : '#2563eb',
              border:'none', borderRadius:8, padding:'8px 20px',
              fontSize:14, fontWeight:600, cursor:'pointer',
            }}>
              {copied ? '✓ Copied!' : 'Copy OTP'}
            </button>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:12 }}>
              Expires in 15 minutes
            </div>
          </>
        ) : null}
      </div>

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:14 }}>Next steps</div>
        {[
          ['1️⃣', 'Go to the PrintPod kiosk'],
          ['2️⃣', 'Enter the 6-digit OTP above'],
          ['3️⃣', 'Your document prints instantly'],
          ['4️⃣', 'Collect from the tray'],
        ].map(([icon, text]) => (
          <div key={text} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontSize:14 }}>{text}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-outline" onClick={() => navigate('/')}>
        Print another document
      </button>
    </div>
  )
}
