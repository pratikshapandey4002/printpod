import { useLocation, useNavigate } from 'react-router-dom'

export default function SuccessPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  if (!state?.otp) {
    navigate('/')
    return null
  }

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨️ PrintPod</h1>
        <p>Payment Successful!</p>
      </div>

      <div className="step-indicator">
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot done" />
        <div className="step-dot active" />
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Payment Confirmed!</div>
        <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          Enter this OTP at the kiosk to collect your printout
        </div>

        <div style={{
          background: '#eff6ff',
          border: '2px solid #bfdbfe',
          borderRadius: 16,
          padding: '24px 16px',
          marginBottom: 24
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Your OTP</div>
          <div style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: 12,
            color: '#2563eb'
          }}>
            {state.otp}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            Valid for 15 minutes
          </div>
        </div>

        <div style={{
          background: '#f9fafb',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>What to do next:</div>
          {['Go to the PrintPod kiosk', 'Tap "Enter OTP" on the screen', 'Type your 6-digit OTP', 'Collect your printout! 🎉'].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#2563eb', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0
              }}>{i + 1}</div>
              <span style={{ fontSize: 14 }}>{step}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          OTP also sent to <strong>+91 {state.phone}</strong>
        </div>

        <button className="btn btn-outline" onClick={() => navigate('/')}>
          Print Another Document
        </button>
      </div>
    </div>
  )
}
