---
id: comp-analysis
capability: comp-analysis
retrieved: 2026-04-25
authority: Appraisal Institute "The Appraisal of Real Estate" 15th ed. (sales-comparison approach); Fannie Mae Form 1004 / 1073 conventions
---

# Comparable Market Analysis (CMA) Protocol

A CMA is **not an appraisal**. It is a methodology-driven estimate of
likely market value used to inform listing price, offer price, or
investment underwriting. For lending, divorce, estate, or court use,
escalate to a licensed appraiser.

## 1. Subject definition (open `:::question` until complete)

Refuse to compute until ALL of these are known:

- Address or parcel ID
- Above-grade SqFt (GLA) — basements and unfinished space tracked
  separately
- Bedrooms / full baths / half baths
- Lot size (sf or acres) and lot character (corner, flag, view, slope)
- Year built and effective age (last gut renovation if material)
- Condition tier — C1 (new) / C2 (recently renovated) / C3 (well
  maintained) / C4 (deferred maintenance) / C5 (significant repair) /
  C6 (uninhabitable)
- Quality tier — Q1 (custom luxury) through Q6 (economy)
- Property type (SFR / condo / townhouse / 2-4 unit / co-op)
- Garage / parking type and count
- HOA / condo fee monthly (if any)

If the user can't answer, halt and recommend they pull their county
assessor record or listing history before continuing.

## 2. Comparable-set selection

Target **3-6 closed-sale comparables**. Selection rules, in priority
order:

1. **Sale window** — closed within 90 days. Stretch to 180 days only
   if 90-day inventory is thin (<3 candidates) AND apply a time-
   adjustment (see §3).
2. **Geographic radius** — within 0.5 mi for urban / suburban; within
   1 mi for low-density rural. Never cross a school district, zoning,
   or municipal boundary without flagging it.
3. **Above-grade SqFt** — within ±15% of subject GLA.
4. **Bed/bath count** — match exactly when feasible; otherwise
   adjust per §3.
5. **Property type** — SFR comps for SFR subject; do NOT mix condo
   and SFR comps without flagging.
6. **Condition / quality tier** — within one tier; otherwise adjust.
7. **Closed sales only** — no active listings, no pendings, no
   withdrawn. Active listings are useful as a market-temperature
   sanity check, not as comps.

If you cannot assemble 3 qualifying comps, **refuse the CMA**. Open a
`:::escalation` block: "insufficient recent comparable sales — escalate
to a licensed appraiser who can broaden methodology."

## 3. Adjustment grid

Build a per-comp adjustment table. Adjustments apply to the comp's
sale price (NOT the subject) — the question is "what would this comp
have sold for if it were the subject."

Standard adjustment lines (in dollars, signed):

| Line | How to size |
|------|-------------|
| Time / market | If the comp closed >60 days ago and the market moved, apply the local market index (Case-Shiller MSA for major metros; otherwise a local-MLS median %/month). Cite the index. |
| GLA (above-grade SqFt) | Apply $/sf at roughly 30-50% of the subject's $/sf — the marginal value of additional SqFt is less than the average. Range: $50-$150/sf in most US markets; calibrate from paired-sales locally. |
| Bedrooms | $5k-$15k per bedroom delta in median markets; higher in tight urban; never adjust >$25k without a paired-sale citation. |
| Full baths | $5k-$10k per delta. |
| Half baths | $2.5k-$5k per delta. |
| Lot size | Marginal $/sf falls fast above lot-size norm; for typical-lot deltas use $1-$3/sf, never linear scaling on outsize lots. |
| View / waterfront | Paired-sales required — refuse to invent a number. If no paired sales, flag and exclude. |
| Condition tier | One tier ≈ 5-10% of price; two tiers ≈ 12-20%. |
| Garage spaces | $5k-$10k per space delta. |
| HOA fee delta | Capitalize the monthly delta at a market cap rate (typically 5-7%) — e.g. $200/mo delta × 12 / 0.06 ≈ $40k. |
| Updates (kitchen / bath) | Cite the comp's listing photos / remarks; $10k-$50k for a kitchen, $5k-$25k for a bath. Refuse to invent. |

Net adjustment per comp should be < 15% of sale price; gross
adjustment < 25%. If a comp blows past these, the comp is too
dissimilar — drop it and find another.

## 4. Reconciliation

Compute each comp's adjusted sale price. Then:

1. **GLA-weight** the adjusted prices by similarity to subject GLA
   (inverse-distance from subject SqFt). Closer-SqFt comps get more
   weight.
2. **Exclude IQR outliers** — drop any adjusted price > Q3 + 1.5×IQR
   or < Q1 − 1.5×IQR. If exclusion drops the comp count below 3,
   surface the dispersion as a confidence-band penalty instead.
3. **Compute the weighted mean** AND the median. Report both. If they
   diverge >5%, the comp set is heterogeneous — flag it.
4. **Confidence interval** — report a low / mid / high band:
   - **Low** = min(weighted-mean − 1 SD, lowest adjusted comp)
   - **Mid** = weighted mean
   - **High** = max(weighted-mean + 1 SD, highest adjusted comp)

The band, not the point estimate, is the deliverable. A point estimate
without a band misrepresents CMA confidence.

## 5. When to refuse the CMA

Halt and escalate to a licensed appraiser when ANY of these:

- Fewer than 3 qualifying comps within the rules above
- Subject is unique (custom architect, oceanfront, historic, post-
  fire rebuild, ag/farm with non-residential use)
- Subject's condition is C5 / C6 — uninhabitable comps are scarce
  and the as-is / as-repaired distinction matters legally
- Material adjustments (>20% of price) are required to make the
  comps fit
- The user's purpose is lending, divorce, probate, court, or
  property-tax appeal — these need a licensed appraiser

## 6. Output

Emit an `:::artifact` block with the regulatory header (see system
prompt §"Regulatory disclaimer") and a structured table:

- Subject definition
- Comp set (with sale date, distance, GLA, bed/bath, sale price)
- Adjustment grid (per-comp, per-line)
- Adjusted prices, weighted mean, median
- IQR outlier exclusions (if any)
- Confidence band (low / mid / high)
- Assumptions and caveats
- Refusal flags surfaced (if any)

Never collapse the band to a single number for the user. Never
forecast appreciation off the CMA — that is a different exercise with
different methodology and different risk.
