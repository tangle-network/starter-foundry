# Data Quality Audit Template

## Purpose
Assess the quality of a dataset across the standard DQ dimensions
and produce a finding-by-finding report. The output is a remediation
plan, not just a vibes-check that the data "looks fine."

## When to use
Trigger when the user is onboarding a new data source, debugging a
suspect dashboard / ML model, or doing a periodic data-asset
review. For day-to-day SQL exploration, use ad-hoc-query.md.

## Method

1. **Scope.** Which tables / columns / time window? Audit
   end-to-end (source → warehouse → mart) or one layer? Audit
   only what's used downstream — auditing every column is
   unsustainable.
2. **Profile first.**
   - Row count, distinct count, null rate, min, max, mean,
     median, stddev for each column.
   - Top-N values for categorical columns; tail length.
   - Type distribution (mixed-type columns are a smell).
   - Date-range coverage.
3. **Run the standard DQ dimensions.**
   - **Completeness**: null rate per column. Flag >5% null
     unless documented as nullable.
   - **Uniqueness**: PK / unique-constraint violations.
     Suspected-PK columns with duplicates are critical.
   - **Consistency**:
     - Format (`email LIKE '%@%'`, phone matches a pattern,
       ISO-8601 dates).
     - Cross-column (e.g., `start_date <= end_date`).
     - Cross-row referential (foreign key to a parent table
       resolves).
   - **Validity**: value ranges (`age BETWEEN 0 AND 120`,
     `price > 0`, status in enum). Out-of-range = bad ETL or
     bad source.
   - **Accuracy**: comparison against a known-good source.
     Often the hardest dimension; sometimes only spot-checkable.
   - **Timeliness**: max(updated_at) is recent enough; data
     freshness SLA met.
   - **Granularity**: row count per logical unit matches
     expectation (e.g., one order per order_id, not duplicated
     across line items).
4. **Identify systematic issues.**
   - **Test-data leakage** into prod tables.
   - **Default values** masquerading as data
     (e.g., `email = 'noreply@example.com'`).
   - **Soft-delete inconsistency** (`deleted_at` set but the
     row appears in active queries).
   - **Time-zone confusion** (TIMESTAMP without TZ; mixed UTC
     and local).
   - **Schema drift** (column added upstream, downstream still
     using old shape).
   - **Encoding issues** (UTF-8 vs Latin-1; mojibake).
5. **Severity rating.**

   | Severity | Definition |
   |----------|------------|
   | Critical | Data is wrong in a way that produces wrong decisions; downstream models / dashboards must be paused. |
   | High     | Data is partially wrong; downstream consumers should be informed; fix in days. |
   | Medium   | Quality issue that doesn't currently mislead but threatens future trust. |
   | Low      | Cosmetic / documentation gap. |

6. **Root-cause where you can.** Each finding gets a hypothesis
   for cause: source-system bug, ETL bug, schema drift, ingestion
   timing. The fix is in the cause, not the symptom.
7. **Remediation plan per finding.**
   - Immediate: stop downstream consumption / add filter.
   - Short-term: backfill / cleanse / re-ingest.
   - Long-term: tighten source-system contract; add CI / dbt
     test; alert on regression.
8. **Prevent regression.**
   - Codify the audit as monitored tests (great_expectations,
     dbt tests, soda-cl). One-time audits decay; monitored
     tests don't.
   - Define data-quality SLAs and alert when breached.
   - Owner assigned for each table / domain.

## Output

```
:::artifact
template: data-quality-audit
scope: ["table_a", "table_b"]
profile: { ... }
findings:
  - id: F1
    column: "email"
    dimension: "completeness"
    issue: "12% null on rows after 2025-08-01"
    severity: "High"
    root-cause-hypothesis: "Form change removed the 'required' attribute."
    remediation:
      immediate: "Filter null in marketing dashboard."
      short-term: "Backfill from CRM where possible."
      long-term: "Add `not null` constraint + form-side validation; dbt test."
    owner: "data-platform"
  - id: F2
    column: "order_date"
    dimension: "validity"
    issue: "0.4% future-dated rows."
    severity: "Medium"
    root-cause-hypothesis: "Client clock skew + no server-side date assignment."
    remediation:
      immediate: "Cap at server-side received_at in dashboard."
      short-term: "Add CHECK constraint."
      long-term: "Move date assignment server-side."
    owner: "orders-team"
:::
```

## Common audit failures

1. **Profile-only.** Counting nulls without judging severity or
   prescribing remediation.
2. **No follow-through.** One-time audit findings rot; codify
   as tests.
3. **Severity inflation.** Marking everything Critical drowns
   the team.
4. **Missing the cross-table consistency.** PK uniqueness is
   easy; FK + cross-row consistency is where most bad data
   hides.
5. **Time-zone blindness.** A timestamp column in mixed TZs
   produces silent rolling errors.
6. **No owner.** Findings without an owner don't get fixed.
7. **Spot-checking accuracy.** Without an external comparator,
   accuracy is rarely auditable; say so explicitly.

## Refusal

- The agent will not bless data quality without running the
  profile.
- The agent will not mark issues "fixed" without verifying via
  re-run.
- The agent will not approve "ignore" on a Critical finding
  without explicit risk acceptance.
