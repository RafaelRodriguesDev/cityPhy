# The city metaphor

Every visual piece maps to real data. If a piece has no data source, it does not exist.

## Project condominium (from graphify)

| Piece | Meaning | Data source |
|---|---|---|
| Neighborhood | a repository or top folder | node `source_file` path |
| Condominium | the whole project | `graph.json` |
| House → building | a code community; small communities are houses, they grow into buildings | community size |
| Floor | a file in that community | file nodes |
| Window | a function or class | code nodes |
| Power line (pole + cable) | dependencies between communities; thicker cable = more edges | edges |
| Substation | hub nodes everything depends on | `graphify god-nodes` |
| Bridge cable | link between neighborhoods (e.g. TS engine ↔ C# engine) | cross-repo edges |
| Gatehouse | index of a building: what lives there, what comes in and goes out | community summary |
| Scaffolding | files changed since the last graph update | git + manifest |
| Dust | code nobody touched in months | git dates |

## Agent district (from each agent's local folders, read-only)

| Piece | Meaning | Data source |
|---|---|---|
| Tower | one AI agent (Claude, Codex, Antigravity) | agent home folder found |
| Ground floor | loaded in every session: rules, instruction files, memory index | e.g. `CLAUDE.md`, `AGENTS.md`, `MEMORY.md` |
| Middle floors | stored, opened on demand: memories, skills | memory and skill folders |
| Upper floors | one floor per session | session logs |
| Annex | older sessions once the tower passes its height limit | session logs |
| Skybridge | what agents actually share (shared instructions, linked skills) | same file / junction |

## Motion

No vehicles. Everything that moves is **light**:

- a pulse running down a cable when an agent queries the graph (`~/.cache/graphify-queries.log`);
- windows lighting up for nodes returned by that query;
- a soft glow on scaffolding when the graph is out of date.
