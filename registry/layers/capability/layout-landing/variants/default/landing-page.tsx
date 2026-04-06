import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'
import personalize from '@/personalize.json'

export default function LandingPage() {
  const { brand, trust, footer } = personalize
  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <img
              src="/images/logo.svg"
              alt={brand.name}
              className="h-8 w-auto"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span>{brand.name}</span>
          </span>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a
              href="#features"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Pricing
            </a>
            <a
              href="/sign-in"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Sign in
            </a>
            <Button
              size="sm"
              className="rounded-lg font-medium transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              asChild
            >
              <a href="/sign-up">Get Started</a>
            </Button>
          </nav>
          <Button size="sm" className="md:hidden" variant="ghost" asChild>
            <a href="/sign-in">Sign in</a>
          </Button>
        </div>
      </header>

      <main id="main">
        <HeroSection />

        <section className="border-y border-border/50 bg-muted/20 py-12 dark:bg-muted/5">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Trusted by teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 lg:gap-x-16">
              {trust.logoNames.map((name) => (
                <span
                  key={name}
                  className="select-none text-lg font-semibold tracking-tight text-muted-foreground/30"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <FeaturesSection />

        <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <PricingSection />
      </main>

      <footer className="border-t border-border/50 bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-1">
              <span className="text-lg font-semibold tracking-tight">{brand.name}</span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {footer.tagline}
              </p>
            </div>
            {Object.entries(footer.sections).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 border-t border-border/50 pt-8">
            <p className="text-sm text-muted-foreground">{footer.copyright}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
