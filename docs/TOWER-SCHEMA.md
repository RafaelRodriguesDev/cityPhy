# Agent tower schema (v1)

An agent tower is a **graphify-compatible `graph.json`**. graphify can `query`/`explain`/`path` it, and cityPhy draws it.
Types: [`src/towers/schema.ts`](../src/towers/schema.ts). Writer: [`src/towers/towerBuilder.ts`](../src/towers/towerBuilder.ts).

Output: `<dataDir>/torre-<agent>/graphify-out/graph.json`, with `dataDir` from `cityphy.config.json`.
Generators share one command line through [`src/towers/cli.ts`](../src/towers/cli.ts): `--project <path>` (repeatable,
default: every project in the config) and `--out <dir>` (default `<dataDir>/torre-<agent>`).

A floor that belongs to a project carries `project: <project path>`; that is what draws the power line from the
tower to the project's condominium.

## Floors (nodes)

Every node is one floor. `community` is the section index, so graphify groups floors by section.

| Section | `load` | What goes there |
|---|---|---|
| `ground` | `always` | everything the agent puts in context at the start of **every** session: built-in rules (size `null` when not a file), global and project instruction files, memory index, skills listing |
| `memory` | `on-demand` | one floor per memory entry, opened only when needed |
| `skills` | `on-demand` | one floor per skill body |
| `sessions` | `history` | one floor per past session log (not loaded; kept as history) |

`cityphy` fields on every node: `section`, `load`, `bytes` (or `null`), `tokensApprox` (`bytes / 4`, or `null`),
`updatedAt`, `project`, `annex`.

**Annex:** the tower keeps the `recentSessions` most recent sessions on top (default 8); older sessions get
`annex: true` and are drawn in a building beside the tower.

## Cables (links)

| `relation` | Meaning |
|---|---|
| `indexes` | an index file points to an entry (memory index → memory) |
| `links_to` | an entry links another (`[[name]]`) |
| `lists` | an always-loaded listing names the entry (skills listing → skill) |
| `loads` | the ground floor brings this into every session |

## Rules

- **Never copy content** into the tower: only names, sizes, dates and links. Session titles are fine; messages are not.
- **Read-only:** a generator never writes into the agent's folders.
- Same ids every run (stable ids), so cityPhy can light up the same floor over time.
