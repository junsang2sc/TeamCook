import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Archive from './pages/Archive'
import Step1Input from './pages/Step1Input'
import Step2Analysis from './pages/Step2Analysis'
import Step3Conditions from './pages/Step3Conditions'
import Step4Dashboard from './pages/Step4Dashboard'
import Step5Adjust from './pages/Step5Adjust'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/step/1" element={<Step1Input />} />
        <Route path="/step/2" element={<Step2Analysis />} />
        <Route path="/step/3" element={<Step3Conditions />} />
        <Route path="/step/4" element={<Step4Dashboard />} />
        <Route path="/step/5" element={<Step5Adjust />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
