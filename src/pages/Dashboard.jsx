import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser, clearUser } from '../lib/user'
import { LESSONS } from '../data/lessons'

// ── Seeded random (same algo as Login, different seed) ────────────────────────
function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ── Starfield ─────────────────────────────────────────────────────────────────
function Starfield() {
  const stars = useMemo(() => {
    const r = seededRand(77)
    return Array.from({ length: 130 }, (_, i) => ({
      id: i,
      size: r() * 2.5 + 0.5,
      x: r() * 100,
      y: r() * 100,
      delay: r() * 7,
      duration: r() * 3 + 2,
      opacity: r() * 0.55 + 0.15,
    }))
  }, [])
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            width: s.size, height: s.size,
            left: `${s.x}%`, top: `${s.y}%`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Floating decorative icons ─────────────────────────────────────────────────
const FLOATERS = [
  { icon: '🔭', x: 4,  y: 8,  size: 36, delay: 0,   duration: 5   },
  { icon: '⚗️', x: 88, y: 5,  size: 30, delay: 1.2, duration: 4.5 },
  { icon: '🌌', x: 92, y: 55, size: 34, delay: 0.5, duration: 6   },
  { icon: '☄️', x: 3,  y: 62, size: 28, delay: 2,   duration: 4   },
  { icon: '🌠', x: 50, y: 2,  size: 26, delay: 0.8, duration: 5.5 },
]

// ── Per-lesson visual config ───────────────────────────────────────────────────
const LESSON_META = [
  {
    emoji: '🍎',
    gradient: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
    glow: 'rgba(124, 58, 237, 0.45)',
    accent: '#A78BFA',
    tagline: 'Why do things fall down?',
  },
  {
    emoji: '⚡',
    gradient: 'linear-gradient(135deg, #78350F 0%, #D97706 100%)',
    glow: 'rgba(217, 119, 6, 0.45)',
    accent: '#FCD34D',
    tagline: 'Nothing travels faster than light!',
  },
  {
    emoji: '⚛️',
    gradient: 'linear-gradient(135deg, #7F1D1D 0%, #EA580C 100%)',
    glow: 'rgba(234, 88, 12, 0.45)',
    accent: '#FB923C',
    tagline: 'Mass and energy are the same thing.',
  },
]

// ── Lesson card ────────────────────────────────────────────────────────────────
function LessonCard({ lesson, meta, status, preScore, preTotal, postScore, postTotal, onClick, index }) {
  const isLocked = status === 'locked'
  const isComplete = status === 'complete'

  return (
    <div
      onClick={!isLocked ? onClick : undefined}
      className="relative rounded-3xl overflow-hidden transition-all duration-300"
      style={{
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.4 : 1,
        animation: `cardIn 0.55s cubic-bezier(0.22,1,0.36,1) ${0.1 + index * 0.13}s both`,
        boxShadow: isLocked ? 'none' : `0 4px 36px ${meta.glow}`,
      }}
      onMouseEnter={e => {
        if (!isLocked) {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.015)'
          e.currentTarget.style.boxShadow = `0 16px 56px ${meta.glow}`
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = isLocked ? 'none' : `0 4px 36px ${meta.glow}`
      }}
    >
      {/* Gradient tint layer */}
      <div
        className="absolute inset-0"
        style={{ background: isLocked ? 'transparent' : meta.gradient, opacity: 0.12 }}
      />

      {/* Glass surface */}
      <div
        className="relative flex items-center gap-4 px-5 py-4"
        style={{
          background: isLocked
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(14px)',
          border: `1px solid ${isLocked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.13)'}`,
          borderRadius: 24,
        }}
      >
        {/* Top accent line */}
        {!isLocked && (
          <div
            className="absolute top-0 left-6 right-6 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)`, opacity: 0.6 }}
          />
        )}

        {/* Emoji badge */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 relative"
          style={{
            background: isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
            boxShadow: isLocked ? 'none' : `0 0 24px ${meta.glow}`,
          }}
        >
          {isLocked ? '🔒' : meta.emoji}
          {isComplete && (
            <div
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold"
              style={{ background: meta.gradient, fontSize: 11, color: '#fff', boxShadow: `0 0 8px ${meta.glow}` }}
            >
              ✓
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: isLocked ? 'rgba(255,255,255,0.22)' : meta.accent, fontFamily: 'Nunito, sans-serif' }}
            >
              Lesson {lesson.id}
            </span>
            {isComplete && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)', color: meta.accent }}
              >
                ✓ Done
              </span>
            )}
            {!isLocked && !isComplete && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: meta.gradient, color: '#fff', fontSize: 9, letterSpacing: '0.05em' }}
              >
                ▶ START
              </span>
            )}
          </div>

          <h3
            className="text-xl font-bold leading-tight"
            style={{ color: '#fff', fontFamily: 'Fredoka, sans-serif' }}
          >
            {lesson.title}
          </h3>

          <p
            className="text-xs mt-0.5 leading-snug"
            style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito, sans-serif' }}
          >
            {isComplete && postScore != null
              ? `Before ${Math.round((preScore / preTotal) * 100)}% → After ${Math.round((postScore / postTotal) * 100)}%`
              : isLocked
              ? `Complete Lesson ${lesson.id - 1} to unlock`
              : meta.tagline}
          </p>

          {isComplete && postScore != null && postScore > preScore && (
            <div
              className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.08)', color: meta.accent }}
            >
              +{postScore - preScore} right! 🎉
            </div>
          )}
        </div>

        {/* Arrow */}
        {!isLocked && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 font-bold"
            style={{ background: 'rgba(255,255,255,0.1)', color: meta.accent }}
          >
            →
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #0d0b2e 0%, #1a1050 100%)' }}
      >
        <div className="text-white text-lg" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          Loading missions… 🚀
        </div>
      </div>
    )
  }

  const lessonStatuses = progress?.lessons || LESSONS.map((l) => ({
    lesson_number: l.id,
    status: 'available',
  }))

  const completedCount = lessonStatuses.filter(l => l.status === 'complete').length
  const progressPct = (completedCount / LESSONS.length) * 100
  const displayName = user.name.charAt(0).toUpperCase() + user.name.slice(1)

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'linear-gradient(170deg, #07051a 0%, #0d0b2e 35%, #140b38 70%, #1a0f4a 100%)' }}
    >
      <Starfield />

      {/* Nebula glow blobs */}
      <div className="fixed pointer-events-none" style={{ zIndex: 0, inset: 0 }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '20%',
          width: 500, height: 400,
          background: 'radial-gradient(ellipse, rgba(88,28,235,0.12) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '-10%',
          width: 400, height: 400,
          background: 'radial-gradient(ellipse, rgba(109,40,217,0.1) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-5%',
          width: 350, height: 300,
          background: 'radial-gradient(ellipse, rgba(147,51,234,0.08) 0%, transparent 70%)',
        }} />
      </div>

      {/* Floating science icons */}
      {FLOATERS.map(({ icon, x, y, size, delay, duration }) => (
        <div
          key={icon}
          className="fixed pointer-events-none select-none hidden sm:block"
          style={{
            left: `${x}%`, top: `${y}%`,
            fontSize: size,
            opacity: 0.25,
            zIndex: 1,
            animation: `float ${duration}s ease-in-out ${delay}s infinite`,
          }}
        >
          {icon}
        </div>
      ))}

      {/* Main content */}
      <div className="relative" style={{ zIndex: 2, maxWidth: 512, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Header ── */}
        <div className="pt-12 pb-8 text-center">

          {/* Orbital Albert badge */}
          <div className="relative mx-auto mb-6" style={{ width: 112, height: 112 }}>
            {/* Outer orbit ring (spinning) */}
            <svg
              width="112" height="112"
              className="absolute inset-0"
              style={{ animation: 'orbit 14s linear infinite' }}
            >
              <circle cx="56" cy="56" r="52" fill="none" stroke="rgba(139,122,255,0.25)" strokeWidth="1.5" strokeDasharray="5 8" />
              <circle cx="56" cy="4" r="5" fill="#8B7AFF" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
            {/* Inner orbit ring (counter-spinning) */}
            <svg
              width="112" height="112"
              className="absolute inset-0"
              style={{ animation: 'orbit 9s linear infinite reverse', opacity: 0.4 }}
            >
              <circle cx="56" cy="56" r="38" fill="none" stroke="rgba(176,102,255,0.35)" strokeWidth="1" strokeDasharray="3 10" />
              <circle cx="56" cy="18" r="3.5" fill="#B066FF" />
            </svg>
            {/* The "A" badge */}
            <div
              className="absolute rounded-full flex items-center justify-center text-3xl font-bold"
              style={{
                width: 76, height: 76,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'linear-gradient(135deg, #8B7AFF 0%, #B066FF 100%)',
                boxShadow: '0 0 0 3px rgba(139,122,255,0.2), 0 0 40px rgba(139,122,255,0.5)',
                fontFamily: 'Fredoka, sans-serif',
                color: '#fff',
                letterSpacing: '-1px',
              }}
            >
              A
            </div>
          </div>

          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Nunito, sans-serif', letterSpacing: '0.2em' }}
          >
            ✦ Science Academy ✦
          </p>
          <h1
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'Fredoka, sans-serif', textShadow: '0 0 40px rgba(139,122,255,0.4)' }}
          >
            Hi, {displayName}! 👋
          </h1>
          <p
            className="text-sm mt-1.5"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito, sans-serif' }}
          >
            {completedCount === 0
              ? 'Your first mission awaits, Junior Scientist!'
              : completedCount === LESSONS.length
              ? 'All missions complete — you\'re a true scientist! 🏆'
              : `${LESSONS.length - completedCount} mission${LESSONS.length - completedCount > 1 ? 's' : ''} remaining — keep exploring!`}
          </p>

          {/* Progress bar */}
          <div className="mt-6 mx-auto" style={{ maxWidth: 290 }}>
            <div
              className="flex justify-between text-xs font-bold mb-2"
              style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Nunito, sans-serif' }}
            >
              <span>Mission Progress</span>
              <span>{completedCount} / {LESSONS.length}</span>
            </div>
            <div
              className="relative h-3 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #7C3AED, #9B59F5, #B066FF, #E040FB)',
                  boxShadow: '0 0 18px rgba(139,122,255,0.9)',
                }}
              />
              {/* Shimmer */}
              {progressPct > 0 && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                    animation: 'shimmer 2.5s ease-in-out infinite',
                  }}
                />
              )}
            </div>
            {/* Stars */}
            <div className="flex justify-around mt-2.5">
              {LESSONS.map((_, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 20,
                    display: 'inline-block',
                    transition: 'all 0.6s ease',
                    opacity: i < completedCount ? 1 : 0.18,
                    filter: i < completedCount ? 'drop-shadow(0 0 8px rgba(255,215,0,0.9))' : 'none',
                    transform: i < completedCount ? 'scale(1.25)' : 'scale(1)',
                    animation: i < completedCount ? `starPop 0.5s ease-out ${i * 0.2}s both` : 'none',
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Lesson cards ── */}
        <div className="flex flex-col gap-4">
          {LESSONS.map((lesson, i) => {
            const ls = lessonStatuses.find(l => l.lesson_number === lesson.id) || { status: 'locked' }
            return (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                meta={LESSON_META[i]}
                status={ls.status}
                preScore={ls.pre_score}
                preTotal={ls.pre_total}
                postScore={ls.post_score}
                postTotal={ls.post_total}
                onClick={() => navigate(`/lesson/${lesson.id}/pre-quiz`)}
                index={i}
              />
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between py-8 mt-2">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'Nunito, sans-serif' }}>
            Powered by UG Labs · Einstein Tutor
          </p>
          <button
            onClick={() => { clearUser(); navigate('/') }}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
            style={{
              color: 'rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'Nunito, sans-serif',
            }}
          >
            Switch learner
          </button>
        </div>
      </div>

      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          60%, 100% { transform: translateX(100%); }
        }
        @keyframes starPop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.5); }
          100% { transform: scale(1.25); opacity: 1; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: var(--base-op, 0.4); transform: scale(1); }
          50%       { opacity: 0.05; transform: scale(0.4); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(3deg); }
          66%       { transform: translateY(-7px) rotate(-2deg); }
        }
      `}</style>
    </div>
  )
}
