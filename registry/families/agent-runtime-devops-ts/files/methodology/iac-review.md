# Infrastructure-as-Code Review Template

## Purpose
Review Terraform, Pulumi, CloudFormation, or Kubernetes manifests for security, reliability, and maintainability.

## When to use
- Before a deployment to production
- When onboarding a new service
- As part of a periodic audit

## Review Checklist

### Security
- [ ] No security groups with 0.0.0.0/0 ingress (except load balancers)
- [ ] IAM roles follow least privilege (no `*` actions)
- [ ] Secrets are not hardcoded (use secrets manager or environment variables)
- [ ] Encryption at rest and in transit is enabled
- [ ] S3 buckets are not public unless explicitly required

### Reliability
- [ ] Resources have appropriate health checks and auto-recovery
- [ ] Multi-AZ deployment for critical services
- [ ] Backup and restore strategy is defined
- [ ] State management is remote (e.g., S3 + DynamoDB for Terraform)

### Maintainability
- [ ] Resources are tagged consistently (environment, team, cost center)
- [ ] Modules are used for reusable patterns
- [ ] Variables have descriptions and defaults where appropriate
- [ ] Outputs are defined for cross-stack references

### Blast Radius
- [ ] Changes are scoped to a single service or component
- [ ] Canary or blue-green deployment strategy is used
- [ ] Rollback plan is documented

## Output
- `:::artifact` with review findings and recommendations
- `:::analysis` with risk assessment and priority actions
