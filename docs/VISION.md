# Vision and plan

Where cityPhy is going and in what order. The pieces already built are described in [METAPHOR.md](METAPHOR.md) and
[ARCHITECTURE.md](ARCHITECTURE.md); this document is the plan, and it changes as decisions are made.

## 0. The principle that does not change

cityPhy **maps, measures and summarizes**. It is not a development tool. Workflow methods (GSD, Superpowers and others),
skills and MCP servers are things cityPhy **sees, explains and helps switch on with consent**; it never replaces them.

Every piece of the city answers one of four questions about a project:

1. **What exists:** code, rules, skills, MCP servers, methods, memory.
2. **What was worked on:** sessions, phases, files touched, which agent worked there.
3. **What it costs and what it saves:** fixed per-session context, consumption, tokens avoided.
4. **What is off:** expected vs. actual (the inspection).

A feature that answers none of these does not belong in cityPhy.

## 1. Four product layers

| Layer | What it is | On? |
|---|---|---|
| **A. Core** | readers, the city, the code graph, local memory, metrics, the **briefing** | always |
| **B. Work log** | the logic of a planning method, reduced: goal, phases, current state, next action, shift handoff | always (lightweight, outside the repo) |
| **C. Library** | inventory of each agent's skills, MCP servers, plugins and hooks, plus a catalog of recommendations | always for mapping; installing only on a yes |
| **D. Integrations** | one adapter per method that **reads that method's footprint** in the project | optional, per project and per agent |

**Work log.** Keeps only structure: the goal (title only), phases (name and status), the current phase, the next action
and a short handoff written when a session ends. It lives in the cityPhy data folder, never in the repository. When a
project already uses a planning method, the work log becomes a **pointer** to that method's files instead of a copy.

**Briefing.** One short summary, capped in tokens, used both by the person (the gatehouse panel) and by the agent
(injected at session start):

1. where we are (current phase and next action, as a pointer);
2. what changed since the last session (phases that moved, files most touched, graph freshness);
3. decisions and lessons (from local memory);
4. at most three inspection alerts;
5. how to find more (`cityphy query`, `mem search`) instead of opening whole files.

A new chat starts from the briefing, so nobody has to carry context from the previous chat or compact it.

## 2. Switched on per agent, with the agent asking

1. The agent opens the folder and runs `cityphy context`.
2. cityPhy returns the briefing **plus pending consents**, e.g. "this project has a planning method's folder, but the
   method is not installed for you: ask the person to install / only map / ignore."
3. The agent asks in chat and records the answer with `cityphy setup --agent <id> --answers <key>=<value>`.
4. The answer is stored in the **project contract** (`project.json`), **per agent**. Nobody asks again, and the city
   shows the contract at the gatehouse.

Three levels for every skill or method: **map** (shown in the city), **recommend** (a hint in the briefing),
**install** (runs that agent's own install command, only on an explicit yes).

### Catalog

- A **curated catalog** shipped with cityPhy (`catalog.json`, versioned, offline). Each entry: source repository,
  license, **what it writes into the project**, **what it injects into every session**, which tools it requests
  (`allowed-tools`), which scenario it fits, and the install command per agent.
- First entries: graphify and cityphy (core); find-skills (discovery); GSD (macro planning); Superpowers (execution
  discipline); planning-with-files (light planning, an alternative to GSD); and domain skills that appear **only when
  the project calls for them** (web quality checks when a frontend is detected, Terraform skills when `.tf` files are).
- **Discovering new skills** (find-skills, the skills.sh index) needs the network. cityPhy's core stays offline: the
  agent searches with its own tools when the person asks, and cityPhy records what got installed.
- **The person's own skills** go in a local catalog file and appear in the library like any other.
- **Inspection badge** in the library, without running anything: requests `Bash`, ships scripts, has a session-start
  hook, has no license, comes from a little-known source. Security research on public skills has found prompt
  injection and credential theft in a meaningful share of them, so the badge only draws attention; it is **not** a
  security guarantee, and the panel says to read the `SKILL.md` and its scripts before installing.

## 3. Three project scenarios

`setup` **detects and suggests** the scenario (commit count and age, footprints of a method); the person confirms.

| | **New** (from scratch) | **In development** | **Mature / maintenance** |
|---|---|---|---|
| Detected by | empty folder or few commits | recent commits and/or a method's footprint (planning folder, plan files, ADRs) | large, stable code, little planning |
| What cityPhy creates | empty lot + empty site office + work log with goal and first phases | adopts the existing method as source of truth; the work log becomes a pointer | graph first (heavy-graph warning, exclude tuning); work log in **maintenance** mode: no roadmap, recent fronts of work |
| History | none: the city **grows over time** (refresh on commit, via hook) | imports past agent sessions into memory | imports sessions and git history; highlights **dust** and **hotspots** |
| The briefing focuses on | plan and next action | current phase, what changed, alerts | code map, recent changes, lessons |
| Method question | "Do you want a method? Work log only / GSD / Superpowers / both" | "Found a method. Only map it, or also install it for the other agents?" | usually none; debugging/testing skills as a recommendation |

The scenario is not fixed: a new project becomes "in development" once it has history, and the city shows the change.

## 4. Folders on a person's machine

Four places, kept strictly apart.

**① The program** (code, no personal data). One installed copy (later `npm i -g cityphy` / `npx cityphy`). The skill
and hooks call the `cityphy` command, never an absolute path. A development clone stays separate and is never what the
agents call.

**② The cityPhy home** (the person's data), configurable:

```
<cityphy-home>/
  config.json                 projects and options (moves out of the repository)
  catalog/local.json          skills and methods the person added
  agents/
    <agent>/  tower/ usage/ consumption/
  projects/
    <project>/
      project.json            options + scenario + method + per-agent contract
      graph/                  graphify-out
      book/                   work log: state.json, phases.json, handoffs/
      memory/                 memory.db, LESSONS.md
      metrics/                metrics.jsonl
      integrations/           metadata read from methods (gsd.json, superpowers.json…)
  groups/<group>/             monorepo root: the group's sessions and memory
  cache/  logs/
```

`cityphy migrate` reads the current flat layout, shows the plan (including orphan folders no longer in the config)
and moves only on a yes.

**③ Agent folders.** Only what the person approved: the `cityphy` skill and hooks. An exact list of what cityPhy may
write there, and `cityphy uninstall` removes exactly that.

**④ The project.** Nothing from cityPhy. Something appears there only if the person chooses a method that writes into
the repository; the method writes it, and the city shows it.

### Source layout

"One agent, one folder" should hold for everything an agent has, not only its tower:

```
src/
  core/                   config, paths, consent / project contract
  agents/<agent>/         tower, usage, consumption, activity, skills, mcp, hooks
  projects/               graph, scenario, work log
  library/                inventory, catalog, inspection badge
  integrations/<method>/  gsd, superpowers, planning-with-files
  memory/
  briefing/               builds the briefing within its token cap
  server/ scene/ ui/ cli/ setup/
```

This touches the shared files (`schema.ts`, `towerBuilder.ts`, [TOWER-SCHEMA.md](TOWER-SCHEMA.md)), which change only
with the maintainer's approval.

## 5. The city

Each kind of thing gets its own kind of piece:

| Kind | Piece | Why |
|---|---|---|
| Model | **power plant** | produces the energy: tokens and cost |
| MCP server | **antenna** | a link to tools or services outside |
| Skill | **book** (agent's shelf, or the library when shared) | knowledge the agent looks up |
| Plugin | **market delivery** | a package that places several pieces around the city |
| Hook | **guardhouse / loudspeaker** | acts on its own when an event happens |
| Method (GSD, Superpowers) | **trade school**, one room per skill | a set of skills that forms a way of working |
| cityPhy | **city hall** | registers, measures, inspects, publishes the briefing |

**West: agent compounds.** Context tower (as today), **power plant** (one turbine per model, rings per reasoning
level, replacing the loose per-model towers), **water tank** (consumption filling up to the limit), **guardhouse**
(hooks: lit when fired recently, red when configured but never fired), an antenna for MCP servers only that agent uses.

**Centre: civic district** (what no single agent owns). City hall (cityPhy and shared rules), **library** (skills
shared by several agents, with the inspection badge; a skill with diverging copies is flagged), **trade schools**
(methods; a room lights up when its skill is used, a room always dark is a skill paid for and never used), **market**
(plugins, with wires to every piece they brought), **radio tower** (shared MCP servers: short antenna for local,
tall antenna pointing off the map for remote, amber light when waiting for authentication).

A method's session-start hook is a loudspeaker on its school's roof, with a cable down to the ground floor of every
agent that has it, sized by what it injects.

**East: condominiums built in stages.** Each integration step creates a piece; a missing step shows as an empty lot
with a sign.

| Step | Piece | If missing |
|---|---|---|
| registered in the config | fenced lot in the project's color | — |
| code graph | foundation + buildings | sign "no graph: run refresh" |
| project rules | **gatehouse** with the rulebook and the **briefing** board | gatehouse with an empty board |
| local memory | **registry office** | closed |
| method footprint or work log | **site office** | — |
| project skills and MCP servers | **clubhouse** (antenna on the gatehouse roof for project MCP servers) | — |
| metrics | **meter** (queries and tokens avoided) | meter off |
| registered agents | **parking spots**, one per agent | red spot when an agent works there unregistered |

**Site office.** Plan board (one band per phase), "we are here" sign (current phase), one floor per phase with a
status color: grey planned · blue has a plan · yellow in progress · green delivered · green with a seal verified.
Commits made during the current phase put **scaffolding in the phase color** on the buildings they touched, so the plan
links to the code. Temporary work trees appear as annex lots while they exist; subagent runs show on the phase they
worked on.

**Scale.** House (small project) → condominium (communities as buildings) → district (a monorepo: one condominium per
system, internal streets, a square with the root's sessions and memory). Lot size on a log scale, with a "heavy graph"
badge.

**Inside a building.** Lit windows for the files agents read or edited most (names only), scaffolding for files
changed since the last graph, dust for code untouched for months, a substation for hub nodes.

### Screen

- **HUD** on top: fixed context per session, tokens avoided this week, agents working now, inspection alerts. Clicking
  one filters the city.
- **One panel template** for every piece: header (icon, name, kind, origin), then four fixed blocks:
  - **Context:** what is paid in every session;
  - **Input:** what the agent fetched on demand;
  - **Output:** what it produced;
  - **Expected vs. actual:** what should have happened and did not;
  
  then links. Today's tabs (summary, levels, calculator, compare) move inside the block they belong to.
- **Layers**, like a map: Context · Power · Cost · Health. Each lights one aspect and dims the rest.
- **Legend**, collapsible. One unit everywhere (≈ tokens, k/M), one big number with the detail below, agent colors
  kept apart from project colors.

## 6. Inspection (expected vs. actual)

- the city and the config disagree (a configured project with no data, an orphan data folder);
- a skill in every session's listing and never used;
- a memory index entry pointing to a missing file;
- an agent working on a project it is not registered for;
- a hook configured with no events;
- a graph older than the last commit; a briefing over its cap;
- a session that read many whole files without querying the graph;
- a method installed for one agent but not for another that works on the same project;
- the combined session-start injections (cityPhy, methods, plugins) over a limit;
- a phase planned but not delivered for a long time; the current phase disagreeing with where the commits land;
  repeated or out-of-order phase numbers; a phase delivered without verification;
- **two plan owners** for the same phase (two methods both planning it);
- a work tree forgotten for weeks.

## 7. Delivery order

| Phase | Delivers | Why in this order |
|---|---|---|
| **F0 Housekeeping** | the city follows the config; one installed copy; the cityPhy home + `migrate`; agent code in `agents/<agent>/` | everything later would be built on a mess otherwise |
| **F1 Inventory** | skills (origin, where it lives, who reads it, cost), MCP servers, plugins and hooks per agent; ground-floor cost | the base of the library, antennas and badge |
| **F2 Work log + briefing** | state, phases, handoff, scenarios in `setup`, per-agent contract | ends "carry context and compact" |
| **F3 Screen** | panel template, HUD, layers, power plant, water tank | the presentation |
| **F4 Condominium** | built in stages, site office, GSD adapter, phase scaffolding, district scale | needs F2 |
| **F5 Catalog** | curated catalog, detection-based recommendations, inspection badge, Superpowers adapter | needs F1 |
| **F6 Inspection** | every expected-vs-actual check | brings everything together |

Every phase closes with `npm run typecheck` and `npm test`; visual changes wait for a screenshot and the maintainer's
approval before committing.

## 8. Decisions

1. **Home:** `~/.cityphy` by default; `home` in the config (or `CITYPHY_HOME`) moves it anywhere. `dataDir` is read as
   `home` during the move to the new layout.
2. **Inside a condominium** any piece fits (houses, buildings, offices, annexes): the design is free as long as every
   piece maps to real data.
3. **Installing methods:** cityPhy runs the agent's own install command, only after an explicit yes for that agent and
   that project.
4. **Work log format:** uses GSD's names (`PROJECT`, `ROADMAP`, `STATE`, phases), so `cityphy promote --to gsd` can
   hand a project's work log to GSD without losing anything. cityPhy borrows the concept and credits it.

Still open:

5. **Reading a method's files:** phase names and status are metadata; the next action is content. Proposal: the city
   shows names and status, the briefing points to the method's state file instead of copying it.
6. **Schema:** new sections for skills, MCP servers, hooks and plugins change the shared tower schema.
