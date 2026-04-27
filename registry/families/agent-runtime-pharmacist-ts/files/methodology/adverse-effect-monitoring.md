# Adverse Effect Monitoring Template

## Purpose
Provide a structured profile of expected adverse effects, monitoring
parameters, and patient-education points for a specific medication.
Advisory only — never replaces a prescribing clinician's judgment
for a real patient. Drug-specific dosing, interactions, and
monitoring belong with the patient's pharmacist, prescriber, and
care team.

## When to use
Trigger when the user asks about side effects of a medication, what
to watch for, or what monitoring labs are appropriate. For
interaction screening with another drug, route to
drug-interaction-check.md. For dose questions, route to
dosing-guidance.md.

## Method

1. **Identify the drug precisely.**
   - Generic name (preferred for unambiguity).
   - Brand name (for the user's own context).
   - Strength, formulation (IR / ER / SR / depot, oral / IM /
     IV / topical / inhaled).
   - Indication (the *same* drug at the *same* dose can have
     different monitoring needs depending on indication).
2. **Pull from authoritative sources.**
   - FDA prescribing information (drugs@FDA, DailyMed) — the
     primary regulatory source in the US.
   - Lexicomp / Micromedex / UpToDate — clinical references.
   - DrugBank / RxList for general consumer-level info.
   - Clinical guidelines (society / consortium): ATS for
     pulmonary, ACC/AHA for cardio, IDSA for infectious
     disease, etc.
3. **Stratify adverse effects by frequency and severity.**

   | Frequency tier | Definition |
   |----------------|------------|
   | Very common | ≥10% of patients |
   | Common      | 1–10% |
   | Uncommon    | 0.1–1% |
   | Rare        | 0.01–0.1% |
   | Very rare   | <0.01% |

   Tag each effect with severity:
   - **Mild / nuisance** (manage symptomatically; rarely
     discontinuation).
   - **Moderate** (may require dose adjustment or
     symptom-directed therapy).
   - **Severe / serious** (warrants discontinuation,
     dose-reduction, or emergent care).
   - **Black-box / boxed warning** (FDA-level red flag).

4. **Map monitoring parameters.**
   - **Baseline**: labs / vitals before initiation. Examples:
     LFTs before statins, K+/Mg+ before QT-prolonging drugs,
     pregnancy test before isotretinoin, eGFR before NSAIDs.
   - **Periodic**: ongoing monitoring at defined intervals.
   - **Threshold for action**: at what value does the team act?
     "ALT >3× ULN with symptoms → discontinue and refer."
   - **Symptom monitoring**: subjective signs the patient
     should report.
5. **Identify high-risk interactions** that *increase* AE risk
   rather than affect efficacy:
   - Drugs that prolong QT in combination.
   - CYP inhibitors that elevate the drug's plasma level.
   - Cumulative serotonergic or anticholinergic burden.
   - Same-class additive effects (multiple antihypertensives,
     multiple anticoagulants, multiple sedatives).
6. **Patient-education delivery.**
   - **What to expect** (mild / common things — set
     expectations to reduce non-adherence over benign symptoms).
   - **What to report** (moderate concerns to flag at the
     next visit / pharmacist call).
   - **When to seek emergency care** (severe / immediate
     concerns — chest pain, difficulty breathing, swelling of
     face / tongue, severe rash, suicidal ideation when on
     antidepressants).
   - Education in language the patient will use, not in
     pharmacology jargon.
7. **Special-population callouts** as relevant:
   - Pregnancy / lactation (Lactmed for breastfeeding).
   - Pediatric / geriatric.
   - Renal / hepatic impairment.
   - Substance-use history (esp. opioids, benzos, stimulants).

## Output

```
:::artifact
template: adverse-effect-monitoring
drug:
  generic: "..."
  brand: "..."
  formulation: "..."
  indication: "..."
common-adverse-effects:
  - { effect: "...", frequency: "common (5%)", severity: "mild", management: "...", typical-onset: "first 1–2 weeks" }
serious-adverse-effects:
  - { effect: "...", frequency: "rare (<0.1%)", severity: "severe", risk-factors: ["..."], action-threshold: "..." }
black-box-warning: "..." | null
monitoring:
  baseline: ["LFTs", "lipid panel", "..."]
  periodic: [{ test: "...", interval: "every 3 months" }]
  thresholds:
    - { parameter: "ALT", action: "..." }
high-risk-interactions:
  - "QT-prolonging combinations: ..."
  - "CYP3A4 inhibitors: ..."
patient-education:
  expect: "..."
  report: "..."
  emergency: "..."
references:
  - "FDA label, accessed YYYY-MM-DD"
  - "Lexicomp, accessed YYYY-MM-DD"
:::
```

## Common monitoring failures

1. **Generic frequency labeling.** "Common" without the % range
   undersells the risk; pull the % from the label.
2. **Skipping baseline labs.** Many AE profiles depend on
   pre-treatment status (LFTs, K+, eGFR). Baseline missed =
   no anchor for periodic comparison.
3. **Ignoring cumulative class burden.** Two anticholinergics
   together is more than additive; same with serotonergic
   load.
4. **Treating the patient as the prescribing clinician.** The
   user is not the prescriber; recommend they raise concerns
   with the actual prescriber rather than acting alone.
5. **Outdated FDA info.** AE profiles update; always include
   pull date.

## Refusal triggers

The agent will:
- **Refuse** to recommend a real patient stop, hold, or alter a
  medication; that is the prescriber's call. Surface what to
  ask the prescriber.
- **Refuse** to interpret labs in a way that constitutes
  diagnosis or dosing decision.
- **Escalate** any user description of:
  - Severe rash with mucous-membrane involvement (Stevens-
    Johnson / TEN risk).
  - Anaphylaxis signs (face/tongue swelling, breathing
    difficulty).
  - Suicidality on antidepressant or any med with this risk.
  - Liver-injury signs (jaundice, severe abdominal pain, dark
    urine).
  - Severe bleeding on anticoagulant.
  - Chest pain on stimulant or stimulant-like agent.
  → call 911 / poison control (US: 1-800-222-1222) /
  prescriber immediately.
