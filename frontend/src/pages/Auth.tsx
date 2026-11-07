import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Brand from '../components/Brand'
import Icon from '../components/Icon'
import ThemeToggle from '../components/ThemeToggle'
import AuthStory from '../components/AuthStory'
import '../styles/tokens.css'
import './Auth.css'
import { useAppDispatch } from '../context/hooks'
import { setAuthenticated } from '../context/authSlice'
import { apiBase, authRequest } from '../services/api'

type AuthMode = 'signin' | 'signup' | 'verify'

export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dispatch = useAppDispatch()
  const initialMode: AuthMode = params.get('mode') === 'signup' ? 'signup' : 'signin'
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  function changeMode(next: AuthMode) { setMode(next); setError(''); setSuccess('') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    if (mode === 'signup' && password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') { await authRequest('signup', { email, password, confirmPassword }); setMode('verify'); setSuccess('We sent a verification code to your email.') }
      else if (mode === 'verify') { await authRequest('verify-otp', { email, otp }); dispatch(setAuthenticated()); navigate(sessionStorage.getItem('room-invite') ? '/invite' : '/home') }
      else { await authRequest('signin', { email, password }); dispatch(setAuthenticated()); navigate(sessionStorage.getItem('room-invite') ? '/invite' : '/home') }
    } catch (err) { setError(err instanceof TypeError ? 'Could not reach the server. Please try again.' : err instanceof Error ? err.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }
  const title = mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'A little more clarity awaits.' : 'Check your inbox.'
  return <main className="auth-page auth-redesign"><div className="auth-main"><div className="auth-header"><Brand onClick={() => navigate('/')} /><div className="auth-header-actions"><ThemeToggle /><button className="back-link" onClick={() => navigate('/')}><Icon name="back" size={16} /> Back to home</button></div></div><div className="auth-content"><div className="auth-form-wrap"><div className="auth-kicker"><span className="eyebrow-dot" /> YOUR WORK, THOUGHTFULLY ORGANIZED</div><h1>{mode === 'signin' ? <>Welcome <em>back.</em></> : title}</h1><p className="auth-subtitle">{mode === 'signin' ? 'Pick up right where you left off.' : mode === 'signup' ? 'Create your account and make space for better work.' : <>Enter the 6-digit verification code sent to <strong>{email}</strong>.</>}</p>
    {mode !== 'verify' && <div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'selected' : ''} onClick={() => changeMode('signin')}>Sign in</button><button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} onClick={() => changeMode('signup')}>Create account</button></div>}
    <form onSubmit={submit} className="auth-form">{mode !== 'verify' ? <><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}><Icon name="eye" size={19} /></button></div>{mode === 'signup' && <><p className="password-hint">8–50 characters, with uppercase, lowercase, a number and a symbol.</p><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirm your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></>}</> : <><label htmlFor="otp">Verification code</label><input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Enter 6-digit code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></>}
      {error && <p className="form-message error" role="alert">{error}</p>}{success && <p className="form-message success" role="status">{success}</p>}
      <button className="button button-dark submit-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Verify email'} <Icon name="arrow" size={17} /></button>
    </form>{mode === 'verify' ? <button className="switch-mode" type="button" onClick={() => changeMode('signup')}>← Back to account details</button> : <><div className="divider"><span />or continue with<span /></div><a className="google-button" href={`${apiBase}/api/auth/google`}><span className="google-g">G</span> Continue with Google</a><p className="auth-switch">{mode === 'signin' ? 'New to JurisMate?' : 'Already have an account?'} <button onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></>}
    <p className="auth-security"><Icon name="lock" size={14} /> Your work, with you in control.</p></div></div><div className="auth-bottom">© {new Date().getFullYear()} JurisMate <span>BUILT FOR THOUGHTFUL WORK</span></div></div><AuthStory /></main>
}
