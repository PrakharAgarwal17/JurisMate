import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import OAuthCallback from './pages/OAuthCallback'
import Home from './pages/Home'
import Room from './pages/Room'
import JoinRoom from './pages/JoinRoom'

export default function App() {
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/home" element={<Home />} />
    <Route path="/rooms/:roomId" element={<Room />} />
    <Route path="/invite" element={<JoinRoom />} />
    <Route path="/oauth/callback" element={<OAuthCallback />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
