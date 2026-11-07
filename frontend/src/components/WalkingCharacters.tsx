import { useEffect, useRef } from 'react'
import './WalkingCharacters.css'

const characters = [
  { color: '#568ecb', face: 'happy', message: 'I would fight for the topic.' },
  { color: '#d65d5d', face: 'wink', message: 'I would fight against the topic.' },
  { color: '#b96b59', face: 'smile', message: 'Let me hear both sides.' },
  { color: '#d39a72', face: 'surprised', message: 'I would note the topics.' },
  { color: '#c5786c', face: 'happy', message: 'I would summarize the topic.' },
  { color: '#d78d72', face: 'smile', message: 'I would research the law.' },
  { color: '#b97a62', face: 'wink', message: 'I would organize the documents.' },
  { color: '#d18a71', face: 'surprised', message: 'I would find missing information.' },
  { color: '#bd705c', face: 'happy', message: 'I would review the details.' },
  { color: '#80a78c', face: 'smile', message: 'I am Switch AI, connecting the team.' },
] as const

export default function WalkingCharacters() {
  const parade = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animations: Animation[] = []
    function start() {
      animations.forEach(animation => animation.cancel())
      animations = []
      if (reducedMotion.matches) return
      parade.current?.querySelectorAll<HTMLElement>('.walking-character').forEach(character => {
        const width = window.innerWidth
        const duration = 22000 + Math.random() * 26000
        const leftToRight = Math.random() > 0.5
        const from = leftToRight ? -90 : width + 10
        const to = leftToRight ? width + 10 : -90
        const animation = character.animate(
          [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
          { duration, iterations: Infinity },
        )
        animation.currentTime = Math.random() * duration
        animations.push(animation)
      })
    }
    start()
    window.addEventListener('resize', start)
    reducedMotion.addEventListener('change', start)
    return () => { window.removeEventListener('resize', start); reducedMotion.removeEventListener('change', start); animations.forEach(animation => animation.cancel()) }
  }, [])

  return <div className="character-parade pointer-events-none fixed bottom-0 left-0 z-50 w-full overflow-hidden" ref={parade}>
    {characters.map((character, index) => <button type="button" className={`walking-character${index === 9 ? ' switch-mascot' : ''}`} key={index} aria-label={character.message} onMouseEnter={event => event.currentTarget.getAnimations().forEach(animation => animation.pause())} onMouseLeave={event => event.currentTarget.getAnimations().forEach(animation => animation.play())} onFocus={event => event.currentTarget.getAnimations().forEach(animation => animation.pause())} onBlur={event => event.currentTarget.getAnimations().forEach(animation => animation.play())}>
      <span className="character-message" aria-hidden="true">{character.message}</span>
      <svg className="character-body" viewBox="0 0 76 60" width="44" height="35" fill="none" aria-hidden="true">
        <ellipse cx="38" cy="57" rx="26" ry="2" fill="#163d2d" opacity=".12" />
        <g className="character-arm arm-left"><path d="M12 30 4 26l-2 5 10 4" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <g className="character-arm arm-right"><path d="m64 30 8-4 2 5-10 4" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <g className="character-leg leg-one"><path d="M17 44v10h6V44" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <g className="character-leg leg-two"><path d="M28 44v10h6V44" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <g className="character-leg leg-one"><path d="M42 44v10h6V44" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <g className="character-leg leg-two"><path d="M53 44v10h6V44" fill={character.color} stroke="#60463d" strokeWidth="2" strokeLinejoin="round" /></g>
        <rect x="11" y="12" width="54" height="33" rx={index === 9 ? 9 : 2} fill={character.color} stroke={index === 9 ? '#355a46' : '#60463d'} strokeWidth="2.4" />
        <path d="M14 15h48" stroke="#fff" strokeOpacity=".2" strokeWidth="2" />
        {character.face === 'happy' ? <><path d="m22 27 4-4 4 4M46 27l4-4 4 4" stroke="#4f403a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M34 32q4 4 8 0" stroke="#4f403a" strokeWidth="2" strokeLinecap="round" /></> : character.face === 'wink' ? <><path d="m22 26 4-3 4 3" stroke="#4f403a" strokeWidth="2.4" strokeLinecap="round" /><rect x="47" y="22" width="4" height="7" rx="1" fill="#4f403a" /><path d="M34 32q4 4 8 0" stroke="#4f403a" strokeWidth="2" strokeLinecap="round" /></> : character.face === 'surprised' ? <><rect x="24" y="21" width="4" height="8" rx="1" fill="#4f403a" /><rect x="48" y="21" width="4" height="8" rx="1" fill="#4f403a" /><circle cx="38" cy="34" r="2.6" fill="#4f403a" /></> : <><rect x="24" y="21" width="4" height="8" rx="1" fill="#4f403a" /><rect x="48" y="21" width="4" height="8" rx="1" fill="#4f403a" /><path d="M34 32q4 4 8 0" stroke="#4f403a" strokeWidth="2" strokeLinecap="round" /></>}
        {index < 2 && <><path d="M11 36h54v10H11z" fill="#25282b" /><path d="m26 36 7 9 5-6 5 6 7-9" fill="#fff" stroke="#25282b" strokeWidth="1" /><path d="M36 38h4v7h-4z" fill="#fff" /></>}
        {index === 2 && <><path d="M11 14c0-7 6-9 11-6 4-4 9-4 13-1 4-3 10-3 14 1 6-3 15-1 16 6v5H11z" fill="#f4f4ef" stroke="#9c9b93" strokeWidth="1.5" /><path d="M11 36h54v10H11z" fill="#25282b" /><path d="M34 36h8v8h-8z" fill="#fff" /></>}
        {index === 3 && <><path d="M61 26h12v16H61z" fill="#fffdf4" stroke="#60463d" strokeWidth="1.5" /><path d="M63 30h8m-8 3h8m-8 3h6" stroke="#a89b8c" strokeWidth="1" /></>}
        {index === 4 && <><circle cx="26" cy="26" r="7" stroke="#313a36" strokeWidth="2" /><circle cx="50" cy="26" r="7" stroke="#313a36" strokeWidth="2" /><path d="M33 26h10" stroke="#313a36" strokeWidth="2" /></>}
        {index === 5 && <><circle cx="65" cy="29" r="6" fill="#e7f2e6" stroke="#60463d" strokeWidth="2" /><path d="m69 33 5 6" stroke="#60463d" strokeWidth="2" /></>}
        {index === 6 && <><path d="M58 30h15v12H58z" fill="#e7bd71" stroke="#60463d" strokeWidth="1.5" /><path d="M58 30v-3h7l2 3" fill="#e7bd71" stroke="#60463d" strokeWidth="1.5" /></>}
        {index === 7 && <><circle cx="38" cy="7" r="5" fill="#f4d77b" stroke="#846f3b" strokeWidth="1.5" /><path d="M36 12h4" stroke="#846f3b" strokeWidth="2" /></>}
        {index === 8 && <><path d="m64 28 7 3v5c0 4-3 6-7 8-4-2-7-4-7-8v-5z" fill="#e6efdf" stroke="#536f56" strokeWidth="1.5" /><path d="m61 35 2 2 4-5" stroke="#536f56" strokeWidth="1.5" /></>}
        {index === 9 && <><path d="M38 12V7" stroke="#355a46" strokeWidth="2" strokeLinecap="round" /><circle cx="38" cy="5" r="3" fill="#efc878" stroke="#355a46" strokeWidth="1.5" /><rect x="20" y="18" width="36" height="19" rx="8" fill="#e9f0df" /><circle cx="29" cy="26" r="2.5" fill="#355a46" /><circle cx="47" cy="26" r="2.5" fill="#355a46" /><path d="M34 31q4 3 8 0" stroke="#355a46" strokeWidth="1.7" strokeLinecap="round" /><circle cx="38" cy="41" r="1.4" fill="#efc878" /></>}
      </svg>
    </button>)}
  </div>
}
