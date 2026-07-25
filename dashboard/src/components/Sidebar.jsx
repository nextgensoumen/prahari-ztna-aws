import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'

const adminNav = [
  { to: '/dashboard',  icon: '⬡', label: 'Overview' },
  { to: '/findings',   icon: '🔎', label: 'Findings Feed' },
  { to: '/sessions',   icon: '🔐', label: 'Sessions' },
  { to: '/policies',   icon: '📋', label: 'Policy Queue' },
  { to: '/pipeline',   icon: '🚀', label: 'Pipeline' },
]

const userNav = [
  { to: '/dashboard', icon: '⬡', label: 'My Dashboard' },
  { to: '/me',        icon: '👤', label: 'My Trust Score' },
]

export default function Sidebar({ user }) {
  const nav = user?.isAdmin ? adminNav : userNav
  const initial = user?.email?.[0]?.toUpperCase() || '?'

  function handleLogout(e) {
    e.preventDefault()
    logout()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="wordmark">प Prahari</div>
        <div className="tagline">Zero Trust Platform</div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">Navigation</span>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initial}</div>
          <div className="user-info">
            <div className="email">{user?.email || 'Unknown'}</div>
            <span className="role-badge">{user?.isAdmin ? 'Admin' : 'User'}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">⏻</button>
        </div>
      </div>
    </aside>
  )
}
