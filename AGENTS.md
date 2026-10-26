# cityPhy — notes for AI agents

Read this first. Talk to the maintainer in Portuguese (pt-BR); code, comments and identifiers in English.

## What this is

A 3D city of AI-agent context: agent **towers** (from each agent's local folders) and project **condominiums** (from
graphify graphs), connected by **power lines** on the street-lamp posts. Read `docs/METAPHOR.md`,
`docs/ARCHITECTURE.md` and `docs/TOWER-SCHEMA.md` before changing anything.

## Configuration

Everything machine-specific is in `cityphy.config.json` (not committed; copy `cityphy.config.example.json`):
`dataDir` (graphs and towers) and `projects` (name, path, graphify excludes). Never hard-code a path in `src/`.

- `npm run refresh` — graphify graph of each project + every tower generator (`src/towers/*/build*Tower.ts`).
- `npm run dev` — the city on `http://127.0.0.1:5190`.
- `npm run typecheck` and `npm test` — both must pass before you hand work back.

## Rules

1. **Read-only, local-only.** Never write into agent folders or `graphify-out/`; never call the network.
2. **Towers never copy content**: names, sizes, dates and links only. Session titles are fine; messages are not.
3. **One agent, one folder**: `src/towers/<agent>/`. `schema.ts`, `towerBuilder.ts`, `fileStats.ts` and `cli.ts` are
   shared — change them only with the maintainer's approval. To build a new tower, follow `docs/PROMPT-TORRE.md`.
4. **City rules** (covered by `tests/cityRules.test.ts`): nothing stands on a street or in a crossing; power only
   travels on lamp posts and crosses the street through the air; each project has its own color.
5. **One piece per file.** Keep `src/city`-style logic free of Three.js where possible so it can be tested.
6. **Visual changes**: show a screenshot and wait for the maintainer's approval before committing.
7. Public changes go in `CHANGELOG.md` (generic: no local paths or project names). A maintainer's personal notes may
   live in `docs/DIARY.md`, which is git-ignored and never published. Commit only the paths you changed; never
   `git add -A`. Never push unless the maintainer asks.

## Use the graph before searching

This repo has its own graphify graph at `<dataDir>/cityPhy/graphify-out/graph.json` (after `npm run refresh`).
Query it with `graphify query "..." --graph <that path>` before reading many files. Never run `graphify update .`
inside the repo (it would create `graphify-out/` here).
