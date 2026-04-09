import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Upload() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [phone, setPhone] = useState('')
  const [settings, setSettings] = useState({
    copies: 1, color: 'mono', sides: 'one-sided',
    paperSize: 'A4', quality: 'normal', orientation: 'portrait'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const allowed = ['application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(f.type)) {
      setError('Only PDF, DOC, and DOCX files are allowed')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB')
      return
    }
    setError('')
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return setError('Please select a file')
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit Indian phone number')
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('document', file)
      form.append('phoneNumber', phone)
      Object.entries(settings).forEach(([k, v]) => form.append(k, v))
      const { data } = await axios.post(`${API}/jobs/upload`, form)
      if (!data.success) throw new Error(data.error)
      navigate('/preview', { state: { job: data, fileName: file.name, phone } })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed')
    } finally {
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
        <div className="step-dot active" />
        <div className="step-dot" />
        <div className="step-dot" />
        <div className="step-dot" />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="field">
          <label className="label">Your document</label>
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: '2px dashed #d1d5db', borderRadius: 12, padding: 24,
              textAlign: 'center', cursor: 'pointer', background: file ? '#f0fdf4' : '#fafafa'
            }}
          >
            {file ? (
              <>
                <div style={{ fontSize: 32 }}>📄</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{(file.size/1024/1024).toFixed(2)} MB</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32 }}>📁</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>Tap to select file</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>PDF, DOC, DOCX up to 50MB</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        <div className="field">
          <label className="label">Phone number (for OTP)</label>
          <input className="input" type="tel" placeholder="10-digit mobile number"
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} />
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Print settings</div>

        <div className="row">
          <div className="field">
            <label className="label">Copies</label>
            <input className="input" type="number" min={1} max={99}
              value={settings.copies}
              onChange={e => setSettings(s => ({ ...s, copies: parseInt(e.target.value) || 1 }))} />
          </div>
          <div className="field">
            <label className="label">Color</label>
            <select className="select" value={settings.color}
              onChange={e => setSettings(s => ({ ...s, color: e.target.value }))}>
              <option value="mono">Black & White</option>
              <option value="color">Color</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label">Sides</label>
            <select className="select" value={settings.sides}
              onChange={e => setSettings(s => ({ ...s, sides: e.target.value }))}>
              <option value="one-sided">Single sided</option>
              <option value="two-sided-long-edge">Double sided</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Paper</label>
            <select className="select" value={settings.paperSize}
              onChange={e => setSettings(s => ({ ...s, paperSize: e.target.value }))}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label">Quality</label>
            <select className="select" value={settings.quality}
              onChange={e => setSettings(s => ({ ...s, quality: e.target.value }))}>
              <option value="draft">Draft</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Orientation</label>
            <select className="select" value={settings.orientation}
              onChange={e => setSettings(s => ({ ...s, orientation: e.target.value }))}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Uploading...' : 'Continue →'}
      </button>
    </div>
  )
}
