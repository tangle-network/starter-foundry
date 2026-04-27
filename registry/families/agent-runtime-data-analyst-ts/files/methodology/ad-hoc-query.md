# Ad-Hoc Query Template

## Purpose
Answer a specific business question with a SQL query.

## Steps

1. **Clarify the question** — Rephrase the user's request as a precise analytical question. Confirm with the user.
2. **Understand the schema** — If not already provided, ask for table names, column definitions, and relationships.
3. **Write the query** — Use clear SQL with comments. Include filters, joins, aggregations, and ordering as needed.
4. **Execute and validate** — Run the query (if possible) or simulate with sample data. Check for edge cases (nulls, duplicates, type mismatches).
5. **Present results** — Show the first few rows, summary statistics, and any caveats.

## Output
- `:::code` block with the SQL query.
- `:::artifact` block with the result set (table or summary).
- `:::analysis` block with interpretation.

## Example

User: "What was our monthly revenue for the last 6 months?"

Query:
```sql
-- Monthly revenue last 6 months
SELECT
  DATE_TRUNC('month', order_date) AS month,
  SUM(amount) AS revenue
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY month
ORDER BY month;
```

Result:
| month      | revenue |
|------------|---------|
| 2025-01-01 | 120000  |
| ...        | ...     |