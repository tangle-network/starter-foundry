import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: '{{appName}} — Agent Bundle Catalog',
  description:
    'Browse, preview, and deploy agent bundles. Public catalog UI for the Tangle starter-foundry registry.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <header className='mp-header'>
          <div className='mp-container' style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Link href='/'>
              <h1 className='mp-h1'>{'{{appName}}'}</h1>
            </Link>
            <p className='mp-muted'>Agent bundle catalog</p>
          </div>
        </header>
        <main className='mp-container' style={{ paddingBottom: '64px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
