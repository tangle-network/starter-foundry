import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-8">
          <span className="text-lg font-semibold">{'{{headline}}'}</span>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="/sign-in" className="transition-colors hover:text-foreground">Sign in</a>
          </nav>
          <Button size="sm" className="md:hidden" variant="ghost" asChild>
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

      <footer className="border-t py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-sm text-muted-foreground sm:flex-row sm:justify-between lg:px-8">
          <p>&copy; {new Date().getFullYear()} {'{{headline}}'}. All rights reserved.</p>
          <nav className="flex gap-6">
            <a href="/privacy" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-foreground">Terms</a>
            <a href="/contact" className="transition-colors hover:text-foreground">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
