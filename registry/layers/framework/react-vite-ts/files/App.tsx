// Minimal App skeleton. Replace the <main> contents with your product UI.
// shadcn/ui components are pre-installed under @/components/ui/.
// Path alias @/ → src/ is configured in vite.config.ts and tsconfig.json.
// See AGENTS.md for the full component inventory and extension points.

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-4">
          <span className="text-sm font-semibold">{'{{projectName}}'}</span>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {/* Build your UI here. */}
      </main>
    </div>
  )
}
