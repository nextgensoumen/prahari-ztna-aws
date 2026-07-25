import React from 'react'
import { Shield, ShieldAlert, CheckCircle, Activity, Key, Code, Clock } from 'lucide-react'

export function TrustScoreGauge({ score = 0, threshold = 50 }) {
  const radius = 76
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const isHigh = score >= threshold
  const color = score < 30 ? 'var(--success)' : score < threshold ? 'var(--warning)' : 'var(--critical)'

  return (
    <div className="trust-gauge-wrap animate-slide-up">
      <div className="gauge-ring">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} fill="none"
            stroke="rgba(99,179,237,0.05)" strokeWidth="16" />
          <circle cx="90" cy="90" r={radius} fill="none"
            stroke={color} strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease' }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-score" style={{ color }}>{score}</span>
          <span className="gauge-label">Risk Score</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span className={`badge ${isHigh ? 'critical' : score < 30 ? 'low' : 'medium'}`} style={{ fontSize: 14, padding: '6px 16px' }}>
          {isHigh ? <><ShieldAlert size={16} style={{marginRight: 6}}/> High Risk</> : score < 30 ? <><Shield size={16} style={{marginRight: 6}}/> Trusted</> : <><Activity size={16} style={{marginRight: 6}}/> Elevated</>}
        </span>
        <div className="text-muted mt-2" style={{ fontSize: 12 }}>Threshold: {threshold}</div>
      </div>
    </div>
  )
}

export function FindingCard({ finding, onClick }) {
  const sev = (finding.severity || 'low').toLowerCase()
  return (
    <div className="finding-card ripple animate-slide-up" onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className={`badge ${sev}`}>{sev}</span>
        <span className="text-muted flex items-center gap-2" style={{ fontSize: 12 }}>
          <Activity size={14} />
          {finding.source_module}
        </span>
      </div>
      <div className="finding-title">{finding.title}</div>
      <div className="finding-desc">{finding.description}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-muted flex items-center gap-2" style={{ fontSize: 12 }}>
          <Key size={14} />
          {finding.principal || '—'}
        </span>
        <span className="text-muted flex items-center gap-2" style={{ fontSize: 12 }}>
          <Clock size={14} />
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
    <tr className="animate-slide-up">
      <td className="text-mono truncate" style={{ maxWidth: 220 }}>
        <div className="flex items-center gap-2">
          <Key size={14} style={{ color: 'var(--text-muted)' }}/>
          {session.principal}
        </div>
      </td>
      <td style={{ color, fontWeight: 700, fontSize: 16 }}>{score}</td>
      <td>
        <span className={`badge ${isHigh ? 'critical' : score < 30 ? 'low' : 'medium'}`}>
          {isHigh ? 'High Risk' : score < 30 ? 'Trusted' : 'Elevated'}
        </span>
      </td>
      <td className="text-muted" style={{ fontSize: 13 }}>
        {session.timestamp ? new Date(session.timestamp).toLocaleString() : '—'}
      </td>
      {isAdmin && (
        <td>
          <button className="btn btn-danger btn-sm ripple"
            onClick={() => onRevoke(session.principal)}>
            <ShieldAlert size={14} /> Revoke
          </button>
        </td>
      )}
    </tr>
  )
}

export function PipelineRow({ build }) {
  const status = (build.status || '').toLowerCase()
  return (
    <tr className="animate-slide-up">
      <td className="text-mono">
        <div className="flex items-center gap-2">
          <Code size={14} style={{ color: 'var(--text-muted)' }}/>
          {build.sha?.slice(0, 7)}
        </div>
      </td>
      <td>
        <span className={`badge ${status.replace('_', '').replace(' ', '')}`}>{build.status}</span>
      </td>
      <td>
        {build.signed
          ? <span className="badge low"><CheckCircle size={14} style={{marginRight: 4}}/> Signed</span>
          : <span className="text-muted">Pending</span>}
      </td>
      <td className="text-mono truncate" style={{ maxWidth: 200 }}>{build.image}</td>
      <td className="text-muted" style={{ fontSize: 13 }}>
        {build.timestamp ? new Date(build.timestamp).toLocaleString() : '—'}
      </td>
    </tr>
  )
}
