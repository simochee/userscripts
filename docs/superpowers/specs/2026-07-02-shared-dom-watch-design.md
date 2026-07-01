# Shared DOM Watch Utility — Design

## Purpose

Provide a shared utility for userscripts to react to elements appearing and
disappearing in the DOM, driven by a single `MutationObserver`. Userscripts on
dynamic pages (e.g. Backlog dashboards) need to attach behavior to elements that
are rendered asynchronously and re-rendered over time. This utility centralizes
that pattern with a small, robust, high-performance API.

## Placement

New shared workspace package: `packages/shared`.

- Not a userscript — it has **no** `build` script, so `pnpm -r build` skips it.
- Exposes source directly (`"exports": "./src/index.ts"`); consumers bundle it via
  `vite-plugin-monkey` at their own build time. No separate build step for shared.
- Consumed by userscript packages as a `workspace:*` dependency and imported by
  name. The bundle output stays a single `<name>.user.js` file per script.
- Follows repo conventions: `type: "module"`, `tsconfig.json` extends
  `../../tsconfig.base.json`, deps referenced via `catalog:` (this package needs
  none beyond TS types, so `devDependencies` may be empty/omitted).

## Public API

```ts
type Cleanup = () => void;
type OnAdd = (el: HTMLElement) => Cleanup | void;

/**
 * Watch for elements matching `selector` appearing anywhere in the document.
 * `onAdd` fires once per element when it (or an ancestor) is inserted.
 * If `onAdd` returns a function, it is called when that element is later removed.
 * Returns a stop function that disconnects the observer and runs all pending
 * cleanups.
 */
function watch(selector: string, onAdd: OnAdd): () => void;
```

Design shape: React `useEffect`-style. Per-element state lives in the closure
returned by `onAdd`, so add/remove state sharing is automatic. This is the
hardest-to-misuse contract of the options considered.

## Observation strategy

A single `MutationObserver` observes `document.documentElement` (or a configurable
root — default `document.body` at call time, falling back to `documentElement`)
with **`childList: true, subtree: true` only**. Attributes and characterData are
NOT observed, minimizing callback frequency.

For each `MutationRecord`:

- **Added nodes** — for each `addedNode`:
  - **Element-only guard**: process only if `node instanceof HTMLElement`. Text
    nodes, comments, and `SVGElement` are skipped immediately. This makes
    `matches`/`querySelectorAll` safe to call and avoids touching non-HTML DOM.
  - **Subtree scan**: check the node itself (`node.matches(selector)`) AND its
    descendants (`node.querySelectorAll(selector)`), since a single insertion may
    bring in matching descendants. `querySelectorAll` on an `HTMLElement` returns
    only element descendants; each result is an `Element`, re-guarded to
    `HTMLElement` before use.
- **Removed nodes** — for each `removedNode` (and its descendants that were
  tracked), run cleanup and untrack.

### Duplicate prevention & cleanup tracking

- `WeakMap<HTMLElement, Cleanup | null>` — `tracked`. Presence = already added.
  Value = the cleanup returned by `onAdd` (or `null` if it returned nothing).
- On a match: skip if already in `tracked`. Otherwise call `onAdd` inside
  try/catch; store the returned cleanup (or `null`).
- On removal: for the removed node itself and any tracked descendants, if present
  in `tracked`, run its cleanup (try/catch) and delete from `tracked`.
- Using a `WeakMap` avoids leaks and makes re-insertion / duplicate mutations
  idempotent. (A `WeakMap` alone suffices; no separate `WeakSet` is needed since
  key-presence already answers "seen?".)

### Removed-subtree handling

When a node is removed, its descendants generate no separate `removedNodes`
records. To fire cleanup for tracked descendants, on each removed `HTMLElement`
run `querySelectorAll(selector)` over it and cleanup any that are in `tracked`,
plus the node itself. (Removed subtrees are still queryable synchronously within
the observer callback.)

### Initial synchronous scan

On `watch()` call, immediately `querySelectorAll(selector)` the root once and
treat existing matches as additions. Covers elements already present before the
observer starts.

## Robustness

- Every `onAdd` and every `Cleanup` invocation is wrapped in try/catch; a throw
  from one element is logged (`console.error`) and does not abort processing of
  other elements or tear down the observer.
- The `HTMLElement` guard means SVG and other non-HTML nodes are never passed to
  `matches`/`querySelectorAll`, so mixed content cannot break the walker.
- No rAF/microtask batching layer: `MutationObserver` already coalesces mutations
  into batched callbacks, and the `WeakMap` guard makes repeated work cheap.
  Adding batching is explicitly out of scope (YAGNI).

## Non-goals

- Attribute/characterData change observation.
- Configurable batching / throttling.
- Non-CSS-selector matching (predicate functions).
- Framework integration.

## File layout

```
packages/shared/
  package.json        # name "shared", private, type module, no build script
  tsconfig.json       # extends ../../tsconfig.base.json
  src/
    index.ts          # exports { watch }
    watch.ts          # implementation
```

Consumers add `"shared": "workspace:*"` to devDependencies and
`import { watch } from "shared";`.
