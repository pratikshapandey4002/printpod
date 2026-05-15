import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Payment() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
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
      window.location.href = data.checkoutUrl
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
          OTP will be shown on screen after payment
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
          <span>After paying, press Back and your OTP will appear.</span>
        </div>
      </div>

      <button className="btn btn-success" onClick={handlePay} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Redirecting...' : `Pay ₹${totalAmount} via Dodo`}
      </button>
    </div>
  )
}
