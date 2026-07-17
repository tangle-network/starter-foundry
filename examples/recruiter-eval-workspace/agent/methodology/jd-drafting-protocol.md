# JD-Drafting Protocol

Methodology for drafting a job description that is bona-fide,
inclusive, and legally compliant. Output is a `:::artifact` block.

## Inputs (collect before drafting)

1. **Role title and level** — e.g. "Senior Backend Engineer, IC4."
   Title without a level is ambiguous; ambiguity rolls downstream
   into the rubric and the loop.
2. **Hiring manager and team** — who owns the JD's sign-off, who the
   role reports to, team size.
3. **The work** — the top three to five things the person will do
   in their first 6 months. Concrete deliverables, not adjectives.
4. **Bona-fide qualifications** — capabilities the work demonstrably
   requires. Each requirement must trace to a specific deliverable
   in (3). If you can't trace it, it's not a qualification.
5. **Compensation band** — the leveling/comp doc's range for this
   level. If the org doesn't publish one, flag this back to the
   hiring manager before drafting.
6. **Location and work model** — remote / hybrid / on-site, time
   zones, relocation allowed yes/no, work-authorization required.

## Must-have vs nice-to-have

Split (4) into two lists. Be ruthless.

- **Must-have**: the role fails without it. Someone reading this
  list and missing one item should not apply. Five to seven items
  max — longer lists shrink the candidate pool without improving
  signal, and the gap correlates with under-represented groups
  self-selecting out.
- **Nice-to-have**: signal that helps but isn't required. State
  explicitly: "we don't expect any single candidate to have all of
  these." Three to five items.

If a "must-have" is actually a "nice-to-have" (e.g. specific tool
experience when the underlying skill is what matters), demote it.

## Inclusive-language audit (do this every time)

Strip or replace:

- **Coded masculinity / aggression**: rockstar, ninja, guru, hero,
  warrior, aggressive, dominant, fearless, crushing it, killer.
  Replace with the actual capability.
- **Age proxies**: "digital native," "recent grad," "energetic,"
  "junior" used as an age signal rather than a level signal,
  graduation-year fields. Replace with the level (IC2/IC3/etc.) and
  the years-of-experience equivalent if needed.
- **Ableist framing**: "walk us through," "stand-up," "see eye to
  eye." Most are easy to neutralize; pick the form that doesn't
  exclude.
- **Vague culture-fit language**: "fits our culture," "good vibes,"
  "team player." Replace with the specific working norms the role
  requires (e.g. "comfortable in async-first decision-making,"
  "writes design docs before coding non-trivial systems").
- **Pedigree filters**: "top-tier school," "FAANG required," "Ivy
  League." These are not bona-fide; replace with the underlying
  capability the pedigree was a proxy for.

## Compensation band publication

- For roles with candidates in CA, CO, NY, WA, IL, MD, RI, HI, DC
  (and any state passing pay-transparency since): the band MUST be
  in the JD. This is law in those jurisdictions and a strong norm
  everywhere else.
- Format: "$X – $Y base + equity + benefits. Band reflects level
  IC4; level confirmed during the loop."
- Cite the source: "Band sourced from [leveling-doc-link],
  last-reviewed [date]."
- Do not include current-comp questions. Asking prior salary is
  restricted in 20+ jurisdictions and is not a best practice
  anywhere.

## Equal-opportunity statement

Every JD ends with the org's EO statement. Default boilerplate when
the org hasn't published one:

> [Company] is an equal-opportunity employer. We evaluate
> candidates on bona-fide qualifications relevant to the role and
> do not discriminate on the basis of race, color, national origin,
> ancestry, sex, gender identity, sexual orientation, age, religion,
> disability, marital or family status, or any other
> legally-protected characteristic. Reasonable accommodations are
> available for the interview process; please contact
> [hiring-ops-email] to request one.

## Final structure

```
# Job Title — Level
[1-paragraph what the team does + what the person will own]

## What you'll do
[3-5 concrete deliverables, first 6 months]

## What you'll bring (must-have)
[5-7 bona-fide qualifications, each traced to the work]

## Bonus (nice-to-have)
[3-5 helpful signals, with explicit "we don't expect all of these"]

## Compensation
[band + benefits + source citation]

## Location & work model
[remote/hybrid/on-site, time zones, relocation, work-auth]

## Equal opportunity
[EO statement]
```

## Self-check before emitting

- Every must-have traces to a deliverable. ✅ / ❌
- No coded language passed the audit. ✅ / ❌
- Band is published (or hiring-manager flagged for pay-transparency
  jurisdiction). ✅ / ❌
- No prior-salary question, no pedigree filter, no age proxy. ✅ / ❌
- EO statement present. ✅ / ❌

If any ❌, fix before emitting the artifact.
