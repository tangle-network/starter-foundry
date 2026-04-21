// GDPR-compliant cookie banner. Shows BEFORE non-essential cookies are set.
// Affirmative action required (no pre-ticked boxes). Consent withdrawable
// via the "Preferences" link at any time.
//
// Consumer must wire onConsent to src/consent.ts's InMemoryConsentStore
// (or production store) + attach the result to analytics/marketing gate.

import { useEffect, useState } from 'react'

export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'personalization'

export interface CookieBannerProps {
  policyUrl: string
  policyVersion: string
  onConsent: (categories: ConsentCategory[]) => void | Promise<void>
}

const STORAGE_KEY = 'starter-foundry:gdpr-consent-v1'

export function CookieBanner(props: CookieBannerProps): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [choices, setChoices] = useState<Record<ConsentCategory, boolean>>({
    essential: true, // always on — Art. 6(1)(b)
    analytics: false,
    marketing: false,
    personalization: false,
  })

  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!stored) setVisible(true)
    else {
      try {
        const prior = JSON.parse(stored)
        if (prior.policyVersion !== props.policyVersion) setVisible(true)
      } catch {
        setVisible(true)
      }
    }
  }, [props.policyVersion])

  if (!visible) return null

  function finalize(selected: ConsentCategory[]): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ policyVersion: props.policyVersion, selected, at: new Date().toISOString() }),
    )
    void props.onConsent(selected)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0b0d10',
        color: '#d5deeb',
        padding: '24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 1000,
      }}
    >
      <h2 id="cookie-banner-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
        Cookies &amp; privacy
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, maxWidth: 720 }}>
        We use cookies to run the service. Analytics + marketing cookies are OFF by default
        and only set after you opt in. Read our{' '}
        <a href={props.policyUrl} style={{ color: '#6ea8ff' }}>
          privacy policy
        </a>
        .
      </p>
      {showDetails && (
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
          {(['analytics', 'marketing', 'personalization'] as const).map((cat) => (
            <label key={cat} style={{ display: 'block', margin: '4px 0' }}>
              <input
                type="checkbox"
                checked={choices[cat]}
                onChange={(e) => setChoices((s) => ({ ...s, [cat]: e.target.checked }))}
              />{' '}
              {cat}
            </label>
          ))}
        </fieldset>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => finalize(['essential'])}>Reject non-essential</button>
        <button type="button" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? 'Hide' : 'Customize'}
        </button>
        {showDetails && (
          <button type="button" onClick={() => finalize((Object.keys(choices) as ConsentCategory[]).filter((k) => choices[k]))}>
            Save selection
          </button>
        )}
        <button
          type="button"
          onClick={() => finalize(['essential', 'analytics', 'marketing', 'personalization'])}
          style={{ background: '#6ea8ff', color: '#0b0d10', border: 'none', padding: '8px 16px' }}
        >
          Accept all
        </button>
      </div>
    </div>
  )
}
