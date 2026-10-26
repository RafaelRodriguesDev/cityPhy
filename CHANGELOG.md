# Changelog

All notable changes to cityPhy. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- File events are recorded in the project that holds the file, not in the folder where the session runs.
- Agent databases are opened read-only.
- First animation frame could step backwards and produce NaN positions.
