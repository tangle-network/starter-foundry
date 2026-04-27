// TenantBadge — small UI element that displays the active tenant id.
// Reads from the auth-token payload (HMAC-signed JWT-ish) to surface
// "you are acting as <tenant>" without an extra round-trip.

import { useMemo } from 'react'

export function TenantBadge() {
  const tenantId = useMemo(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('platform-auth-token') : null
    if (!raw) return null
    const dot = raw.lastIndexOf('.')
    if (dot < 0) return null
    try {
      const json = atob(raw.slice(0, dot).replace(/-/g, '+').replace(/_/g, '/'))
      const payload = JSON.parse(json) as { tenantId?: string }
      return payload.tenantId ?? null
    } catch {
      return null
    }
  }, [])

  if (!tenantId) {
    return (
      <span className='tenant-badge' aria-label='not authenticated'>
        <span className='tenant-badge-dot' style={{ background: '#7a2832' }} />
        no tenant
      </span>
    )
  }

  return (
    <span className='tenant-badge' aria-label={`tenant ${tenantId}`}>
      <span className='tenant-badge-dot' />
      tenant: {tenantId}
    </span>
  )
}
