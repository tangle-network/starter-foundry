# Color palette design

A working palette is a system, not a vibe. This methodology builds
a palette that holds together at thumbnail and trim, supports the
lead artist's voice, and survives the medium constraints (print
gamut, screen gamut, motion).

Default output: `:::artifact role=illustrator template=color-palette-design`
with the palette specified at the precision the medium demands
(hex + CMYK for print; hex + RGB for screen; gradient stops if
relevant).

## Procedure

### 1. Read the brief

- **Medium**: print (CMYK gamut, paper stock matters), screen
  (sRGB or P3 wide gamut), motion (color persistence under
  movement).
- **Lead artist's voice signature**: what does the prose / script
  / music *notice*? Light? Texture? Weather? Voice prose that
  notices weather wants palettes that can hold weather (cool,
  desaturated, atmospheric); voice prose that notices objects
  wants palettes that can hold object color (warm, saturated,
  specific).
- **Forbidden moves** from the brief (genre signifiers the lead
  artist doesn't want).

### 2. Pick the harmony

A palette has a structure. Don't drift; pick:

- **Monochromatic** — single hue, varying value/saturation.
  Restrained, voice-forward, common in literary covers.
- **Analogous** — adjacent hues on the wheel (e.g., teal /
  blue / blue-violet). Cohesive, atmospheric.
- **Complementary** — opposite hues (red / cyan, orange / blue,
  yellow / violet). High contrast; needs careful balance to
  avoid vibration.
- **Split-complementary** — base hue + the two hues adjacent to
  its complement. Softer than complementary, still dynamic.
- **Triadic** — three hues evenly spaced (red / yellow / blue).
  Bold; reads graphic.
- **Tetradic** — four hues in two complementary pairs. Risky;
  needs one dominant.

### 3. Set the value structure

Values matter more than hue. A palette that works in B&W (when
desaturated) works in color; the converse does not hold. Specify:

- **Lightest value** (the highlight or background "breath").
- **Mid-tone** (most of the image lives here).
- **Darkest value** (the anchor; without one, the image floats).
- **Value range** — wide (high drama) vs narrow (subtle, lyric).

### 4. Set the temperature

- **Warm-dominant**: reds, oranges, yellows. Reads intimate,
  alive, sometimes aggressive.
- **Cool-dominant**: blues, teals, violets. Reads remote,
  reflective, sometimes cold.
- **Neutral with one accent**: most of the image neutral, one
  saturated accent draws the eye. Works for cover designs that
  need a focal point.

### 5. Saturation discipline

Most amateur palettes saturate everything. Voice palettes are
disciplined:

- 70-80% of the image at moderate saturation (or lower).
- 10-20% at higher saturation, pulled out of the dominant range
  for emphasis.
- 5-10% at full saturation, reserved for the focal point.

### 6. Test the palette

- **Thumbnail.** Reduce the palette to 1cm and check: does the
  composition still read? Does the focal point still pull the
  eye? Most palettes that fail at trim size were already failing
  at thumbnail.
- **B&W (luminance only).** Desaturate. Does the value structure
  hold? If everything reads middle-gray, the palette has no
  value structure.
- **Adjacent context.** A novel cover sits next to other covers
  on a shelf. Web art sits in feeds. Test the palette against
  the contexts it'll live in; a palette that's a masterpiece in
  isolation can be invisible in context.

### 7. Specify the deliverable

```
:::artifact role=illustrator template=color-palette-design id=palette-2026-04-26 title="Palette — <project>"

## Lead artist + voice
Lead: <novelist / writer / musician / artist>
Voice signature: <one paragraph, from the coach's audit if applicable>
Forbidden: <e.g., "no genre red/black; no thriller-serif palette">

## Harmony + structure
Harmony: <monochromatic | analogous | complementary | ...>
Temperature: <warm | cool | neutral-with-accent>
Value range: <wide | medium | narrow>

## The palette

| Role        | Hex     | RGB         | CMYK         | Notes |
|-------------|---------|-------------|--------------|-------|
| Background  | #1a2433 | 26,36,51    | 89,72,49,57  | Deep blue-violet; the ocean at dusk |
| Mid-tone    | #5d6b7a | 93,107,122  | 60,46,40,17  | Stone gray-blue; rocks |
| Highlight   | #c4d2dc | 196,210,220 | 25,13,10,0   | Cool fog; for the lighthouse mass |
| Accent      | #d4a04a | 212,160,74  | 18,38,80,1   | Lamp warmth; the only warm note in the palette |
| Anchor      | #0a0e15 | 10,14,21    | 90,82,67,90  | Near-black; for line and detail |

## Test results
- Thumbnail (1cm): focal point holds, lamp accent visible
- B&W: 4 distinct value steps, no merging
- Context (other lit-fic covers): reads quiet, distinct from
  thriller / romance neighbors

## Trade-offs (named)
- Cool-dominant palette feels withheld; great for the voice,
  weaker on shelf retail "pop." If retail visibility is
  prioritized, the accent can take more area (currently ~5%; could
  go to 10-15% without breaking the harmony).

## Iteration plan
One pass to the lead artist. If they want warmer overall, the
palette anchor ports to a slightly warmer near-black (#0e0d0a);
the rest holds.
:::
```

## Cross-medium variants

### For a needle-drop / album artwork brief (handoff from music-producer)

When the music-producer has supplied a one-page musical-direction
document (atmosphere, dynamics, vocal pocket), translate the
sonic vocabulary to color:

- **Bass-forward, slow** → low-value, cool-temperature, narrow-
  saturation, large mid-tone area.
- **Vocal-forward, intimate** → mid-value, warm, accent on a
  single hue, smaller value range.
- **Dense, full-spectrum** → wider saturation range, more accent
  area, but maintain value discipline (dense music + dense color
  = mush).
- **Sparse, single-instrument** → monochromatic + restrained,
  one accent.

### For a script color-palette pre-vis (handoff from screenwriter)

Less common but valuable: the writer wants a palette key for
production design. Specify the palette as a *story arc*: which
hues dominate Act I, which shift in Act II, which return at
resolution. Production design + DP use the key as a constraint;
you supply the structure, they execute.

## Anti-patterns to refuse

- **Trendy palettes.** "Use the palette that's hot right now"
  ages instantly. Voice palettes age well.
- **Saturating everything.** Discipline above; obey it.
- **Skipping the B&W test.** A palette that fails B&W will fail
  in print and at thumbnail.
- **Producing the final color file.** Palette spec is the
  artifact; final color application by a production artist
  (`:::escalation` for production-ready files).

## When to escalate

- **Brand identity color systems** (trademarked, used across many
  surfaces) — branding agency.
- **Color management for print production** (ICC profiles,
  paper-stock-specific gamut testing) — prepress specialist.
- **Accessibility color contrast** (WCAG AA/AAA compliance for UI
  surfaces) — accessibility specialist; you can run the math but
  the audit is theirs.
