# Backlog Viewer

A small local web app for tracking the tickets in the `BACKLOG.md` files of all your projects. Node.js only, no dependencies.

## Run

```
node server.js            # http://localhost:4321
start.cmd / stop.cmd      # Windows: start hidden + open the browser / stop the server
Backlog Viewer.app        # macOS: double-click — like the .exe on Windows, no Terminal window
start.command             # macOS: same behaviour from a script (opens Terminal briefly)
stop.command              # macOS: stop the server
```

`Backlog Viewer.app` is a tiny launcher (it runs `node server.js`, opens the browser, and quits when every tab is closed). On the first open macOS Gatekeeper may block it — right-click → **Open** once, or run `xattr -dr com.apple.quarantine "Backlog Viewer.app"`. The same applies to `start.command` / `stop.command`.

On first run it scans the parent folder for `BACKLOG*.md` files and stores the project list in `projects.json` (not committed).

## Backlog format

Markdown with `##` sections (milestones) and tables that have an `ID` column. A table without an `ID` column is ignored. The first `#` heading is the project name and the first paragraph under it is its description.

| Column | Meaning | Also accepted |
|---|---|---|
| `ID` | Ticket id, e.g. `CORE-01` (required) | |
| `Task` | What to do | `Title`, `Description`, `Việc` |
| `Priority` | `P0`, `P1`, `P2`… | `Prio`, `Ưu tiên` |
| `Estimate` | Size, e.g. `S`, `M`, `L` | `Est`, `Effort`, `Ước lượng` |
| `Needs you` | What only a person can do (device, account, review) | `Owner`, `Assignee`, `Cần bạn` |
| `Status` | `[ ]` to do · `[~]` in progress · `[x]` done · `[-]` cancelled (struck through, left out of the progress %) | `State`, `Trạng thái` |

Column names are case-insensitive and can be in any order; only `ID` is required. Rows without a `Status` column show as "Unscheduled".

```
## M1 — Core gameplay

| ID | Task | Priority | Estimate | Needs you | Status |
|---|---|---|---|---|---|
| CORE-01 | Tile model | P0 | S | — | [x] |
| CORE-02 | Play on a real phone | P1 | S | test device | [ ] |
```

### Split backlog

A long backlog can keep one file per milestone in a `backlog/` folder next to `BACKLOG.md`, so an AI agent working on one ticket reads only that milestone. `BACKLOG.md` keeps the title, version and legend and links to the files:

```
- [M0 — Core](backlog/M0.md)
- [M1 — Levels](backlog/M1.md)
```

Each file holds its `## M0 — …` heading and ticket table. Files are read in link order, then any unlinked `backlog/*.md` by name. Status changes are written to the file the ticket is in, and the AI prompt points at that file when all picked tickets share it.

Changing a status in the app rewrites only the `[ ]` / `[~]` / `[x]` cell of that row.

## Features

- Overview of all projects, progress per project and milestone
- List / board / git-graph view, filters by status, priority, milestone, search (`/`)
- **Git graph**: a per-project commit graph (the project folder's git history across all branches) with lanes, merges, branch and tag labels, loaded lazily (50 commits first, more as you scroll down) — switch to it with the **Git graph** button next to List / Board
- Change a ticket's status from a menu; it is written to the file after 5 s (cancel with the toast button or Ctrl+Z), then undo with Ctrl+Z
- Click a ticket to compose a one-line prompt for an AI coding agent (Ctrl+click to add tickets)
- Release build button: runs the project's build command (or `tools/export_release.ps1`), bumps `version/code` and `version/name` in a Godot `export_presets.cfg` first and restores them if the build fails
- Version tag next to the project name: typed in the edit dialog, else a `**Version:** 1.2.0` line under the BACKLOG.md title, else `version/name` in a Godot `export_presets.cfg`
- Add / edit / remove projects, light and dark theme
- Sidebar: drag projects to reorder, group them (folder button next to "Projects"), pin projects or groups to the top; right-click or `⋯` for the same actions. Saved in `layout.json` (not committed); the overview follows the same order
- Vietnamese and English UI (VI / EN button, remembered per browser); the AI prompt and server messages follow it

The server listens on 127.0.0.1 only. Requests that change anything must carry the `X-BV: 1` header, which the page sends.

`node make-icon.js` regenerates `icon.ico` for a desktop shortcut to `start.cmd`.
