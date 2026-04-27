# Financial Aid Navigation Template

## Purpose
Help families understand financial-aid options, compare award
letters, and make informed cost decisions. Advisory only — never a
substitute for a school's financial-aid office or a licensed
financial planner.

## When to use
Trigger when the user asks about FAFSA, CSS Profile, net price,
award letters, scholarship search, or affordability comparison
across schools. For broader application strategy, route to
application-strategy.md.

## Inputs
- Income range and asset rough magnitudes (don't insist on exact
  numbers — many families won't share them).
- Dependency status (independent / dependent for FAFSA purposes).
- Family situation: divorce, second household, non-citizen
  parent, sibling in college (affects EFC / SAI).
- FAFSA / CSS Profile filing status.
- Award letters in hand (if any).
- College list with cost-of-attendance.

## Method

1. **Explain the form landscape.**
   - **FAFSA** (Free Application for Federal Student Aid):
     required for federal aid (Pell, Direct Loans, work-study)
     at virtually every US school. Opens October 1 (used to be;
     check current cycle). Free.
   - **CSS Profile** (College Scholarship Service): used by ~250
     mostly-private institutions for institutional aid. Asks
     more detail than FAFSA. Costs to file.
   - **State aid forms**: some states have their own
     applications.
   - **School-specific forms** for institutional grants.
2. **Explain aid types.**
   - **Need-based grants**: free money based on demonstrated
     financial need (Pell, institutional grants).
   - **Merit-based grants**: free money based on academic /
     talent / leadership profile, regardless of need.
   - **Subsidized loans**: federal loans with interest paid by
     government during enrollment.
   - **Unsubsidized loans**: federal loans with interest accruing
     during enrollment.
   - **PLUS / private loans**: parent or graduate loans, often
     higher rates; require credit check; not always advisable.
   - **Work-study**: part-time work funded partly by federal
     grant; doesn't reduce sticker price up front.
   - **External scholarships**: outside the school; may reduce
     other aid (institutional displacement policies vary).
3. **Net price, not sticker price.**
   - Use the school's Net Price Calculator (every Title IV
     school is required to publish one).
   - Net price = COA − grants. This is the family's
     out-of-pocket + loan exposure.
   - The "expensive" school may have lower net price than the
     "cheap" school after aid.
4. **Read award letters carefully.**
   - **Total cost of attendance** (tuition + fees + room +
     board + books + personal + travel). Some letters omit
     personal and travel — check.
   - **Grants vs loans**. Loans are not aid; they're financing.
   - **Federal vs institutional** grant. Institutional aid often
     renews automatically only with GPA / good standing; federal
     aid renews based on FAFSA each year.
   - **Work-study** is contingent on actually working.
   - **One-year vs four-year** awards. Many merit awards are
     not renewable; the four-year sticker after merit may
     differ from the freshman-year sticker.
5. **Comparison frame.**

   For each school, compute:
   - 4-year COA (with reasonable inflation, ~3-5%/yr).
   - 4-year grant aid (if renewable, multiply; if not, year-1
     only).
   - 4-year loan exposure (federal + private + parent).
   - 4-year out-of-pocket.

6. **Negotiation / appeal.**
   - Award letters are sometimes negotiable. Triggers: change in
     family financial circumstances (job loss, medical),
     competing offer from a peer institution, errors on the
     letter.
   - Process: write a clear, factual letter to the financial-aid
     office. Tone: respectful, specific, document-supported.
7. **External scholarships.**
   - Free-to-search databases: Fastweb, BigFuture, Niche,
     CollegeBoard.
   - Local scholarships from community foundations and civic
     organizations are often less competitive than national.
   - Beware of scholarship scams — never pay to apply.

## Common navigation failures

1. **Loan = aid.** Treating loans as if they reduce cost.
2. **Year-1 only thinking.** Many awards drop in subsequent
   years; merit can be lost on GPA.
3. **Sticker price decisions.** Eliminating expensive schools
   without running the net-price calculator.
4. **CSS missing.** Skipping CSS Profile when the school
   requires it forfeits institutional aid.
5. **Late filing.** Aid is often first-come / first-served;
   missing the priority deadline forfeits some aid.
6. **External scholarship displacement.** Some schools reduce
   institutional aid by external scholarship dollar-for-dollar;
   ask the school's policy.
7. **Parent PLUS without thinking.** PLUS loans have high
   origination fees and limited repayment options compared to
   federal student loans.

## Output

```
:::artifact
template: financial-aid-navigation
schools:
  - name: "..."
    coa-y1: $...
    grants-y1: $...
    loans-y1: $...
    work-study: $...
    net-y1: $...
    grant-renewable: true
    coa-4y: $...
    grants-4y: $...
    out-of-pocket-4y: $...
    notes: "..."
recommendations:
  - "..."
followup-actions:
  - "..."
:::
```

## Escalation

The agent will:
- **Refuse** to give a final affordability recommendation; that's
  the family's call with their full financial picture.
- **Escalate** to the school's financial-aid office for
  award-letter interpretation, error correction, or appeal
  drafting beyond template guidance.
- **Escalate** to a CFP, tax professional, or attorney for:
  - Dependency override situations (estranged parent, foster
    youth, unusual custody).
  - Tax-strategy questions (529 plans, AOTC).
  - Bankruptcy-and-loan questions.
  - Divorce / custody affecting financial-aid eligibility.
- **Refuse** to advise loan-borrowing strategy as if it were
  financial advice; surface the trade-offs, leave the choice
  to the family.
