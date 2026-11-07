import { useAppDispatch, useAppSelector } from '../context/hooks'
import { toggleTheme } from '../context/themeSlice'
import { flushSync } from 'react-dom'

export default function ThemeToggle() {
  const theme = useAppSelector(state => state.theme)
  const dispatch = useAppDispatch()
  function switchTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) { dispatch(toggleTheme()); return }
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const transition = document.startViewTransition(() => { flushSync(() => dispatch(toggleTheme())) })
    void transition.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 450, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' })).catch(() => undefined)
  }
  return <button type="button" className="theme-toggle" onClick={switchTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
    <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
  </button>
}
