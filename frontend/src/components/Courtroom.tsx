import { useEffect, useRef, useState, type FormEvent } from 'react'
import api from '../services/api'
import axios from 'axios'
import './Courtroom.css'

type Role = 'user' | 'claimant' | 'respondent' | 'judge'
type Message = { role: Role; text: string }
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
  const instructionInput = useRef<HTMLTextAreaElement>(null)
  function instruct(role: Exclude<Role, 'user'>) {
    setTarget(role)
    instructionInput.current?.focus()
    instructionInput.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }
  useEffect(() => {
    let active = true
    api.get<{ messages: Message[] }>(`/api/switch/rooms/${roomId}/courtroom`).then(r => { if (active) setMessages(r.data.messages) }).catch(() => { if (active) setError('Verify the Switch room before opening the courtroom.') })
    return () => { active = false }
  }, [roomId])
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const response = await api.post<{ messages: Message[] }>(`/api/switch/rooms/${roomId}/courtroom`, { message, target }, { timeout: 600000 }); setMessages(response.data.messages); setMessage('') }
    catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'The simulation could not complete. Check the room connection and Groq configuration.') }
    finally { setBusy(false) }
  }
  return <section className="courtroom"><div className="courtroom-heading"><span>JURISMATE / SIMULATION</span><h2>Step into the courtroom.</h2><p>Explore both sides of your case with your AI team.</p></div>
    <div className="court-stage" aria-label="The courtroom participants">{characters.map(c => <button type="button" key={c.role} className={`court-character ${c.role}`} onClick={() => instruct(c.role)} aria-label={`Give an instruction to ${c.name}`}><span className="court-instruct">Give instruction</span><svg viewBox="0 0 100 86" aria-hidden="true"><ellipse cx="50" cy="80" rx="34" ry="4" fill="#101b2a" opacity=".2"/><path d="M24 64v13h10V64m32 0v13h10V64" fill={c.color} stroke="#3a3130" strokeWidth="3"/><path d="M18 40 8 35l-3 8 13 5m64-8 10-5 3 8-13 5" fill={c.color} stroke="#3a3130" strokeWidth="3"/><rect x="18" y="18" width="64" height="49" rx="4" fill={c.color} stroke="#3a3130" strokeWidth="3"/><path d="M18 52h64v15H18z" fill="#20232a"/><path d="m38 52 7 12 5-7 5 7 7-12" fill="#fff"/><circle cx="37" cy="36" r="3" fill="#342d2d"/><circle cx="63" cy="36" r="3" fill="#342d2d"/><path d="M44 44q6 4 12 0" fill="none" stroke="#342d2d" strokeWidth="2"/>{c.role === 'judge' && <path d="M18 23q-2-13 9-12 6-7 13-2 8-5 14 0 8-5 14 2 14-2 14 12z" fill="#f2f0e9" stroke="#a5a09b" strokeWidth="2"/>}</svg><strong>{c.name}</strong><small>{c.role === 'judge' ? 'Neutral moderator' : 'AI advocate'}</small></button>)}</div>
    <p className="court-disclosure">Simulation only, not a court judgment. Case chat and extracted storage text are sent to Groq; online search may use this context. Check sources and legal conclusions yourself.</p>
    <div className="court-transcript" aria-live="polite">{messages.length ? messages.map((entry, i) => <article key={i}><strong>{entry.role === 'user' ? 'You' : characters.find(c => c.role === entry.role)?.name}</strong><p>{entry.text}</p></article>) : <p>Introduce the case or ask the team to examine an issue.</p>}{busy && <p>Agents are considering the case…</p>}</div>
    {error && <p className="home-error" role="alert">{error}</p>}<form onSubmit={send}><label htmlFor="court-target">Address</label><select id="court-target" value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="all">All three agents</option><option value="claimant">For the case</option><option value="respondent">Against the case</option><option value="judge">Judge</option></select><label htmlFor="court-message">Your instruction</label><textarea ref={instructionInput} id="court-message" value={message} onChange={e => setMessage(e.target.value)} required maxLength={4000} placeholder="Ask the advocates to examine an issue…"/><button className="home-add" disabled={busy}>{busy ? 'In session…' : 'Send instruction →'}</button></form>
  </section>
}
