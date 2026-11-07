import { useCallback, useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Brand from '../components/Brand'
import ThemeToggle from '../components/ThemeToggle'
import RoomStorage from '../components/RoomStorage'
import Courtroom from '../components/Courtroom'
import api from '../services/api'
import './Home.css'

type RoomInfo = { _id: string; name: string; platform: string; connected: boolean; ownerId: string; switchVerified?: boolean }
type Entry = { id: string; sender_name?: string; body?: string; timestamp?: number; kind?: string }
type History = { threads?: { root: Entry; replies?: Entry[] }[]; truncated?: boolean }

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<RoomInfo>()
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [view, setView] = useState<'chat' | 'storage' | 'courtroom'>('chat')
  const [isOwner, setIsOwner] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [history, setHistory] = useState<History>()
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantError, setAssistantError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let response
        try { response = await api.get<{ rooms: RoomInfo[] }>('/api/switch/rooms') }
        catch (err) {
          if (!axios.isAxiosError(err) || err.response?.status !== 401) throw err
          await api.post('/api/auth/refresh'); response = await api.get<{ rooms: RoomInfo[] }>('/api/switch/rooms')
        }
        const selected = response.data.rooms.find(item => item._id === roomId)
        const profile = await api.get<{ user: { id: string } }>('/api/auth/me')
        if (active) { setRoom(selected); setIsOwner(selected?.ownerId === profile.data.user.id) }
      } catch (err) {
        if (!active) return
        if (axios.isAxiosError(err) && err.response?.status === 401) { navigate('/auth', { replace: true }); return }
        setError('Could not load this room. Please try again.')
      } finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [navigate, roomId])

  const loadHistory = useCallback(async () => {
    try { const response = await api.get<{ history: History }>(`/api/switch/rooms/${roomId}/messages`); setHistory(response.data.history); setHistoryError('') }
    catch { setHistoryError('Could not load messages from Switch. Check the connection and try again.') }
  }, [roomId])
  useEffect(() => {
    if (!room?.switchVerified || view !== 'chat') return
    const first = window.setTimeout(() => void loadHistory(), 0)
    const timer = window.setInterval(() => void loadHistory(), 10000)
    return () => { window.clearTimeout(first); window.clearInterval(timer) }
  }, [room?.switchVerified, view, loadHistory])
  async function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!assistantQuestion.trim() || !roomId) return
    setAssistantBusy(true); setAssistantError(''); setAssistantAnswer('')
    try { const response = await api.post<{ answer: string }>(`/api/switch/rooms/${roomId}/assistant`, { question: assistantQuestion.trim() }, { timeout: 200000 }); setAssistantAnswer(response.data.answer) }
    catch (err) { setAssistantError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Could not answer right now. Please try again.') }
    finally { setAssistantBusy(false) }
  }
  async function requestCode() {
    setVerifying(true); setError(''); setNotice('')
    try { await api.post(`/api/switch/rooms/${roomId}/verification`); setRoom(previous => previous ? { ...previous, switchVerified: false } : previous); setNotice('Code sent to the Switch room. It expires in five minutes.') }
    catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Could not send the verification code.') }
    finally { setVerifying(false) }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setVerifying(true); setError(''); setNotice('')
    try { await api.post(`/api/switch/rooms/${roomId}/verification/confirm`, { code }); setRoom(previous => previous ? { ...previous, switchVerified: true } : previous); setCode(''); setNotice('Switch room access verified.') }
    catch (err) { setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Verification failed.') }
    finally { setVerifying(false) }
  }
  async function createInvite() {
    setError('')
    try { const response = await api.post<{ token: string }>(`/api/switch/rooms/${roomId}/invite`); setInviteLink(`${window.location.origin}/invite#${response.data.token}`) }
    catch { setError('Could not create an invitation.') }
  }
  async function endCollaboration() {
    setError('')
    try { await api.delete(`/api/switch/rooms/${roomId}/collaboration`); setInviteLink(''); setNotice('Collaboration ended. Existing collaborators no longer have access.') }
    catch { setError('Could not end collaboration.') }
  }
  const entries = history?.threads?.flatMap(thread => [thread.root, ...(thread.replies ?? [])]).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)) ?? []

  return <main className="home-page"><header className="home-header"><Brand onClick={() => navigate('/home')} /><div><ThemeToggle /><button className="home-signout" onClick={() => navigate('/home')}>← Your rooms</button></div></header>
    <div className="workspace-shell"><aside className="workspace-sidebar" aria-label="Room navigation"><div className="workspace-sidebar-label">THIS ROOM</div><button className={`workspace-nav-item${view === 'chat' ? ' selected' : ''}`} onClick={() => setView('chat')}><span aria-hidden="true">▤</span> Conversation</button><button className={`workspace-nav-item${view === 'storage' ? ' selected' : ''}`} onClick={() => setView('storage')}><span aria-hidden="true">▱</span> Storage</button><button className={`workspace-nav-item${view === 'courtroom' ? ' selected' : ''}`} onClick={() => setView('courtroom')}><span aria-hidden="true">⚖</span> Courtroom</button><div className="workspace-sidebar-note"><span>YOUR MATTER</span><p>Keep the conversation and documents close.</p></div></aside><div className="home-layout"><section className="home-heading room-heading"><div><span className="home-eyebrow">YOUR SWITCH ROOM / {view === 'chat' ? 'CONVERSATION' : view.toUpperCase()}</span><h1>{loading ? 'Opening room…' : room ? room.name : 'Room unavailable'}</h1><p>{room ? `${room.platform === 'discord' ? 'Discord' : 'Slack'} · Switch room` : 'Return to your rooms and try again.'}</p></div></section>
      {error && <p className="home-error" role="alert">{error}</p>}{notice && <p className="room-notice" role="status">{notice}</p>}
      {room && <>{isOwner && <section className="collaboration"><button className="room-open" onClick={() => void createInvite()}>Create collaboration link</button><button className="room-open" onClick={() => void endCollaboration()}>End collaboration</button>{inviteLink && <><label htmlFor="invite-link">Share this link (expires in 24 hours)</label><input id="invite-link" value={inviteLink} readOnly onFocus={event => event.currentTarget.select()} /></>}</section>}
        <div className="room-tabs"><button aria-pressed={view === 'chat'} onClick={() => setView('chat')}>Chat</button><button aria-pressed={view === 'storage'} onClick={() => setView('storage')}>Storage</button><button aria-pressed={view === 'courtroom'} onClick={() => setView('courtroom')}>Courtroom</button></div>
        {view === 'storage' && roomId ? <RoomStorage roomId={roomId} /> : view === 'courtroom' && roomId ? <Courtroom roomId={roomId} /> : <section className="switch-room chat-panel"><div className="chat-heading"><div><span className="home-eyebrow">ROOM CONVERSATION</span><h2>Talk to your Switch room</h2></div>{room.switchVerified && <button className="room-open" onClick={() => void loadHistory()}>Refresh</button>}</div>
          {!room.switchVerified ? <div className="room-verification"><h3>Verify access to this Switch room</h3><p>The room owner can request a code in the connected Switch room and enter it here. Everyone with access to that chat can see the code.</p>{isOwner ? <><button className="home-add" type="button" disabled={verifying} onClick={() => void requestCode()}>Send verification code</button><form onSubmit={verify}><label htmlFor="verify-code">Six-digit code</label><input id="verify-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /><button className="home-add" disabled={verifying}>Verify room</button></form></> : <p>Ask the room owner to verify access first.</p>}</div> : <><div className="chat-history" aria-label="Switch room messages">{historyError ? <p role="alert">{historyError}</p> : !history ? <p>Loading messages…</p> : entries.length ? entries.map(entry => <article className="chat-message" key={entry.id}><strong>{entry.sender_name || 'Switch'}</strong><p>{entry.body || ''}</p></article>) : <p>No messages yet in this room.</p>}{history?.truncated && <p>Showing recent messages only.</p>}</div><section className="room-assistant"><h3>Ask about this conversation</h3><p>Your question and recent room messages are shared with an external AI service. The answer is visible only here.</p><form onSubmit={askAssistant}><label htmlFor="assistant-question">Your question</label><textarea id="assistant-question" value={assistantQuestion} onChange={event => setAssistantQuestion(event.target.value)} maxLength={4000} placeholder="What would you like to know about this discussion?" required /><button className="home-add" disabled={assistantBusy || !room.connected}>{assistantBusy ? 'Thinking…' : 'Ask →'}</button></form>{assistantError && <p role="alert">{assistantError}</p>}{assistantAnswer && <article className="chat-message" aria-live="polite"><strong>Answer</strong><p style={{ whiteSpace: 'pre-wrap' }}>{assistantAnswer}</p></article>}</section></>}
        </section>}
      </>}
    </div></div></main>
}
