import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function PaymentPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState(null)

  if (!state?.file) {
    navigate('/')
    return null
  }

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('phone', state.phone)
      formData.append('copies', state.copies)
      formData.append('color', state.color)
      formData.append('sides', state.sides)
      formData.append('paperSize', state.paperSize)
      formData.append('pageCount', state.pageCount)

      const { data: uploadData } = await axios.post(`${API}/jobs/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed')

      const createdJobId = uploadData.jobId
      setJobId(createdJobId)

      const { data: orderData } = await axios.post(`${API}/payment/create-order`, {
        jobId: createdJobId
      })

      if (!orderData.success) throw new Error(orderData.error || 'Order creation failed')

      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'PrintPod',
        description: `Print job – ${state.file.name}`,
        order_id: orderData.razorpayOrderId,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post(`${API}/payment/verify`, {
              jobId: createdJobId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            if (verifyData.success) {
              navigate('/success', { state: { otp: verifyData.otp, jobId: createdJobId, ...state } })
            } else {
              setError('Payment verification failed. Contact support.')
            }
          } catch {
            setError('Payment verification failed. Please try again.')
          }
          setLoading(false)
        },
        prefill: { contact: state.phone },
        theme: { color: '#2563eb' },
        modal: { ondismiss: () => setLoading(false) }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨️ PrintPod</h1>
        <p>Review & Pay</p>
      </div>

      <div className="step-indicator">
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot active" />
        <div className="step-dot" />
      </div>

      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>Order Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>File</span>
            <span style={{ fontWeight: 500, maxWidth: 200, textAlign: 'right', fontSize: 14 }}>
              {state.file.name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Pages</span>
            <span style={{ fontWeight: 500 }}>{state.pageCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Copies</span>
            <span style={{ fontWeight: 500 }}>{state.copies}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Type</span>
            <span style={{ fontWeight: 500 }}>
              {state.color === 'color' ? 'Color' : 'Black & White'} · {state.sides === 'one-sided' ? 'Single' : 'Double'} sided
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Paper</span>
            <span style={{ fontWeight: 500 }}>{state.paperSize}</span>
          </div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#2563eb' }}>₹{state.total}</span>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn btn-success" onClick={handlePay} disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Processing...' : `Pay ₹${state.total}`}
        </button>

        <button
          className="btn btn-outline"
          style={{ marginTop: 10 }}
          onClick={() => navigate('/settings', { state })}
          disabled={loading}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
