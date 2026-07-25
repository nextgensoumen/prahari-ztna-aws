import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { Hexagon, Search, Lock, FileText, Rocket, User, LogOut } from 'lucide-react'

const adminNav = [
  { to: '/dashboard',  icon: Hexagon, label: 'Overview' },
  { to: '/findings',   icon: Search,  label: 'Findings Feed' },
  { to: '/sessions',   icon: Lock,    label: 'Sessions' },
  { to: '/policies',   icon: FileText,label: 'Policy Queue' },
  { to: '/pipeline',   icon: Rocket,  label: 'Pipeline' },
]

const userNav = [
  { to: '/dashboard', icon: Hexagon, label: 'My Dashboard' },
  { to: '/me',        icon: User,    label: 'My Trust Score' },
]

export default function Sidebar({ user }) {
  const nav = user?.isAdmin ? adminNav : userNav
  const initial = user?.email?.[0]?.toUpperCase() || '?'

  function handleLogout(e) {
    e.preventDefault()
    if (sessionStorage.getItem('mock_user')) {
      sessionStorage.clear()
      window.location.reload()
    } else {
      logout()
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="mark">प</div>
        <div className="wordmark">Prahari</div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `nav-item ripple${isActive ? ' active' : ''}`}
            >
              <span className="icon"><Icon size={18} /></span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
