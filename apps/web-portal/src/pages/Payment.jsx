import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Payment() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    if (!state?.jobId) navigate('/')
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [state, navigate])

  if (!state?.jobId) return null

  const { jobId, totalAmount, phone, fileName } = state

  const startPolling = () => {
    setPolling(true)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/payment/status/${jobId}`)
        if (data.paymentStatus === 'paid') {
          clearInterval(pollRef.current)
          navigate('/success', { state: { jobId, totalAmount, fileName } })
        }
      } catch {}
    }, 2000)
  }

  const handlePay = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${API}/payment/create-checkout`, { jobId })
      if (!data.success) throw new Error(data.error)
      setCheckoutUrl(data.checkoutUrl)
      // Open Dodo checkout in new tab
      window.open(data.checkoutUrl, '_blank')
      setLoading(false)
      // Start polling for payment confirmation
      startPolling()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Payment failed')
      setLoading(false)
    }
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
        <div className="step-dot active" />
        <div className="step-dot" />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:8 }}>Complete Payment</div>
        <div style={{ color:'#6b7280', fontSize:14, marginBottom:24 }}>
          You will receive an OTP on +91 {phone} after payment
        </div>
        <div className="price-tag">
          <div className="amount">₹{totalAmount}</div>
        </div>
      </div>

      {polling ? (
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Waiting for payment...</div>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
            Complete the payment in the Dodo tab.<br/>
            This page will update automatically.
          </div>
          {checkoutUrl && (
            <button
              onClick={() => window.open(checkoutUrl, '_blank')}
              style={{
                background:'#eff6ff', color:'#2563eb', border:'none',
                borderRadius:8, padding:'8px 20px', fontSize:14,
                fontWeight:600, cursor:'pointer', marginBottom:8
              }}
            >
              Reopen Payment Page
            </button>
          )}
          <div style={{ fontSize:12, color:'#9ca3af' }}>
            Already paid?{' '}
            <span
              style={{ color:'#2563eb', cursor:'pointer' }}
              onClick={async () => {
                try {
                  const { data } = await axios.get(`${API}/payment/status/${jobId}`)
                  if (data.paymentStatus === 'paid') {
                    navigate('/success', { state: { jobId, totalAmount, fileName } })
                  } else {
                    setError('Payment not confirmed yet. Please wait.')
                  }
                } catch {}
              }}
            >
              Check now
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ fontSize:13, color:'#6b7280' }}>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <span>🔒</span>
              <span>Secured by Dodo Payments. Supports UPI, cards, netbanking.</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span>📱</span>
              <span>OTP will be shown on screen after payment.</span>
            </div>
          </div>

          <button className="btn btn-success" onClick={handlePay} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Opening payment...' : `Pay ₹${totalAmount} via Dodo`}
          </button>
        </>
      )}
    </div>
  )
}
