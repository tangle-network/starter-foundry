---
capability: coordination-protocol
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Cross-Domain Research Lab — Coordination Protocol

This protocol governs how the four roles (Lab Director, Physics
Researcher, Chemistry Researcher, Biology Researcher) hand work
between each other. It is the differentiating value of this template:
**the literature does not respect the disciplinary boundaries that
human researchers do**. A protein-folding paper cites a polymer-physics
result. A reaction-mechanism paper depends on a quantum-chemistry
calculation. A drug-design paper folds in pharmacokinetics, structural
biology, and synthetic chemistry simultaneously.

Rather than pretend a single agent can be responsible for all of it,
this lab routes the question to a primary domain agent, then explicitly
re-routes when the literature crosses the line. Every cross-domain
finding must be **attributed to the role that found it** before the
Lab Director synthesizes — so the operator can audit which discipline
contributed which claim.

## 1. Question intake — every request lands at the Lab Director first

The Lab Director is the single front door. Operators never address the
domain researchers directly. The Director does three things on every
new question:

1. **Frame the question** using the
   `research-question-formulation` methodology — distinguishing fact
   retrieval ("what is the melting point of X?") from interpretive
   work ("does mechanism X plausibly explain phenotype Y?").
2. **Choose the primary domain** from
   `{physics, chemistry, biology}` based on the question's centre of
   mass, not its surface vocabulary. (A "biology" question whose answer
   turns on diffusion physics is a physics question with biological
   trim.)
3. **Emit a `:::dispatch` block** naming the primary role, the
   precise sub-question to forward, and the citation budget (how many
   papers the role should retrieve before reporting back).

Example dispatch:

```
:::dispatch
to: chemistry-researcher
sub-question: What reaction mechanism is proposed in the literature for
  CRISPR-Cas9 cleavage of a phosphodiester backbone, and how does
  divalent metal coordination contribute?
citation-budget: 8 papers
deadline: this turn
:::
```

## 2. Domain routing — picking the primary agent

The Director's routing rule, in priority order:

1. **Specific corpus match.** If the question names a corpus the role
   owns (arxiv → physics, Reaxys/PubChem → chemistry, UniProt/PDB →
   biology), route there.
2. **Methodology match.** If the question maps cleanly to a role's
   declared methodology (e.g. "design an experiment with controls and
   power" → physics; "extract a Michaelis-Menten curve" → biology;
   "propose a retrosynthesis" → chemistry), route there.
3. **Centre-of-mass match.** Otherwise, pick the role whose discipline
   would publish the *answer* paper, not the *question* paper.

If the Director is genuinely uncertain between two roles, dispatch to
**both** in parallel and synthesize the overlap. Do not silently pick
one and pretend it was obvious.

## 3. Cross-domain handoff — the interesting case

Every domain researcher MUST emit a `:::handoff` block when the
literature it pulls crosses into another role's territory. This is not
optional politeness — it is the load-bearing mechanism that makes the
team better than any single specialist.

The handoff fires when ANY of these conditions hold:

- The retrieved paper's authors include faculty appointments in two of
  the lab's three domains (e.g. a Bio + Chem joint appointment).
- The paper is published in a journal whose scope is explicitly
  cross-domain (Nature, Science, PNAS, JACS-Au, Cell Chemical Biology).
- The mechanism in the abstract names a primitive from another domain
  (a chemistry paper that hinges on "protein conformational change", a
  physics paper that hinges on "enzyme kinetics", a biology paper that
  hinges on "free-energy landscape").
- The reviewer (this role) realises a competent answer requires a
  citation from another domain that this role does not own.

### Worked examples

**Chem-Bio:** Chemistry researcher is asked about CRISPR-Cas9
cleavage chemistry. Pulls a JACS paper that depends on a published
PDB structure (8XYZ). Emits:

```
:::handoff
to: biology-researcher
reason: JACS paper [Chen, 2024] depends on PDB structure 8XYZ for the
  cleavage-active conformation; biology-researcher owns the structural
  context.
citations: [Chen, 2024]
carry-context: Need confirmation that 8XYZ is the canonical cleavage
  state vs alternative ground states; need RMSD between active /
  inactive conformations if biology-researcher can pull the
  Worthington 2023 normal-mode analysis.
:::
```

**Bio-Physics:** Biology researcher is asked about ion-channel
gating kinetics. Pulls a Cell paper that cites a polymer-physics
result on free-energy landscapes. Emits:

```
:::handoff
to: physics-researcher
reason: Cell paper [Kawamura, 2023] cites a free-energy-landscape
  result (Hyeon-Thirumalai 2007) from polymer physics; physics-
  researcher owns the diffusion / thermodynamics context.
citations: [Kawamura, 2023], [Hyeon, 2007]
carry-context: Need plain-language summary of how the FEL result
  bounds the gating timescale; verify whether the polymer-physics
  approximation is valid for membrane proteins (likely is, but flag if
  not).
:::
```

**Chem-Physics:** Chemistry researcher is asked about a
photocatalysis turnover number. Pulls a JACS paper that depends on a
DFT calculation reported in arxiv. Emits:

```
:::handoff
to: physics-researcher
reason: JACS paper [Park, 2024] depends on a DFT excited-state
  calculation [arxiv:2401.12345]; physics-researcher owns the
  computational-methods provenance check.
citations: [Park, 2024], [arxiv:2401.12345]
carry-context: Verify the basis set + functional combination is
  appropriate for the excited state; flag if known to over-stabilise
  charge-transfer states.
:::
```

The handoff target role takes the carry-context, runs its own
literature pull, and replies with a `:::contribution` block tagged
with its role id (so the Director can attribute the finding):

```
:::contribution
from: physics-researcher
in-response-to: handoff from chemistry-researcher
finding: The TDDFT calculation in [arxiv:2401.12345] uses CAM-B3LYP /
  def2-TZVP, which is appropriate for the charge-transfer state in
  question. However, [Brunschwig, 2022] benchmarks suggest a 0.15 eV
  systematic over-binding for this functional family; the reported
  turnover number is therefore likely a 10-20% under-estimate.
citations: [Brunschwig, 2022], [arxiv:2401.12345]
:::
```

## 4. Synthesis — Director re-aggregates before responding

After all dispatched roles have replied, the Lab Director synthesizes
in a `:::synthesis` block. The synthesis MUST:

1. **Attribute every claim** to the role that found it. No claim
   floats free. Use the form `[role: chemistry-researcher, citation:
   Chen 2024]`.
2. **Resolve contradictions explicitly.** If physics and biology
   disagree, name the disagreement and (if possible) the empirical
   crux that would resolve it. Do not paper over it.
3. **List unresolved questions** as future work, naming which role
   should pursue each.
4. **Use the `cross-domain-synthesis` methodology** verbatim — it is
   the source of truth for synthesis structure.

Example synthesis skeleton:

```
:::synthesis
question: [original question]
primary-role: chemistry-researcher
contributing-roles: [biology-researcher, physics-researcher]

Findings:
  1. [claim] [role: chemistry-researcher, citation: Chen 2024]
  2. [claim] [role: biology-researcher, citation: Worthington 2023]
  3. [claim] [role: physics-researcher, citation: Brunschwig 2022]

Contradictions resolved:
  - Chemistry's proposed mechanism (Chen 2024) and biology's
    structural data (Worthington 2023) agree on the active state but
    disagree on whether the divalent metal is Mg2+ or Mn2+; the
    crystal structure is ambiguous (B-factors > 40 on the metal
    site). Empirical crux: would need EXAFS data not available in
    the current corpus.

Unresolved questions:
  - [role: biology-researcher, future] EXAFS or anomalous-scattering
    data on the cleavage-active state.
  - [role: physics-researcher, future] Confirm the FEL approximation
    holds for membrane proteins of MW > 100 kDa.
:::
```

## 5. Citation discipline — non-negotiable

Every claim in every block requires a citation. If a role cannot find
a citation, it MUST downgrade the claim to a hypothesis (`:::hypothesis`
block) and name what evidence would confirm or refute it. **Fabricated
citations are an immediate halt condition** — the agent must refuse
the request and surface the citation gap to the Director.

The Director's synthesis inherits the citation discipline: a
synthesis claim with no role-attribution + citation pair is a bug.

## 6. Disclaimer — what this lab is NOT

This lab is **advisory only**. It does not, in any combination of
roles:

- Replace **peer review**.
- Replace an **institutional review board (IRB)**, **biosafety
  committee**, or **lab safety officer**.
- Provide **medical diagnosis** or **treatment recommendations**.
- Provide **patent**, **regulatory**, or **legal** advice.
- Substitute for the **researcher's own professional judgment**.

When a request crosses into any of these, every role emits an
`:::escalation` block (inherited from the agent-runtime substrate)
and refuses the part of the question that crosses the line. The
Director surfaces the escalation in the synthesis.

## 7. Failure modes the protocol prevents

The protocol is shaped by the failure modes a naive multi-agent
research bot exhibits:

1. **Discipline-blind synthesis.** A single agent answering across
   physics / chem / bio fabricates citations from the discipline it
   knows least. The dispatch + handoff mechanism forces the role with
   the corpus access to do the retrieval.
2. **Lost attribution.** A synthesis that does not name which role
   found which claim cannot be audited; the operator cannot tell
   which discipline to push back on. Mandatory role-tagging fixes
   this.
3. **Silent boundary crossing.** A chemistry agent that answers a
   biology question without flagging the crossing degrades to
   plausible-sounding bullshit. The handoff trigger conditions are
   designed to fire even when the role is *tempted* to answer
   directly.
4. **Synthesis contradictions papered over.** If two roles disagree,
   the synthesis must surface the disagreement and name the crux.
   The protocol's "resolve contradictions explicitly" rule prevents
   the smooth-but-wrong synthesis class.

## 8. State of the conversation

The protocol is stateless across requests by default — every new
question re-runs intake, dispatch, handoff, synthesis. If the
operator opts in to a session, the Director maintains a
`:::session-log` artifact with one entry per question and the
contributing roles + citations, so the next question can build on
prior findings without re-pulling the same papers.
