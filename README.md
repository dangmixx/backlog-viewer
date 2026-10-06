# Backlog Viewer

A small local web app for tracking the tickets in the `BACKLOG.md` files of all your projects. Node.js only, no dependencies.

## Run

```
node server.js            # http://localhost:4321
start.cmd                 # Windows: starts hidden, opens the browser, quits when every tab is closed
stop.cmd                  # stops the server
```

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
| `Status` | `[ ]` to do · `[~]` in progress · `[x]` done | `State`, `Trạng thái` |

Column names are case-insensitive and can be in any order; only `ID` is required. Rows without a `Status` column show as "Unscheduled".

```
## M1 — Core gameplay

| ID | Task | Priority | Estimate | Needs you | Status |
|---|---|---|---|---|---|
| CORE-01 | Tile model | P0 | S | — | [x] |
| CORE-02 | Play on a real phone | P1 | S | test device | [ ] |
```

Changing a status in the app rewrites only the `[ ]` / `[~]` / `[x]` cell of that row.

## Features

- Overview of all projects, progress per project and milestone
- List / board view, filters by status, priority, milestone, search (`/`)
- Change a ticket's status from a menu; it is written to the file after 5 s (cancel with the toast button or Ctrl+Z), then undo with Ctrl+Z
- Click a ticket to compose a one-line prompt for an AI coding agent (Ctrl+click to add tickets)
- Release build button: runs the project's build command (or `tools/export_release.ps1`), bumps `version/code` and `version/name` in a Godot `export_presets.cfg` first and restores them if the build fails
- Add / edit / remove projects, light and dark theme
- Vietnamese and English UI (VI / EN button, remembered per browser); the AI prompt and server messages follow it

The server listens on 127.0.0.1 only. Requests that change anything must carry the `X-BV: 1` header, which the page sends.

`node make-icon.js` regenerates `icon.ico` for a desktop shortcut to `start.cmd`.
