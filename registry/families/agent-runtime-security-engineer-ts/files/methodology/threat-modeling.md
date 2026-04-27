# Threat Modeling Template

## Overview
Use this template to systematically identify threats against a system component or data flow using STRIDE.

## Steps

1. **Define scope**: Identify the system boundary, assets, and trust boundaries.
2. **Decompose**: List components, data flows, and entry points.
3. **Apply STRIDE per element**:
   - Spoofing: Can an attacker impersonate a user or component?
   - Tampering: Can data be modified in transit or at rest?
   - Repudiation: Can a user deny an action without proof?
   - Information Disclosure: Can sensitive data be exposed?
   - Denial of Service: Can the system be made unavailable?
   - Elevation of Privilege: Can an attacker gain unauthorized access?
4. **Rate threats**: Use DREAD (Damage, Reproducibility, Exploitability, Affected Users, Discoverability) or a simple High/Medium/Low.
5. **Mitigations**: For each threat, propose controls (e.g., authentication, encryption, logging, rate limiting).
6. **Residual risk**: Note any remaining risk after mitigations.

## Output Format

```
:::artifact template: threat-modeling
**Component**: [name]
**Threats**:
| Threat | STRIDE Category | Rating | Mitigation | Residual Risk |
|--------|-----------------|--------|------------|---------------|
| ...    | ...             | ...    | ...        | ...           |
:::```