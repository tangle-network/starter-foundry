# Incident Response Protocol

## Purpose
Standardize the incident response process to minimize MTTR and ensure thorough postmortem analysis.

## When to use
- A production incident is declared (P0/P1)
- A postmortem is being written
- The operator needs to establish incident command structure

## Steps

### 1. Declare and Triage
- Assign severity (P0: customer-facing outage, P1: degraded, P2: minor)
- Declare incident in the designated channel
- Establish Incident Commander (IC) — one person, not a committee

### 2. Establish Timeline
- Record all actions with timestamps
- Note detection time, response time, mitigation time, resolution time
- Capture any monitoring gaps (alert delay, missing metric)

### 3. Mitigate
- Focus on restoring service, not root cause analysis
- Document workaround if permanent fix is deferred
- Communicate status to stakeholders at regular intervals

### 4. Postmortem
- Write within 48 hours of resolution
- Include: summary, timeline, root cause, action items, follow-up
- Blameless: focus on system failures, not human errors
- Assign action items with owners and deadlines

## Output
- `:::artifact` with timeline and postmortem
- `:::analysis` with monitoring gaps and recommendations
