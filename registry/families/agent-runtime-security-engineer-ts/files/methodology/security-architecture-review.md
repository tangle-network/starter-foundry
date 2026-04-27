# Security Architecture Review Template

## Overview
Use this template to evaluate the security posture of a system architecture.

## Steps

1. **Understand architecture**: Review diagrams, data flows, trust boundaries, and component interactions.
2. **Identify controls**: List existing security controls (auth, encryption, logging, network segmentation).
3. **Analyze gaps**: For each control, assess if it is sufficient against common attack patterns.
4. **Apply principles**: Check for least privilege, defense in depth, secure defaults, fail-safe defaults, and separation of duties.
5. **Document findings**: List strengths, weaknesses, and recommendations.

## Output Format

```
:::artifact template: security-architecture-review
**System**: [name]
**Strengths**:
- [control]
**Weaknesses**:
- [gap]
**Recommendations**:
- [action]
**Risk Level**: [Low/Medium/High]
:::```