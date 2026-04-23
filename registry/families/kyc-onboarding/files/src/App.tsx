import { useState } from 'react'

type Step = 'start' | 'document' | 'selfie' | 'review' | 'done'

export function App() {
  const [step, setStep] = useState<Step>('start')
  const kycProvider = import.meta.env.VITE_KYC_PROVIDER ?? 'sandbox'

  return (
    <main style={{ maxWidth: 560, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>KYC onboarding</h1>
      <p style={{ color: '#666' }}>Provider: <code>{kycProvider}</code></p>
      {step === 'start' && (
        <button onClick={() => setStep('document')}>Start verification</button>
      )}
      {step === 'document' && (
        <section>
          <h2>1. Upload document</h2>
          <p>Drop a government-issued ID. Extension points: replace with your KYC provider SDK.</p>
          <button onClick={() => setStep('selfie')}>Continue</button>
        </section>
      )}
      {step === 'selfie' && (
        <section>
          <h2>2. Liveness check</h2>
          <p>Capture a selfie for liveness. Hook your provider's capture widget here.</p>
          <button onClick={() => setStep('review')}>Continue</button>
        </section>
      )}
      {step === 'review' && (
        <section>
          <h2>3. Review</h2>
          <p>Submitted — waiting for provider decision.</p>
          <button onClick={() => setStep('done')}>Simulate approval</button>
        </section>
      )}
      {step === 'done' && <p>✓ Verified. Next: call your backend to mint user credentials.</p>}
    </main>
  )
}
