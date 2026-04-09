import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Preview() {
  const { state } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!state?.job) navigate('/')
  }, [state, navigate])

  if (!state?.job) return null

  const { job, fileName, phone } = state
  const { jobId, pageCount, printOptions, pricing, otp } = job

  const label = {
    color: { mono: 'Black & White', color: 'Color' },
    sides: { 'one-sided': 'Single sided', 'two-sided-long-edge': 'Double sided' },
    quality: { draft: 'Draft', normal: 'Normal', high: 'High' },
    orientation: { portrait: 'Portrait', landscape: 'Landscape' },
  }

  const Row = ({ l, v }) => (
    <div style={{ display:'flex', justifyContent:'space-between',
      padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
      <span style={{ color:'#6b7280', fontSize:14 }}>{l}</span>
      <span style={{ fontWeight:500, fontSize:14 }}>{v}</span>
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
        <div className="step-dot active" />
        <div className="step-dot" />
        <div className="step-dot" />
      </div>

      <div className="card">
        <div style={{ fontWeight:700, fontSize:18, marginBottom:16 }}>Order summary</div>
        <Row l="File" v={fileName} />
        <Row l="Pages" v={pageCount} />
        <Row l="Copies" v={printOptions.copies} />
        <Row l="Color" v={label.color[printOptions.color]} />
        <Row l="Sides" v={label.sides[printOptions.sides]} />
        <Row l="Paper" v={printOptions.paperSize} />
        <Row l="Quality" v={label.quality[printOptions.quality]} />
      </div>

      <div className="price-tag">
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:4 }}>Total amount</div>
        <div className="amount">₹{pricing.totalAmount}</div>
        <div className="breakdown">₹{pricing.pricePerPage}/page × {pageCount * printOptions.copies} pages</div>
      </div>

      {/* Demo mode — get OTP instantly */}
      <button className="btn btn-primary" style={{ marginBottom:12 }}
        onClick={() => navigate('/success', {
          state: { jobId, otp, totalAmount: pricing.totalAmount, fileName }
        })}>
        Get OTP instantly (Demo) →
      </button>

      {/* Dodo Pay — real payment */}
      <button className="btn btn-success" style={{ marginBottom:12 }}
        onClick={() => navigate('/payment', {
          state: { jobId, totalAmount: pricing.totalAmount, phone, fileName }
        })}>
        💳 Pay ₹{pricing.totalAmount} via Dodo
      </button>

      <button className="btn btn-outline" onClick={() => navigate('/')}>
        ← Change settings
      </button>
    </div>
  )
}
