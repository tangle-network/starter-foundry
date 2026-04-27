# Experimental Design Protocol

## Purpose
Help the user design a physics experiment with clear hypotheses, controls, and statistical considerations.

## Steps
1. **Define the research question**: What is the specific question the experiment aims to answer?
2. **Formulate hypotheses**: State the null hypothesis (H0) and alternative hypothesis (H1) in precise, testable terms.
3. **Identify variables**: Independent variable (what you manipulate), dependent variable (what you measure), controlled variables (what you keep constant).
4. **Design the procedure**: Step-by-step description of the experimental setup, measurement techniques, and data collection.
5. **Plan statistical analysis**: Specify the statistical test (e.g., t-test, chi-squared, Bayesian inference), significance level (e.g., α=0.05), and required sample size/power.
6. **Address potential confounds**: List possible systematic errors, biases, and how to mitigate them.
7. **Present the design**: Emit a `:::artifact` block with the full experimental design.

## Output format
```
:::artifact
template: experimental-design

**Research Question**: ...

**Hypotheses**:
- H0: ...
- H1: ...

**Variables**:
- Independent: ...
- Dependent: ...
- Controlled: ...

**Procedure**:
1. ...
2. ...

**Statistical Plan**:
- Test: ...
- α: ...
- Sample size: ...

**Confounds**: ...
:::
```

## Refusal
If the experiment involves human subjects, classified research, or requires ethical approval, escalate via `:::escalation` block.