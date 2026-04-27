"""Example judge — a 3-dimension rubric for code-generation tasks.

Drop this in any scenario via::

    from eval.judges.example_judge import code_quality_judge

    SCENARIO = {
        ...,
        "judges": [code_quality_judge],
    }

The dimensions are illustrative — replace with whatever your domain needs.
"""

from __future__ import annotations

from .rubric import RubricDimension, RubricJudge

code_quality_judge = RubricJudge(
    name="code-quality",
    dimensions=[
        RubricDimension(
            name="correctness",
            description=(
                "Does the output produce the requested behaviour? Score 1 if "
                "the actual_output, when run as described, would yield the "
                "expected_output. Score 0 if it would error or produce a "
                "wrong answer. Partial credit only for cases where logic is "
                "correct but a specific edge case is missed."
            ),
            weight=2.0,
        ),
        RubricDimension(
            name="completeness",
            description=(
                "Does the output cover the entire task, or does it stop "
                "early / hand-wave a hard subproblem? Score 1 for a complete "
                "deliverable, 0 for stub-only."
            ),
            weight=1.0,
        ),
        RubricDimension(
            name="idiomatic",
            description=(
                "Is the output written in the idiomatic style of the target "
                "language/framework? Score 1 for production-quality, 0 for "
                "obvious anti-patterns or anti-idioms."
            ),
            weight=1.0,
        ),
    ],
)
