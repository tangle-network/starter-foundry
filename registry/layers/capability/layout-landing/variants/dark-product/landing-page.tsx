import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-8">
          <span className="text-lg font-semibold text-zinc-50">{'{{headline}}'}</span>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-emerald-400">Features</a>
            <a href="#pricing" className="transition-colors hover:text-emerald-400">Pricing</a>
            <a href="/sign-in" className="transition-colors hover:text-emerald-400">Sign in</a>
          </nav>
          <Button size="sm" variant="ghost" className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 md:hidden" asChild>
            <a href="/sign-in">Sign in</a>
          </Button>
        </div>
      </header>

      <main>
        <HeroSection />
        <div id="features">
          <FeaturesSection />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-sm text-zinc-500 sm:flex-row sm:justify-between lg:px-8">
          <p>&copy; {new Date().getFullYear()} {'{{headline}}'}. All rights reserved.</p>
          <nav className="flex gap-6">
            <a href="/privacy" className="transition-colors hover:text-zinc-300">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-zinc-300">Terms</a>
            <a href="/contact" className="transition-colors hover:text-zinc-300">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
