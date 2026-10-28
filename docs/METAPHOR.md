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

## Civic district and antennas (inventory and measured use)

| City | Means | Read from |
|---|---|---|
| Library | every skill each agent can see; the frieze shows where they came from (agent folder, account sync, plugin, project) | skill folders, enabled plugins |
| Radio park | one lattice mast per **installed** MCP server: the catalog | agent configs, plugin manifests |
| Consumption glasses | fresh tokens of the week and the day, filled by plan percent, config limit or the busiest recent day | agent logs (counts only) |
| Antenna station (behind a condominium) | one mast per MCP server **the project used**, taller with more calls; gray when the agent app brought it; a dashed arc to the radio park when it is also installed | conversation logs (tool names and counts only) |
| Radio central | the same station once a project used more than 6 servers: one building, the total on its sign | same |

## Motion

No vehicles. Everything that moves is **light**:

- a pulse running down a cable when an agent queries the graph (`~/.cache/graphify-queries.log`);
- windows lighting up for nodes returned by that query;
- a soft glow on scaffolding when the graph is out of date.
