import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/auth'
import { TrustScoreGauge, FindingCard, SessionRow, PipelineRow } from '../components/Widgets'

function StatTile({ label, value, sub, variant }) {
  return (
    <div className={`stat-tile ${variant || ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
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

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Overview</h1>
          <p className="page-subtitle">Real-time view of Prahari platform telemetry</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatTile label="Critical Findings" value={critical} sub="Last 50 events" variant="critical" />
        <StatTile label="High Findings"     value={high}     sub="Last 50 events" variant="high" />
        <StatTile label="Active Sessions"   value={sessions.length} sub="All principals" variant="accent" />
        <StatTile label="High-Risk Sessions" value={highRisk} sub="Score ≥ threshold" variant={highRisk > 0 ? 'critical' : 'ok'} />
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Findings</span>
            <a href="/findings" className="btn btn-ghost btn-sm">View all →</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.slice(0, 5).map(f => (
              <FindingCard key={f.event_id} finding={f} />
            ))}
            {findings.length === 0 && <div className="empty-state"><span className="icon">🔍</span>No findings yet</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Sessions</span>
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
            {sessions.length === 0 && <div className="empty-state"><span className="icon">🔐</span>No sessions</div>}
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
    apiGet('/me')
      .then(data => setMe(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  const score = Number(me?.trust?.score || 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Security Status</h1>
          <p className="page-subtitle">{user?.email}</p>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: '300px 1fr' }}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <TrustScoreGauge score={score} threshold={50} />
          <div className="mt-4">
            <div className="card-title" style={{ marginBottom: 8 }}>Triggered Rules</div>
            {(me?.trust?.triggered_rules || []).length === 0
              ? <div className="text-muted" style={{ fontSize: 12 }}>No signals detected</div>
              : (me?.trust?.triggered_rules || []).map(r => (
                <div key={r} className="badge info" style={{ margin: '3px auto', display: 'inline-block' }}>{r}</div>
              ))
            }
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Allowed Applications</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Prahari Dashboard', url: '#', protected: true },
            ].map(app => (
              <div key={app.name} className="flex items-center gap-3"
                style={{ padding: '12px 16px', background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 20 }}>🔐</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{app.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>Verified Access protected</div>
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
    apiGet('/findings')
      .then(d => setFindings(d.findings || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Findings Feed</h1>
          <p className="page-subtitle">Normalized security events from GuardDuty, Security Hub & CloudTrail</p>
        </div>
      </div>
      <div className="content-grid single" style={{ gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {findings.map(f => <FindingCard key={f.event_id} finding={f} />)}
          {findings.length === 0 && <div className="empty-state"><span className="icon">🔍</span>No findings yet. Try running <code>aws guardduty create-sample-findings</code></div>}
        </div>
      </div>
    </>
  )
}

export function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/sessions')
      .then(d => setSessions(d.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleRevoke = async (principal) => {
    if (!confirm(`Revoke session for ${principal}?`)) return
    await apiPost('/sessions/revoke', { principal })
    alert('Revocation triggered — check Step Functions console for progress')
  }

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Session Management</h1>
          <p className="page-subtitle">Trust scores and session control for all principals</p>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Principal</th><th>Score</th><th>Status</th><th>Last Updated</th><th>Action</th>
            </tr></thead>
            <tbody>
              {sessions.map(s => (
                <SessionRow key={s.principal} session={s} isAdmin={true} onRevoke={handleRevoke} />
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && <div className="empty-state"><span className="icon">🔐</span>No sessions recorded yet</div>}
        </div>
      </div>
    </>
  )
}

export function PoliciesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/policies')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Policy Queue</h1>
          <p className="page-subtitle">Open GitHub PRs from the least-privilege autopilot</p>
        </div>
      </div>
      <div className="card">
        {(data?.policies || []).length === 0
          ? <div className="empty-state">
              <span className="icon">📋</span>
              No open policy proposals. The autopilot runs weekly on tagged roles.
            </div>
          : data.policies.map((p, i) => (
            <div key={i} className="flex items-center gap-3 mb-4"
              style={{ padding: 16, background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span>📋</span>
              <div><div style={{ fontWeight: 500 }}>{p.title}</div><div className="text-muted" style={{ fontSize: 12 }}>{p.url}</div></div>
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
    apiGet('/pipeline')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Supply Chain Pipeline</h1>
          <p className="page-subtitle">CodeBuild runs — all artifacts are signed with Sigstore keyless mode</p>
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Commit</th><th>Status</th><th>Signed</th><th>Image</th><th>Time</th>
            </tr></thead>
            <tbody>
              {(data?.pipeline || []).map(b => <PipelineRow key={b.id} build={b} />)}
            </tbody>
          </table>
          {(data?.pipeline || []).length === 0 && <div className="empty-state"><span className="icon">🚀</span>No builds yet</div>}
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

  if (loading) return <div className="spinner" />

  const score = Number(me?.trust?.score || 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Trust Score</h1>
          <p className="page-subtitle">{user?.email}</p>
        </div>
      </div>
      <div className="content-grid" style={{ gridTemplateColumns: '280px 1fr' }}>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <TrustScoreGauge score={score} threshold={50} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Score Breakdown</span></div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <p className="mb-4">Your risk score is recalculated whenever a security event is linked to your identity. A score above 50 triggers automatic session review.</p>
            {(me?.trust?.triggered_rules || []).length > 0 && (
              <div>
                <div className="card-title mb-4">Triggered Rules</div>
                {me.trust.triggered_rules.map(r => (
                  <div key={r} className="flex items-center gap-2 mb-4">
                    <span className="badge high">{r}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-muted mt-4" style={{ fontSize: 12 }}>
              Last updated: {me?.trust?.timestamp ? new Date(me.trust.timestamp).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
