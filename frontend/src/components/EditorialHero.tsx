import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import handPen from '../assets/hand-pen.png'
import './EditorialHero.css'

const palettes = ['terracotta', 'forest', 'indigo', 'berry'] as const
type Palette = typeof palettes[number]

export default function EditorialHero() {
  const navigate = useNavigate()
  const [palette, setPalette] = useState<Palette>(() => {
    try { const value = localStorage.getItem('jurismate-palette'); if (palettes.some(item => item === value)) return value as Palette } catch { /* Default palette remains available. */ }
    return 'terracotta'
  })
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    try { localStorage.setItem('jurismate-palette', palette) } catch { /* Selection still works for this session. */ }
  }, [palette])
  return <>
    <section className="editorial-hero" data-palette={palette} aria-labelledby="editorial-title">
      <div className="hero-glow" aria-hidden="true" /><div className="hero-grain" aria-hidden="true" />
      <div className="hero-corner hero-top-left">AN AI JUNIOR ASSOCIATE<br />FOR ADVOCATES</div>
      <div className="hero-corner hero-top-right">EST. 2026<br />INDIA</div>
      <h1 id="editorial-title" className="hero-headline"><span>400 pages,</span><em>one answer.</em></h1>
      <div className="hero-hand-stage"><img src={handPen} alt="A hand holding a fountain pen" /></div>
      <p className="hero-description"><strong>More room for the work that matters.</strong> Bring your conversations, documents and ideas together in one workspace.</p>
      <div className="hero-actions-new"><button onClick={() => navigate('/auth?mode=signup')}>Start free <span aria-hidden="true">↗</span></button><a href="#how-it-works">Scroll <span aria-hidden="true">↓</span></a></div>
      <div className="hero-palette" role="group" aria-label="Choose accent colour">{palettes.map(option => <button key={option} type="button" className={`palette-dot ${option}`} aria-label={`${option} accent`} aria-pressed={palette === option} onClick={() => setPalette(option)} />)}</div>
    </section>
    <div className="editorial-marquee" aria-label="Contracts, notices, case laws, affidavits, petitions, judgments"><div className="marquee-track" aria-hidden="true">{[0, 1].map(copy => <span key={copy}>Contracts <i>·</i> Notices <i>·</i> Case laws <i>·</i> Affidavits <i>·</i> Petitions <i>·</i> Judgments <i>·</i></span>)}</div></div>
  </>
}
