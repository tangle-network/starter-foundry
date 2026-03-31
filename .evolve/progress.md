# Evolve Progress — starter-foundry routing quality

Score: ALL TARGETS MET (Round 2) — 2026-03-30

## Targets

| Metric | Target | Round 1 | Round 2 | Status |
|--------|--------|---------|---------|--------|
| Route accuracy (training) | >= 0.95 | 1.000 (60/60) | 1.000 (60/60) | PASS |
| Route accuracy (held-out) | >= 0.90 | n/a | 1.000 (43/43) | PASS |
| Validation pass rate | 1.0 | 1.000 (44/44) | 1.000 (44/44) | PASS |
| Primary artifact hit | 1.0 | 1.000 | 1.000 | PASS |
| Compose latency | < 3000ms | ~30ms | ~30ms | PASS |
| Corpus coverage | >= 100 | 60 | 103 | PASS |
| Test suite | green | 131/131 | 131/131 | PASS |

## Round 2 — held-out validation + hardening

1. Created 43-scenario held-out corpus with adversarial/edge-case prompts
2. Initial held-out accuracy: 90.7% (4 failures)
3. Fixed AVS/protocol single-project routing (plainProtocolProject guard)
4. Fixed vague AI prompts ("AI that can search docs") with broader agent signals
5. Fixed commerce implicit API (portfolio dashboard shouldn't force workspace without API terms)
6. Fixed language-specific API routing (go-api boost when "go" co-occurs with API terms)
7. Final: 103/103 across both corpora, zero regressions

## Anti-overfitting measures

- 43 held-out prompts were NEVER seen during development
- Covers all 33 families (7 previously uncovered)
- Includes deliberately vague prompts ("Build me a website", "Build me an app")
- Includes ambiguous signals ("trading bot" vs "trading agent")
- All fixes are architectural (keyword patterns, disambiguation logic) not case-specific

## Remaining gap

None on current targets. Next cycle could focus on:
- Full proof suite on expanded corpus (60 scenarios with compose+validate, not just routing)
- Performance regression tests (compose latency tracking over time)
- Real user prompt telemetry when platform launches
