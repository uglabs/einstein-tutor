import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { LESSONS } from '../data/lessons'

function seededRand(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function Starfield() {
  const stars = useMemo(() => {
    const r = seededRand(55)
    return Array.from({ length: 80 }, (_, i) => ({
      id: i, size: r() * 2 + 0.5,
      x: r() * 100, y: r() * 100,
      delay: r() * 6, duration: r() * 3 + 2, opacity: r() * 0.4 + 0.15,
    }))
  }, [])
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} className="absolute rounded-full bg-white" style={{
          width: s.size, height: s.size, left: `${s.x}%`, top: `${s.y}%`,
          opacity: s.opacity, animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  )
}

const LESSON_META = [
  { gradient: 'linear-gradient(135deg, #4C1D95, #7C3AED)', accent: '#A78BFA', glow: 'rgba(124,58,237,0.5)' },
  { gradient: 'linear-gradient(135deg, #78350F, #D97706)', accent: '#FCD34D', glow: 'rgba(217,119,6,0.5)' },
  { gradient: 'linear-gradient(135deg, #7F1D1D, #EA580C)', accent: '#FB923C', glow: 'rgba(234,88,12,0.5)' },
]

function ScoreBar({ label, pct, color, glow, delay = 0 }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { const t = setTimeout(() => setWidth(pct), 300 + delay); return () => clearTimeout(t) }, [pct, delay])
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito, sans-serif' }}>{label}</span>
        <span className="text-2xl font-bold" style={{ color, fontFamily: 'Fredoka, sans-serif', textShadow: `0 0 16px ${glow}` }}>{pct}%</span>
      </div>
      <div className="h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${width}%`, background: color, boxShadow: `0 0 16px ${glow}` }}
        />
      </div>
    </div>
  )
}

export default function Results() {
  const { n } = useParams()
  const lessonNum = parseInt(n, 10)
  const lesson = LESSONS[lessonNum - 1]
  const meta = LESSON_META[lessonNum - 1] || LESSON_META[0]
  const navigate = useNavigate()

  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const sessionId = sessionStorage.getItem(`session_${lessonNum}`)

  useEffect(() => {
    if (!sessionId) { navigate('/dashboard'); return }
    api.getResults(sessionId).then(setResults).catch(console.error).finally(() => setLoading(false))
  }, [sessionId])

  if (!lesson) return null
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(170deg, #07051a 0%, #0d0b2e 100%)' }}>
        <div className="text-white text-lg" style={{ fontFamily: 'Fredoka, sans-serif' }}>Loading results… ✨</div>
      </div>
    )
  }

  const { pre, post, session } = results || {}
  const prePct  = pre  ? Math.round((pre.score  / pre.total)  * 100) : 0
  const postPct = post ? Math.round((post.score / post.total) * 100) : 0
  const improvement = post && pre ? post.score - pre.score : null
  const durationMins = session?.duration_secs ? Math.round(session.duration_secs / 60) : null
  const exchanges = session?.message_count || 0

  const celebrationEmoji = improvement > 0 ? '🎉' : improvement === 0 ? '🧠' : '⭐'
  const headline = improvement > 0 ? 'Amazing work!' : improvement === 0 ? 'You already knew it!' : 'Great effort!'
  const subtitle = improvement > 0
    ? `You got ${improvement} more question${improvement > 1 ? 's' : ''} right after talking to Albert!`
    : improvement === 0
    ? 'You were a natural scientist even before the lesson!'
    : 'Every scientist learns at their own pace. Keep going!'

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-5 py-10"
      style={{ background: 'linear-gradient(170deg, #07051a 0%, #0d0b2e 40%, #140b38 100%)' }}
    >
      <Starfield />

      {/* Nebula glow */}
      <div className="fixed pointer-events-none" style={{ zIndex: 0, inset: 0 }}>
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 500, height: 400,
          background: `radial-gradient(ellipse, ${meta.glow.replace('0.5','0.1')} 0%, transparent 65%)` }} />
      </div>

      <div className="relative w-full" style={{ zIndex: 2, maxWidth: 560 }}>

        {/* Celebration header */}
        <div className="text-center mb-8" style={{ animation: 'cardIn 0.6s ease-out both' }}>
          <div className="text-6xl mb-4" style={{ animation: 'starPop 0.8s ease-out 0.2s both', display: 'inline-block' }}>
            {celebrationEmoji}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif', textShadow: `0 0 40px ${meta.glow}` }}>
            {headline}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito, sans-serif', maxWidth: 360, margin: '0 auto' }}>
            {subtitle}
          </p>
          <p className="text-xs mt-2 font-bold uppercase tracking-wider" style={{ color: meta.accent, fontFamily: 'Nunito, sans-serif' }}>
            Lesson {lessonNum} · {lesson.title}
          </p>
        </div>

        {/* Score card */}
        <div
          className="rounded-3xl p-7 mb-5"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: `0 8px 50px rgba(0,0,0,0.4)`,
            animation: 'cardIn 0.6s ease-out 0.15s both',
          }}
        >
          {pre && post ? (
            <>
              <div className="flex flex-col gap-5">
                <ScoreBar label="Before" pct={prePct}  color="rgba(255,255,255,0.45)" glow="rgba(255,255,255,0.2)" delay={0} />
                <ScoreBar label="After"  pct={postPct} color={meta.accent}             glow={meta.glow}              delay={200} />
              </div>

              {/* Improvement pill */}
              {improvement !== null && (
                <div
                  className="mt-6 flex items-center justify-center gap-3 py-4 rounded-2xl"
                  style={{
                    background: improvement > 0 ? `${meta.glow.replace('0.5','0.15')}` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${improvement > 0 ? meta.accent + '40' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <span className="text-2xl font-bold" style={{ color: improvement > 0 ? meta.accent : 'rgba(255,255,255,0.6)', fontFamily: 'Fredoka, sans-serif' }}>
                    {improvement > 0 ? `+${improvement} correct` : improvement === 0 ? 'Same score' : `${improvement} correct`}
                  </span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito, sans-serif' }}>
                    {improvement > 0 ? '— nice improvement! 🚀' : '— consistent! 🧠'}
                  </span>
                </div>
              )}

              {/* Stats */}
              {(durationMins || exchanges > 0) && (
                <div className="mt-5 pt-5 flex gap-6 justify-center" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {durationMins && (
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif' }}>{durationMins}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif' }}>minutes</div>
                    </div>
                  )}
                  {exchanges > 0 && (
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif' }}>{exchanges}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif' }}>exchanges with Albert</div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No quiz data available</p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full rounded-2xl font-bold text-white transition-all"
          style={{
            padding: '18px',
            fontSize: 18,
            background: meta.gradient,
            fontFamily: 'Fredoka, sans-serif',
            boxShadow: `0 8px 32px ${meta.glow}`,
            border: 'none',
            animation: 'cardIn 0.6s ease-out 0.3s both',
          }}
        >
          Back to Mission Control →
        </button>
      </div>

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:inherit;transform:scale(1)} 50%{opacity:0.05;transform:scale(0.4)} }
        @keyframes cardIn { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes starPop { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.4)} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}
