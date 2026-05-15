import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Payment() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [step, setStep] = useState('pay') // pay | waiting | otp
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otp, setOtp] = useState(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!state?.jobId) navigate('/')
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [state, navigate])

  if (!state?.jobId) return null

  const { jobId, totalAmount, fileName } = state

  const startPolling = () => {
    setStep('waiting')
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const { data } = await axios.get(`${API}/payment/status/${jobId}`)
        if (data.paymentStatus === 'paid') {
          clearInterval(pollRef.current)
          // Fetch OTP
          const otpRes = await axios.get(`${API}/jobs/${jobId}/otp`)
          if (otpRes.data.success) {
            setOtp(otpRes.data.otp)
            setStep('otp')
          }
        }
      } catch {}
      if (attempts > 150) { // 5 minutes
        clearInterval(pollRef.current)
        setError('Payment not confirmed. Please contact support.')
        setStep('pay')
      }
    }, 2000)
  }

  const handlePay = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${API}/payment/create-checkout`, { jobId })
      if (!data.success) throw new Error(data.error)
      // Start polling BEFORE redirecting
      startPolling()
      // Small delay then redirect
      setTimeout(() => {
        window.location.href = data.checkoutUrl
      }, 300)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Payment failed')
      setLoading(false)
    }
  }

  const copyOTP = () => {
    navigator.clipboard.writeText(otp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // After paying and pressing back, resume polling
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && step === 'waiting') {
        // User came back - check immediately
        axios.get(`${API}/payment/status/${jobId}`).then(async ({ data }) => {
          if (data.paymentStatus === 'paid') {
            clearInterval(pollRef.current)
            const otpRes = await axios.get(`${API}/jobs/${jobId}/otp`)
            if (otpRes.data.success) {
              setOtp(otpRes.data.otp)
              setStep('otp')
            }
          }
        }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [step, jobId])

  if (step === 'otp') return (
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
        <div style={{ color:'#6b7280', fontSize:14 }}>{fileName}</div>
      </div>
      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, color:'#6b7280', marginBottom:8, fontWeight:500 }}>
          YOUR PRINT OTP
        </div>
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

  if (step === 'waiting') return (
    <div className="container">
      <div className="logo">
        <h1>🖨 PrintPod</h1>
        <p>Smart Cloud Printing</p>
      </div>
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:8 }}>
          Complete your payment
        </div>
        <div style={{ color:'#6b7280', fontSize:14, marginBottom:24, lineHeight:1.6 }}>
          Pay on the Dodo page, then press<br/>
          <strong>Back</strong> to return here and get your OTP
        </div>
        <div style={{
          background:'#f0fdf4', border:'1px solid #bbf7d0',
          borderRadius:12, padding:16, marginBottom:16
        }}>
          <div style={{ color:'#16a34a', fontWeight:600, fontSize:14 }}>
            ✓ This page is waiting for your payment
          </div>
          <div style={{ color:'#6b7280', fontSize:13, marginTop:4 }}>
            OTP will appear automatically after payment
          </div>
        </div>
        <div style={{
          width:40, height:40, border:'3px solid #e5e7eb',
          borderTopColor:'#2563eb', borderRadius:'50%',
          animation:'spin 0.7s linear infinite', margin:'0 auto'
        }} />
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  )

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨 PrintPod</h1>
        <p>Smart Cloud Printing</p>
      </div>
      <div className="step-indicator">
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot active" />
        <div className="step-dot" />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:8 }}>Complete Payment</div>
        <div style={{ color:'#6b7280', fontSize:14, marginBottom:24 }}>
          OTP will appear on this screen after payment
        </div>
        <div className="price-tag">
          <div className="amount">₹{totalAmount}</div>
        </div>
      </div>
      <div className="card" style={{ fontSize:13, color:'#6b7280' }}>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <span>🔒</span>
          <span>Secured by Dodo Payments. UPI, cards, netbanking.</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span>📋</span>
          <span>After paying, press Back — your OTP will show here.</span>
        </div>
      </div>
      <button className="btn btn-success" onClick={handlePay} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Loading...' : `Pay ₹${totalAmount} via Dodo`}
      </button>
    </div>
  )
}
