import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/auth'
import { TrustScoreGauge, FindingCard, SessionRow, PipelineRow } from '../components/Widgets'
import { Shield, ShieldAlert, Users, Activity, FileText, CheckCircle, Package } from 'lucide-react'

function StatTile({ label, value, sub, variant, icon: Icon, delay }) {
  return (
    <div className={`stat-tile ${variant || ''} animate-slide-up ${delay || ''}`}>
      <div className="label">
        <Icon size={16} />
        {label}
      </div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function DateFilter() {
  return (
    <div className="date-picker animate-slide-up">
      <button className="ripple">1H</button>
      <button className="active ripple">24H</button>
      <button className="ripple">7D</button>
      <button className="ripple">30D</button>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div className="content-grid animate-slide-up">
      <div className="card shimmer-bg" style={{ height: 400 }} />
      <div className="card shimmer-bg" style={{ height: 400 }} />
    </div>
  )
}

export function AdminDashboard() {
  const [findings, setFindings] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiGet('/findings'), apiGet('/sessions')])
      .then(([f, s]) => { setFindings(f.findings || []); setSessions(s.sessions || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const critical = findings.filter(f => f.severity === 'critical').length
  const high     = findings.filter(f => f.severity === 'high').length
  const highRisk = sessions.filter(s => s.is_high_risk).length

  if (loading) return <SkeletonLoader />

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">Security Overview</h1>
          <p className="page-subtitle">Real-time view of Prahari platform telemetry</p>
        </div>
        <DateFilter />
      </div>

      <div className="stat-grid">
        <StatTile label="Critical Findings" value={critical} sub="Last 50 events" variant="critical" icon={ShieldAlert} delay="delay-100" />
        <StatTile label="High Findings"     value={high}     sub="Last 50 events" variant="high" icon={Activity} delay="delay-200" />
        <StatTile label="Active Sessions"   value={sessions.length} sub="All principals" variant="accent" icon={Users} delay="delay-300" />
        <StatTile label="High-Risk Sessions" value={highRisk} sub="Score ≥ threshold" variant={highRisk > 0 ? 'critical' : 'ok'} icon={Shield} delay="delay-400" />
      </div>

      <div className="content-grid">
        <div className="card animate-slide-up delay-100">
          <div className="card-header">
            <span className="card-title"><Activity size={18} /> Recent Findings</span>
            <a href="/findings" className="btn btn-ghost btn-sm ripple">View all →</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {findings.slice(0, 5).map(f => (
              <FindingCard key={f.event_id} finding={f} />
            ))}
            {findings.length === 0 && <div className="empty-state"><Shield size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>No findings yet</div>}
          </div>
        </div>

        <div className="card animate-slide-up delay-200">
          <div className="card-header">
            <span className="card-title"><Users size={18} /> Sessions</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Principal</th><th>Score</th><th>Status</th><th>Updated</th><th>Action</th>
              </tr></thead>
              <tbody>
                {sessions.slice(0, 8).map(s => (
                  <SessionRow key={s.principal} session={s} isAdmin={true}
                    onRevoke={(p) => apiPost('/sessions/revoke', { principal: p }).then(() => alert('Revocation triggered'))} />
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && <div className="empty-state"><Users size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>No sessions</div>}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── User Dashboard Helpers ───────────────────────────────────────────────────

function ScoreRing({ score, threshold }) {
  const r = 64, cx = 80, cy = 80, stroke = 12
  const circ = 2 * Math.PI * r
  const pct = Math.min(score, 100) / 100
  const color = score >= threshold ? '#ef4444' : score >= threshold * 0.7 ? '#fbbf24' : '#4ade80'
  const label = score >= threshold ? 'High Risk' : score >= threshold * 0.7 ? 'Moderate' : 'Trusted'
  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <svg width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color }}>{score}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  )
}

function UserStatPill({ icon: Icon, label, value, color }) {
  return (
    <div className="animate-slide-up" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
      borderRadius: 14, transition: 'all 0.2s'
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function DecayBar({ score, threshold }) {
  const hoursToZero = Math.ceil(score / 5)
  const pct = score / 100
  const color = score >= threshold ? '#ef4444' : score >= threshold * 0.7 ? '#fbbf24' : '#4ade80'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Score Decay Progress</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>~{hoursToZero}h to zero</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`, borderRadius: 999,
          background: `linear-gradient(90deg, #4ade80, ${color})`,
          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 12px ${color}80`
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Score decays at <strong style={{color:'var(--accent)'}}>-5 pts/hour</strong> with no new alerts
      </div>
    </div>
  )
}

function RuleTag({ rule }) {
  const ruleInfo = {
    guardduty_high:       { label: 'GuardDuty High',       color: '#f87171' },
    guardduty_critical:   { label: 'GuardDuty Critical',   color: '#ef4444' },
    privilege_escalation: { label: 'Privilege Escalation', color: '#fb923c' },
    audit_trail_tampering:{ label: 'Audit Trail Tampered', color: '#ef4444' },
    unusual_region_login: { label: 'Unusual Login',        color: '#fbbf24' },
    sechub_high:          { label: 'Security Hub High',    color: '#f87171' },
    iam_user_created:     { label: 'Shadow Admin Risk',    color: '#fb923c' },
    root_account_login:   { label: 'Root Login Detected',  color: '#ef4444' },
    mfa_used:             { label: 'MFA Verified',         color: '#4ade80' },
  }
  const info = ruleInfo[rule] || { label: rule, color: '#94a3b8' }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
      background: `${info.color}12`, border: `1px solid ${info.color}30`,
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: info.color,
      margin: '4px 4px 4px 0'
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
      {info.label}
    </div>
  )
}

function AccessCard({ name, description, status, icon }) {
  const isActive = status === 'active'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
      background: isActive ? 'rgba(74,222,128,0.04)' : 'rgba(239,68,68,0.04)',
      border: `1px solid ${isActive ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}`,
      borderRadius: 14, transition: 'all 0.25s', cursor: 'default'
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, fontSize: 20,
        background: isActive ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{description}</div>
      </div>
      <div style={{
        padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: isActive ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
        color: isActive ? '#4ade80' : '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em'
      }}>{isActive ? '● Active' : '✕ Blocked'}</div>
    </div>
  )
}

function SecurityTip({ tip, index }) {
  const colors = ['#63b3ed', '#a78bfa', '#fbbf24', '#4ade80', '#f87171']
  const c = colors[index % colors.length]
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 16px',
      background: `${c}08`, borderRadius: 12, border: `1px solid ${c}20`,
      fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, alignItems: 'flex-start'
    }}>
      <span style={{ color: c, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✦</span>
      {tip}
    </div>
  )
}

export function UserDashboard({ user }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me').then(setMe).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />

  const score     = Number(me?.trust?.score || 0)
  const threshold = Number(me?.trust?.threshold || 50)
  const rules     = me?.trust?.triggered_rules || []
  const isHigh    = score >= threshold
  const lastSeen  = me?.trust?.timestamp ? new Date(me.trust.timestamp).toLocaleString() : 'Never'

  const securityTips = [
    'Always authenticate via SSO — never share credentials.',
    `Your trust score decays -5pts/hour. ${score > 0 ? `At this rate it clears in ~${Math.ceil(score/5)} hours.` : 'You are currently at zero risk.'}`,
    'If you triggered alerts, review recent activity in your AWS console.',
    'MFA is enforced — every login generates a positive trust signal.',
    'Report suspicious activity immediately to your security team.',
  ]

  return (
    <>
      {/* ─── Hero Header ─────────────────────────────────────── */}
      <div className="animate-slide-up" style={{
        padding: '28px 32px 24px',
        background: isHigh
          ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(10,12,18,0) 60%)'
          : 'linear-gradient(135deg, rgba(99,179,237,0.07), rgba(10,12,18,0) 60%)',
        borderBottom: '1px solid var(--border)', marginBottom: 28
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: 'var(--accent)'
              }}>{user?.email?.[0]?.toUpperCase() || '?'}</div>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user?.email}</span>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: 'rgba(99,179,237,0.12)', color: 'var(--accent)', letterSpacing: '0.06em'
              }}>USER</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>My Security Status</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
              Your access is continuously evaluated. Last updated: {lastSeen}
            </p>
          </div>
          {isHigh && (
            <div className="animate-slide-up" style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: '12px 20px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 14, animation: 'pulse-glow 2s infinite'
            }}>
              <ShieldAlert size={20} color="#ef4444" />
              <div>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>High Risk Detected</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Access may be restricted</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ─── Row 1: Score Ring + Stats ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Trust Score Card */}
          <div className="card animate-slide-up delay-100" style={{ textAlign: 'center', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trust Score</div>
            <ScoreRing score={score} threshold={threshold} />
            <DecayBar score={score} threshold={threshold} />
          </div>

          {/* Stats + Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <UserStatPill icon={Shield}     label="Risk Threshold" value={`Score ≥ ${threshold}`} color="#63b3ed" />
              <UserStatPill icon={ShieldAlert} label="Triggered Rules" value={rules.length === 0 ? 'None' : `${rules.length} rule${rules.length>1?'s':''}`} color={rules.length > 0 ? '#f87171' : '#4ade80'} />
              <UserStatPill icon={CheckCircle} label="MFA Status" value="Enforced ON" color="#4ade80" />
              <UserStatPill icon={Activity}   label="Session Status" value={isHigh ? 'Under Review' : 'Trusted'} color={isHigh ? '#f87171' : '#4ade80'} />
            </div>

            {/* Triggered Rules */}
            <div className="card animate-slide-up delay-200" style={{ padding: '20px 24px' }}>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <span className="card-title"><ShieldAlert size={16} /> Active Signals</span>
              </div>
              {rules.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CheckCircle size={16} color="#4ade80" /> No risk signals detected on your account
                  </div>
                : <div>{rules.map(r => <RuleTag key={r} rule={r} />)}</div>
              }
            </div>
          </div>
        </div>

        {/* ─── Row 2: Allowed Applications ─────────────────────── */}
        <div className="card animate-slide-up delay-200">
          <div className="card-header" style={{ marginBottom: 18 }}>
            <span className="card-title"><Package size={18} /> Your Allowed Applications</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Protected by AWS Verified Access</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccessCard name="Prahari Security Dashboard" description="Zero Trust Governance Portal" status={isHigh ? 'blocked' : 'active'} icon="🛡️" />
            <AccessCard name="Internal DevOps Portal"     description="CI/CD & pipeline management" status={isHigh ? 'blocked' : 'active'} icon="🚀" />
            <AccessCard name="Source Code Repository"     description="GitHub Enterprise via Verified Access" status="active" icon="📦" />
            <AccessCard name="Incident Command Channel"   description="PagerDuty + Slack integration" status={score > 30 ? 'blocked' : 'active'} icon="🔔" />
          </div>
        </div>

        {/* ─── Row 3: Security Tips + Score Explanation ─────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card animate-slide-up delay-300">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <span className="card-title"><Activity size={16} /> Security Recommendations</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {securityTips.map((tip, i) => <SecurityTip key={i} tip={tip} index={i} />)}
            </div>
          </div>

          <div className="card animate-slide-up delay-400">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <span className="card-title"><FileText size={16} /> How Your Score Works</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, borderLeft: '3px solid var(--accent)' }}>
                <strong style={{color:'var(--text-primary)'}}>0 – {Math.round(threshold*0.6)}</strong> &nbsp;Trusted — full access
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, borderLeft: '3px solid #fbbf24' }}>
                <strong style={{color:'var(--text-primary)'}}>{Math.round(threshold*0.6)+1} – {threshold-1}</strong> &nbsp;Moderate — monitoring active
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, borderLeft: '3px solid #ef4444' }}>
                <strong style={{color:'var(--text-primary)'}}>{threshold}+</strong> &nbsp;High Risk — access restricted
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, padding: '10px 14px', background: 'rgba(99,179,237,0.05)', borderRadius: 10, border: '1px solid rgba(99,179,237,0.12)' }}>
                Score recalculates on every security event and decays automatically at <strong style={{color:'var(--accent)'}}>5 pts/hour</strong> with no new alerts.
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}


export function FindingsPage() {
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/findings').then(d => setFindings(d.findings || [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">Findings Feed</h1>
          <p className="page-subtitle">Normalized security events from GuardDuty, Security Hub & CloudTrail</p>
        </div>
        <DateFilter />
      </div>
      <div className="content-grid single animate-slide-up delay-100">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {findings.map(f => <FindingCard key={f.event_id} finding={f} />)}
          {findings.length === 0 && <div className="empty-state"><Shield size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>No findings yet.</div>}
        </div>
      </div>
    </>
  )
}

export function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/sessions').then(d => setSessions(d.sessions || [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleRevoke = async (principal) => {
    if (!confirm(`Revoke session for ${principal}?`)) return
    await apiPost('/sessions/revoke', { principal })
    alert('Revocation triggered — check Step Functions console for progress')
  }

  if (loading) return <SkeletonLoader />

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">Session Management</h1>
          <p className="page-subtitle">Trust scores and session control for all principals</p>
        </div>
      </div>
      <div className="card animate-slide-up delay-100">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Principal</th><th>Score</th><th>Status</th><th>Last Updated</th><th>Action</th>
            </tr></thead>
            <tbody>
              {sessions.map(s => <SessionRow key={s.principal} session={s} isAdmin={true} onRevoke={handleRevoke} />)}
            </tbody>
          </table>
          {sessions.length === 0 && <div className="empty-state"><Users size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>No sessions recorded yet</div>}
        </div>
      </div>
    </>
  )
}

export function PoliciesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/policies').then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">Policy Queue</h1>
          <p className="page-subtitle">Open GitHub PRs from the least-privilege autopilot</p>
        </div>
      </div>
      <div className="card animate-slide-up delay-100">
        {(data?.policies || []).length === 0
          ? <div className="empty-state">
              <FileText size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>
              No open policy proposals. The autopilot runs weekly on tagged roles.
            </div>
          : data.policies.map((p, i) => (
            <div key={i} className="flex items-center gap-4 mb-4 ripple"
              style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <FileText size={24} style={{color: 'var(--accent)'}}/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{p.url}</div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  )
}

export function PipelinePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/pipeline').then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">Supply Chain Pipeline</h1>
          <p className="page-subtitle">CodeBuild runs — all artifacts are signed with Sigstore keyless mode</p>
        </div>
      </div>
      <div className="card animate-slide-up delay-100">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Commit</th><th>Status</th><th>Signed</th><th>Image</th><th>Time</th>
            </tr></thead>
            <tbody>
              {(data?.pipeline || []).map(b => <PipelineRow key={b.id} build={b} />)}
            </tbody>
          </table>
          {(data?.pipeline || []).length === 0 && <div className="empty-state"><CheckCircle size={48} style={{margin:'0 auto 16px', opacity:0.5}}/>No builds yet</div>}
        </div>
      </div>
    </>
  )
}

export function MePage({ user }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me').then(setMe).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonLoader />

  const score = Number(me?.trust?.score || 0)

  return (
    <>
      <div className="page-header animate-slide-up">
        <div>
          <h1 className="page-title">My Trust Score</h1>
          <p className="page-subtitle">{user?.email}</p>
        </div>
      </div>
      <div className="content-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div className="card animate-slide-up delay-100" style={{ textAlign: 'center', padding: 40 }}>
          <TrustScoreGauge score={score} threshold={50} />
        </div>
        <div className="card animate-slide-up delay-200">
          <div className="card-header"><span className="card-title"><ShieldAlert size={18} /> Score Breakdown</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            <p className="mb-6">Your risk score is recalculated whenever a security event is linked to your identity. A score above 50 triggers automatic session review.</p>
            {(me?.trust?.triggered_rules || []).length > 0 && (
              <div>
                <div className="card-title mb-4">Triggered Rules</div>
                {me.trust.triggered_rules.map(r => (
                  <div key={r} className="flex items-center gap-3 mb-4 p-3" style={{background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)'}}>
                    <ShieldAlert size={16} color="var(--critical)"/>
                    <span style={{color: 'var(--text-primary)', fontWeight: 500}}>{r}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-muted mt-6" style={{ fontSize: 12 }}>
              Last updated: {me?.trust?.timestamp ? new Date(me.trust.timestamp).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
