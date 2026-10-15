# Shared primitive scaffold proof

The nine inventoried template sources now delegate to Brand/UI/Sandbox UI. Three bare React fallback primitive copies also delegate to the shared owner. Existing editable application behavior stays with its consumer.

Before: `90d72bf4`. After: `606b98e2`. Captured 2026-10-15 on Beelink1 at 1440 × 1000 and 390 × 1000; marketplace screenshots include the full scrolling page. Light and dark screenshots finish finite CSS transitions before capture.

## Checked behavior

- Normal gate `beelink1-e1773020ff20cb2798aacf3f4f5b9d11`: exit 0; frozen install, TypeScript build, all seven composition tests, registry validation (169 families), and nine of nine delegated-source checks.
- Before and after browser receipts: zero page errors; workspace input/action and marketplace command editing pass; clipboard equals the exact displayed code at both widths.
- Freshly composed React production build passes; freshly composed marketplace Next production build passes after fixing promised route parameters. Next workers were capped at two in the disposable consumer.
- All sixteen screenshots opened in a contact sheet; all four unchanged recordings decoded and reviewed through frame sequences.

These captures exercise isolated source-template fixtures. The generated consumers were built from the composer API with real package dependencies. Package publication and a consumer built from the published package are separate delivery checks.

## Matching screenshots

| Surface     | Width | Theme | Before                                      | After                                     |
| ----------- | ----: | ----- | ------------------------------------------- | ----------------------------------------- |
| primitives  |  1440 | light | [Before](before/primitives-1440-light.png)  | [After](after/primitives-1440-light.png)  |
| primitives  |  1440 | dark  | [Before](before/primitives-1440-dark.png)   | [After](after/primitives-1440-dark.png)   |
| primitives  |   390 | light | [Before](before/primitives-390-light.png)   | [After](after/primitives-390-light.png)   |
| primitives  |   390 | dark  | [Before](before/primitives-390-dark.png)    | [After](after/primitives-390-dark.png)    |
| marketplace |  1440 | light | [Before](before/marketplace-1440-light.png) | [After](after/marketplace-1440-light.png) |
| marketplace |  1440 | dark  | [Before](before/marketplace-1440-dark.png)  | [After](after/marketplace-1440-dark.png)  |
| marketplace |   390 | light | [Before](before/marketplace-390-light.png)  | [After](after/marketplace-390-light.png)  |
| marketplace |   390 | dark  | [Before](before/marketplace-390-dark.png)   | [After](after/marketplace-390-dark.png)   |

## Uncut recordings

| Width | Before                                 | After                                |
| ----: | -------------------------------------- | ------------------------------------ |
|  1440 | [Before](before/interaction-1440.webm) | [After](after/interaction-1440.webm) |
|   390 | [Before](before/interaction-390.webm)  | [After](after/interaction-390.webm)  |

The recordings show theme switching, workspace input and its visible action result, marketplace input editing, and copying. [Manifest](manifest.json) records revisions, dimensions, durations and file hashes.
