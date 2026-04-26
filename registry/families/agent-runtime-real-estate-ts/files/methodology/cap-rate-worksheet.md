---
id: cap-rate-worksheet
capability: cap-rate-worksheet
retrieved: 2026-04-25
authority: CCIM Institute "Investment Real Estate" curriculum; Frank Gallinelli "What Every Real Estate Investor Needs to Know About Cash Flow"; IRS Pub 527 (residential rental); IRS Pub 544 (asset disposition)
---

# Cap Rate / NOI / Cash-on-Cash Worksheet

A cap rate is a **valuation-comparison ratio** for stabilized income
property. It is not a return projection, not a hold-period IRR, and
not a substitute for full underwriting. Use this worksheet to compare
a candidate property to market or to underwrite a buy-and-hold
acquisition. For syndication, partnership, or lending decisions,
escalate to a CPA and the lender's underwriter.

## 1. Inputs (open `:::question` until complete)

Refuse to compute until ALL of these are known:

- Asking / contract price
- Unit count and rent per unit (current AND market — flag any gap)
- Vacancy assumption (% — physical AND credit-loss combined)
- Operating expense detail (line items, not a ratio)
- Capex reserve (annual $ or per-unit)
- Property type (residential 1-4 / residential 5+ / commercial / mixed)
- Financing structure (cash / loan amount / rate / amortization /
  term / IO period if any)
- Closing costs and immediate capex (acquisition basis)

Refuse to use a "50% rule" or other rules-of-thumb in lieu of real
opex line items. Rules-of-thumb are screening tools, not underwriting.

## 2. NOI build

```
Gross Potential Rent (GPR)        = sum(unit rent × 12)
+ Other income                     (laundry, parking, storage, pet)
− Vacancy & credit loss            (% × GPR; minimum 5% even if
                                     "fully leased")
= Effective Gross Income (EGI)

− Operating expenses               (see §3 line items)
− Capex reserve                    (see §4)
= Net Operating Income (NOI)
```

NOI **excludes** debt service, depreciation, income tax, and the
owner's labor. Including any of those produces a different metric
(cash flow before tax, after-tax cash flow, etc.) — keep them
separate.

## 3. Operating expenses (line by line)

Refuse to estimate opex as a single percentage. Build it:

- **Property tax** — pull from county assessor; flag if a sale will
  trigger reassessment (e.g. CA Prop 13 succession, mansion-tax
  jurisdictions). Reassessment risk is a real underwriting hazard;
  surface it.
- **Insurance** — current premium; flag wind / flood / wildfire
  zones where premium has moved >20% YoY recently.
- **Property management** — 6-10% of EGI for residential SFR; 4-8%
  for multifamily 5+; lower for commercial NNN. If owner-managed,
  carry a phantom PM fee — the labor isn't free.
- **Repairs & maintenance** — 5-15% of EGI; calibrate to age and
  condition tier.
- **Utilities** — only what owner pays; verify lease structure.
- **HOA / condo fees** — if any.
- **Trash / sewer / water** — if owner-paid.
- **Lawn / snow / pest** — if owner-paid.
- **Legal / accounting / licensing** — small but real.
- **Marketing / leasing commissions** — annualized.

## 4. Capex reserve

Capex is NOT a maintenance line. It is a sinking fund for big-ticket
replacement: roof (20-30 yr), HVAC (15-20), water heater (8-12),
flooring (10-15), siding (25-40), windows (25-40), kitchen (15-25),
bath (15-25), parking lot resurface (15-25 commercial).

Per-unit per-year defaults:
- Residential SFR: $250-$500 / unit / yr
- Residential 2-4: $200-$400 / unit / yr
- Residential 5+: $250-$350 / unit / yr (institutional standard)
- Commercial NNN: tenant typically pays — verify the lease

Underreserving capex is the single most common mistake in retail-
investor cap-rate math. Always carry a reserve. Surface it loudly
when the user wants to omit it.

## 5. Cap rate

```
Cap rate = NOI / Price
```

Compare to market cap rate for the asset class / submarket. Sources:
CoStar, RCA, local broker market reports. Surface 3 cap rates side by
side:

- **In-place cap** — using current rents
- **Market cap** — using market rents
- **Stabilized cap** — using market rents, full vacancy assumption,
  realistic opex including PM and capex reserve

If in-place and market diverge >100 bps, there is rent upside or
downside the user must underwrite separately. Don't paper over it.

## 6. Cash-on-cash and DSCR

```
Annual debt service        = mortgage P&I × 12
Cash flow before tax (CFBT) = NOI − annual debt service
Cash invested              = down payment + closing costs + immediate capex

Cash-on-cash               = CFBT / cash invested
DSCR                       = NOI / annual debt service
```

DSCR floors:
- Residential 1-4 conventional: lender doesn't underwrite DSCR;
  surface it anyway as a stress test
- Residential 5+ agency: typically 1.20-1.25 minimum
- Commercial: 1.20-1.40 typical; lower in trophy assets, higher in
  distressed markets

DSCR < 1.0 means the property doesn't cover its own debt service from
NOI — flag this as a serious underwriting risk regardless of the
investor's outside income.

## 7. Sensitivity table

Build a 2D sensitivity (cap rate × exit cap, OR rent growth × vacancy)
showing Year-5 cash flow and unlevered IRR. A point estimate without
sensitivity misrepresents the bet. The user should see how fragile
the deal is to:

- ±50 bps cap rate at exit
- ±100 bps interest rate at refinance
- ±5% vacancy
- ±10% opex inflation

## 8. When cap rates mislead — escalate

Cap rates are **wrong tools** for these — escalate to deeper
methodology or a specialist:

- **Gut-renovation / value-add deals** — NOI doesn't exist yet;
  underwrite stabilized-yield-on-cost instead, and hold-period IRR.
- **Owner-occupier / house-hack 2-4 units** — cap rate ignores the
  saved rent the owner is paying themselves; use a different
  framework.
- **Ground-lease / leasehold** — residual-lease-term decay
  dominates; cap rate misleads.
- **Short-term rental (STR)** — operates more like a hotel than a
  rental; opex profile and seasonality break the worksheet.
- **Triple-net (NNN) commercial** — lease creditworthiness and
  rollover risk dominate cap rate.
- **1031-exchange replacement underwriting** — the basis-tracking
  and like-kind execution timing (45-day identification, 180-day
  close, qualified intermediary) are CPA / QI territory; surface
  the concept only and escalate execution.

## 9. Output

Emit an `:::artifact` block with the regulatory header (see system
prompt §"Regulatory disclaimer") and a structured table:

- Inputs (rents, vacancy, opex line items, capex reserve, financing)
- NOI build
- In-place / market / stabilized cap
- Cash flow, cash-on-cash, DSCR
- Sensitivity table (2D)
- Flags (reassessment risk, capex underreserve, DSCR <1, rent gap)
- Refusal / escalation flags surfaced

Never report a single cap rate without surfacing the in-place vs.
stabilized gap and the reserve / vacancy assumptions that produced
it. The number alone is a vibe; the build is the analysis.
