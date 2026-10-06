import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { LangToggle } from './LangToggle'

// Shared header: brand on the left, page-specific actions, then the language switch.
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-actions">
        {children}
        <LangToggle />
      </div>
    </header>
  )
}
