import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'Docs', href: '/docs' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Status', href: '/status' },
    { label: 'Support', href: '/support' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
}

const trustLogos = [
  'Acme Corp',
  'TechFlow',
  'Quantum',
  'NovaSoft',
  'BuildStack',
  'DataPipe',
]

export default function LandingPage() {
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
              alt="{{headline}}"
              className="h-8 w-auto"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span>{'{{headline}}'}</span>
          </span>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a
              href="#features"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded"
            >
              Pricing
            </a>
            <a
              href="/sign-in"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded"
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

        {/* Trust section */}
        <section className="border-y border-border/50 bg-muted/20 py-12 dark:bg-muted/5">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Trusted by teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 lg:gap-x-16">
              {trustLogos.map((name) => (
                <span
                  key={name}
                  className="text-lg font-semibold tracking-tight text-muted-foreground/30 select-none"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Gradient divider */}
        <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <section id="features">
          <FeaturesSection />
        </section>

        {/* Gradient divider */}
        <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <section id="pricing">
          <PricingSection />
        </section>
      </main>

      <footer className="border-t bg-muted/30 dark:bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-foreground">
                  {category}
                </h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 border-t pt-8">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {'{{headline}}'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
