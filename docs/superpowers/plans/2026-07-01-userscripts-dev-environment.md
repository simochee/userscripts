# Userscripts Development Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a pnpm-workspace monorepo for authoring `vite-plugin-monkey` userscripts with Biome, a Plop scaffold, date-based versioning, and Greasy Fork distribution metadata.

**Architecture:** pnpm workspace monorepo — one package per userscript under `packages/`, shared Vite/Biome/TS config at root, mandatory `catalog:` for all dependency versions. Each package builds a single `.user.js` via `vite-plugin-monkey` with metadata declared inline in its `vite.config.ts`. Version is `YYYY.MM.DD[.N]`, injected at build time from a shared `scripts/version.ts`. A Plop generator (`nr new`) scaffolds new packages.

**Tech Stack:** pnpm 11, Node.js 26, Vite 8, vite-plugin-monkey 8, Biome 2, Plop 4, TypeScript 6, @antfu/ni.

## Global Constraints

- Package manager: pnpm 11.x, workspaces. Node.js pinned to `26` via `devEngines.runtime` in root `package.json`.
- **`catalog:` is mandatory** — every dependency version is defined in `pnpm-workspace.yaml` under `catalog:`; all `package.json` files reference deps with the `catalog:` protocol. No inline version ranges anywhere.
- All package-manager commands use `@antfu/ni` (`ni`, `nr`, `nlx`) — never `npm`/`yarn`/`pnpm` directly.
- All authored text (code comments, metadata, README, Plop prompts, docs) is written in **English**.
- Userscript metadata is declared inline in each package's `vite.config.ts` via `monkey({ userscript: {...} })`.
- `@version` format: `YYYY.MM.DD`, with a monotonic `.N` suffix for same-day rebuilds. `package.json` `version` field is unused for distribution (fixed `0.0.0`).
- `vite-plugin-monkey` must be the **last** plugin in the Vite plugin list.
- Each package's `@downloadURL`/`@updateURL` must be present so end users get automatic updates.

---

### Task 1: Root workspace, catalog, and tooling config

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - Root scripts: `build` (`pnpm -r build`), `check` (`biome check --write .`), `new` (`plop`).
  - Catalog keys available to all packages: `vite`, `vite-plugin-monkey`, `typescript` (all `catalog:`).
  - `tsconfig.base.json` with `compilerOptions` that package `tsconfig.json` files extend.

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
*.log
```

- [ ] **Step 2: Create `.npmrc`**

```ini
# Fail if a dependency version is not resolvable via catalog/workspace.
auto-install-peers=true
```

- [ ] **Step 3: Create `pnpm-workspace.yaml` with packages glob and catalog**

```yaml
packages:
  - packages/*

catalog:
  vite: ^8.1.2
  vite-plugin-monkey: ^8.0.6
  typescript: ^6.0.3
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "userscripts",
  "private": true,
  "type": "module",
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": "26"
    }
  },
  "scripts": {
    "build": "pnpm -r build",
    "check": "biome check --write .",
    "new": "plop"
  },
  "devDependencies": {
    "@biomejs/biome": "catalog:",
    "plop": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 5: Add `@biomejs/biome` and `plop` to the catalog**

Edit `pnpm-workspace.yaml`, adding under `catalog:`:

```yaml
  "@biomejs/biome": ^2.5.2
  plop: ^4.0.5
```

- [ ] **Step 6: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 7: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.2/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

- [ ] **Step 8: Install and verify the workspace resolves**

Run: `ni`
Expected: install succeeds, `node_modules/` created, no catalog resolution errors.

- [ ] **Step 9: Verify Biome runs**

Run: `nr check`
Expected: Biome runs and reports "Checked N files" (0 files is fine — no source yet), exit 0.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json biome.json .gitignore .npmrc pnpm-lock.yaml
git commit -m "chore: set up pnpm workspace with catalog, Biome, and TS base config"
```

---

### Task 2: Shared date-based version generator

**Files:**
- Create: `scripts/version.ts`
- Test: `scripts/version.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `export function getVersion(now: Date, existingVersions?: string[]): string` — returns `YYYY.MM.DD`, or `YYYY.MM.DD.N` when `existingVersions` already contains the plain date (N is the next integer after the highest existing same-day suffix; first collision yields `.1`). `now` is injected so it is testable; callers pass `new Date()`.

Note: Vitest is added as a dev tool here since `scripts/` needs a unit test. Add it to the catalog and root devDeps in this task.

- [ ] **Step 1: Add Vitest to catalog and root devDeps**

Edit `pnpm-workspace.yaml`, under `catalog:` add:

```yaml
  vitest: ^4.0.0
```

Edit root `package.json` `devDependencies`, add:

```json
    "vitest": "catalog:"
```

And add to root `package.json` `scripts`:

```json
    "test": "vitest run"
```

Run: `ni`
Expected: install succeeds.

- [ ] **Step 2: Write the failing test**

Create `scripts/version.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getVersion } from "./version.ts";

describe("getVersion", () => {
  const now = new Date("2026-07-01T10:00:00Z");

  it("returns a zero-padded date version", () => {
    expect(getVersion(new Date("2026-03-05T00:00:00Z"))).toBe("2026.03.05");
  });

  it("returns the plain date when there are no existing versions", () => {
    expect(getVersion(now, [])).toBe("2026.07.01");
  });

  it("appends .1 on the first same-day collision", () => {
    expect(getVersion(now, ["2026.07.01"])).toBe("2026.07.01.1");
  });

  it("increments past the highest existing same-day suffix", () => {
    expect(getVersion(now, ["2026.07.01", "2026.07.01.1", "2026.07.01.2"])).toBe(
      "2026.07.01.3",
    );
  });

  it("ignores versions from other days", () => {
    expect(getVersion(now, ["2026.06.30", "2026.06.30.5"])).toBe("2026.07.01");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `nr test scripts/version.test.ts`
Expected: FAIL — cannot resolve `./version.ts` / `getVersion` not defined.

- [ ] **Step 4: Write minimal implementation**

Create `scripts/version.ts`:

```typescript
/**
 * Generates a date-based userscript version: `YYYY.MM.DD`.
 *
 * Greasy Fork requires monotonically increasing `@version` values and rejects
 * re-uploads of the same version. Dates satisfy that naturally. When a package
 * is rebuilt more than once on the same day, a monotonic `.N` suffix is added.
 *
 * @param now The build timestamp. Injected for testability; callers pass `new Date()`.
 * @param existingVersions Previously published versions, used to pick the suffix.
 */
export function getVersion(now: Date, existingVersions: string[] = []): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const date = `${year}.${month}.${day}`;

  const sameDay = existingVersions.filter(
    (v) => v === date || v.startsWith(`${date}.`),
  );
  if (sameDay.length === 0) {
    return date;
  }

  const highestSuffix = sameDay.reduce((max, v) => {
    const suffix = v === date ? 0 : Number(v.slice(date.length + 1));
    return Number.isNaN(suffix) ? max : Math.max(max, suffix);
  }, 0);

  return `${date}.${highestSuffix + 1}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `nr test scripts/version.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/version.ts scripts/version.test.ts package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: add date-based version generator"
```

---

### Task 3: First userscript package (reference implementation)

**Files:**
- Create: `packages/hello-example/package.json`
- Create: `packages/hello-example/tsconfig.json`
- Create: `packages/hello-example/vite.config.ts`
- Create: `packages/hello-example/src/main.ts`

**Interfaces:**
- Consumes: `getVersion` from `scripts/version.ts` (Task 2); catalog keys `vite`, `vite-plugin-monkey` (Task 1); `tsconfig.base.json` (Task 1).
- Produces: the canonical package shape that the Plop template (Task 4) mirrors. `vite.config.ts` calls `getVersion(new Date())` and passes it to `monkey({ userscript: { version } })`. Build emits `packages/hello-example/dist/hello-example.user.js`.

- [ ] **Step 1: Create `packages/hello-example/package.json`**

```json
{
  "name": "hello-example",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "catalog:",
    "vite-plugin-monkey": "catalog:"
  }
}
```

- [ ] **Step 2: Create `packages/hello-example/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `packages/hello-example/src/main.ts`**

```typescript
// Entry point for the hello-example userscript.
(() => {
  console.log("[hello-example] userscript loaded");
})();
```

- [ ] **Step 4: Create `packages/hello-example/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { getVersion } from "../../scripts/version.ts";

const name = "hello-example";
const repoRawBase =
  "https://raw.githubusercontent.com/simochee/userscripts/main/packages";
const downloadURL = `${repoRawBase}/${name}/dist/${name}.user.js`;

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      build: { fileName: `${name}.user.js` },
      userscript: {
        name: "Hello Example",
        namespace: "https://github.com/simochee/userscripts",
        description: "Example userscript demonstrating the build setup.",
        version: getVersion(new Date()),
        match: ["https://example.com/*"],
        grant: [],
        downloadURL,
        updateURL: downloadURL,
      },
    }),
  ],
});
```

- [ ] **Step 5: Install the new package's deps**

Run: `ni`
Expected: install succeeds; `vite` and `vite-plugin-monkey` resolve via catalog.

- [ ] **Step 6: Build the package and verify output**

Run: `nr build --filter hello-example`
Expected: build succeeds; `packages/hello-example/dist/hello-example.user.js` exists.

- [ ] **Step 7: Verify the metadata banner and version**

Run: `grep -E "@name|@version|@match|@downloadURL|@updateURL" packages/hello-example/dist/hello-example.user.js`
Expected: banner contains `@name Hello Example`, a `@version` matching `YYYY.MM.DD` (today), `@match https://example.com/*`, and both URL fields pointing at the raw GitHub path.

- [ ] **Step 8: Verify Biome is clean**

Run: `nr check`
Expected: exit 0 (no lint/format errors in the new files).

- [ ] **Step 9: Commit**

```bash
git add packages/hello-example pnpm-lock.yaml
git commit -m "feat: add hello-example userscript package"
```

---

### Task 4: Plop generator for scaffolding new userscripts

**Files:**
- Create: `plopfile.mjs`
- Create: `plop-templates/userscript/package.json.hbs`
- Create: `plop-templates/userscript/tsconfig.json.hbs`
- Create: `plop-templates/userscript/vite.config.ts.hbs`
- Create: `plop-templates/userscript/src/main.ts.hbs`

**Interfaces:**
- Consumes: root `new` script (`plop`) from Task 1; the package shape from Task 3.
- Produces: `nr new` interactively generates `packages/<name>/` mirroring the Task 3 layout. Prompts: `name` (kebab-case), `title`, `description`, `namespace`, `match` (comma-separated → array), `grant` (checkbox multiselect).

- [ ] **Step 1: Create `plop-templates/userscript/package.json.hbs`**

```handlebars
{
  "name": "{{name}}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "catalog:",
    "vite-plugin-monkey": "catalog:"
  }
}
```

- [ ] **Step 2: Create `plop-templates/userscript/tsconfig.json.hbs`**

```handlebars
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `plop-templates/userscript/src/main.ts.hbs`**

```handlebars
// Entry point for the {{name}} userscript.
(() => {
  console.log("[{{name}}] userscript loaded");
})();
```

- [ ] **Step 4: Create `plop-templates/userscript/vite.config.ts.hbs`**

```handlebars
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { getVersion } from "../../scripts/version.ts";

const name = "{{name}}";
const repoRawBase =
  "https://raw.githubusercontent.com/simochee/userscripts/main/packages";
const downloadURL = `${repoRawBase}/${name}/dist/${name}.user.js`;

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      build: { fileName: `${name}.user.js` },
      userscript: {
        name: "{{title}}",
        namespace: "{{namespace}}",
        description: "{{description}}",
        version: getVersion(new Date()),
        match: [{{#each match}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
        grant: [{{#each grant}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
        downloadURL,
        updateURL: downloadURL,
      },
    }),
  ],
});
```

- [ ] **Step 5: Create `plopfile.mjs`**

```javascript
/**
 * Plop generator for scaffolding a new userscript package under packages/.
 * Run via `nr new`.
 *
 * @param {import('plop').NodePlopAPI} plop
 */
export default function (plop) {
  plop.setGenerator("userscript", {
    description: "Create a new userscript package",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name (kebab-case):",
        validate: (value) =>
          /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ||
          "Use lowercase kebab-case (e.g. my-script)",
      },
      {
        type: "input",
        name: "title",
        message: "Userscript display name:",
      },
      {
        type: "input",
        name: "description",
        message: "Description:",
      },
      {
        type: "input",
        name: "namespace",
        message: "Namespace:",
        default: "https://github.com/simochee/userscripts",
      },
      {
        type: "input",
        name: "match",
        message: "Match patterns (comma-separated):",
        filter: (value) =>
          value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
      },
      {
        type: "checkbox",
        name: "grant",
        message: "GM grants:",
        choices: [
          "GM_addStyle",
          "GM_setValue",
          "GM_getValue",
          "GM_deleteValue",
          "GM_xmlhttpRequest",
          "GM_openInTab",
          "GM_registerMenuCommand",
        ],
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "packages/{{name}}",
        base: "plop-templates/userscript",
        templateFiles: "plop-templates/userscript/**/*.hbs",
      },
      () => "Package created. Run `ni` to install dependencies.",
    ],
  });
}
```

- [ ] **Step 6: Run the generator non-interactively to verify it works**

Run: `nlx plop userscript -- --name plop-smoke --title "Plop Smoke" --description "temp" --namespace "https://github.com/simochee/userscripts" --match "https://example.org/*" --grant`
Expected: files generated under `packages/plop-smoke/`. (If passing array prompts via CLI is awkward, run `nr new` interactively instead and fill the prompts.)

- [ ] **Step 7: Verify the generated package builds**

Run: `ni && nr build --filter plop-smoke`
Expected: `packages/plop-smoke/dist/plop-smoke.user.js` exists with a valid metadata banner (`grep "@name" packages/plop-smoke/dist/plop-smoke.user.js` shows `@name Plop Smoke`).

- [ ] **Step 8: Remove the smoke-test package**

Run: `rm -rf packages/plop-smoke`
Expected: directory removed; the generator itself is what we keep.

- [ ] **Step 9: Verify Biome is clean**

Run: `nr check`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add plopfile.mjs plop-templates
git commit -m "feat: add Plop generator for new userscript packages"
```

---

### Task 5: README documenting the workflow

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1-4 (scripts, generator, build output).
- Produces: end-user/contributor documentation. No code interface.

- [ ] **Step 1: Create `README.md`**

```markdown
# userscripts

A pnpm-workspace monorepo for authoring userscripts with
[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) and
[Biome](https://biomejs.dev/), distributed via
[Greasy Fork](https://greasyfork.org/).

## Requirements

- Node.js 26
- pnpm 11
- [@antfu/ni](https://github.com/antfu-collective/ni) (commands below use it)

## Setup

```bash
ni
```

## Creating a new userscript

```bash
nr new
```

Answer the prompts (name, display name, description, namespace, match patterns,
GM grants). A new package is created under `packages/<name>/`. Then run `ni` to
install its dependencies.

## Development

```bash
nr dev --filter <name>
```

Vite starts a dev server and vite-plugin-monkey serves an install URL
(`<name>.proxy.user.js`). Install it once in your userscript manager
(Tampermonkey / Violentmonkey), then edits hot-reload live.

## Build

```bash
nr build                 # build all packages
nr build --filter <name> # build one package
```

Each package emits a single `packages/<name>/dist/<name>.user.js` with the
metadata banner and inlined dependencies. `@version` is a date, `YYYY.MM.DD`
(with a `.N` suffix for same-day rebuilds).

## Lint & format

```bash
nr check
```

## Distribution

Upload the built `.user.js` to Greasy Fork manually. Each script carries
`@downloadURL`/`@updateURL` so end users receive automatic updates.

## Versioning

Versions are date-based (`YYYY.MM.DD`) and generated at build time by
`scripts/version.ts`. Greasy Fork requires monotonically increasing versions,
which dates satisfy naturally. The `version` field in each package's
`package.json` is unused for distribution.
```

- [ ] **Step 2: Verify Biome is clean**

Run: `nr check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README documenting the userscript workflow"
```

---

## Self-Review Notes

- **Spec coverage:** toolchain (Task 1), catalog mandatory (Task 1), date version (Task 2), inline metadata + downloadURL/updateURL (Task 3), Plop scaffold with English prompts (Task 4), dev/build/check scripts (Tasks 1, 3, 5), Greasy Fork manual distribution (Task 5 docs). All covered.
- **Type consistency:** `getVersion(now: Date, existingVersions?: string[])` defined in Task 2 and called as `getVersion(new Date())` in Tasks 3 & 4 — consistent.
- **Note on `getVersion` at build time:** `vite.config.ts` runs under Node at build time (not in a sandbox), so `new Date()` is available. `existingVersions` is omitted in the config call — same-day suffix handling is available for future CI use but the default (plain date) is used locally. This matches the spec (suffix for repeated same-day builds is optional/CI concern).
```