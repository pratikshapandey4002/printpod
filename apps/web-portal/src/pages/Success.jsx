import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Success() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('checking')
  const [otp, setOtp] = useState(state?.otp || null)

  // jobId can come from state (demo flow) or URL param (Dodo redirect)
  const jobId = state?.jobId || searchParams.get('jobId')
  const totalAmount = state?.totalAmount
  const fileName = state?.fileName

  useEffect(() => {
    if (!jobId) { navigate('/'); return }

    // If OTP already in state (demo mode) — no need to poll
    if (state?.otp) { setStatus('ready'); return }

    // Poll for payment confirmation after Dodo redirect
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API}/payment/status/${jobId}`)
        if (data.paymentStatus === 'paid') {
          setStatus('paid')
        } else {
          setTimeout(poll, 2000)
        }
      } catch {
        setTimeout(poll, 3000)
      }
    }
    poll()
  }, [jobId, navigate, state])

  if (!jobId) return null

  const copyOTP = () => {
    if (!otp) return
    navigator.clipboard.writeText(otp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Still waiting for payment confirmation
  if (status === 'checking') return (
    <div className="container">
      <div className="logo"><h1>🖨 PrintPod</h1></div>
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:8 }}>Confirming payment...</div>
        <div style={{ color:'#6b7280', fontSize:14 }}>Please wait a moment</div>
        <div className="progress-bar" style={{ margin:'20px auto 0' }}>
          <div className="progress-fill" />
        </div>
      </div>
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
        <div className="step-dot done" />
        <div className="step-dot active" />
      </div>

      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:6 }}>
          {status === 'paid' ? 'Payment Successful!' : 'Upload Successful!'}
        </div>
        {fileName && <div style={{ color:'#6b7280', fontSize:14 }}>{fileName}</div>}
        {totalAmount && <div style={{ color:'#6b7280', fontSize:14 }}>₹{totalAmount}</div>}
      </div>

      {otp ? (
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
      ) : (
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📱</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>OTP sent to your phone!</div>
          <div style={{ fontSize:14, color:'#6b7280' }}>
            Check your SMS for the 6-digit OTP
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight:600, marginBottom:14 }}>Next steps</div>
        {[
          ['1️⃣', 'Go to the PrintPod kiosk'],
          ['2️⃣', 'Enter the 6-digit OTP'],
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
