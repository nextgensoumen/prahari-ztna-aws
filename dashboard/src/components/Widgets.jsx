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

// ─── SOC Extensions ───────────────────────────────────────────

export function SocActionBar() {
  return (
    <div className="soc-action-bar animate-slide-up">
      <div className="flex items-center gap-4">
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={20} color="var(--critical)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>SOC Quick Actions</div>
          <div className="text-muted" style={{ fontSize: 13 }}>Emergency response and platform control</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost ripple" onClick={() => alert('Initiating log export to S3 bucket...')}>
          Export Audit Logs
        </button>
        <button className="btn btn-ghost ripple" onClick={() => alert('Syncing latest Cedar policies...')}>
          Force Policy Sync
        </button>
        <button className="btn btn-danger ripple" onClick={() => {
          if (confirm('CRITICAL ACTION: This will immediately revoke sessions for ALL principals with a score >= 50. Proceed?')) {
            alert('Global quarantine triggered.')
          }
        }}>
          Quarantine All High-Risk
        </button>
      </div>
    </div>
  )
}

export function MitreBreakdown({ findings }) {
  // Mock grouping for demonstration
  const tactics = [
    { name: 'Initial Access', count: findings.filter(f => f.title.includes('Login') || f.title.includes('IAM')).length || 2, color: '#f87171' },
    { name: 'Privilege Escalation', count: findings.filter(f => f.title.includes('Privilege')).length || 1, color: '#fbbf24' },
    { name: 'Defense Evasion', count: findings.filter(f => f.title.includes('Trail') || f.title.includes('Log')).length || 3, color: '#a78bfa' },
    { name: 'Credential Access', count: 0, color: '#63b3ed' },
  ]
  const total = tactics.reduce((sum, t) => sum + t.count, 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {tactics.map(t => (
        <div key={t.name} className="soc-tactic-row">
          <div className="flex items-center gap-3">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ width: 100, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(t.count / total) * 100}%`, height: '100%', background: t.color, transition: 'width 1s' }} />
            </div>
            <span style={{ fontSize: 13, width: 24, textAlign: 'right', fontWeight: 600 }}>{t.count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SystemHealth() {
  return (
    <div className="soc-health-grid">
      <div className="soc-health-item">
        <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Latency</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--success)' }}>42ms</div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>P99 Ingestion</div>
      </div>
      <div className="soc-health-item">
        <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DLQ Depth</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--success)' }}>0</div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Dead letter events</div>
      </div>
      <div className="soc-health-item">
        <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cedar Policies</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--text-primary)' }}>14</div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Active Rules</div>
      </div>
      <div className="soc-health-item">
        <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events (24h)</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--accent)' }}>12.4k</div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Processed</div>
      </div>
    </div>
  )
}
