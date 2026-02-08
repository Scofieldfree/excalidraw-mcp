---
name: excalidraw-drawing-accuracy
description: Accuracy-first Excalidraw drawing skill for this MCP server. Use when creating/updating diagrams with strict structure constraints, deterministic layout, endpoint/text bindings, and post-write verification.
---

# Excalidraw Drawing Accuracy

Use this skill for all diagram generation/refinement tasks where correctness and edit stability matter.

Source of truth: this file is the primary definition. Mirror copies should sync from here.

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

Choose strategy before any tool call:

- If input contains Mermaid data (fenced ```mermaid block or Mermaid DSL text), use `create_from_mermaid`.
- If input does not contain Mermaid data, use manual element editing (`add_elements`/`update_element`).

Default to manual strategy because it gives deterministic control over ids, bindings, and spacing.

If `create_from_mermaid` is used, always run post-conversion normalization and verification (ids, bindings, spacing, readability) before final delivery.

Decision priority:

1. Mermaid input detected -> `create_from_mermaid`
2. No Mermaid input -> `add_elements` / `update_element`

## Standard Workflow

Always execute in this order:

1. Start and target a session

- call `start_session` with `sessionId`
- keep using the same `sessionId` in subsequent calls

2. Validate intent

- identify required nodes, edges, and labels
- decide layout direction: vertical (pipeline/hierarchy) or horizontal (sequence/timeline)

3. Normalize plan

- assign stable ids for all nodes and edges
- define spacing, sizing, and edge semantics before writing

4. Write scene

- create nodes first
- attach labels to nodes (`label` preferred)
- create connectors after both endpoints exist
- apply updates incrementally for complex diagrams

5. Verify

- call `get_scene`
- verify ids exist, labels are bound, and connectors are bound on both ends

6. Deliver

- provide session URL and summarize changed node/edge ids

## Hard Constraints (Blocking)

Do not proceed if any rule fails:

1. Every non-text element has explicit stable `id`.
2. Text on shapes is bound (`label` preferred over free-floating text).
3. Bound text does not set explicit `x/y/width/height`.
4. Every arrow has both ends bound via `start/end` or `startBinding/endBinding`.
5. Arrows are created only after source/target nodes exist.
6. Update/delete targets by stable identity (`id`, semantic role), not by coordinates.
7. Grouping (if used) only after layout is stable.

## Quality Constraints (Non-Blocking)

- Node size target: `200-300 x 80-120`
- Spacing target: `40-60px`
- Connector gap target: `10-15px`
- Use orthogonal connectors when possible
- Connector semantics:
  - `solid`: primary/required flow
  - `dashed`: weak dependency or boundary
  - `dotted`: optional/future/reference

## Pre-Flight Checklist

Before `add_elements`:

- [ ] sessionId fixed and consistent
- [ ] Mermaid detection completed and strategy selected by priority rule
- [ ] ids unique
- [ ] no orphan text unless explicitly required
- [ ] all connector endpoints resolvable
- [ ] layout direction and spacing policy defined

## Post-Write Verification

After write/update/delete:

- [ ] `get_scene` succeeds
- [ ] critical ids are present
- [ ] no dangling connector endpoints
- [ ] label readability is acceptable
- [ ] scene can tolerate one-node move without broken links (logical check)

If any check fails, repair and re-verify before finishing.

## Failure Handling

- `connection_error`: session/server unavailable -> re-check session and endpoint, retry
- `missing_element`: id not found -> refresh scene, remap target, retry
- `binding_error`: arrow/text unbound -> patch with explicit bindings
- `layout_regression`: spacing/alignment degraded -> normalize and update again

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
3. hard-constraint pass status
4. any residual risks (if constraints could not be fully satisfied)
