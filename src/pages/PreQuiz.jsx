import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { getStoredUser } from '../lib/user'
import { LESSONS } from '../data/lessons'

function seededRand(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function Starfield({ seed = 11 }) {
  const stars = useMemo(() => {
    const r = seededRand(seed)
    return Array.from({ length: 80 }, (_, i) => ({
      id: i, size: r() * 2 + 0.5,
      x: r() * 100, y: r() * 100,
      delay: r() * 6, duration: r() * 3 + 2, opacity: r() * 0.4 + 0.15,
    }))
  }, [seed])
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} className="absolute rounded-full bg-white" style={{
          width: s.size, height: s.size, left: `${s.x}%`, top: `${s.y}%`,
          opacity: s.opacity, animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
      <style>{`@keyframes twinkle { 0%,100%{opacity:inherit;transform:scale(1)} 50%{opacity:0.05;transform:scale(0.4)} }`}</style>
    </div>
  )
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
let _quizAudio = null
async function speak(text) {
  if (_quizAudio) { _quizAudio.pause(); URL.revokeObjectURL(_quizAudio.src); _quizAudio = null }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/nzeAacJi50IvxcyDnMXa/stream', {
      method: 'POST',
      headers: { 'xi-api-key': 'sk_1d397cf59adfecb2739f56b3bc554688ae15661bb1c7e7f1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    })
    if (!res.ok) throw new Error('TTS error')
    const url = URL.createObjectURL(await res.blob())
    const audio = new Audio(url)
    _quizAudio = audio
    audio.play()
    audio.onended = () => { URL.revokeObjectURL(url); if (_quizAudio === audio) _quizAudio = null }
  } catch (err) {
    console.warn('TTS failed', err)
  }
}
function stopSpeaking() {
  if (_quizAudio) { _quizAudio.pause(); _quizAudio = null }
}

const LESSON_META = [
  { gradient: 'linear-gradient(135deg, #4C1D95, #7C3AED)', accent: '#A78BFA', glow: 'rgba(124,58,237,0.4)' },
  { gradient: 'linear-gradient(135deg, #78350F, #D97706)', accent: '#FCD34D', glow: 'rgba(217,119,6,0.4)' },
  { gradient: 'linear-gradient(135deg, #7F1D1D, #EA580C)', accent: '#FB923C', glow: 'rgba(234,88,12,0.4)' },
]

export default function PreQuiz() {
  const { n } = useParams()
  const lessonNum = parseInt(n, 10)
  const lesson = LESSONS[lessonNum - 1]
  const meta = LESSON_META[lessonNum - 1] || LESSON_META[0]
  const navigate = useNavigate()
  const user = getStoredUser()

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  // Read question aloud whenever it changes
  useEffect(() => {
    if (lesson?.quiz[current]) speak(lesson.quiz[current].question)
    return () => stopSpeaking()
  }, [current])

  if (!lesson) return null

  const q = lesson.quiz[current]
  const isLast = current === lesson.quiz.length - 1

  async function handleNext() {
    stopSpeaking()
    const newAnswers = [...answers, selected]
    if (!isLast) {
      setAnswers(newAnswers); setSelected(null); setCurrent(c => c + 1); return
    }
    setSaving(true)
    try {
      const { session_id } = await api.startSession(user.id, lessonNum)
      sessionStorage.setItem(`session_${lessonNum}`, session_id)
      await api.saveQuiz(session_id, true, newAnswers, lesson.quiz.map(q => q.correct))
      navigate(`/lesson/${lessonNum}/chat`)
    } catch (err) {
      console.error(err); setSaving(false)
    }
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(170deg, #07051a 0%, #0d0b2e 40%, #140b38 100%)' }}
    >
      <Starfield seed={11} />

      {/* Nebula glow */}
      <div className="fixed pointer-events-none" style={{ zIndex: 0, inset: 0 }}>
        <div style={{ position: 'absolute', top: '-5%', left: '15%', width: 500, height: 350,
          background: `radial-gradient(ellipse, ${meta.glow.replace('0.4','0.1')} 0%, transparent 70%)` }} />
      </div>

      {/* Content */}
      <div className="relative flex flex-col flex-1 px-5 py-8" style={{ zIndex: 2, maxWidth: 600, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="mb-6 text-center">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
            style={{ background: 'rgba(139,122,255,0.2)', color: '#C4BCFF', border: '1px solid rgba(139,122,255,0.3)' }}
          >
            Lesson {lessonNum} · {lesson.title}
          </span>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            Quick check before we start!
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito, sans-serif' }}>
            No right or wrong — just curious what you already know 🧠
          </p>
        </div>

        {/* Progress pips */}
        <div className="flex gap-2 justify-center mb-6">
          {lesson.quiz.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              height: 6,
              width: i === current ? 28 : 8,
              background: i < current ? meta.accent : i === current ? meta.accent : 'rgba(255,255,255,0.15)',
              opacity: i > current ? 0.5 : 1,
              boxShadow: i === current ? `0 0 8px ${meta.accent}` : 'none',
            }} />
          ))}
        </div>

        {/* Question card */}
        <div
          className="rounded-3xl p-6 flex-1 flex flex-col"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: `0 8px 40px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Question number + read button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.accent, fontFamily: 'Nunito, sans-serif' }}>
              Question {current + 1} of {lesson.quiz.length}
            </span>
            <button
              onClick={() => speak(q.question)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              title="Read question aloud"
            >
              🔊
            </button>
          </div>

          {/* Question text */}
          <p className="font-bold mb-6 leading-snug" style={{
            color: '#fff',
            fontFamily: 'Fredoka, sans-serif',
            fontSize: 22,
          }}>
            {q.question}
          </p>

          {/* Options */}
          <div className="flex flex-col gap-3 flex-1">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="text-left rounded-2xl transition-all duration-200 flex items-center gap-3"
                style={{
                  padding: '14px 18px',
                  background: selected === i ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${selected === i ? meta.accent : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: selected === i ? `0 0 16px ${meta.glow}` : 'none',
                  color: '#fff',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                <span
                  className="inline-flex flex-shrink-0 items-center justify-center font-bold rounded-xl"
                  style={{
                    width: 32, height: 32, fontSize: 13,
                    background: selected === i ? meta.gradient : 'rgba(255,255,255,0.1)',
                    color: selected === i ? '#fff' : 'rgba(255,255,255,0.5)',
                    boxShadow: selected === i ? `0 0 10px ${meta.glow}` : 'none',
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleNext}
            disabled={selected === null || saving}
            className="mt-6 w-full rounded-2xl font-bold text-white transition-all disabled:opacity-30"
            style={{
              padding: '16px',
              fontSize: 17,
              background: selected !== null && !saving ? meta.gradient : 'rgba(255,255,255,0.1)',
              fontFamily: 'Fredoka, sans-serif',
              letterSpacing: '0.3px',
              boxShadow: selected !== null && !saving ? `0 6px 24px ${meta.glow}` : 'none',
              border: 'none',
            }}
          >
            {saving ? 'Starting…' : isLast ? 'Start Lesson with Albert →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
