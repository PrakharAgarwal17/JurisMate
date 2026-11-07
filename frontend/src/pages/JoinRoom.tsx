import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Home.css'

export default function JoinRoom() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    const token = window.location.hash.slice(1) || sessionStorage.getItem('room-invite')
    if (!token) return
    sessionStorage.setItem('room-invite', token)
    window.history.replaceState(null, '', '/invite')
  }, [])
  async function join() {
    const token = sessionStorage.getItem('room-invite')
    if (!token) { setError('Invitation is missing.'); return }
    try {
      const response = await api.post<{ roomId: string }>('/api/switch/invitations/join', { token })
      sessionStorage.removeItem('room-invite'); navigate(`/rooms/${response.data.roomId}`, { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) { navigate('/auth'); return }
      setError('This invitation is invalid or has expired.')
    }
  }
  return <main className="home-page"><div className="home-layout"><section className="switch-room"><span className="home-eyebrow">ROOM INVITATION</span><h2>Join a workspace</h2><p>Sign in to accept this invitation and access the room.</p>{error && <p className="home-error" role="alert">{error}</p>}<button className="home-add" onClick={() => void join()}>Accept invitation</button></section></div></main>
}
