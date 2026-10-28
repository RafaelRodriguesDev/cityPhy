# Changelog

All notable changes to cityPhy. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Maquete as the main page**: a light, model-like city (flat colors, outlines, sun shadows, orthographic view) with
  towers that have window rows and setbacks, measuring-glass consumption, a library building with columns and a
  pediment, lattice radio masts with animated waves for MCP servers, and condominiums with houses and blocks. The first
  city stays at `/classica.html`.
- **Antenna station behind each condominium**: the MCP servers the project actually used, from its conversations
  (one lattice mast per server, taller with more calls, gray when the agent app brought it), wired by a dashed arc to
  the same server in the civic radio park when it is configured. Above six servers it becomes a radio central: a
  building with masts on its roof and the real total on its sign. The civic radio park stays the catalog of what is
  installed.
- **Savings and control per project**: tokens the graph kept out of the conversation (whole files vs. graph answers),
  what entered the conversation per tool kind, and per agent how many sessions cityPhy saw live, imported later from
  old logs, or never saw.
- **Conversations, skills and MCP use**: per project, every conversation with its title, date and the skills and MCP
  servers it used; a searchable skills tab in the library (used / never used / per agent) and MCP calls per server,
  including servers the agent app brings itself. Only names and counts are read; agents whose logs do not record tool
  calls are marked as such.
- **Civic district** on the corner of the main crossing: a **library** with one book per skill (shared skills first,
  then one bookcase per agent; color = where it came from: the agent's folder, synced from the account, a plugin or the
  project) and a **radio park** with one antenna per MCP server (tall and orange when remote). Read-only `/api/library`
  inventory of each agent's skills, enabled plugins and MCP servers: names, sizes, dates and the host of remote
  servers only; a skill's text is hashed to flag diverging copies, never kept.
- **HUD** with four numbers (fixed context per session, consumption of the week, agents working now, things to look
  at) and a sidebar of cards per agent, project and the civic district; a card opens the piece and takes the camera
  there, "ver cidade toda" brings it back.
- **Four fixed blocks** in every panel (agent, floor, consumption, project, skill, MCP server): Contexto, Entrada,
  Saída and Esperado × real, the last one listing what looks off (diverging skill copies, agents working on a project
  they are not registered for, a heavy always-loaded file, a remote MCP server…).
- **Consumption glass fills without a limit**: today against the busiest day of the last 7, the week against 7 such
  days; a plan window that already reset is ignored until the tool reports the new one.
- **Codex agent tower** generated from local rules, skills and session metadata; conversation messages are never
  copied into the city.
- **Live power lines**: a cable is lit only while the agent is working on the project (log writes within
  `activeWindowMinutes`, default 15), dark otherwise; the page polls `/api/activity` every 30 s, inactive cables can be
  hidden and the project panel shows when each agent last worked there.
- **Project groups** for monorepos (`group` in the config): one graph and condominium per system, while sessions,
  memory, hooks and power lines of the root belong to the group. `refresh --project <name>` and `maxGraphBytes`.
- **Model towers**: one tower per model next to each agent, one band per reasoning level; panel with summary, levels,
  a calculator by number of calls (fresh vs cached tokens, × relative cost) and a comparison between models.
- **Consumption tower**: glass blocks for the week and the day (or the tool's 5-hour window) that fill up to 100%, using
  the tool's real plan percent when it records one, else the limits in the local config.
- **Usage and consumption readers** for Claude Code, Codex and Antigravity (model, reasoning level, tokens per call;
  Codex plan windows).
- **Tabbed left panel**: a general tab plus one tab per tool found.
- **Global agent rules**: `cityphy setup` installs a global `cityphy` skill per agent and Claude Code hooks in the global
  settings; nothing is written inside projects anymore (older project blocks/hooks can be removed by setup).
- **Local memory per project** (idea of claude-mem, kept on disk): Claude Code hooks turn session events into
  observations in a per-project SQLite file (`node:sqlite`, full-text search), summarized by rules into `LESSONS.md`
  and brought back at session start within a token budget. `cityphy mem search | save | stats | lessons`.
- **Import of past Claude sessions and memories** into the project memory: `cityphy mem import claude`.
- **Savings metric**: `cityphy query` runs a graphify query and logs tokens returned vs tokens of the whole source
  files behind the answer (`metrics.jsonl`). Real usage per model read from Claude Code session logs.
- **`cityphy setup`**: checks requirements (Node 24+, Python 3.10+, graphify, uv/pipx, optional Ollama), installs only
  with permission, asks the opt-in questions per project and writes the agent rules (AGENTS.md block, Claude hooks) only
  with permission.
- **Condominium panel with tabs**: summary, savings, memory and enabled options.
- **Agent towers** in graphify's `graph.json` format, generated from each agent's local folders (names, sizes, dates and
  links only): Claude and Antigravity, plus a prompt for any other agent to build its own (`docs/PROMPT-TORRE.md`).
- **The city**: streets, sidewalks, street lamps, fenced condominiums with gatehouses, one color per project, power
  lines that run on the lamp posts and cross the street through the air, light pulses, hover and click panels.
- **Generic configuration** (`cityphy.config.json`, optional `graphifyBin`), `npm run refresh`, fictional example city
  (`npm run dev:example`), tests for the city rules, README in Portuguese and English, credits.

### Fixed
- Claude Code calls copied into a resumed conversation's log were counted twice in consumption and usage.
- Model totals in the agent panel mixed cache reads with fresh tokens; they are now shown apart.
- File events are recorded in the project that holds the file, not in the folder where the session runs.
- Agent databases are opened read-only.
- First animation frame could step backwards and produce NaN positions.
