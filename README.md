# userscripts

[![Node.js](https://img.shields.io/badge/Node.js-26.2.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.6.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![vite-plugin-monkey](https://img.shields.io/badge/vite--plugin--monkey-8-FFB300)](https://github.com/lisonge/vite-plugin-monkey)
[![Biome](https://img.shields.io/badge/Biome-2-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-distribution-670000)](https://greasyfork.org/)

A pnpm-workspace monorepo for authoring userscripts with
[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) and
[Biome](https://biomejs.dev/), distributed via
[Greasy Fork](https://greasyfork.org/).

## Requirements

- [mise](https://mise.jdx.dev/) — provisions the toolchain (Node.js, pnpm,
  [@antfu/ni](https://github.com/antfu-collective/ni)) pinned by this repo

Node.js 26 and pnpm are declared in `package.json` `devEngines` with
`onFail: "download"`, so pnpm fetches the matching versions on demand as well.

## Setup

```bash
mise install
```

This installs the pinned toolchain; a mise `postinstall` hook then runs `ni`
to install the workspace dependencies. To install dependencies again later,
run `ni` directly.

## Creating a new userscript

```bash
nr new
```

Answer the prompts (name, display name, description, namespace, match patterns,
GM grants). A new package is created under `packages/<name>/`. Then run `ni` to
install its dependencies.

## Development

```bash
pnpm --filter <name> dev
```

Vite starts a dev server and vite-plugin-monkey serves an install URL
(`<name>.proxy.user.js`). Install it once in your userscript manager
(Tampermonkey / Violentmonkey), then edits hot-reload live.

## Build

```bash
nr build                           # build all packages
pnpm --filter <name> build         # build one package
```

Each package emits a single `packages/<name>/dist/<name>.user.js` with the
metadata banner and inlined dependencies. `@version` is a date, `YYYY.MM.DD`,
and each same-day rebuild bumps a monotonic `.N` suffix (read from the previous
build's banner) so re-uploads to Greasy Fork always increase.

> The root `build` script runs `pnpm -r build` (all packages). To scope to one
> package, invoke pnpm's workspace filter directly: `pnpm --filter <name>
> build`.

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
