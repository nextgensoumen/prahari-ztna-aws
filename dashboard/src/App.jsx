import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { initiateLogin, handleCallback, getCurrentUser, logout } from './lib/auth'
import Sidebar from './components/Sidebar'
import {
  AdminDashboard, UserDashboard,
  FindingsPage, SessionsPage, PoliciesPage, PipelinePage, MePage
} from './pages/Pages'

function LoginPage() {
  return (
    <div className="login-page">
      <div className="bg-grid" />
      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="login-logo">प Prahari</div>
        <div className="login-tagline">Zero Trust Access & Governance Platform</div>
        <button className="login-btn" onClick={initiateLogin}>
          Sign in with SSO →
        </button>
        <div className="login-note">
          Secured by Amazon Cognito + AWS Verified Access.<br />
          Your session is continuously evaluated for risk.
        </div>
      </div>
    </div>
  )
}

function CallbackPage({ onAuth }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) { navigate('/'); return }

    handleCallback(code)
      .then(() => {
        onAuth()
        navigate('/dashboard')
      })
      .catch(err => {
        console.error('Auth failed', err)
        navigate('/')
      })
  }, [])

  return <div className="spinner" style={{ marginTop: '40vh' }} />
}

function ProtectedLayout({ user }) {
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={user.isAdmin
            ? <AdminDashboard />
            : <UserDashboard user={user} />}
          />
          {user.isAdmin && <>
            <Route path="/findings"  element={<FindingsPage />} />
            <Route path="/sessions"  element={<SessionsPage />} />
            <Route path="/policies"  element={<PoliciesPage />} />
            <Route path="/pipeline"  element={<PipelinePage />} />
          </>}
          <Route path="/me" element={<MePage user={user} />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => getCurrentUser())

  function refreshUser() {
    setUser(getCurrentUser())
  }

  return (
    <Routes>
      <Route path="/"         element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/callback" element={<CallbackPage onAuth={refreshUser} />} />
      <Route path="/*"        element={<ProtectedLayout user={user} />} />
    </Routes>
  )
}
