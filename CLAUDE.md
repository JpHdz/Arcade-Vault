# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — a platform for playing games online and competing for the highest score (per README.md, in Spanish). Currently an unmodified `create-next-app` scaffold (Next.js 16.3.4, React 19.2.8, App Router, TypeScript, Tailwind CSS v4); no game features, routes, or components exist yet beyond the default `app/page.tsx` and `app/layout.tsx`.

## Critical: this is not the Next.js you know

`AGENTS.md` (imported via `CLAUDE.md`'s `@AGENTS.md`) is regenerated automatically by `next dev` — do not remove it, and committing it is expected to keep the tree clean. It states that this Next.js version has breaking changes from training data. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (e.g. `01-app/01-getting-started/` for routing/layouts/data fetching, `01-app/03-api-reference/05-config/` for `next.config.ts` options). Heed deprecation notices found there. Notable App Router layout convention already in use: `LayoutProps<"/">` typed props (see `app/layout.tsx`) rather than a manually declared `{ children }` type.

## Commands

- `npm run dev` — start dev server (Turbopack, per default Next 16 behavior)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next` core-web-vitals + typescript)

There is no test runner configured in this project yet.

## Architecture notes

- App Router only (`app/` directory) — no `pages/` directory.
- Path alias `@/*` maps to the project root (`tsconfig.json`).
- Styling via Tailwind CSS v4 through `@tailwindcss/postcss` (see `postcss.config.mjs`), global styles in `app/globals.css`.
- `next.config.ts` is currently empty of custom options.

## Intended workflow: Spec Driven Design

Per README.md, this project is meant to follow spec-driven design using `/spec` and `/spec-impl`, based on practices from https://github.com/Klerith/fernando-skills, installable via `npx skills@latest add Klerith/fernando-skills`. These skills are not yet installed in this repository (no `.claude/` skills directory present) — if spec files or `/spec`/`/spec-impl` commands are expected but missing, the skills package likely needs to be added first.
