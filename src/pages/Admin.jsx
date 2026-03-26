import { useEffect, useState } from 'react'
import { adminApi } from '../lib/api'

const LESSON_NAMES = { 1: 'Gravity', 2: 'Light & Speed', 3: 'E=mc²' }
const ADMIN_KEY = 'einstein-admin-2026'

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function duration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}m ${s}s`
}

function ScorePill({ score, total, dim }) {
  if (score == null) return <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
  const pct = Math.round((score / total) * 100)
  const color = dim ? 'rgba(255,255,255,0.4)' : pct >= 75 ? '#6ee7b7' : pct >= 50 ? '#fcd34d' : '#fca5a5'
  return (
    <span style={{ color, fontWeight: 700 }}>{score}/{total} <span style={{ fontWeight: 400, opacity: 0.6 }}>({pct}%)</span></span>
  )
}

function DeltaPill({ pre, preTotal, post, postTotal }) {
  if (pre == null || post == null) return <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
  const delta = post - pre
  const color = delta > 0 ? '#6ee7b7' : delta === 0 ? '#fcd34d' : '#fca5a5'
  const sign = delta > 0 ? '+' : ''
  return <span style={{ color, fontWeight: 700 }}>{sign}{delta}</span>
}

function TranscriptModal({ session, onClose }) {
  const [lines, setLines] = useState(null)
  useEffect(() => {
    adminApi.getTranscript(ADMIN_KEY, session.id)
      .then(r => setLines(r.transcript))
      .catch(() => setLines([]))
  }, [session.id])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0d2a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: 28, width: '100%', maxWidth: 640,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif', fontSize: 20, margin: 0 }}>
              {session.user_name} · {LESSON_NAMES[session.lesson_number]}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 0', fontFamily: 'Nunito, sans-serif' }}>
              {fmt(session.started_at)} · {session.message_count || 0} exchanges
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines === null && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif', textAlign: 'center', marginTop: 32 }}>Loading…</p>
          )}
          {lines?.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif', textAlign: 'center', marginTop: 32 }}>No transcript recorded.</p>
          )}
          {lines?.map((m, i) => {
            const isAlbert = m.role !== 'user'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isAlbert ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', borderRadius: 12,
                  background: isAlbert ? 'rgba(139,122,255,0.15)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${isAlbert ? 'rgba(139,122,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                  fontFamily: 'Nunito, sans-serif', fontSize: 14, lineHeight: 1.5,
                  color: isAlbert ? '#c4bcff' : '#fff',
                }}>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.5, marginBottom: 4 }}>
                    {isAlbert ? 'Albert' : 'Child'}
                  </span>
                  {m.content}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SessionsTable({ sessions, onSelect }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {['User', 'Lesson', 'Date', 'Duration', 'Exchanges', 'Pre', 'Post', 'Delta', 'Transcript'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr
              key={s.id}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 700 }}>{s.user_name}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.7)' }}>{LESSON_NAMES[s.lesson_number] || `#${s.lesson_number}`}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{fmt(s.started_at)}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.5)' }}>{duration(s.duration_secs)}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{s.message_count || '—'}</td>
              <td style={{ padding: '12px 14px' }}><ScorePill score={s.pre_score} total={s.pre_total} dim /></td>
              <td style={{ padding: '12px 14px' }}><ScorePill score={s.post_score} total={s.post_total} /></td>
              <td style={{ padding: '12px 14px' }}><DeltaPill pre={s.pre_score} preTotal={s.pre_total} post={s.post_score} postTotal={s.post_total} /></td>
              <td style={{ padding: '12px 14px' }}>
                <button
                  onClick={() => onSelect(s)}
                  style={{ background: 'rgba(139,122,255,0.15)', border: '1px solid rgba(139,122,255,0.3)', borderRadius: 6, color: '#a78bfa', fontSize: 12, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr><td colSpan={9} style={{ padding: '32px 14px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>No sessions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function UsersTable({ users }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {['Name', 'Joined', 'Total Sessions', 'Completed', 'Last Active'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr
              key={u.id}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 700 }}>{u.name}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{u.total_sessions}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{u.completed_sessions}</td>
              <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{fmt(u.last_active)}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '32px 14px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>No users yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState('sessions')
  const [sessions, setSessions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    if (pw !== ADMIN_KEY) { setPwError(true); return }
    setLoading(true)
    try {
      const [s, u] = await Promise.all([adminApi.getSessions(ADMIN_KEY), adminApi.getUsers(ADMIN_KEY)])
      setSessions(s); setUsers(u); setAuthed(true)
    } catch {
      setPwError(true)
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([adminApi.getSessions(ADMIN_KEY), adminApi.getUsers(ADMIN_KEY)])
      setSessions(s); setUsers(u)
    } finally {
      setLoading(false)
    }
  }

  const totalImproved = sessions.filter(s => s.post_score != null && s.pre_score != null && s.post_score > s.pre_score).length
  const avgImprovement = (() => {
    const scored = sessions.filter(s => s.post_score != null && s.pre_score != null)
    if (!scored.length) return null
    return (scored.reduce((a, s) => a + (s.post_score - s.pre_score), 0) / scored.length).toFixed(1)
  })()

  const bg = 'linear-gradient(170deg, #07051a 0%, #0d0b2e 40%, #140b38 100%)'

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif', fontSize: 28, textAlign: 'center', marginBottom: 8 }}>
            Einstein Tutor
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
            Admin Dashboard
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Admin password"
              value={pw}
              onChange={e => { setPw(e.target.value); setPwError(false) }}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16,
                background: 'rgba(255,255,255,0.07)', border: `1px solid ${pwError ? '#fca5a5' : 'rgba(255,255,255,0.15)'}`,
                color: '#fff', outline: 'none', fontFamily: 'Nunito, sans-serif', boxSizing: 'border-box', marginBottom: 8,
              }}
              autoFocus
            />
            {pwError && <p style={{ color: '#fca5a5', fontSize: 13, fontFamily: 'Nunito, sans-serif', marginBottom: 8 }}>Incorrect password.</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
                background: 'linear-gradient(135deg, #4C1D95, #7C3AED)', border: 'none', color: '#fff',
                fontFamily: 'Fredoka, sans-serif', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Loading…' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 24px', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif', fontSize: 28, margin: 0 }}>Admin Dashboard</h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '4px 0 0' }}>Einstein Tutor usage overview</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Users', value: users.length },
            { label: 'Total Sessions', value: sessions.length },
            { label: 'Completed', value: sessions.filter(s => s.ended_at).length },
            { label: 'Improved', value: `${totalImproved}/${sessions.filter(s => s.post_score != null).length}` },
            { label: 'Avg Delta', value: avgImprovement != null ? `+${avgImprovement}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '18px 20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{label}</p>
              <p style={{ color: '#fff', fontSize: 28, fontFamily: 'Fredoka, sans-serif', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {['sessions', 'users'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t ? 'rgba(139,122,255,0.2)' : 'transparent',
                color: tab === t ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14,
                borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'sessions' ? `(${sessions.length})` : `(${users.length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
          {tab === 'sessions'
            ? <SessionsTable sessions={sessions} onSelect={setSelected} />
            : <UsersTable users={users} />
          }
        </div>

      </div>

      {selected && <TranscriptModal session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
