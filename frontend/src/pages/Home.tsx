import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import ThemeToggle from '../components/ThemeToggle'
import { useAppDispatch } from '../context/hooks'
import { clearAuthentication, setAuthenticated } from '../context/authSlice'
import api from '../services/api'
import './Home.css'

type Room = { _id: string; name: string; platform: 'discord' | 'slack'; switchRoomId: string; connected: boolean }

export default function Home() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [rooms, setRooms] = useState<Room[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<'discord' | 'slack'>('discord')
  const [channelUrl, setChannelUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let response
        try { response = await api.get<{ rooms: Room[] }>('/api/switch/rooms') }
        catch (err) {
          if (!axios.isAxiosError(err) || err.response?.status !== 401) throw err
          await api.post('/api/auth/refresh')
          response = await api.get<{ rooms: Room[] }>('/api/switch/rooms')
        }
        const profile = await api.get<{ user: { displayName: string | null } }>('/api/auth/me')
        if (active) { setRooms(response.data.rooms); setDisplayName(profile.data.user.displayName || ''); dispatch(setAuthenticated()) }
      } catch (err) {
        if (!active) return
        if (axios.isAxiosError(err) && err.response?.status === 401) { dispatch(clearAuthentication()); navigate('/auth', { replace: true }); return }
        setError('Could not load your rooms. Please refresh and try again.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [dispatch, navigate])

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await api.post<{ room: Room }>('/api/switch/rooms', { name, platform, channelUrl })
      setRooms(previous => [response.data.room, ...previous.filter(room => room._id !== response.data.room._id)])
      setName(''); setChannelUrl(''); setShowForm(false)
    } catch (err) {
      setError(axios.isAxiosError(err) && typeof err.response?.data?.msg === 'string' ? err.response.data.msg : 'Could not save this room. Please try again.')
    } finally { setSaving(false) }
  }

  async function signOut() {
    try { await api.post('/api/auth/signout'); dispatch(clearAuthentication()); navigate('/', { replace: true }) }
    catch { setError('Could not sign out. Please try again.') }
  }

  return <main className="home-page">
    <header className="home-header"><Brand onClick={() => navigate('/home')} /><div><ThemeToggle /><button className="home-signout" onClick={signOut}>Sign out</button></div></header>
    <div className="workspace-shell"><aside className="workspace-sidebar" aria-label="Workspace navigation"><div className="workspace-sidebar-label">YOUR WORKSPACE</div><a className="workspace-nav-item selected" href="#your-rooms"><span aria-hidden="true">▦</span> Overview</a><button className="workspace-nav-item" onClick={() => setShowForm(true)}><span aria-hidden="true">＋</span> Add a room</button><div className="workspace-sidebar-note"><span>YOUR SPACE</span><p>Everything for your matters, in one place.</p></div></aside><div className="home-layout">
      <section className="home-heading"><div><span className="home-eyebrow">YOUR WORKSPACE / OVERVIEW</span><h1>{displayName ? <>Welcome, <em>{displayName}.</em></> : <>Good to have you <em>here.</em></>}</h1><p>A quieter space for the work that matters.</p></div><div className="workspace-overview"><span>YOUR ROOMS</span><strong>{loading ? '—' : rooms.length.toString().padStart(2, '0')}</strong><small>Conversations, together.</small></div></section>
      <section className="rooms-section" id="your-rooms" aria-labelledby="rooms-heading"><div className="rooms-title"><div><span className="home-eyebrow">MATTER BY MATTER</span><h2 id="rooms-heading">Your rooms <span>{rooms.length.toString().padStart(2, '0')}</span></h2><p>Keep your matters and their connected conversations together.</p></div><button className="home-add" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : '+ Add a room'}</button></div>
      {error && <p className="home-error" role="alert">{error}</p>}
      {showForm && <form className="room-form" onSubmit={addRoom}><div><h3>Connect a channel</h3><p>Connect your channel to Switch and invite the JurisMate agent. Paste the channel link to create its workspace.</p></div><label>Room name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sharma matter" /></label><label>Platform<select value={platform} onChange={e => setPlatform(e.target.value as 'discord' | 'slack')}><option value="discord">Discord</option><option value="slack">Slack</option></select></label><label>Channel link<input required type="url" maxLength={500} value={channelUrl} onChange={e => setChannelUrl(e.target.value)} placeholder={platform === 'discord' ? 'https://discord.com/channels/…' : 'https://workspace.slack.com/archives/…'} /></label><button className="home-add" disabled={saving}>{saving ? 'Connecting…' : 'Connect room'}</button></form>}
      {loading ? <p className="home-status">Loading your rooms…</p> : rooms.length ? <div className="room-grid">{rooms.map(room => <article className="room-card" key={room._id}><div className="room-card-top"><span className={`platform-icon ${room.platform}`}>{room.platform === 'discord' ? 'D' : 'S'}</span><span className="room-status">{room.connected ? 'SAVED' : 'DISCONNECTED'}</span></div><h3>{room.name}</h3><p>{room.platform === 'discord' ? 'Discord' : 'Slack'} · Switch room</p><button className="room-open" onClick={() => navigate(`/rooms/${room._id}`)}>Open room →</button></article>)}</div> : <div className="room-empty"><div className="empty-icon" aria-hidden="true">01</div><h3>A little space for your next case.</h3><p>Once your room is set up in Switch, add it here to keep it close.</p></div>}
      </section><p className="home-footnote">Your work, thoughtfully organized.</p>
    </div></div>
  </main>
}
