# Release Workflow — Design

Date: 2026-07-02

## Goal

Publish built userscripts so they can be distributed and auto-updated via
Greasy Fork. A GitHub Actions workflow builds every package on push to `main`
and syncs the resulting `.user.js` files to a dedicated `dist` branch, whose
raw URLs are registered as each script's sync source on Greasy Fork. Versions
are managed manually. All authored text is English.

## Background: Greasy Fork × GitHub

Greasy Fork's sync (webhook or 24-hour) clones the repository and reads the
`.user.js` from a raw Git URL. It does **not** read GitHub Release assets, and
it cannot read files that are git-ignored. Greasy Fork treats a re-sync of an
unchanged `@version` as a no-op, so it will not republish a script whose
version has not increased.

Consequences for this repo:

- Build output must be committed to git for Greasy Fork to fetch it. The
  current `@downloadURL` points at `main/packages/<name>/dist/<name>.user.js`,
  which is git-ignored (`dist/`) and would 404. This is a latent bug the design
  fixes.
- Publishing is gated by `@version`: bump it to publish, leave it to keep the
  current release live. No custom "changed since last release" logic is needed
  — Greasy Fork's version comparison handles it.

## Distribution Channel

- Built userscripts are committed to a dedicated **`dist` branch** — an orphan
  branch with a flat layout (`<name>.user.js` at the branch root, mirroring a
  package's local `dist/`).
- Distribution URL (used for `@downloadURL` and `@updateURL`, and registered as
  the Greasy Fork sync source):
  `https://raw.githubusercontent.com/simochee/userscripts/dist/<name>.user.js`

## Versioning (manual)

- Each package's `vite.config.ts` sets `version` to a hand-written SemVer
  string (e.g. `"1.0.0"`).
- To publish an update, bump the version and push. To ship a change without
  publishing (refactors, tweaks), leave the version unchanged: the `dist`
  branch may still receive a commit, but Greasy Fork treats the identical
  `@version` as a no-op and does not republish.
- The date-based auto-versioning (`scripts/version.ts`, `getVersion`,
  `resolveVersion`) is **removed**.

## CI Workflow (`.github/workflows/release.yml`)

- **Trigger:** push to `main`.
- **Permissions:** `contents: write` (uses the default `GITHUB_TOKEN`; no extra
  secrets).
- **Steps:**
  1. Check out `main`.
  2. Provision the toolchain (Node.js / pnpm per `devEngines`; the workflow
     sets these up directly rather than via mise) and run `ni`.
  3. `nr build` — build every package, producing `packages/*/dist/<name>.user.js`.
  4. Add the `dist` branch as a git worktree in a separate directory
     (`git worktree add <dir> dist`). The `dist` branch is created once,
     manually, before the workflow runs (see Setup below); the workflow assumes
     it exists.
  5. Copy every `packages/*/dist/*.user.js` into the worktree root (flat).
  6. `git add -A` in the worktree; if `git diff --cached --quiet` reports no
     changes, skip the commit. Otherwise commit and push to `origin dist`.
- **No idempotency logic in CI:** every push builds all packages and copies them
  over. Whether anything publishes is decided downstream — git skips the commit
  when files are byte-identical, and Greasy Fork skips republishing when
  `@version` is unchanged.

## One-Time Setup (manual, done by the maintainer)

Create the empty orphan `dist` branch before the first CI run:

```bash
git switch --orphan dist
git commit --allow-empty -m "chore: initialize dist branch"
git push -u origin dist
git switch main
```

Then, on Greasy Fork, register each script's sync source as the raw `dist`
branch URL above and (optionally) add the GitHub webhook for push-triggered
sync.

## Changes to Existing Files

- `packages/hello-example/vite.config.ts`:
  - Remove the `resolveVersion` import and call; set `version: "1.0.0"`.
  - Fix `downloadURL`/`updateURL` to the `dist` branch raw URL
    (`.../userscripts/dist/<name>.user.js`).
- `plop-templates/userscript/vite.config.ts.hbs`: same two changes, so
  generated packages are correct by default.
- `package.json`: remove the `test` script and the `vitest` devDependency.
- `pnpm-workspace.yaml`: remove `vitest` from the catalog.
- `README.md`: document the release flow (push → `dist` branch → Greasy Fork),
  manual versioning, and the one-time `dist` setup; remove the test/versioning
  sections that no longer apply.

## Removals

- `scripts/version.ts`, `scripts/version.test.ts`, and the now-empty `scripts/`
  directory.
- All test tooling (Vitest): catalog entry, root `test` script, and devDep.

## Out of Scope (YAGNI)

- Content-hash idempotency in CI (dropped in favor of manual versioning +
  git/Greasy Fork no-op behavior).
- Automatic `dist` branch creation in CI (created manually, once).
- Greasy Fork publishing automation (registration/webhook is a manual, one-time
  Greasy Fork-side setup).
- GitHub Pages distribution (raw `dist` branch URLs are used instead).
- Path-filtered / changed-only builds (all packages are built every push).
