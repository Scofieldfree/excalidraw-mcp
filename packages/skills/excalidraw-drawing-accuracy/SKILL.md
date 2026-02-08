---
name: excalidraw-drawing-accuracy
description: Minimal Excalidraw workflow for stable output: start session first, route Mermaid/manual correctly, use default Ghibli style, write in small batches, then do a quick verification.
---

# Excalidraw Drawing (Minimal)

Use this skill for fast, stable diagram output with minimal process overhead.

Source of truth: this file is the primary definition.

## Tools

- `start_session`
- `create_from_mermaid`
- `add_elements`
- `update_element`
- `get_scene`

## Rules

1. Always call `start_session` first for the target `sessionId`.
2. Strategy routing:

- Mermaid input (` ```mermaid ` block or Mermaid DSL) -> `create_from_mermaid`
- Non-Mermaid input -> `add_elements` / `update_element`

3. Use segmented writes for medium/large diagrams (2-4 batches).
4. Prefer updating by `id`.

## Default Style

When user does not specify style, use `Ghibli`:

- Primary: `#f0f9ff` / `#0369a1`
- Secondary: `#f7fee7` / `#365314`
- Accent: `#fff7ed` / `#9a3412`
- Shared: `fillStyle: "hachure"`, `roughness: 2`, `roundness: { "type": 3 }`

If user specifies style, follow user style.

## Workflow

1. `start_session(sessionId)`
2. First render:

- Mermaid -> `create_from_mermaid`
- Manual -> `add_elements` (segmented)

3. Quick polish with `update_element`
4. Verify with `get_scene`

## Quick Verification

- `get_scene` succeeds
- key nodes/edges exist
- labels are readable on core nodes
- no obvious broken connector on core flow

If checks fail, fix only the affected region and re-check.

## Completion Output

Report:

1. `sessionId`
2. created/updated ids
3. verification pass/fail
