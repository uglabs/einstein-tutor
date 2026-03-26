import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConversationManager } from '../lib/ug-js-sdk.mjs'
import { api } from '../lib/api'
import { getStoredUser } from '../lib/user'
import { LESSONS } from '../data/lessons'

// ── Avatar spritesheet config ─────────────────────────────────────────────────
const DIR = '/assets/avatars/spritesheets/albert/'
const STATES = {
  body_idle:                DIR + 'albert_idle.png',
  body_idle_think:          DIR + 'albert_thinking.png',
  body_idle_think2:         DIR + 'albert_thinking.png',
  body_talk_to_user_loop:   DIR + 'albert_speaking.png',
  body_talk_to_user_loop_2: DIR + 'albert_speaking_2.png',
  body_idle_listen:         DIR + 'albert_listening.png',
  idle_to_think:            DIR + 'albert_idle_to_think.png',
  idle_to_listen:           DIR + 'albert_idle_to_listen.png',
  think_to_speak:           DIR + 'albert_think_to_speak.png',
  speak_to_idle:            DIR + 'albert_speak_to_idle.png',
  listen_to_think:          DIR + 'albert_listen_to_think.png',
}
const FW = 218, FH = 290, FRAMES = 36, COLS = 6, MS_PF = 1000 / 20
const TRANSITION_ANIMS = new Set(['idle_to_think','idle_to_listen','think_to_speak','speak_to_idle','listen_to_think'])
const TRANSITION_MAP = {
  'body_idle:body_idle_think':               'idle_to_think',
  'body_idle:body_idle_listen':              'idle_to_listen',
  'body_idle_think:body_talk_to_user_loop':  'think_to_speak',
  'body_idle_think:body_talk_to_user_loop_2':'think_to_speak',
  'body_talk_to_user_loop:body_idle':        'speak_to_idle',
  'body_talk_to_user_loop_2:body_idle':      'speak_to_idle',
}

// ── Avatar player ─────────────────────────────────────────────────────────────
class AcePlayer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')
    this.imgs = {}; this.state = 'body_idle'; this.frame = 0
    this.loop = true; this.done = false; this.lastMs = 0; this._raf = null
    this._pendingQueue = []; this._preSpeakDone = false
    this._cameFromListening = false; this._speakLoopCount = 0
  }
  _load(url) {
    if (this.imgs[url]) return Promise.resolve(this.imgs[url])
    return new Promise(res => {
      const img = new Image()
      img.onload = () => { this.imgs[url] = img; res(img) }
      img.onerror = () => res(null)
      img.src = url
    })
  }
  async preload() {
    await this._load(STATES.body_idle); this._start()
    ;[...new Set(Object.values(STATES))].forEach(u => this._load(u))
  }
  _start() {
    if (this._raf) return
    const tick = ts => {
      this._raf = requestAnimationFrame(tick)
      if (this.done || ts - this.lastMs < MS_PF) return
      this.lastMs = ts; this._draw()
    }
    this._raf = requestAnimationFrame(tick)
  }
  _playDirect(name, loop) {
    this.state = name; this.frame = 0; this.loop = loop; this.done = false
    if (!this._raf) this._start()
  }
  _draw() {
    const img = this.imgs[STATES[this.state]]
    if (!img) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(img, (this.frame%COLS)*FW, Math.floor(this.frame/COLS)*FH, FW, FH, 0, 0, this.canvas.width, this.canvas.height)
    this.frame++
    if (this.frame >= FRAMES) {
      if (this.loop) {
        if (this.state === 'body_talk_to_user_loop' || this.state === 'body_talk_to_user_loop_2') {
          this._speakLoopCount++
          if (this.state === 'body_talk_to_user_loop' && this._speakLoopCount >= 2) { this._speakLoopCount = 0; this._playDirect('body_talk_to_user_loop_2', true) }
          else if (this.state === 'body_talk_to_user_loop_2' && this._speakLoopCount >= 1) { this._speakLoopCount = 0; this._playDirect('body_talk_to_user_loop', true) }
          else { this.frame = 0 }
        } else { this.frame = 0 }
      } else {
        if (this._pendingQueue.length > 0) { const {name,loop} = this._pendingQueue.shift(); this._playDirect(name,loop) }
        else { this.frame = FRAMES-1; this.done = true }
      }
    }
  }
  setAnimation(_layer, name, loop=true) {
    if (!STATES[name] || TRANSITION_ANIMS.has(name)) return
    if (name === 'body_talk_to_user_loop' || name === 'body_talk_to_user_loop_2') { name = 'body_talk_to_user_loop'; this._speakLoopCount = 0 }
    if (name === 'body_idle' && this._cameFromListening) return
    if (name === 'body_idle_listen') { this._cameFromListening = true }
    else if (name !== 'body_idle' && name !== 'body_idle_think') { this._cameFromListening = false }
    if (name === 'body_idle_think' && this._cameFromListening) {
      this._cameFromListening = false; this._preSpeakDone = true
      this._pendingQueue = [{name:'think_to_speak',loop:false}]; this._playDirect('listen_to_think',false); return
    }
    if ((name==='body_talk_to_user_loop'||name==='body_talk_to_user_loop_2') && (this._preSpeakDone||this.state==='think_to_speak')) {
      this._preSpeakDone = false; this._pendingQueue = []; this._playDirect(name,loop); return
    }
    const ta = TRANSITION_MAP[`${this.state}:${name}`]
    if (ta && STATES[ta]) { this._pendingQueue = [{name,loop}]; this._playDirect(ta,false) }
    else { this._pendingQueue = []; this._playDirect(name,loop) }
  }
  destroy() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null } }
}

function formatTime(secs) {
  return `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`
}

// ── Chat page ─────────────────────────────────────────────────────────────────
export default function Chat() {
  const { n } = useParams()
  const lessonNum = parseInt(n, 10)
  const lesson = LESSONS[lessonNum - 1]
  const navigate = useNavigate()
  const user = getStoredUser()

  const canvasRef = useRef(null)
  const managerRef = useRef(null)
  const transcriptRef = useRef([])
  const messageCountRef = useRef(0)
  const elapsedRef = useRef(0)
  const injectedRef = useRef(new Set())
  const timerRef = useRef(null)

  // Auto-end state machine
  const autoEndRef = useRef(false)           // true after closing injection fires
  const injectionFiredAtRef = useRef(null)   // elapsed time when injection fired
  const autoEndTriggeredRef = useRef(false)  // prevent double-trigger
  const endingRef = useRef(false)
  const handleEndLessonRef = useRef(null)    // updated each render — safe to call from SDK callback
  const pendingInjectionRef = useRef(null)   // injection queued for next idle (avoids mid-speech interrupt)
  const currentStateRef = useRef('waiting')  // tracks latest SDK state for synchronous checks
  const albertBufferRef = useRef([])         // accumulates all chunks in the current Albert turn

  const [statusText, setStatusText] = useState('Starting…')
  const [lastLine, setLastLine] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [ending, setEnding] = useState(false)
  const [wrappingUp, setWrappingUp] = useState(false)

  const sessionId = sessionStorage.getItem(`session_${lessonNum}`)

  // Keep ref current so SDK callbacks can call the latest version
  useEffect(() => {
    handleEndLessonRef.current = async () => {
      if (endingRef.current || !sessionId) return
      endingRef.current = true
      setEnding(true)
      stopTimer()
      try {
        await api.endSession(sessionId, transcriptRef.current, messageCountRef.current)
      } catch (err) {
        console.error(err)
      }
      navigate(`/lesson/${lessonNum}/post-quiz`)
    }
  })

  // ── Mute intercept ───────────────────────────────────────────────────────
  useEffect(() => {
    if (window._muteIntercepted) return
    window._muteIntercepted = true
    window._muted = false; window._masterGains = []
    const orig = AudioNode.prototype.connect
    AudioNode.prototype.connect = function(dest, ...args) {
      if (dest?.context?.destination === dest) {
        const ctx = dest.context
        if (!ctx._masterGain) {
          ctx._masterGain = ctx.createGain()
          orig.call(ctx._masterGain, dest)
          ctx._masterGain.gain.value = window._muted ? 0 : 1
          window._masterGains.push(ctx._masterGain)
        }
        return orig.call(this, ctx._masterGain, ...args)
      }
      return orig.call(this, dest, ...args)
    }
  }, [])

  // ── Init avatar + SDK ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lesson || !canvasRef.current || !user) return
    const canvas = canvasRef.current
    canvas.width = 746; canvas.height = 826
    const player = new AcePlayer(canvas)
    let cancelled = false

    // Prepend student name to the lesson prompt
    const prompt = `# STUDENT
The child's name is ${user.name}. You already know their name — do not ask for it. Address them warmly as ${user.name} where natural.

${lesson.prompt}`

    player.preload().then(async () => {
      if (cancelled) return
      const manager = new ConversationManager({
        apiUrl:      'https://pug.stg.uglabs.app/api',
        apiKey:      '0745b05178e232c5c54ebd21bfcf142997ebd531469a95985574130cddb8a128',
        federatedId: 'dc8a1a71155a63c72e22c5f3955454d7',
        prompt,
        voiceProfile: {
          speed: 1, provider: 'elevenlabs',
          voice_id: 'nzeAacJi50IvxcyDnMXa',
          stability: 0.5, similarity_boost: 0.75, deepdub_locale: 'en-US',
        },
        inputCapabilities: { audio: true, text: false },
        capabilities: { audio: true, subtitles: false, avatar: true },
        hooks: {
          onAvatarAnimationChanged: ({ name, layer, loop }) => {
            if (!window._muted) player.setAnimation(layer, name, loop)
          },
          onStateChange: (state) => {
            currentStateRef.current = state
            // Actual SDK states: waiting, playing, processing_complete, listening, error
            const labels = {
              waiting:            'Ready',
              playing:            'Speaking',
              processing_complete:'Just a moment…',
              listening:          'Listening…',
              initializing:       'Getting ready…',
              thinking:           'Thinking…',
              speaking:           'Speaking',
              idle:               'Ready',
              error:              'Reconnecting…',
            }
            setStatusText(labels[state] || state)

            console.log(`[STATE] ${state} | T=${elapsedRef.current}s | autoEnd=${autoEndRef.current} | injFiredAt=${injectionFiredAtRef.current} | pending=${!!pendingInjectionRef.current} | autoEndTriggered=${autoEndTriggeredRef.current}`)

            // Reset caption buffer when starting a new turn (before Albert's next response)
            if (state === 'waiting') {
              albertBufferRef.current = []
            }

            // Fire pending injection on processing_complete or waiting — mic is OFF, safe states
            // Do NOT fire on 'listening' or 'userSpeaking' (mic active → "provide either text or audio" error)
            if ((state === 'processing_complete' || state === 'waiting') && pendingInjectionRef.current) {
              const { message, isClosing } = pendingInjectionRef.current
              pendingInjectionRef.current = null
              console.log(`[INJECT] Firing wrap-up at T=${elapsedRef.current}s (state=processing_complete)`)
              setTimeout(() => managerRef.current?.sendText?.(message), 400)
              if (isClosing) {
                autoEndRef.current = true
                injectionFiredAtRef.current = elapsedRef.current
              }
              return
            }

            // Auto-end: Albert finished closing → processing_complete or waiting
            if (
              (state === 'processing_complete' || state === 'waiting' || state === 'idle') &&
              autoEndRef.current &&
              !autoEndTriggeredRef.current &&
              injectionFiredAtRef.current !== null &&
              elapsedRef.current >= injectionFiredAtRef.current + 4
            ) {
              console.log(`[AUTOEND] Triggering at T=${elapsedRef.current}s (injFiredAt=${injectionFiredAtRef.current})`)
              autoEndTriggeredRef.current = true
              setTimeout(() => handleEndLessonRef.current?.(), 1800)
            }

            // Error during wrap-up phase → end gracefully instead of being stuck
            if (state === 'error' && autoEndRef.current && !autoEndTriggeredRef.current) {
              console.log(`[AUTOEND] Error during wrap-up at T=${elapsedRef.current}s — ending gracefully`)
              autoEndTriggeredRef.current = true
              setTimeout(() => handleEndLessonRef.current?.(), 2500)
            }
          },
          onTextMessage: ({ text, role }) => {
            if (!text || text.startsWith('[SYSTEM')) return
            console.log(`[MSG] role=${role || 'assistant'} | "${text.substring(0, 80)}${text.length > 80 ? '…' : ''}"`)
            const entry = { role: role || 'assistant', content: text, ts: Date.now() }
            transcriptRef.current = [...transcriptRef.current, entry]
            if (role !== 'user') {
              messageCountRef.current += 1
              // Accumulate all chunks for this turn — SDK may fire multiple times per response
              albertBufferRef.current = [...albertBufferRef.current, text]
              setLastLine(albertBufferRef.current.join(' '))
            }
          },
          onError: (err) => { console.error('[SDK]', err); setStatusText('Error') },
        },
      })
      managerRef.current = manager
      await manager.initialize()
      if (!cancelled) { startTimer(); manager.startListening().catch(() => {}) }
    })

    return () => {
      cancelled = true
      player.destroy()
      stopTimer()
      // Silence all audio immediately on unmount (prevents ghost audio after navigation)
      try { window._masterGains?.forEach(n => { n.gain.value = 0 }) } catch {}
      window._muteIntercepted = false // reset so next session creates a fresh intercept
    }
  }, [])

  // ── Timer + injection ────────────────────────────────────────────────────
  function startTimer() {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(e => e + 1)

      // Periodic log every 5s so we can see the timer is alive
      if (elapsedRef.current % 5 === 0) {
        console.log(`[TIMER] T=${elapsedRef.current}s | state=${currentStateRef.current} | autoEnd=${autoEndRef.current} | injFiredAt=${injectionFiredAtRef.current} | pending=${!!pendingInjectionRef.current}`)
      }

      lesson.injections.forEach(({ at, message, isClosing }) => {
        if (elapsedRef.current >= at && !injectedRef.current.has(at)) {
          injectedRef.current.add(at)
          if (isClosing) {
            setWrappingUp(true)
            if (currentStateRef.current === 'processing_complete' || currentStateRef.current === 'idle' || currentStateRef.current === 'waiting') {
              // Mic is off — safe to send text now
              console.log(`[INJECT] T=${elapsedRef.current}s — firing immediately (state=${currentStateRef.current})`)
              setTimeout(() => managerRef.current?.sendText?.(message), 400)
              autoEndRef.current = true
              injectionFiredAtRef.current = elapsedRef.current
            } else {
              // Mic active or Albert speaking — queue for next processing_complete
              console.log(`[INJECT] T=${elapsedRef.current}s — queued (state=${currentStateRef.current})`)
              pendingInjectionRef.current = { message, isClosing }
            }
          } else {
            managerRef.current?.sendText?.(message)
          }
        }
      })

      // Fallback A: 30s after closing injection fired, SDK state never settled — force end
      if (
        autoEndRef.current &&
        !autoEndTriggeredRef.current &&
        injectionFiredAtRef.current !== null &&
        elapsedRef.current >= injectionFiredAtRef.current + 30
      ) {
        console.log(`[AUTOEND] Fallback A at T=${elapsedRef.current}s`)
        autoEndTriggeredRef.current = true
        handleEndLessonRef.current?.()
      }

      // Fallback B: 60s past scheduled injection time and injection never fired — force inject now
      lesson.injections.forEach(({ at, message, isClosing }) => {
        if (
          isClosing &&
          elapsedRef.current >= at + 60 &&
          !injectedRef.current.has(at) &&
          currentStateRef.current !== 'listening' &&
          currentStateRef.current !== 'userSpeaking'
        ) {
          injectedRef.current.add(at)
          console.log(`[INJECT] Fallback B at T=${elapsedRef.current}s — force injecting wrap-up`)
          setWrappingUp(true)
          setTimeout(() => managerRef.current?.sendText?.(message), 400)
          autoEndRef.current = true
          injectionFiredAtRef.current = elapsedRef.current
        }
      })
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  if (!lesson) return null

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: lesson.color }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('/assets/bg-einstein.png')" }}
      />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-5 pb-2">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito, sans-serif' }}
          >
            Lesson {lessonNum}
          </p>
          <h2
            className="text-lg font-bold text-white"
            style={{ fontFamily: 'Fredoka, sans-serif' }}
          >
            {lesson.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {wrappingUp && (
            <span
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'Nunito, sans-serif',
              }}
            >
              Wrapping up…
            </span>
          )}
          <span
            className="font-mono text-sm font-bold px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
          >
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Avatar — center stage */}
      <div className="relative z-10 flex flex-col items-center flex-1 justify-center" style={{ marginTop: -20 }}>
        <canvas
          ref={canvasRef}
          style={{ width: 370, height: 440, display: 'block' }}
        />
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#a0e080', animation: 'pulse-glow 2s ease-in-out infinite' }}
          />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Nunito, sans-serif' }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* What Albert just said */}
      {lastLine && (
        <div className="relative z-20 px-4 w-full pb-3">
          <div
            className="rounded-2xl px-5 py-4 leading-relaxed"
            style={{
              background: 'rgba(255,255,255,0.93)',
              backdropFilter: 'blur(16px)',
              color: '#191041',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              fontSize: 17,
              lineHeight: 1.5,
            }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider block mb-1.5"
              style={{ color: '#9496AE', fontFamily: 'Nunito, sans-serif' }}
            >
              Albert says
            </span>
            {lastLine}
          </div>
        </div>
      )}

      {/* End lesson — always visible */}
      <div className="relative z-20 flex justify-center pb-8 px-4">
        <button
          onClick={() => handleEndLessonRef.current?.()}
          disabled={ending}
          className="px-8 py-3 rounded-2xl font-bold text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(255,255,255,0.25)',
            color: '#fff',
            fontFamily: 'Nunito, sans-serif',
            cursor: ending ? 'default' : 'pointer',
          }}
        >
          {ending ? 'Saving lesson… 📚' : 'End Lesson →'}
        </button>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #a0e080; }
          50% { opacity: 0.4; box-shadow: none; }
        }
      `}</style>
    </div>
  )
}
