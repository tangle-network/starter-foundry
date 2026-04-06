import './globals.css'
import './personalize.css'

export const metadata = {
  title: '{{headline}}',
  description: '{{subheadline}}',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
