# Pursuit: Harden and Test Everything
Generation: 8
Date: 2026-04-01
Status: designing

## Diagnosis

55% of capabilities (38/69) have never been triggered in any test.
6 families have never been composed. 25 lane overrides still bypass
the tiered scorer. We keep adding features on top of untested foundation.

## Generation 8 Design

### Thesis
**Test everything that exists. Delete the overrides. Stop adding families.**

### Changes (ordered by impact)

#### 1. Comprehensive capability trigger test
Write a test that runs one prompt per capability and verifies it attaches.
38 new test cases covering every capability that's currently dark.

#### 2. Compose test for every family
Write a test that composes one project per family and verifies files exist.
6 new test cases for untested families.

#### 3. Delete the 25 lane overrides
The tiered scorer + semantic fallback + familyHint handle all cases.
The overrides are legacy. Delete them, run the 103+43+260 corpus,
fix any regressions through manifest keyword adjustments.

### Success criteria
- 0 untested capabilities (was 38)
- 0 untested families (was 6)
- 0 lane overrides (was 25)
- 103/103 corpus maintained
- 131+ tests (adding ~44 new tests)
