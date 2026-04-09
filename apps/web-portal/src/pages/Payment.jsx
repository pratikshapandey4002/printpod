import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Payment() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!state?.jobId) navigate('/')
  }, [state, navigate])

  if (!state?.jobId) return null

  const { jobId, totalAmount, phone } = state

  const handlePay = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${API}/payment/create-order`, { jobId })
      if (!data.success) throw new Error(data.error)

      const options = {
        key: data.razorpayKeyId,
        amount: data.order.amount,
        currency: 'INR',
        name: 'PrintPod',
        description: 'Document Printing',
        order_id: data.order.id,
        prefill: { contact: phone },
        theme: { color: '#2563eb' },
        handler: async (response) => {
          try {
            await axios.post(`${API}/payment/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              jobId,
            })
            navigate('/success', { state: { jobId, phone } })
          } catch {
            setError('Payment verified but OTP failed. Call support.')
          }
        },
        modal: { ondismiss: () => setLoading(false) }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
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

      <div className="card" style={{ fontSize:13, color:'#6b7280' }}>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <span>🔒</span>
          <span>Secured by Razorpay. Supports UPI, cards, netbanking.</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span>📱</span>
          <span>OTP will be sent to your mobile after payment.</span>
        </div>
      </div>

      <button className="btn btn-success" onClick={handlePay} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Opening payment...' : `Pay ₹${totalAmount}`}
      </button>
    </div>
  )
}
