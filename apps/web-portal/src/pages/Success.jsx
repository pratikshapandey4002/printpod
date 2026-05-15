import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Success() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [otp, setOtp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const jobId = state?.jobId || searchParams.get('jobId')

  useEffect(() => {
    if (!jobId) { navigate('/'); return }

    const fetchOtp = async () => {
      let attempts = 0
      const maxAttempts = 15
      const tryFetch = async () => {
        try {
          const { data } = await axios.get(`${API}/jobs/${jobId}/otp`)
          if (data.success) {
            setOtp(data.otp)
            setLoading(false)
          } else if (attempts < maxAttempts) {
            attempts++
            setTimeout(tryFetch, 2000)
          } else {
            setError('Payment not confirmed yet. Try refreshing.')
            setLoading(false)
          }
        } catch {
          if (attempts < maxAttempts) {
            attempts++
            setTimeout(tryFetch, 2000)
          } else {
            setError('Could not load OTP. Refresh this page.')
            setLoading(false)
          }
        }
      }
      tryFetch()
    }

    fetchOtp()
  }, [jobId, navigate])

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
        <div style={{ color:'#6b7280', fontSize:14 }}>Your document is ready to print</div>
      </div>

      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, color:'#6b7280', marginBottom:8, fontWeight:500 }}>
          YOUR PRINT OTP
        </div>

        {loading ? (
          <div style={{ padding:'20px 0' }}>
            <div style={{
              width:36, height:36, border:'3px solid #e5e7eb',
              borderTopColor:'#2563eb', borderRadius:'50%',
              animation:'spin 0.7s linear infinite', margin:'0 auto'
            }} />
            <div style={{ color:'#6b7280', fontSize:14, marginTop:12 }}>
              Confirming payment...
            </div>
          </div>
        ) : error ? (
          <div>
            <div className="error">{error}</div>
            <button
              className="btn btn-outline"
              onClick={() => window.location.reload()}
              style={{ marginTop:8 }}
            >
              Refresh
            </button>
          </div>
        ) : (
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
        )}
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
