import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { storeUser, getStoredUser, hashToUuid } from '../lib/user'

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || ''

// Seeded random so stars don't jump on re-render
function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function Starfield() {
  const stars = useMemo(() => {
    const r = seededRand(42)
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      size: r() * 2.5 + 0.8,
      x: r() * 100,
      y: r() * 100,
      delay: r() * 5,
      duration: r() * 2 + 2,
      opacity: r() * 0.5 + 0.3,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.x}%`,
            top: `${s.y}%`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

const FLOATING_ICONS = [
  { icon: '🔭', x: 8,  y: 12, delay: 0,   size: 32 },
  { icon: '⚡', x: 85, y: 8,  delay: 0.6, size: 28 },
  { icon: '🧪', x: 6,  y: 72, delay: 1.2, size: 30 },
  { icon: '⚛️', x: 88, y: 68, delay: 0.3, size: 34 },
  { icon: '🍎', x: 15, y: 45, delay: 1.8, size: 26 },
  { icon: '💡', x: 80, y: 40, delay: 0.9, size: 28 },
]

export default function Login() {
  const navigate = useNavigate()
  const remembered = getStoredUser()
  const [name, setName] = useState(remembered?.name || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (ACCESS_CODE && code.trim().toUpperCase() !== ACCESS_CODE.toUpperCase()) {
      setError('Incorrect class code. Ask your teacher!')
      return
    }

    const user = { id: hashToUuid(trimmed), name: trimmed }
    storeUser(user)
    navigate('/dashboard')
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0b2e 0%, #1a1050 40%, #2d1b69 100%)' }}
    >
      <Starfield />

      {/* Floating science icons */}
      {FLOATING_ICONS.map(({ icon, x, y, delay, size }) => (
        <div
          key={icon}
          className="absolute select-none pointer-events-none hidden sm:block"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            fontSize: size,
            animation: `float 4s ease-in-out ${delay}s infinite`,
            opacity: 0.6,
          }}
        >
          {icon}
        </div>
      ))}

      {/* Main card */}
      <div
        className="relative w-full max-w-sm rounded-3xl px-8 py-10 text-center"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Albert badge */}
        <div
          className="mx-auto mb-5 w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #8B7AFF 0%, #B066FF 100%)',
            animation: 'pulse-glow 3s ease-in-out infinite, badge-pop 0.5s ease-out both',
            fontFamily: 'Fredoka, sans-serif',
            color: '#fff',
            letterSpacing: '-1px',
          }}
        >
          A
        </div>

        <h1
          className="text-3xl font-bold text-white mb-1"
          style={{ fontFamily: 'Fredoka, sans-serif', letterSpacing: '0.5px' }}
        >
          Einstein Tutor
        </h1>
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Nunito, sans-serif' }}>
          Science adventures with Albert! 🚀
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
          <label
            className="text-sm font-bold"
            style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito, sans-serif' }}
          >
            What's your name, young scientist?
          </label>

          <input
            type="text"
            placeholder="e.g. Emma"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            autoFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full px-4 py-3.5 rounded-2xl text-base font-semibold outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: `2px solid ${focused ? '#8B7AFF' : 'rgba(255,255,255,0.2)'}`,
              color: '#fff',
              fontFamily: 'Nunito, sans-serif',
              boxShadow: focused ? '0 0 0 4px rgba(139,122,255,0.2)' : 'none',
            }}
          />

          {ACCESS_CODE && (
            <input
              type="text"
              placeholder="Class code"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={10}
              className="w-full px-4 py-3 rounded-2xl text-sm font-bold outline-none uppercase tracking-widest"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontFamily: 'Nunito, sans-serif',
              }}
            />
          )}

          {error && (
            <p className="text-sm font-semibold text-center" style={{ color: '#FF8C8C' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all mt-1 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #8B7AFF 0%, #B066FF 100%)',
              fontFamily: 'Fredoka, sans-serif',
              letterSpacing: '0.5px',
              boxShadow: name.trim() && !loading ? '0 8px 32px rgba(139,122,255,0.5)' : 'none',
              transform: name.trim() && !loading ? 'translateY(-1px)' : 'none',
            }}
          >
            {loading ? 'Loading…' : "Let's go! →"}
          </button>
        </form>
      </div>

      <p
        className="mt-6 text-xs"
        style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Nunito, sans-serif' }}
      >
        Powered by UG Labs
      </p>
    </div>
  )
}
