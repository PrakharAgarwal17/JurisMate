import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import Icon from '../components/Icon'
import { useAppDispatch } from '../context/hooks'
import { setAuthenticated } from '../context/authSlice'
import api from '../services/api'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
  useEffect(() => {
    let active = true
    api.get('/api/switch/rooms')
      .then(() => { if (active) { dispatch(setAuthenticated()); navigate(sessionStorage.getItem('room-invite') ? '/invite' : '/home', { replace: true }) } })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [dispatch, navigate])
  return <main className="callback-page"><Brand onClick={() => navigate('/')} /><div><span className="section-label">WELCOME TO JURISMATE</span><h1>{status === 'checking' ? 'Checking your sign-in…' : status === 'success' ? "You're signed in." : 'Could not confirm sign-in.'}</h1><p>{status === 'success' ? 'Your workspace is coming soon.' : status === 'error' ? 'Please try signing in again.' : 'Just a moment.'}</p><button className="button button-dark" onClick={() => navigate(status === 'error' ? '/auth' : '/')}>{status === 'error' ? 'Back to sign in' : 'Back to home'} <Icon name="arrow" size={16} /></button></div></main>
}
