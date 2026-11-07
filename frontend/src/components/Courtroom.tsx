import { useEffect, useRef, useState, type FormEvent } from 'react'
import api from '../services/api'
import axios from 'axios'
import './Courtroom.css'

type Role = 'user' | 'claimant' | 'respondent' | 'judge'
type Message = { role: Role; text: string; phase?: 'question' | 'answer' }
type ContextItem = { storageKey: string; title: string; kind: 'file' | 'note'; hasContext: boolean }
type CourtBrief = { summary: string; notes: string; createdAt: string }
type CourtSession = { active: boolean; endsAt: string; nextAt: string; turn: number; lockedUntil?: string }
const characters: { role: Exclude<Role, 'user'>; name: string; color: string }[] = [
  { role: 'claimant', name: 'For the case', color: '#568ecb' },
  { role: 'judge', name: 'Judge', color: '#b96b59' },
  { role: 'respondent', name: 'Against the case', color: '#d65d5d' },
]

export default function Courtroom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<'all' | Exclude<Role, 'user'>>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contextText, setContextText] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [contextItems, setContextItems] = useState<ContextItem[]>([])
  const [contextNotice, setContextNotice] = useState('')
  const [contextBusy, setContextBusy] = useState(false)
  const [contextDirty, setContextDirty] = useState(false)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [session, setSession] = useState<CourtSession | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const stepping = useRef(false)
  const instructionInput = useRef<HTMLTextAreaElement>(null)
  const latestAgentMessage = session?.active && session.turn > 0 && clock < Date.parse(session.endsAt) ? [...messages].reverse().find(entry => entry.phase) : undefined
  function instruct(role: Exclude<Role, 'user'>) {
    setTarget(role)
    instructionInput.current?.focus()
    instructionInput.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }
  useEffect(() => {
    let active = true
    api.get<{ messages: Message[]; session: CourtSession | null }>(`/api/switch/rooms/${roomId}/courtroom`).then(r => { if (active) { setMessages(r.data.messages); setSession(r.data.session) } }).catch(() => { if (active) setError('Verify the Switch room before opening the courtroom.') })
    return () => { active = false }
  }, [roomId])
  useEffect(() => {
    if (!busy) return
    let active = true
    const timer = window.setInterval(() => {
      api.get<{ messages: Message[] }>(`/api/switch/rooms/${roomId}/courtroom`).then(response => { if (active) setMessages(response.data.messages) }).catch(() => undefined)
    }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [busy, roomId])
  useEffect(() => {
    if (!session?.active) return
    let active = true
    const timer = window.setInterval(async () => {
      const now = Date.now(); setClock(now)
      if (now >= Date.parse(session.endsAt) || stepping.current || now < Date.parse(session.nextAt) || (session.lockedUntil && now < Date.parse(session.lockedUntil))) return
      stepping.current = true
      try {
        const response = await api.post<{ messages: Message[]; session: CourtSession }>(`/api/switch/rooms/${roomId}/courtroom/session/step`, {}, { timeout: 210000 })
        if (active) { setMessages(response.data.messages); setSession(response.data.session) }
      } catch (err) {
        if (active && axios.isAxiosError(err) && err.response?.status === 409) {
          try { const latest = await api.get<{ messages: Message[]; session: CourtSession | null }>(`/api/switch/rooms/${roomId}/courtroom`); if (active) { setMessages(latest.data.messages); setSession(latest.data.session) } } catch { /* Retry on the next tick. */ }
        } else if (active) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'The court session stopped.'); setSession(previous => previous ? { ...previous, active: false } : null) }
      } finally { stepping.current = false }
    }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId, session])
  async function changeSession(start: boolean) {
    setError('')
    try {
      const response = start ? await api.post<{ session: CourtSession }>(`/api/switch/rooms/${roomId}/courtroom/session`) : await api.delete<{ session: CourtSession }>(`/api/switch/rooms/${roomId}/courtroom/session`)
      setClock(Date.now()); setSession(response.data.session)
    } catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Could not update the session.') }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get<{ text: string; storageKeys: string[]; brief: CourtBrief | null }>(`/api/switch/rooms/${roomId}/courtroom/context`), api.get<{ items: ContextItem[] }>(`/api/storage/chats/${roomId}/items`)]).then(([context, items]) => {
      if (!active) return
      const files = items.data.items.filter(item => item.kind === 'file')
      const fileKeys = context.data.storageKeys.filter(key => files.some(file => file.storageKey === key))
      setContextItems(files)
      setContextText(context.data.text); setSelectedKeys(fileKeys); setContextDirty(fileKeys.length !== context.data.storageKeys.length); setContextLoaded(true)
    }).catch(() => { if (active) setError('Could not load court context. Verify the room and try again.') })
    return () => { active = false }
  }, [roomId])
  async function saveContext(event: FormEvent) {
    event.preventDefault(); setContextBusy(true); setError(''); setContextNotice('')
    try { await api.put(`/api/switch/rooms/${roomId}/courtroom/context`, { text: contextText, storageKeys: selectedKeys }); setContextDirty(false); setContextNotice('Court context saved.') }
    catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Could not save court context.') }
    finally { setContextBusy(false) }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const response = await api.post<{ messages: Message[] }>(`/api/switch/rooms/${roomId}/courtroom`, { message, target }, { timeout: 600000 }); setMessages(response.data.messages); setMessage('') }
    catch (err) {
      setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'The simulation could not complete. Check the room connection and Groq configuration.')
      try { const response = await api.get<{ messages: Message[] }>(`/api/switch/rooms/${roomId}/courtroom`); setMessages(response.data.messages) } catch { /* Keep the visible transcript when refresh fails. */ }
    }
    finally { setBusy(false) }
  }
  return <section className="courtroom"><div className="courtroom-heading"><span>JURISMATE / SIMULATION</span><h2>Step into the courtroom.</h2><p>Explore both sides with your AI team.</p></div>
    <div className="court-stage" aria-label="The courtroom participants">{characters.map(c => <button type="button" key={c.role} className={`court-character ${c.role}`} onClick={() => instruct(c.role)} aria-label={`Give an instruction to ${c.name}`}>{latestAgentMessage?.role === c.role && <span className="court-speech"><span>{latestAgentMessage.phase === 'question' ? 'Question' : latestAgentMessage.phase === 'answer' ? 'Answer' : 'Says'}</span>{latestAgentMessage.text}</span>}<span className="court-instruct">Give instruction</span><svg viewBox="0 0 100 86" aria-hidden="true"><ellipse cx="50" cy="80" rx="34" ry="4" fill="#101b2a" opacity=".2"/><path d="M24 64v13h10V64m32 0v13h10V64" fill={c.color} stroke="#3a3130" strokeWidth="3"/><path d="M18 40 8 35l-3 8 13 5m64-8 10-5 3 8-13 5" fill={c.color} stroke="#3a3130" strokeWidth="3"/><rect x="18" y="18" width="64" height="49" rx="4" fill={c.color} stroke="#3a3130" strokeWidth="3"/><path d="M18 52h64v15H18z" fill="#20232a"/><path d="m38 52 7 12 5-7 5 7 7-12" fill="#fff"/><circle cx="37" cy="36" r="3" fill="#342d2d"/><circle cx="63" cy="36" r="3" fill="#342d2d"/><path d="M44 44q6 4 12 0" fill="none" stroke="#342d2d" strokeWidth="2"/>{c.role === 'judge' && <path d="M18 23q-2-13 9-12 6-7 13-2 8-5 14 0 8-5 14 2 14-2 14 12z" fill="#f2f0e9" stroke="#a5a09b" strokeWidth="2"/>}</svg><strong>{c.name}</strong><small>{c.role === 'judge' ? 'Neutral moderator' : 'AI advocate'}</small></button>)}</div>
    <div className="court-setup"><section className="court-context"><form onSubmit={saveContext}><label htmlFor="court-context-text">Topic</label><textarea id="court-context-text" value={contextText} onChange={event => { setContextText(event.target.value); setContextDirty(true); setContextNotice('') }} maxLength={4000} placeholder="What should the advocates discuss?" rows={2} />
        <details className="court-files"><summary>Storage files <span>{selectedKeys.length} / 5 selected</span></summary><fieldset><legend className="court-sr-only">Files from storage (up to 5)</legend>{contextItems.length === 0 ? <p>No files in this room's storage yet.</p> : contextItems.map(item => <label key={item.storageKey}><input type="checkbox" checked={selectedKeys.includes(item.storageKey)} disabled={!item.hasContext || (!selectedKeys.includes(item.storageKey) && selectedKeys.length >= 5)} onChange={event => { setSelectedKeys(previous => event.target.checked ? [...previous, item.storageKey] : previous.filter(key => key !== item.storageKey)); setContextDirty(true) }} /> {item.title}{!item.hasContext && ' — extract context in storage first'}</label>)}</fieldset></details>
        <button className="home-add" disabled={contextBusy || !contextLoaded}>{contextBusy ? 'Saving…' : 'Save topic and files'}</button>{contextNotice && <p role="status">{contextNotice}</p>}</form>
    </section>
    <section className="court-session"><h3>Court session</h3><p>{session?.active && clock < Date.parse(session.endsAt) ? `Time remaining: ${Math.floor(Math.max(0, Date.parse(session.endsAt) - clock) / 60000)}:${String(Math.floor(Math.max(0, Date.parse(session.endsAt) - clock) / 1000) % 60).padStart(2, '0')}` : '15-minute simulation'}</p><p>Agents take turns every 30 seconds. Keep this page open.</p>{session?.active && clock < Date.parse(session.endsAt) ? <button type="button" className="room-open" onClick={() => void changeSession(false)}>End session</button> : <button type="button" className="home-add" disabled={!contextLoaded || contextDirty || contextBusy} onClick={() => void changeSession(true)}>Start 15-minute session</button>}</section></div>
    <div className="court-transcript" aria-live="polite">{messages.length ? messages.map((entry, i) => <article key={i}><strong>{entry.role === 'user' ? 'You' : characters.find(c => c.role === entry.role)?.name}{entry.phase && ` · ${entry.phase === 'question' ? 'Question' : 'Answer'}`}</strong><p>{entry.text}</p></article>) : <p>Introduce the case or ask the team to examine an issue.</p>}{busy && <p>Agents are considering the case…</p>}</div>
    {error && <p className="home-error" role="alert">{error}</p>}<form onSubmit={send}><p>Addressing: {target === 'all' ? 'All three agents' : characters.find(character => character.role === target)?.name} {target !== 'all' && <button type="button" onClick={() => setTarget('all')}>Address everyone</button>}</p><label htmlFor="court-message">Your instruction</label><textarea ref={instructionInput} id="court-message" value={message} onChange={e => setMessage(e.target.value)} required maxLength={4000} placeholder="Ask the advocates to examine an issue…"/>{contextDirty && <p role="status">Save your updated court context before sending an instruction.</p>}<button className="home-add" disabled={busy || contextDirty || !contextLoaded}>{busy ? 'In session…' : 'Send instruction →'}</button></form>
  </section>
}
