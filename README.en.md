<div align="center">

# cityPhy

**Watch your AI agents think — as a city.**

A local 3D city of your code and of what your AI coding agents (Claude Code, Codex, Antigravity…) carry in their
context. Built on [graphify](https://github.com/safishamsi/graphify). Everything stays on your machine.

[Português](README.md) · **English** · [How it works](#how-it-works) · [Install](#install) · [Commands](#commands) ·
[Credits](CREDITS.md)

![The example city: agent towers on the left, project condominiums on the right, power lines on the lamp posts](docs/images/city-overview.jpg)

<sub>Screenshot of the bundled **fictional** example (`npm run dev:example`): three projects and three agents.</sub>

</div>

---

## Why

Every message you send to an AI coding agent re-sends the **whole conversation**. When the agent reads five files to
answer a question, those ~20,000 tokens stay in the conversation and are paid again on **every message after it**.

cityPhy attacks what goes *into* the conversation:

| Instead of… | the agent uses… | measured example |
|---|---|---|
| reading whole files to find something | a **graphify** query (local code graph) | ≈ 444 tokens returned vs ≈ 8,028 tokens in the 11 files behind the answer |
| re-discovering what was done last week | the project's **local memory** | a short summary at session start, with a token budget |
| guessing where the context goes | the **city**: every floor sized by its weight | ground floor = what is paid in every session |

## What you see

| Piece | Meaning |
|---|---|
| **Agent tower** (west of the main street) | one per AI agent. **Ground floor** = what the agent loads in *every* session (rules, instruction files, memory index, skills listing). Then memories, skills and the latest sessions. Older sessions move to an **annex**. Floor height = content weight (≈ tokens). |
| **Condominium** (east of the street) | one fenced lot per project, one building per top folder, sized by file count. Each project has **its own color**. |
| **Power line** | when an agent works on a project, a cable leaves its tower, runs along the **street-lamp posts**, crosses the street through the air and enters the project's **gatehouse**, then runs on the ground to every building. Light pulses travel along it in the project's color. Nothing ever stands on a street. |
| **Model towers** | next to each agent, one tower per model used (e.g. two Claude models, three levels of the same GPT). Each **band** is a reasoning level (low, medium, high...), sized by the tokens spent. The panel has **Summary**, **Levels**, **Calculator** (type how many calls a task will take and see the cost at each level: fresh × cached tokens) and **Compare** (the agent's models side by side). |
| **Consumption tower** | two **glass** blocks that fill up to 100%: **week** and **day** (or the 5-hour window, when the tool reports it). Uses the tool's **real plan percent** when it records one (e.g. Codex); otherwise the limit you set in the config; with no limit, just the tokens. |
| **Tabbed panels** | on the left, **General** plus one tab per tool found (a new tool gets its own tab). In condominiums: Summary, Savings, Memory and Options. |
| **Gatehouse panel** | hover anything for its weight; click to open its panel. |

<table>
<tr>
<td width="50%"><img src="docs/images/tower-floor-panel.jpg" alt="Clicking a tower floor shows how it is loaded, its size in tokens and its links"><br><sub>A tower floor: how it is loaded, ≈ tokens, links.</sub></td>
<td width="50%"><img src="docs/images/condo-panel.jpg" alt="Clicking a project building shows files, symbols and which agents power it"><br><sub>A project building: files, symbols, which agents power it.</sub></td>
</tr>
<tr>
<td colspan="2"><img src="docs/images/power-lines.jpg" alt="Power lines in each project's color running on the lamp posts"><br><sub>Power lines on the lamp posts, one color per project.</sub></td>
</tr>
</table>

## How it works

![Projects go through graphify, agent folders through the tower generators, session events into the local memory; cityPhy draws all of it](docs/images/how-it-works.svg)

1. **graphify** builds a graph of each project's code with its local AST pass (`GRAPHIFY_BACKEND=none`): no model, no API key.
2. **Tower generators** (`src/towers/<agent>/`) read each agent's own folders and write a graphify-compatible
   `graph.json` with **names, sizes, dates and links only** — never the content of memories or conversations.
3. **Local memory** (the idea of [claude-mem](https://github.com/thedotmack/claude-mem), kept on disk): agent hooks or
   session logs become short observations in a per-project SQLite file, summarized **by rules, not by a model**.
4. **cityPhy** serves the city on `127.0.0.1:5190` and the agents query the graph and the memory instead of re-reading
   whole files.

## Requirements

| Requirement | Why | Installed by `setup`? |
|---|---|---|
| **Node.js 24+** | runs cityPhy and the generators; **includes SQLite** (`node:sqlite`) used by the memory | no — get it at [nodejs.org](https://nodejs.org) |
| **Python 3.10+** | graphify is written in Python | no — get it at [python.org](https://www.python.org/downloads/) |
| **graphify** (`graphifyy` on PyPI) | builds the code graph | **yes, if you allow it** |
| uv or pipx *(recommended)* | installs graphify in its own environment | **yes, if you allow it** |
| Ollama *(optional)* | local model for nicer memory summaries (planned) | no — [ollama.com](https://ollama.com) |

`cityphy setup` checks all of them, shows the exact command for anything missing and **only runs it after you say yes**.

## Install

```bash
git clone https://github.com/RafaelRodriguesDev/cityPhy.git
cd cityPhy
npm install
```

**Just look first** — open the fictional example city:

```bash
npm run dev:example        # http://127.0.0.1:5190
```

**Use it with your projects:**

```bash
cp cityphy.config.example.json cityphy.config.json   # list your projects (see below)
npm run cityphy -- setup     # requirements + questions per project + agent rules (asks before each step)
npm run refresh              # graphify graph of each project + every agent tower
npm run dev                  # http://127.0.0.1:5190
```

`cityphy.config.json` (not committed):

```json
{
  "dataDir": "./data",
  "projects": [
    { "name": "shop-api", "path": "C:/code/shop-api", "exclude": ["**/node_modules/", "**/dist/"] }
  ]
}
```

- `dataDir` — where graphs, towers, memory and metrics are written. Each project gets its own folder:

  ```
  <dataDir>/
    shop-api/
      graphify-out/        graphify graph of the project
      cityphy/
        project.json       options chosen in setup
        memory.db          local memory (SQLite)
        LESSONS.md         short summary for the start of a session
        metrics.jsonl      one line per graph query: tokens returned vs avoided
    torre-claude/          Claude's tower ("torre" = tower)
    torre-codex/
  ```
- `exclude` is passed to `graphify extract --exclude`. If `graphify` is not on your `PATH`, set `GRAPHIFY_BIN` or `graphifyBin`.
- Optional, only in your local config: `"models": { "<model>": { "multiplier": 2 } }` (relative cost 1x/2x/0x in your plan) and `"tools": { "claude": { "dailyLimit": 2000000, "weeklyLimit": 10000000 } }` (the 100% of the consumption tower, in fresh tokens).

- **Monorepo** (several system folders under one root the agents open): one project per system with `"group": { "name": "Company", "path": "C:/code/company" }`. Each system gets its own graph and condominium; sessions, memory and power of the root belong to the group. `npm run refresh -- --project <name>` refreshes one system.

**Usage readers today:** Claude Code (model and tokens per call), Codex (model, reasoning level, tokens and the real plan percent) and Antigravity (model, level and tokens). Each tool adds its own in `src/metrics/usage/` and `src/metrics/consumption/`.

## What `setup` asks (per project)

1. Use the graphify graph in this project? *(recommended)*
2. Turn on the automatic local memory? *(nothing leaves the machine)*
3. Put a short summary of recent work at the start of each session? Token budget? *(default 800)*
4. Log the token savings of each graph query?
5. Use a local model (Ollama) for summaries? *(default no)*
6. May it install the global `cityphy` skill for each agent (`~/.claude/skills`, `~/.codex/skills`, `~/.gemini/config/skills`)?
7. *(Claude Code)* May it turn on the cityPhy hooks in `~/.claude/settings.json`? Outside cityPhy projects they do nothing.

**Nothing is written inside your projects.** The project list lives only in `cityphy.config.json`; agents find the project from the open folder.

An agent with the `cityphy` skill that opens a project it is not registered for asks **you** these questions in chat and
then runs `cityphy setup --project <p> --agent <its id> --answers graph=sim,memory=sim,...`.

## Commands

Run from anywhere with `node <cityPhy>/bin/cityphy.ts <command>` (or `npm run cityphy -- <command>` inside the repo).

| Command | What it does |
|---|---|
| `setup [--project P] [--agent A] [--answers k=v,…] [--yes]` | requirements, opt-in questions, agent rules |
| `refresh [--towers]` | graphify graph of every project + every tower generator |
| `dev` | the city on `127.0.0.1:5190` |
| `context [--project P]` | the text an agent gets at session start |
| `query "<question>" [--project P] [--agent A] [--budget N]` | graphify query + savings metric |
| `mem search "<terms>"` · `mem save --note "…"` · `mem stats` · `mem lessons` | the project's local memory |
| `hook claude` | Claude Code hook (reads the event on stdin) |

## Add your agent's tower

Towers live in `src/towers/<agent>/` — Claude's and Antigravity's are there. To have another agent build its own, paste
[docs/PROMPT-TORRE.md](docs/PROMPT-TORRE.md) into it. It lists what it found, waits for your OK, writes only inside its
folder and hands back proof (generator output, typecheck, `graphify explain`). Schema: [docs/TOWER-SCHEMA.md](docs/TOWER-SCHEMA.md).

## Privacy

- cityPhy only **reads** agent folders and projects, and serves the page on `127.0.0.1`. No telemetry, no network calls.
- Towers keep names, sizes, dates and links — never message or memory content.
- graphify runs its local AST pass only. The memory is summarized by rules on your machine.

## Development

```bash
npm run typecheck
npm test               # includes the city rules: nothing on a street, power only on lamp posts
npm run example        # regenerates the fictional example in examples/data
```

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Metaphor: [docs/METAPHOR.md](docs/METAPHOR.md) ·
Notes for AI agents: [AGENTS.md](AGENTS.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

## Roadmap

- Several accounts per tool (one consumption tower per account + total)
- "Measure a task": which model and level fit a task (forecast from history, optional real test)
- Live pulses when an agent queries the graph or a memory is saved
- The notary building ("cartório") for each project's memory
- `npx cityphy`

## Credits

cityPhy stands on other people's work — see [CREDITS.md](CREDITS.md). In short: **graphify** by
[safishamsi](https://github.com/safishamsi/graphify) (MIT) builds the graphs; the local memory follows the idea of
**claude-mem** by [thedotmack](https://github.com/thedotmack/claude-mem) (Apache-2.0); drawn with
[Three.js](https://threejs.org) and served by [Vite](https://vite.dev) (both MIT).

## License

[MIT](LICENSE) · made by **Rafael Rodrigues Dev** · **Lunar Wave**
