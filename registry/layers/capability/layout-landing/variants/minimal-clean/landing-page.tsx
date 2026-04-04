import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <span className="text-base font-medium tracking-tight text-foreground">
            {'{{headline}}'}
          </span>
          <nav className="hidden items-center gap-8 text-sm font-light text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="/sign-in" className="transition-colors hover:text-foreground">Sign in</a>
          </nav>
          <a href="/sign-in" className="text-sm font-light text-muted-foreground transition-colors hover:text-foreground md:hidden">
            Sign in
          </a>
        </div>
      </header>

      <main>
        <div className="pt-8">
          <HeroSection />
        </div>
        <div id="features" className="pt-8">
          <FeaturesSection />
        </div>
        <div id="pricing" className="pt-8">
          <PricingSection />
        </div>
      </main>

      <footer className="py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-sm font-light text-muted-foreground sm:flex-row sm:justify-between lg:px-8">
          <p>&copy; {new Date().getFullYear()} {'{{headline}}'}</p>
          <nav className="flex gap-8">
            <a href="/privacy" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-foreground">Terms</a>
            <a href="/contact" className="transition-colors hover:text-foreground">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
