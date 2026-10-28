# Architecture

Stack: TypeScript, Three.js, Vite. A tiny local Node server reads the data (the browser cannot read
`~/.claude` and friends) and pushes changes to the page.

Rules:

- **Read-only.** cityPhy never writes into `graphify-out/` or any agent folder.
- **Local only.** The server binds to `127.0.0.1`. No telemetry, no external requests.
- **Cheap to watch.** Render on demand (only when the camera moves or data changes), instanced meshes, level of
  detail, pause when the tab is hidden.
- **One piece per file.** The `city/` layer is pure data (no Three.js) so it can be tested.

## Built so far

```
cityphy.config.json         machine config (not committed): dataDir + projects
scripts/refresh.ts          npm run refresh: graphify per project + every tower generator
src/config/loadConfig.ts    reads the config (CITYPHY_CONFIG / CITYPHY_DATA override)
src/towers/                 tower model + generators (run with Node, type stripping)
  schema.ts, towerBuilder.ts, fileStats.ts, cli.ts (shared; ask before changing)
  claude/                   sources, groundFloor, memoryFloor, skillsFloor, sessionsFloor, buildClaudeTower
  <agent>/                  same pieces, one folder per agent
src/readers/                towers.ts, projects.ts (graph summary per top folder, cached by mtime)
src/server/dataPlugin.ts    GET /api/towers, GET /api/projects (Vite dev server, 127.0.0.1:5190)
src/scene/                  stage, cityLayout, ground, grass, streetLamps, fence, towerMesh, projectBlock,
                            projectColors, cables, powerLine, lotWiring, pulses, glow, label, picking
src/ui/                     towerSummary, floorPanel, projectPanel, format
tests/                      cityRules (street rules, power routing), readers
```

## Planned layout

```
bin/cityphy.js              CLI: npx cityphy <graphify-out> → starts server, opens browser
src/
  readers/                  read-only data sources
    graphifyGraph.ts        graph.json + analysis (the condominium)
    graphifyQueries.ts      query log (live pulses)
    claudeTower.ts          ~/.claude, project memory, sessions
    codexTower.ts           ~/.codex
    antigravityTower.ts     ~/.gemini
  server/
    server.ts               local HTTP server (127.0.0.1)
    watcher.ts              file watcher → server-sent events
  city/                     data → city model (no 3D, unit-tested)
    types.ts
    layout.ts               neighborhood and lot placement
    buildings.ts            community → house/building
    floors.ts               file → floor, symbol → window
    towers.ts               agent towers and annexes
    wiring.ts               poles and cables from edges
  scene/                    Three.js
    stage.ts                renderer, camera, on-demand loop
    buildings.ts            instanced buildings and floors
    windows.ts              instanced windows
    poles.ts, cables.ts
    pulses.ts               light running along cables
    picking.ts              hover and click
  ui/
    gatehouse.ts            side panel of a building
    search.ts, legend.ts
  main.ts
  maquete/                  the main page: maquete scene (towers, library, radio masts, condominiums), HUD,
                            sidebar tabs, project/library panels with savings, conversations, skills and MCP use
index.html                  main page (src/maquete/main.ts)
classica.html               the first city (src/main.ts)
examples/small-graph/       fake data for the demo and tests
tests/                      layout, floors, wiring, readers
docs/                       METAPHOR.md, ARCHITECTURE.md, TOWER-SCHEMA.md, PROMPT-TORRE.md (DIARY.md: local only)
```
