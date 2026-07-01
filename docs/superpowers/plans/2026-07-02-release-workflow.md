# Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every userscript on push to `main` and sync the outputs to a flat `dist` branch whose raw URLs are the Greasy Fork distribution source, with manually managed SemVer versions.

**Architecture:** A GitHub Actions workflow (`release.yml`) provisions the toolchain via `jdx/mise-action`, runs `nr build`, then uses a plain-git `git worktree` on the pre-existing orphan `dist` branch to copy `packages/*/dist/*.user.js` in flat, committing and pushing only when the tree actually changed. Versions are hand-written SemVer in each package's `vite.config.ts`; the date-based auto-versioning and all test tooling are removed.

**Tech Stack:** GitHub Actions, `jdx/mise-action`, pnpm 11 / Node 26 (via `devEngines` + mise), Vite 8 + vite-plugin-monkey 8, plain git worktree.

## Global Constraints

- `catalog:` is mandatory — every dependency version lives in `pnpm-workspace.yaml` under `catalog:`; all `package.json` reference deps via `catalog:`. No inline version ranges.
- All package-manager commands use `@antfu/ni` (`ni`, `nr`, `nlx`).
- All authored text (comments, config, docs, workflow, prompts) is English.
- Distribution URL for `@downloadURL`/`@updateURL`: `https://raw.githubusercontent.com/simochee/userscripts/dist/<name>.user.js`.
- Versions are hand-written SemVer in each package's `vite.config.ts` (e.g. `"1.0.0"`).
- The `dist` branch is a pre-existing orphan branch with a flat layout (`<name>.user.js` at root). CI assumes it exists.
- CI triggers on push to `main`, uses the default `GITHUB_TOKEN` with `contents: write`, and pushes to `dist` only when the worktree has staged changes.
- vite-plugin-monkey must remain the last plugin in each package's plugin list.

---

### Task 1: Remove auto-versioning and test tooling; switch to manual SemVer

**Files:**
- Delete: `scripts/version.ts`
- Delete: `scripts/version.test.ts`
- Modify: `packages/hello-example/vite.config.ts`
- Modify: `plop-templates/userscript/vite.config.ts.hbs`
- Modify: `package.json` (root)
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `packages/hello-example/vite.config.ts` and the template with `version: "1.0.0"` (hand-written) and `dist`-branch `downloadURL`/`updateURL`. No `scripts/` directory, no Vitest, no root `test` script.

- [ ] **Step 1: Delete the version generator and its test**

```bash
git rm scripts/version.ts scripts/version.test.ts
```

Expected: both files removed; `scripts/` becomes empty and is dropped by git.

- [ ] **Step 2: Rewrite `packages/hello-example/vite.config.ts`**

Replace the entire file with:

```typescript
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const name = "hello-example";
const downloadURL = `https://raw.githubusercontent.com/simochee/userscripts/dist/${name}.user.js`;

export default defineConfig({
	plugins: [
		monkey({
			entry: "src/main.ts",
			build: { fileName: `${name}.user.js` },
			userscript: {
				name: "Hello Example",
				namespace: "https://github.com/simochee/userscripts",
				description: "Example userscript demonstrating the build setup.",
				version: "1.0.0",
				match: ["https://example.com/*"],
				grant: [],
				downloadURL,
				updateURL: downloadURL,
			},
		}),
	],
});
```

- [ ] **Step 3: Rewrite `plop-templates/userscript/vite.config.ts.hbs`**

Replace the entire file with:

```handlebars
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const name = "{{name}}";
const downloadURL = `https://raw.githubusercontent.com/simochee/userscripts/dist/${name}.user.js`;

export default defineConfig({
	plugins: [
		monkey({
			entry: "src/main.ts",
			build: { fileName: `${name}.user.js` },
			userscript: {
				name: "{{title}}",
				namespace: "{{namespace}}",
				description: "{{description}}",
				version: "1.0.0",
				match: [{{#each match}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
				grant: [{{#each grant}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
				downloadURL,
				updateURL: downloadURL,
			},
		}),
	],
});
```

- [ ] **Step 4: Remove the `test` script and `vitest` devDep from root `package.json`**

In `package.json`, delete the `"test": "vitest run"` line from `scripts`, and delete the `"vitest": "catalog:"` line from `devDependencies`. The result:

```json
{
	"name": "userscripts",
	"private": true,
	"type": "module",
	"devEngines": {
		"runtime": {
			"name": "node",
			"version": "26.2.0",
			"onFail": "download"
		},
		"packageManager": {
			"name": "pnpm",
			"version": "11.6.0",
			"onFail": "download"
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

- [ ] **Step 5: Remove `vitest` from the catalog**

In `pnpm-workspace.yaml`, delete the `vitest:` line from the `catalog:` block. Leave the other catalog entries (`vite`, `vite-plugin-monkey`, `typescript`, `@biomejs/biome`, `plop`) untouched.

- [ ] **Step 6: Reinstall to update the lockfile**

Run: `ni`
Expected: install succeeds; `pnpm-lock.yaml` no longer references `vitest`.

- [ ] **Step 7: Build and verify the manual version + dist URL**

Run: `nr build`
Then: `grep -E "@version|@downloadURL|@updateURL" packages/hello-example/dist/hello-example.user.js`
Expected: `@version 1.0.0`, and both URLs are `https://raw.githubusercontent.com/simochee/userscripts/dist/hello-example.user.js`.

- [ ] **Step 8: Verify Biome is clean and no test script remains**

Run: `nr check`
Expected: exit 0.
Run: `nr --list` (or inspect `package.json`)
Expected: no `test` script listed.

- [ ] **Step 9: Clean build output and commit**

```bash
rm -rf packages/*/dist
git add -A
git commit -m "refactor: manual SemVer versions, dist-branch URLs, drop auto-version and tests"
```

Note: `git add -A` stages the deletions of `scripts/*`, the edits, and the updated `pnpm-lock.yaml`. Confirm `dist/` is not staged (it is gitignored) before committing.

---

### Task 2: Release workflow that syncs builds to the `dist` branch

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `nr build` producing `packages/*/dist/<name>.user.js` (Task 1); the manually-created orphan `dist` branch; the repo `mise.toml` (provisions `@antfu/ni` + Node).
- Produces: a workflow that, on push to `main`, syncs all built `.user.js` to the flat `dist` branch, committing/pushing only on actual change.

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Check out main
        uses: actions/checkout@v4

      - name: Set up toolchain
        uses: jdx/mise-action@v2

      - name: Install dependencies
        run: ni --frozen

      - name: Build all packages
        run: nr build

      - name: Sync built userscripts to the dist branch
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          # Fetch and mount the pre-existing orphan dist branch as a worktree.
          git fetch origin dist
          git worktree add ../dist-branch origin/dist

          # Replace the worktree contents with the freshly built userscripts.
          # Keep .git; drop previous *.user.js so removed packages disappear too.
          find ../dist-branch -maxdepth 1 -name '*.user.js' -delete
          cp packages/*/dist/*.user.js ../dist-branch/

          cd ../dist-branch
          git checkout -B dist
          git add -A
          if git diff --cached --quiet; then
            echo "No changes to publish."
          else
            git commit -m "chore: sync userscripts from ${GITHUB_SHA}"
            git push origin dist
          fi
```

- [ ] **Step 2: Lint the workflow YAML locally**

Run: `nlx yaml-lint .github/workflows/release.yml` (or, if unavailable, validate by parsing)
Alternative check — parse with Node to confirm it is valid YAML:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/release.yml','utf8');if(!/on:\s*[\s\S]*push/.test(s)||!/permissions:\s*[\s\S]*contents:\s*write/.test(s))throw new Error('workflow missing trigger or permissions');console.log('workflow structure OK')"
```

Expected: prints `workflow structure OK`.

- [ ] **Step 3: Verify the copy/glob logic against a real build**

Run:
```bash
nr build
ls packages/*/dist/*.user.js
```
Expected: lists `packages/hello-example/dist/hello-example.user.js` — confirming the glob `packages/*/dist/*.user.js` in the workflow matches at least one file. Then `rm -rf packages/*/dist`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow syncing builds to the dist branch"
```

---

### Task 3: Document the release flow in the README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the release workflow (Task 2), manual versioning and `dist` URLs (Task 1).
- Produces: contributor-facing docs; no code interface.

- [ ] **Step 1: Replace the `## Distribution` and `## Versioning` sections in `README.md`**

Find the existing `## Distribution` section and the `## Versioning` section (currently describing manual upload and date-based versions) and replace both with:

```markdown
## Versioning

Each package sets `@version` by hand in its `vite.config.ts` (SemVer, e.g.
`1.0.0`). Bump it to publish an update; leave it unchanged to ship code without
republishing — Greasy Fork treats an unchanged `@version` as a no-op.

## Release & distribution

On every push to `main`, the `release` workflow builds all packages and syncs
the resulting `<name>.user.js` files to the flat `dist` branch. Their raw URLs

```
https://raw.githubusercontent.com/simochee/userscripts/dist/<name>.user.js
```

are what each script's `@downloadURL`/`@updateURL` point at, and are registered
as the sync source on [Greasy Fork](https://greasyfork.org/). The workflow
commits to `dist` only when a build output actually changed.

### One-time setup

Create the empty orphan `dist` branch once, before the first release:

```bash
git switch --orphan dist
git commit --allow-empty -m "chore: initialize dist branch"
git push -u origin dist
git switch main
```

Then register each script on Greasy Fork with its raw `dist` URL as the sync
source (optionally add the GitHub webhook for push-triggered sync).
```

- [ ] **Step 2: Remove any remaining references to `nr test` / date-based versions**

Search the README: `grep -nE "nr test|date-based|YYYY\.MM\.DD|scripts/version" README.md`
Expected after edit: no matches. If any remain, delete those lines/sentences.

- [ ] **Step 3: Verify Biome is clean**

Run: `nr check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document release workflow, dist branch, and manual versioning"
```

---

## Self-Review Notes

- **Spec coverage:** dist-branch distribution + URLs (Task 1 config, Task 2 workflow, Task 3 docs); manual SemVer (Task 1); removal of `scripts/version.*` + Vitest (Task 1); `release.yml` with push trigger, `contents: write`, worktree, change-gated commit (Task 2); one-time `dist` setup documented (Task 3); latent `@downloadURL` 404 bug fixed (Task 1). All covered.
- **Placeholder scan:** no TBD/TODO; every code/step is concrete.
- **Type/URL consistency:** the `dist` raw URL string is identical in `vite.config.ts`, the `.hbs` template, and the README (`https://raw.githubusercontent.com/simochee/userscripts/dist/<name>.user.js`). `version: "1.0.0"` used consistently.
- **Note on CI toolchain:** the spec said the workflow provisions Node/pnpm "directly rather than via mise"; this plan uses `jdx/mise-action` instead because the repo already carries `mise.toml` (which provides `@antfu/ni` and the `ni` postinstall hook), making mise the consistent, lower-maintenance path. pnpm is still resolved via `devEngines`/corepack. This is a deliberate refinement of the spec's implementation detail, not a scope change.
```