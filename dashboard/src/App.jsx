import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { initiateLogin, handleCallback, getCurrentUser, logout } from './lib/auth'
import Sidebar from './components/Sidebar'
import {
  AdminDashboard, UserDashboard,
  FindingsPage, SessionsPage, PoliciesPage, PipelinePage, MePage
} from './pages/Pages'
import { Search, Bell, Settings, ChevronDown, LogOut } from 'lucide-react'

function LoginPage() {
  return (
    <div className="login-page">
      <div className="bg-grid" />
      <div className="login-card animate-slide-up" style={{ position: 'relative', zIndex: 1 }}>
        <div className="login-logo">प Prahari</div>
        <div className="login-tagline">Zero Trust Access & Governance Platform</div>
        <button className="login-btn ripple" onClick={initiateLogin}>
          Sign in with SSO →
        </button>
        
        {/* Development Mocks */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Developer Mode</div>
          <button className="login-btn ripple" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
            onClick={() => {
              sessionStorage.setItem('mock_user', JSON.stringify({ email: 'admin@prahari.internal', isAdmin: true }));
              window.location.reload();
            }}>
            Simulate Admin Login
          </button>
          <button className="login-btn ripple" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
            onClick={() => {
              sessionStorage.setItem('mock_user', JSON.stringify({ email: 'developer@prahari.internal', isAdmin: false }));
              window.location.reload();
            }}>
            Simulate User Login
          </button>
        </div>

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

function TopHeader({ user }) {
  const initial = user?.email?.[0]?.toUpperCase() || '?'
  return (
    <header className="top-header animate-slide-up">
      <div className="search-bar">
        <Search size={16} color="var(--text-muted)" />
        <input type="text" placeholder="Search principals, findings..." />
      </div>
      <div className="header-actions">
        <button className="icon-btn ripple"><Bell size={18} /></button>
        <button className="icon-btn ripple"><Settings size={18} /></button>
        <div className="profile-dropdown">
          <button className="profile-btn ripple" onClick={() => {
            if (sessionStorage.getItem('mock_user')) {
              sessionStorage.clear()
              window.location.reload()
            } else {
              logout()
            }
          }}>
            <div className="profile-avatar">{initial}</div>
            <span className="profile-name">{user?.email?.split('@')[0] || 'User'}</span>
            <LogOut size={14} style={{marginLeft: 4, color: 'var(--text-muted)'}}/>
          </button>
        </div>
      </div>
    </header>
  )
}

function ProtectedLayout({ user }) {
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-content" style={{ position: 'relative' }}>
        <TopHeader user={user} />
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
  const [user, setUser] = useState(() => {
    const mock = sessionStorage.getItem('mock_user')
    return mock ? JSON.parse(mock) : getCurrentUser()
  })

  function refreshUser() {
    const mock = sessionStorage.getItem('mock_user')
    setUser(mock ? JSON.parse(mock) : getCurrentUser())
  }

  // Also patch the top header logout to clear mock
  const handleLogout = () => {
    if (sessionStorage.getItem('mock_user')) {
      sessionStorage.removeItem('mock_user')
      window.location.reload()
    } else {
      logout()
    }
  }

  return (
    <Routes>
      <Route path="/"         element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/callback" element={<CallbackPage onAuth={refreshUser} />} />
      <Route path="/*"        element={<ProtectedLayout user={user} />} />
    </Routes>
  )
}
