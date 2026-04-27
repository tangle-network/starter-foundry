# Escalation Triage

## Purpose
Triage customer escalations by severity and route to the appropriate team.

## When to use
- A customer reports a critical issue
- The operator receives an escalation from a customer
- During health review when a red flag is detected

## Severity Levels

### P1 – Critical
- **Definition:** Complete service outage, data loss, security breach
- **Response time:** <1 hour
- **Action:** Immediate incident response; notify executive team
- **Owner:** Support engineer + CSM

### P2 – High
- **Definition:** Major feature broken, severe performance degradation, blocked workflow
- **Response time:** <4 hours
- **Action:** Dedicated fix; communicate ETA to customer
- **Owner:** Support engineer + CSM

### P3 – Medium
- **Definition:** Non-critical bug, feature request, minor inconvenience
- **Response time:** <24 hours
- **Action:** Log ticket, assign to product team
- **Owner:** CSM

### P4 – Low
- **Definition:** Documentation gap, cosmetic issue, general inquiry
- **Response time:** <72 hours
- **Action:** Self-serve or next release
- **Owner:** CSM or support

## Triage Steps
1. Identify severity based on customer impact
2. Assign owner and set response SLA
3. Communicate to customer: acknowledgment, ETA, next steps
4. Track resolution and follow up

## Output
Produce a `:::artifact` block with the triage summary.
