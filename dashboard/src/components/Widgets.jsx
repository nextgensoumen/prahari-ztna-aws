import React from 'react'

function severityColor(s = '') {
  const map = { critical: '#f56565', high: '#fc8181', medium: '#f6ad55', low: '#68d391' }
  return map[s.toLowerCase()] || '#a0aec0'
}

export function TrustScoreGauge({ score = 0, threshold = 50 }) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const isHigh = score >= threshold
  const color = score < 30 ? '#68d391' : score < threshold ? '#f6ad55' : '#f56565'

  return (
    <div className="trust-gauge-wrap">
      <div className="gauge-ring">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none"
            stroke="rgba(99,179,237,0.08)" strokeWidth="12" />
          <circle cx="70" cy="70" r={radius} fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-score" style={{ color }}>{score}</span>
          <span className="gauge-label">Risk</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span className={`badge ${isHigh ? 'critical' : score < 30 ? 'low' : 'medium'}`}>
          {isHigh ? '⚠ High Risk' : score < 30 ? '✓ Trusted' : '! Elevated'}
        </span>
        <div className="text-muted mt-1" style={{ fontSize: 11 }}>Threshold: {threshold}</div>
      </div>
    </div>
  )
}

export function FindingCard({ finding, onClick }) {
  const sev = (finding.severity || 'low').toLowerCase()
  return (
    <div className="card" onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: '16px 20px' }}>
      <div className="flex items-center justify-between">
        <span className={`badge ${sev}`}>{sev}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {finding.source_module}
        </span>
      </div>
      <div style={{ marginTop: 10, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
        {finding.title}
      </div>
      <div className="truncate text-muted mt-1" style={{ fontSize: 12 }}>
        {finding.description}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-muted" style={{ fontSize: 11 }}>
          {finding.principal || '—'}
        </span>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {finding.timestamp ? new Date(finding.timestamp).toLocaleString() : ''}
        </span>
      </div>
    </div>
  )
}

export function SessionRow({ session, onRevoke, isAdmin }) {
  const score = Number(session.score || 0)
  const isHigh = session.is_high_risk
  const color = isHigh ? 'var(--critical)' : score < 30 ? 'var(--success)' : 'var(--warning)'
  return (
    <tr>
      <td className="text-mono truncate" style={{ maxWidth: 220 }}>{session.principal}</td>
      <td style={{ color, fontWeight: 600 }}>{score}</td>
      <td>
        <span className={`badge ${isHigh ? 'critical' : score < 30 ? 'low' : 'medium'}`}>
          {isHigh ? 'High Risk' : score < 30 ? 'Trusted' : 'Elevated'}
        </span>
      </td>
      <td className="text-muted" style={{ fontSize: 12 }}>
        {session.timestamp ? new Date(session.timestamp).toLocaleString() : '—'}
      </td>
      {isAdmin && (
        <td>
          <button className="btn btn-danger btn-sm"
            onClick={() => onRevoke(session.principal)}>
            Revoke
          </button>
        </td>
      )}
    </tr>
  )
}

export function PipelineRow({ build }) {
  const status = (build.status || '').toLowerCase()
  return (
    <tr>
      <td className="text-mono">{build.sha?.slice(0, 7)}</td>
      <td>
        <span className={`badge ${status.replace('_', '').replace(' ', '')}`}>{build.status}</span>
      </td>
      <td>
        {build.signed
          ? <span className="text-success">✓ Signed</span>
          : <span className="text-muted">Pending</span>}
      </td>
      <td className="text-mono truncate" style={{ maxWidth: 200 }}>{build.image}</td>
      <td className="text-muted" style={{ fontSize: 12 }}>
        {build.timestamp ? new Date(build.timestamp).toLocaleString() : '—'}
      </td>
    </tr>
  )
}
