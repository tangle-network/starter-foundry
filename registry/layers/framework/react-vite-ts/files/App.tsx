import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    title: 'shadcn/ui Components',
    description: '27 pre-installed components — Button, Card, Dialog, Table, and more. Import from @/components/ui/',
    badge: 'Ready',
  },
  {
    title: 'Tailwind CSS',
    description: 'Utility-first styling with design tokens, dark mode support, and responsive breakpoints.',
    badge: 'Configured',
  },
  {
    title: 'TypeScript + Vite',
    description: 'Fast builds with HMR. Path aliases configured — use @/ for src/ imports.',
    badge: 'Fast',
  },
]

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {'{{projectName}}'.charAt(0).toUpperCase()}
            </div>
            <span className="text-lg font-semibold">{'{{projectName}}'}</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Documentation</Button>
            <Button size="sm">Get Started</Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="mx-auto max-w-3xl py-20 text-center">
          <Badge variant="secondary" className="mb-4">Scaffold Ready</Badge>
          <h1 className="text-5xl font-bold tracking-tight">{'{{headline}}'}</h1>
          <p className="mx-auto mt-6 max-w-xl text-xl text-muted-foreground">
            {'{{subheadline}}'}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg">Read AGENTS.md</Button>
            <Button size="lg" variant="outline">Browse Components</Button>
          </div>
        </section>

        <section className="mx-auto max-w-4xl pb-20">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <Badge variant="outline" className="text-xs">{feature.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built with starter-foundry &middot; Read AGENTS.md to customize
        </div>
      </footer>
    </div>
  )
}
