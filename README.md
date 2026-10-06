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

Markdown with `##` sections (milestones) and tables that have an `ID` column. Recognised columns: `ID`, `Việc`/`Task`, `Ưu tiên`/`Priority`, `Ước lượng`/`Estimate`, `Cần bạn`/`Owner`, `Trạng thái`/`Status` with `[ ]` todo, `[~]` in progress, `[x]` done.

```
## M1 — Core gameplay

| ID | Việc | Ưu tiên | Ước lượng | Trạng thái |
|---|---|---|---|---|
| CORE-01 | Tile model | P0 | S | [x] |
```

## Features

- Overview of all projects, progress per project and milestone
- List / board view, filters by status, priority, milestone, search (`/`)
- Change a ticket's status from a menu; it is written to the file after 5 s (cancel with the toast button or Ctrl+Z), then undo with Ctrl+Z
- Click a ticket to compose a one-line prompt for an AI coding agent (Ctrl+click to add tickets)
- Release build button: runs the project's build command (or `tools/export_release.ps1`), bumps `version/code` and `version/name` in a Godot `export_presets.cfg` first and restores them if the build fails
- Add / edit / remove projects, light and dark theme

The server listens on 127.0.0.1 only. Requests that change anything must carry the `X-BV: 1` header, which the page sends.

`node make-icon.js` regenerates `icon.ico` for a desktop shortcut to `start.cmd`.
