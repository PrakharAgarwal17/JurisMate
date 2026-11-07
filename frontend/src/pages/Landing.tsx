import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import Icon, { type IconName } from '../components/Icon'
import WalkingCharacters from '../components/WalkingCharacters'
import ThemeToggle from '../components/ThemeToggle'
import EditorialHero from '../components/EditorialHero'
import './LandingDetails.css'

const features: { icon: IconName; number: string; title: string; description: string }[] = [
  { icon: 'chat', number: '01', title: 'Start with the conversation', description: 'Bring the details, questions, and people involved in a matter into one clear workspace.' },
  { icon: 'file', number: '02', title: 'Make sense of documents', description: 'Keep documents close and turn lengthy material into useful context for your work.' },
  { icon: 'check', number: '03', title: 'Move from context to clarity', description: 'Explore the facts, identify gaps, and prepare a thoughtful first draft with AI assistance.' },
]

export default function Landing() {
  const navigate = useNavigate()
  return <div className="landing">
    <header className="site-header"><div className="header-inner"><Brand onClick={() => navigate('/')} /><nav className="desktop-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#features">The workspace</a><a href="#about">Our approach</a></nav><div className="header-actions"><ThemeToggle /><button className="text-button" onClick={() => navigate('/auth')}>Sign in</button><button className="button button-dark header-cta" onClick={() => navigate('/auth?mode=signup')}>Get started <Icon name="arrow" size={16} /></button></div></div></header>
    <main>
      <EditorialHero />
      <div className="trust-strip"><span className="trust-label">BUILT AROUND YOUR WORK</span><span><Icon name="shield" size={17} /> Advocate in control</span><span><Icon name="file" size={17} /> Matter-focused workspace</span><span><Icon name="check" size={17} /> AI-assisted, human-reviewed</span></div>
      <section id="how-it-works" className="section intro-section"><div className="section-kicker"><span>01 / A DIFFERENT WAY TO WORK</span><span>MADE FOR LEGAL MINDS</span></div><div className="section-heading"><div><span className="section-label">THE IDEA IS SIMPLE</span><h2>Less time finding things.<br /><em>More time thinking.</em></h2></div><p>Legal work is built on details. JurisMate helps bring them together, giving you a little more space for the work only you can do.</p></div><div className="feature-grid" id="features">{features.map(feature => <article className="feature-card" key={feature.number}><div className="feature-top"><span className="feature-icon"><Icon name={feature.icon} size={23} /></span><span className="feature-number">{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><span className="feature-arrow">↗</span></article>)}</div></section>
      <section id="about" className="approach-section"><div className="approach-inner"><div><span className="section-label light-label">AN ASSISTANT, NOT A DECISION MAKER</span><h2>Your expertise leads.<br /><em>We help you get there.</em></h2></div><div className="approach-copy"><p>From the first question to the final review, JurisMate is designed to support your process—with the advocate always in control.</p><button className="button button-light" onClick={() => navigate('/auth?mode=signup')}>Get started <Icon name="arrow" size={16} /></button></div></div></section>
    </main><footer className="site-footer"><Brand onClick={() => navigate('/')} /><p>A little more clarity for the work that matters.</p><span>© {new Date().getFullYear()} JurisMate</span></footer><WalkingCharacters />
  </div>
}
