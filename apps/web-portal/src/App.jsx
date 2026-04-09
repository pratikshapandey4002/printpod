import { Routes, Route, Navigate } from 'react-router-dom'
import Upload from './pages/Upload'
import Preview from './pages/Preview'
import Payment from './pages/Payment'
import Success from './pages/Success'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Upload />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/success" element={<Success />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
