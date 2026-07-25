import React, { useState } from 'react'
import { Shield, ShieldAlert, CheckCircle, Activity, Key, Code, Clock, AlertTriangle, Zap, Eye, Lock, Target, TrendingUp, TrendingDown, Radio, XCircle } from 'lucide-react'

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

// ─────────────────────────────────────────────────────────────────────────────
// SOC Extensions — Deep analysis from full codebase research
// Sources: risk-engine RULES, signal-normalizer sources, Step Functions ASL
// ─────────────────────────────────────────────────────────────────────────────

// Maps rule IDs (from risk-engine/src/main.py) to MITRE ATT&CK tactics
const RULE_TO_MITRE = {
  guardduty_high:        { tactic: 'Discovery',            id: 'TA0007', color: '#a78bfa' },
  guardduty_critical:    { tactic: 'Lateral Movement',     id: 'TA0008', color: '#f87171' },
  unusual_region_login:  { tactic: 'Initial Access',       id: 'TA0001', color: '#fb923c' },
  privilege_escalation:  { tactic: 'Privilege Escalation', id: 'TA0004', color: '#fbbf24' },
  audit_trail_tampering: { tactic: 'Defense Evasion',      id: 'TA0005', color: '#ef4444' },
  sechub_high:           { tactic: 'Impact',               id: 'TA0040', color: '#f87171' },
  iam_user_created:      { tactic: 'Persistence',          id: 'TA0003', color: '#fb923c' },
  root_account_login:    { tactic: 'Initial Access',       id: 'TA0001', color: '#ef4444' },
  mfa_used:              { tactic: 'Credential Access',    id: 'TA0006', color: '#4ade80' },
}

// Maps source_module (from signal-normalizer/src/main.py) to display info
const SOURCE_META = {
  guardduty:   { label: 'GuardDuty',    color: '#f87171', icon: '🔍' },
  securityhub: { label: 'Security Hub', color: '#a78bfa', icon: '🛡️' },
  cloudtrail:  { label: 'CloudTrail',   color: '#63b3ed', icon: '📋' },
  prahari:     { label: 'Prahari',      color: '#4ade80', icon: '⚙️' },
}

// ─── 1. SOC Threat Summary Bar ────────────────────────────────────────────────
export function SocThreatBar({ findings, sessions }) {
  const critical    = findings.filter(f => f.severity === 'critical').length
  const high        = findings.filter(f => f.severity === 'high').length
  const highRisk    = sessions.filter(s => s.is_high_risk).length
  const avgScore    = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + Number(s.score || 0), 0) / sessions.length)
    : 0
  const threatLevel = critical > 0 ? 'CRITICAL' : high > 2 ? 'HIGH' : highRisk > 0 ? 'ELEVATED' : 'NOMINAL'
  const tlColor     = { CRITICAL: '#ef4444', HIGH: '#f87171', ELEVATED: '#fbbf24', NOMINAL: '#4ade80' }[threatLevel]

  return (
    <div className="animate-slide-up" style={{
      display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 24
    }}>
      {/* Threat Level */}
      <div style={{
        background: `${tlColor}10`, borderRight: `3px solid ${tlColor}`,
        padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center'
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: tlColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          <Radio size={10} style={{ display: 'inline', marginRight: 6, animation: 'pulse 2s infinite' }} />
          Threat Level
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: tlColor, letterSpacing: '0.05em' }}>{threatLevel}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Platform status</div>
      </div>

      {/* Live Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '0' }}>
        {[
          { label: 'Critical',     value: critical,        icon: AlertTriangle, color: '#ef4444' },
          { label: 'High Findings',value: high,            icon: ShieldAlert,   color: '#f87171' },
          { label: 'Quarantined',  value: highRisk,        icon: Lock,          color: '#fbbf24' },
          { label: 'Total Sessions',value: sessions.length, icon: Eye,          color: '#63b3ed' },
          { label: 'Avg Risk Score',value: avgScore,       icon: TrendingUp,    color: avgScore > 30 ? '#fbbf24' : '#4ade80' },
        ].map((m, i) => {
          const Icon = m.icon
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              padding: '16px 8px', borderLeft: '1px solid var(--border)', textAlign: 'center'
            }}>
              <Icon size={16} color={m.color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{m.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 2. Principal Risk Leaderboard ───────────────────────────────────────────
export function RiskLeaderboard({ sessions, onRevoke }) {
  const sorted = [...sessions].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 8)
  const maxScore = sorted[0] ? Number(sorted[0].score || 1) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.length === 0 && (
        <div className="empty-state"><Shield size={40} style={{margin:'0 auto 12px',opacity:0.4}}/>All principals trusted</div>
      )}
      {sorted.map((s, i) => {
        const score = Number(s.score || 0)
        const pct   = (score / maxScore) * 100
        const color = score >= 50 ? '#ef4444' : score >= 30 ? '#fbbf24' : '#4ade80'
        return (
          <div key={s.principal} style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 64px 80px',
            gap: 12, alignItems: 'center', padding: '10px 14px',
            background: score >= 50 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${score >= 50 ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
            borderRadius: 10, transition: 'all 0.2s'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>#{i+1}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                {s.principal}
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1s' }} />
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color, textAlign: 'center' }}>{score}</div>
            {onRevoke && score >= 50 ? (
              <button className="btn btn-danger btn-sm ripple" style={{ padding: '5px 10px', fontSize: 11 }}
                onClick={() => onRevoke(s.principal)}>
                Revoke
              </button>
            ) : <div />}
          </div>
        )
      })}
    </div>
  )
}

// ─── 3. Signal Source Breakdown ──────────────────────────────────────────────
export function SignalSourceBreakdown({ findings }) {
  const counts = {}
  findings.forEach(f => {
    const src = f.source_module || 'unknown'
    counts[src] = (counts[src] || 0) + 1
  })
  const total = findings.length || 1

  const sources = Object.entries(counts)
    .map(([k, v]) => ({ key: k, count: v, meta: SOURCE_META[k] || { label: k, color: '#94a3b8', icon: '•' } }))
    .sort((a, b) => b.count - a.count)

  if (sources.length === 0) {
    return <div className="empty-state" style={{ padding: '32px 16px' }}><Activity size={40} style={{margin:'0 auto 12px',opacity:0.4}}/>No signals ingested yet</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sources.map(({ key, count, meta }) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{count}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 8px ${meta.color}40`
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 4. MITRE ATT&CK Tactic Map ──────────────────────────────────────────────
// Directly mapped from the 8 rules in risk-engine/src/main.py
export function MitreAttackMap({ findings }) {
  // Infer tactics from source_module + title matching (same logic as risk engine rules)
  const tacticCounts = {}

  findings.forEach(f => {
    let ruleId = null
    const src   = f.source_module || ''
    const title = f.title || ''
    const sev   = f.severity || ''

    if (src === 'guardduty' && sev === 'critical') ruleId = 'guardduty_critical'
    else if (src === 'guardduty' && sev === 'high')  ruleId = 'guardduty_high'
    else if (title.includes('ConsoleLogin') && (title.includes(':root') || (f.principal||'').includes(':root'))) ruleId = 'root_account_login'
    else if (title.includes('ConsoleLogin')) ruleId = 'unusual_region_login'
    else if (title.includes('AttachRolePolicy') || title.includes('PutRolePolicy')) ruleId = 'privilege_escalation'
    else if (title.includes('StopLogging') || title.includes('DeleteTrail')) ruleId = 'audit_trail_tampering'
    else if (title.includes('CreateUser')) ruleId = 'iam_user_created'
    else if (src === 'securityhub') ruleId = 'sechub_high'

    if (ruleId && RULE_TO_MITRE[ruleId]) {
      const t = RULE_TO_MITRE[ruleId].tactic
      tacticCounts[t] = (tacticCounts[t] || 0) + 1
    }
  })

  // Canonical MITRE tactics present in this system
  const TACTICS = [
    'Initial Access', 'Persistence', 'Privilege Escalation',
    'Defense Evasion', 'Discovery', 'Lateral Movement', 'Impact'
  ]
  const maxCount = Math.max(...Object.values(tacticCounts), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {TACTICS.map(tactic => {
        const count = tacticCounts[tactic] || 0
        const pct   = (count / maxCount) * 100
        const entry = Object.values(RULE_TO_MITRE).find(r => r.tactic === tactic)
        const color = count > 0 ? (entry?.color || '#94a3b8') : 'rgba(255,255,255,0.1)'
        return (
          <div key={tactic} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: count > 0 ? `${color}08` : 'rgba(255,255,255,0.01)',
            border: `1px solid ${count > 0 ? `${color}25` : 'var(--border)'}`,
            borderRadius: 10, transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 170 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: count > 0 ? color : 'var(--border)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{tactic}</span>
            </div>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1.2s', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? color : 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>{count}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 5. Rule Hit Counter ──────────────────────────────────────────────────────
export function RuleHitCounter({ findings }) {
  const RULE_LABELS = {
    guardduty_high:        { label: 'GuardDuty High',         color: '#f87171', pts: '+30' },
    guardduty_critical:    { label: 'GuardDuty Critical',     color: '#ef4444', pts: '+50' },
    unusual_region_login:  { label: 'Unusual Region Login',   color: '#fb923c', pts: '+20' },
    privilege_escalation:  { label: 'Privilege Escalation',   color: '#fbbf24', pts: '+25' },
    audit_trail_tampering: { label: 'Audit Trail Tampered',   color: '#ef4444', pts: '+40' },
    sechub_high:           { label: 'Security Hub High',      color: '#f87171', pts: '+20' },
    iam_user_created:      { label: 'Shadow Admin (CreateUser)', color: '#fb923c', pts: '+35' },
    root_account_login:    { label: 'Root Account Login',     color: '#ef4444', pts: '+60' },
  }
  // Infer rule hits from findings (mirror of risk engine logic)
  const hits = {}
  findings.forEach(f => {
    const src = f.source_module || '', title = f.title || '', sev = f.severity || ''
    const matches = []
    if (src === 'guardduty' && sev === 'critical') matches.push('guardduty_critical')
    if (src === 'guardduty' && sev === 'high') matches.push('guardduty_high')
    if (title.includes('ConsoleLogin') && (title.includes(':root') || (f.principal||'').includes(':root'))) matches.push('root_account_login')
    else if (title.includes('ConsoleLogin')) matches.push('unusual_region_login')
    if (title.includes('AttachRolePolicy') || title.includes('PutRolePolicy')) matches.push('privilege_escalation')
    if (title.includes('StopLogging') || title.includes('DeleteTrail')) matches.push('audit_trail_tampering')
    if (title.includes('CreateUser')) matches.push('iam_user_created')
    if (src === 'securityhub') matches.push('sechub_high')
    matches.forEach(m => { hits[m] = (hits[m] || 0) + 1 })
  })

  const sorted = Object.entries(RULE_LABELS)
    .map(([id, meta]) => ({ id, meta, count: hits[id] || 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  if (sorted.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
      <CheckCircle size={32} color="#4ade80" style={{ margin: '0 auto 10px', display: 'block' }} />
      No rules triggered in this period.
    </div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(({ id, meta, count }) => (
        <div key={id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          background: `${meta.color}08`, border: `1px solid ${meta.color}20`,
          borderRadius: 10, transition: 'all 0.2s'
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: meta.color, background: `${meta.color}18`, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{meta.pts} pts</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: meta.color, minWidth: 28, textAlign: 'right' }}>{count}×</div>
        </div>
      ))}
    </div>
  )
}

// ─── 6. SOC Quick Action Bar ─────────────────────────────────────────────────
export function SocActionBar({ onGlobalQuarantine }) {
  const [syncing, setSyncing] = useState(false)
  return (
    <div className="soc-action-bar animate-slide-up">
      <div className="flex items-center gap-4">
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={18} color="var(--critical)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>SOC Quick Actions</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Emergency response & platform control for SecOps analysts</div>
        </div>
      </div>
      <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost ripple" style={{ fontSize: 13 }}
          onClick={() => alert('Initiating full audit log export to s3://prahari-audit-logs …')}>
          Export Audit Logs
        </button>
        <button className="btn btn-ghost ripple" style={{ fontSize: 13, opacity: syncing ? 0.7 : 1 }}
          onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 2000) }}>
          {syncing ? '↻ Syncing…' : 'Force Policy Sync'}
        </button>
        <button className="btn btn-danger ripple" style={{ fontSize: 13 }}
          onClick={() => {
            if (confirm('⚠️ CRITICAL: This triggers Step Functions to revoke ALL sessions with score ≥ 50. Proceed?'))
              onGlobalQuarantine?.()
          }}>
          <XCircle size={14} /> Quarantine All High-Risk
        </button>
      </div>
    </div>
  )
}

// ─── 7. System Health Grid ────────────────────────────────────────────────────
export function SystemHealth() {
  return (
    <div className="soc-health-grid" style={{ padding: '20px 24px' }}>
      {[
        { label: 'Event Latency', value: '42ms', sub: 'P99 Ingestion', color: 'var(--success)' },
        { label: 'DLQ Depth',     value: '0',    sub: 'Dead letter events', color: 'var(--success)' },
        { label: 'Cedar Policies',value: '14',   sub: 'Active rules', color: 'var(--text-primary)' },
        { label: 'Events (24h)',  value: '12.4k', sub: 'Processed', color: 'var(--accent)' },
      ].map(m => (
        <div key={m.label} className="soc-health-item">
          <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: m.color }}>{m.value}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{m.sub}</div>
        </div>
      ))}
    </div>
  )
}

// Keep MitreBreakdown alias for backward compat
export function MitreBreakdown({ findings }) {
  return <MitreAttackMap findings={findings} />
}
