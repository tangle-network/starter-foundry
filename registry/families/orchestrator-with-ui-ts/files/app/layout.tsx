import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: '{{appName}} — Agent Fleet',
  description:
    'Multi-agent dashboard for the {{appName}} fleet. Each agent runs in its own Tangle sandbox; this UI talks to N sandboxes in parallel.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Root layout intentionally renders a thin shell. The DashboardLayout (rail
// sidebar + center pane) lives inside app/page.tsx and app/agents/[id]/page.tsx
// so each route can decide its own sidebar selection / breadcrumb without
// fighting a layout-level prop. If you want the DashboardLayout to persist
// across route transitions (and thereby keep per-agent useSdkSession state
// alive while the user navigates between agents), lift it here and wrap the
// children in a SessionProvider that owns one useSdkSession per roster entry.
// See README.md → 'Session lifecycle' for the trade-off.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  )
}
