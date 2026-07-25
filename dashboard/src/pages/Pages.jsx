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

export function UserDashboard({ user }) {
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
          <h1 className="page-title">My Security Status</h1>
          <p className="page-subtitle">{user?.email}</p>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div className="card animate-slide-up delay-100" style={{ textAlign: 'center', padding: 40 }}>
          <TrustScoreGauge score={score} threshold={50} />
          <div className="mt-4">
            <div className="card-title" style={{ justifyContent: 'center', marginBottom: 12 }}>Triggered Rules</div>
            {(me?.trust?.triggered_rules || []).length === 0
              ? <div className="text-muted" style={{ fontSize: 13 }}>No signals detected</div>
              : (me?.trust?.triggered_rules || []).map(r => (
                <div key={r} className="badge info" style={{ margin: '4px auto', display: 'inline-block' }}>{r}</div>
              ))
            }
          </div>
        </div>

        <div className="card animate-slide-up delay-200">
          <div className="card-header">
            <span className="card-title"><Shield size={18} /> Allowed Applications</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { name: 'Prahari Dashboard', url: '#', protected: true },
            ].map(app => (
              <div key={app.name} className="flex items-center gap-3 ripple"
                style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 24 }}><Package /></span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{app.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>Verified Access protected</div>
                </div>
                <span className="badge low" style={{ marginLeft: 'auto' }}>Active</span>
              </div>
            ))}
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
