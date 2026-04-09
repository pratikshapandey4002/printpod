import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [phone, setPhone] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()
  const navigate = useNavigate()

  const ALLOWED = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png']

  function handleFile(f) {
    if (!f) return
    if (!ALLOWED.includes(f.type)) {
      setError('Only PDF, Word (.doc/.docx), JPG, PNG files are allowed.')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB.')
      return
    }
    setError('')
    setFile(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleNext() {
    if (!file) return setError('Please select a file.')
    if (!/^\d{10}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.')
    setError('')
    navigate('/settings', { state: { file, phone } })
  }

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨️ PrintPod</h1>
        <p>Upload · Print · Done</p>
      </div>

      <div className="step-indicator">
        <div className="step-dot active" />
        <div className="step-dot" />
        <div className="step-dot" />
        <div className="step-dot" />
      </div>

      <div className="card">
        <div className="field">
          <label className="label">Mobile Number (for OTP)</label>
          <input
            className="input"
            type="tel"
            maxLength={10}
            placeholder="Enter 10-digit number"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="field">
          <label className="label">Upload Document</label>
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? '#2563eb' : '#d1d5db'}`,
              borderRadius: 12,
              padding: '32px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? '#eff6ff' : '#fafafa',
              transition: 'all 0.2s'
            }}
          >
            {file ? (
              <>
                <div style={{ fontSize: 32 }}>📄</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB · Tap to change
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>📁</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>Tap to select file</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  PDF, Word, JPG, PNG · Max 20MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn btn-primary" onClick={handleNext}>
          Continue →
        </button>
      </div>
    </div>
  )
}
