# Mechanic Design Template

## Overview
Use this template to design a single game mechanic. Each mechanic should be grounded in the MDA framework and produce a clear player behavior.

## Fields

- **Mechanic Name**: Short, descriptive name.
- **Core Interaction**: What the player does (e.g., "press A to jump").
- **Rules**: The formal rules governing the mechanic.
- **Dynamics**: The emergent behaviors the rules produce.
- **Aesthetics**: The emotional experience targeted (e.g., challenge, discovery, expression).
- **Player Behavior Hypothesis**: What you expect the player to do. Falsifiable.
- **Metric**: How you would measure success (e.g., usage rate, completion time, error rate).
- **Complexity Cost**: Estimated learning curve and cognitive load.
- **Trade-offs**: What this mechanic costs in terms of other design goals.

## Example

- **Mechanic Name**: Grappling Hook
- **Core Interaction**: Aim and fire a hook to a grapple point; pull toward it.
- **Rules**: Hook attaches only to designated surfaces; player must hold button to maintain grip; momentum is preserved on release.
- **Dynamics**: Players swing, bypass obstacles, chain moves.
- **Aesthetics**: Sensation, mastery, freedom.
- **Player Behavior Hypothesis**: Players will use the hook to traverse faster and reach vertical areas.
- **Metric**: Average traversal time per level; hook usage per minute.
- **Complexity Cost**: Medium — requires aim and timing.
- **Trade-offs**: Adds camera control complexity; may trivialize ground-based encounters.
