import Icon from './Icon'

export default function AuthStory() {
  return <aside className="auth-story" aria-label="About JurisMate">
    <div className="auth-story-top"><span>YOUR AI JUNIOR ASSOCIATE</span><span>EST. FOR THE DETAILS</span></div>
    <div className="auth-story-body">
      <span className="story-index">01 / A LITTLE MORE ROOM TO THINK</span>
      <h2>Good work starts with a <em>clearer mind.</em></h2>
      <p>Make space for the work that matters. Your conversations, documents and ideas, thoughtfully brought together.</p>
      <div className="story-workspace" aria-label="Illustration of a matter workspace">
        <div className="story-workspace-head"><span><i /> MATTER WORKSPACE</span><span>01</span></div>
        <div className="story-document"><span className="story-doc-icon"><Icon name="file" size={17} /></span><div><strong>Case notes</strong><small>Details, all in one place</small></div><span className="story-doc-check">✓</span></div>
        <div className="story-insight"><span className="story-sparkle" aria-hidden="true">↗</span><div><span>YOUR JUNIOR ASSOCIATE</span><p>Let’s make sense of the details, together.</p></div></div>
        <div className="story-paper" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
    <div className="auth-story-footer"><span>DESIGNED FOR ADVOCATES</span><span>THOUGHTFULLY, ALWAYS &nbsp; ↗</span></div>
  </aside>
}
