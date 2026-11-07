import type { ReactNode } from 'react'

export type IconName = 'arrow' | 'file' | 'shield' | 'chat' | 'check' | 'lock' | 'eye' | 'back'
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    file: <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" />,
    shield: <path d="M12 3 4.5 6v5c0 5 3 8 7.5 10 4.5-2 7.5-5 7.5-10V6L12 3Zm-3 9 2 2 4-4" />,
    chat: <path d="M5 5h14v10H9l-4 4V5Zm4 4h6M9 12h4" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M9 10V7a3 3 0 0 1 6 0v3M12 14v2" /></>,
    eye: <><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></>,
    back: <path d="M20 12H5M11 6l-6 6 6 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
