---
name: excalidraw-drawing-accuracy
description: Lightweight Excalidraw drawing skill for this MCP server. Use for fast diagram creation with minimal constraints, then iterate with targeted fixes.
---

# Excalidraw Drawing (Lightweight)

Use this skill to get a usable diagram quickly, then refine in small steps.

Source of truth: this file is the primary definition.

## Scope

This skill targets tools in `packages/mcp-server/src/tools/*`:

- `start_session`
- `add_elements`
- `create_from_mermaid`
- `update_element`
- `delete_element`
- `get_scene`
- `export_diagram`

## 1. Strategy Selection

Use simple routing:

- Input contains Mermaid (` ```mermaid ` or Mermaid DSL) -> `create_from_mermaid`
- Otherwise -> `add_elements` / `update_element`

## 2. Default Style

Default preset: `Ghibli` (apply when user does not specify style).

- Primary node: `backgroundColor: #f0f9ff`, `strokeColor: #0369a1`
- Secondary node: `backgroundColor: #f7fee7`, `strokeColor: #365314`
- Accent node: `backgroundColor: #fff7ed`, `strokeColor: #9a3412`
- Shared style: `fillStyle: "hachure"`, `roughness: 2`, `roundness: { "type": 3 }`

Override rule:

- If user explicitly asks for another style, follow user style.
- Otherwise keep Ghibli and do not mix different style systems in one diagram.

## Standard Workflow

Use this short loop:

1. Start session

- call `start_session` with `sessionId`

2. First render

- Mermaid input: call `create_from_mermaid`
- Non-Mermaid input: call `add_elements` in 2-4 small batches (not one huge batch)

3. Quick polish

- use `update_element` for spacing, labels, and key connector fixes
- prefer touching only problematic elements

4. Verify and deliver

- call `get_scene`
- confirm key nodes/edges exist
- return session URL + summary of what changed

## Minimal Constraints

1. Every non-text element has explicit stable `id`.
2. For arrows, bind both endpoints when possible (`start/end` preferred).
3. Create/connect in segments; avoid one-shot giant payloads.
4. Target updates by `id`, not by coordinate guessing.

## Pre-Flight Checklist

Before scene write (`create_from_mermaid` / `add_elements` / `update_element`):

- [ ] sessionId fixed and consistent
- [ ] strategy selected (Mermaid vs manual)
- [ ] style selected (default `Ghibli` unless user overrides)
- [ ] ids unique
- [ ] write plan is segmented (2-4 batches for medium/large scenes)

## Post-Write Verification

After write/update/delete:

- [ ] `get_scene` succeeds
- [ ] critical ids are present
- [ ] no obvious broken connector on core flow
- [ ] labels are readable for core nodes

If checks fail, patch only the failing region and re-verify.

## Failure Handling

- `connection_error`: session/server unavailable -> re-check session and endpoint, retry
- `missing_element`: id not found -> refresh scene, remap target, retry
- `binding_error`: arrow/text unbound -> patch with explicit bindings
- `layout_issue`: unreadable region -> manual local fix with `update_element`

## Canonical Patterns

### Node with label

```json
{
  "id": "node-api",
  "type": "rectangle",
  "x": 120,
  "y": 120,
  "width": 240,
  "height": 96,
  "backgroundColor": "#f1f5f9",
  "strokeColor": "#475569",
  "label": {
    "text": "API Service",
    "fontSize": 16,
    "textAlign": "center",
    "verticalAlign": "middle"
  }
}
```

### Bound arrow

```json
{
  "id": "edge-api-db",
  "type": "arrow",
  "x": 0,
  "y": 0,
  "start": { "id": "node-api" },
  "end": { "id": "node-db" },
  "strokeStyle": "solid",
  "endArrowhead": "arrow"
}
```

## Completion Contract

When concluding work, report:

1. `sessionId`
2. created/updated/deleted ids
3. core checks pass/fail
4. next suggested tweak (one item max)
