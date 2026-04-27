# Proof-of-Concept Design Template

## Purpose
Design a POC with clear success criteria, timeline, and exit ramps.

## Sections

### 1. POC Overview
- Prospect name and deal stage
- Problem statement
- Success criteria (measurable, binary or threshold-based)
- Duration (typically 2-4 weeks)

### 2. Technical Scope
- What will be built / configured
- Integration points (APIs, data sources, authentication)
- Environment requirements (cloud, on-prem, hybrid)
- Assumptions and prerequisites

### 3. Success Criteria
| Criterion | Metric | Target | Measurement Method |
|-----------|--------|--------|--------------------|
| Performance | Latency p95 | <200ms | Load test |
| Functionality | Feature completion | 100% of agreed scope | Demo to prospect |
| Integration | Data sync success | >99% | Monitoring |

### 4. Timeline
| Week | Activities | Deliverables |
|------|------------|--------------|
| 1 | Environment setup, initial configuration | Architecture doc, access credentials |
| 2 | Core integration, feature development | Working prototype |
| 3 | Testing, refinement, documentation | Test report, user guide |
| 4 | Prospect demo, feedback, handoff | Demo recording, handoff doc |

### 5. Exit Ramps
- **Green**: All success criteria met → move to production pilot
- **Yellow**: Partial success, clear path to resolution → extend POC by 1 week
- **Red**: Critical failure or prospect disengagement → close POC, document learnings

### 6. Resources
- Engineering support needed (hours / week)
- Tools and licenses
- Prospect point of contact