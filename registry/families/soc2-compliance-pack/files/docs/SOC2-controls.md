# SOC2 Trust Services Criteria — Control Surface

This pack produces the technical artifacts a SOC2 Type II audit checks. The
process bits (risk assessments, vendor reviews, tabletop exercises) are
operational — not shipped by code.

## Trust Services Criteria covered

| TSC | Name | Artifact |
|---|---|---|
| CC1.1 | Organizational demonstration of integrity | Policies (markdown) |
| CC2.1 | Communication of internal controls | `docs/SOC2-controls.md` (this file) |
| CC3.1 | Risk identification | Annual risk assessment (process) |
| CC5.1 | Control activities | `src/change-mgmt.ts` |
| CC6.1 | Logical access — role-based | Auth layer in consuming app |
| CC6.6 | System monitoring | Dashboards + alerts (infra) |
| CC7.1 | System availability SLI | Uptime monitor |
| **CC7.2** | System operations monitoring | `src/audit.ts` append-only audit log |
| CC7.3 | Incident response | `docs/incident-response.md` |
| **CC8.1** | Change management | `src/change-mgmt.ts` + branch protection + CODEOWNERS |
| CC9.1 | Vendor risk management | `docs/vendor-attestations.md` |
| CC9.2 | Vendor performance monitoring | Vendor SLAs tracked operationally |

## CC7.2 — Monitoring evidence

The `SocAuditStore` backing must be append-only at the DB level. Enforce via:

- Postgres: revoke UPDATE + DELETE on `socaudit_*` tables from the application user.
- Other DBs: use a WORM storage tier (S3 Object Lock, Azure Blob Immutable).

## CC8.1 — Change management

`recordChange()` rejects:

- Changes with zero approvers.
- Self-approved changes (requester ∈ approvers).

This matches the auditor's expectation that **every** production-affecting
change is logged AND signed off by someone other than the requester.
Enforce the underlying via:

- GitHub branch protection: "Require pull request reviews before merging"
  with "Dismiss stale pull request approvals when new commits are pushed."
- `.github/CODEOWNERS` pointing every directory to at least 2 maintainers.

## Audit retention

Minimum 12 months for the audit window + 3 months pre-window = 15 months
typical. Many auditors prefer 7 years. Confirm with your audit firm.

## Operational sibling docs

- `docs/incident-response.md` — tabletop + real-incident playbook.
- `docs/vendor-attestations.md` — live sub-processor registry.
