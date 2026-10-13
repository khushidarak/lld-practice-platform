import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HistoryPage } from './pages/HistoryPage'
import { ProblemPage } from './pages/ProblemPage'
import { ProblemsPage } from './pages/ProblemsPage'
import { SubmissionPage } from './pages/SubmissionPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ProblemsPage />} />
        <Route path="/problems/:id" element={<ProblemPage />} />
        <Route path="/submissions/:id" element={<SubmissionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
