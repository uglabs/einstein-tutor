import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PreQuiz from './pages/PreQuiz'
import Chat from './pages/Chat'
import PostQuiz from './pages/PostQuiz'
import Results from './pages/Results'
import { getStoredUser } from './lib/user'

function RequireAuth({ children }) {
  return getStoredUser() ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/lesson/:n/pre-quiz" element={<RequireAuth><PreQuiz /></RequireAuth>} />
        <Route path="/lesson/:n/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/lesson/:n/post-quiz" element={<RequireAuth><PostQuiz /></RequireAuth>} />
        <Route path="/lesson/:n/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
