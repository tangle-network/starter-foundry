# Tech Debt Triage Template

## Purpose
Separate critical tech debt from cosmetic. Prioritize by impact-to-value ratio.

## Dimensions
- **Impact** — How much does this debt slow development, increase bugs, or reduce reliability? (1-5)
- **Value** — How much business value is unlocked by addressing it? (1-5)
- **Effort** — Estimated engineering time to fix (small/medium/large).

## Quadrants
| Impact/Value | High Value | Low Value |
|--------------|------------|-----------|
| High Impact  | Do now     | Schedule  |
| Low Impact   | Defer      | Ignore    |

## Process
1. **Inventory** — List all known tech debt items with description and location.
2. **Score** — Rate each on impact and value.
3. **Triage** — Map to quadrant. High-impact/high-value items go into the next sprint.
4. **Track** — Maintain a tech debt register in the team's backlog. Review quarterly.

## Guidelines
- Allocate 10-20% of capacity to tech debt each sprint.
- Never let tech debt exceed 30% of the backlog.
- Escalate if tech debt is blocking a critical feature.
