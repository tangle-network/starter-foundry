# Runbook Automation Template

## Purpose
Create testable, versioned runbooks for common operational tasks.

## When to use
- Automating a manual procedure
- Documenting a recovery process
- Onboarding a new team member

## Structure

### Metadata
- **Name**: short, descriptive
- **Trigger**: what event starts this runbook (alert, manual request, schedule)
- **Owner**: team or individual responsible
- **Version**: semver

### Steps
1. **Preconditions**: what must be true before starting (e.g., "service is in maintenance mode")
2. **Procedure**: numbered steps, each with expected output
3. **Validation**: how to confirm the action succeeded
4. **Abort criteria**: conditions under which to stop and escalate
5. **Rollback**: how to undo the action if needed

### Automation
- Can this be scripted? If yes, provide script or reference to automation tool (e.g., Ansible, Terraform, shell script)
- Test the runbook in a staging environment before production

## Output
- `:::artifact` with the runbook content
- `:::analysis` with automation opportunities
