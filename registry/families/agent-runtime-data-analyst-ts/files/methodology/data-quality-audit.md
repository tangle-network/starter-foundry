# Data Quality Audit Template

## Purpose
Assess the quality of a dataset across dimensions: completeness, uniqueness, consistency, validity, and timeliness.

## Steps

1. **Define scope** — Which tables or columns are being audited?
2. **Completeness** — Check null rates per column. Flag columns with >5% missing.
3. **Uniqueness** — Check for duplicate rows or duplicate primary keys.
4. **Consistency** — Check for conflicting values (e.g., same customer with different emails). Check data types and formats.
5. **Validity** — Check values against expected ranges, patterns (e.g., email regex), or reference tables.
6. **Timeliness** — Check recency of data. Are there stale records?
7. **Report** — Summarize findings, severity (low/medium/high), and recommended fixes.

## Output
- `:::code` block with SQL or Python checks.
- `:::artifact` block with a quality report table: column, issue, severity, recommendation.

## Example

| Column       | Issue                | Severity | Recommendation          |
|--------------|----------------------|----------|-------------------------|
| email        | 10% null             | High     | Add validation on input |
| order_date   | 5% future dates      | Medium   | Check ETL logic         |