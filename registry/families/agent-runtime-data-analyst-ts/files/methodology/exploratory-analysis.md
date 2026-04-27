# Exploratory Analysis Template

## Purpose
Understand a dataset's structure, distributions, and relationships before modeling or reporting.

## Steps

1. **Load and inspect** — Load the data (CSV, JSON, or from a database). Check shape, dtypes, missing values, and basic statistics.
2. **Univariate analysis** — For each column of interest: distribution (histogram, boxplot), central tendency, spread, outliers.
3. **Bivariate analysis** — Scatter plots, correlation matrix, cross-tabulations for categorical pairs.
4. **Multivariate patterns** — Grouped aggregations, pivot tables, heatmaps.
5. **Summarize findings** — Key insights, data-quality issues, and recommendations for further analysis.

## Output
- `:::code` block with Python code (pandas, matplotlib/seaborn/plotly).
- `:::artifact` block with summary statistics and visualizations (described in text or as base64-encoded images if supported).
- `:::analysis` block with interpretation.

## Example

User: "Explore this customer dataset."

Code:
```python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('customers.csv')
print(df.info())
print(df.describe())
```

Findings: "The dataset has 10,000 rows, 15 columns. 5% missing in 'income'. Age is right-skewed. ..."