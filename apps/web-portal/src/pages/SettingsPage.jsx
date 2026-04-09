import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const PRICES = {
  mono: { 'one-sided': 2, 'two-sided-long-edge': 3 },
  color: { 'one-sided': 8, 'two-sided-long-edge': 12 },
}

export default function SettingsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const [copies, setCopies] = useState(1)
  const [color, setColor] = useState('mono')
  const [sides, setSides] = useState('one-sided')
  const [paperSize, setPaperSize] = useState('A4')
  const [pageCount, setPageCount] = useState(1)

  if (!state?.file) {
    navigate('/')
    return null
  }

  const pricePerPage = PRICES[color][sides]
  const total = (pageCount * copies * pricePerPage).toFixed(2)

  function handleNext() {
    navigate('/payment', {
      state: {
        ...state,
        copies,
        color,
        sides,
        paperSize,
        pageCount,
        pricePerPage,
        total: parseFloat(total),
      }
    })
  }

  return (
    <div className="container">
      <div className="logo">
        <h1>🖨️ PrintPod</h1>
        <p>Configure your print</p>
      </div>

      <div className="step-indicator">
        <div className="step-dot done" />
        <div className="step-dot active" />
        <div className="step-dot" />
        <div className="step-dot" />
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>
          📄 {state.file.name}
        </div>

        <div className="field">
          <label className="label">Number of Pages in Document</label>
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            value={pageCount}
            onChange={e => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        <div className="row field">
          <div>
            <label className="label">Copies</label>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="label">Paper Size</label>
            <select className="select" value={paperSize} onChange={e => setPaperSize(e.target.value)}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="A3">A3</option>
            </select>
          </div>
        </div>

        <div className="row field">
          <div>
            <label className="label">Color</label>
            <select className="select" value={color} onChange={e => setColor(e.target.value)}>
              <option value="mono">Black & White</option>
              <option value="color">Color</option>
            </select>
          </div>
          <div>
            <label className="label">Sides</label>
            <select className="select" value={sides} onChange={e => setSides(e.target.value)}>
              <option value="one-sided">Single</option>
              <option value="two-sided-long-edge">Double</option>
            </select>
          </div>
        </div>

        <div className="price-tag">
          <div className="amount">₹{total}</div>
          <div className="breakdown">
            {pageCount} pages × {copies} copies × ₹{pricePerPage}/page
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleNext}>
          Proceed to Pay →
        </button>
      </div>
    </div>
  )
}
