#!/usr/bin/env bash
# Tat server Backlog Viewer (port 4321) tren macOS.
PID=$(lsof -nP -iTCP:4321 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID" ]; then
  kill "$PID" 2>/dev/null && echo "Da tat server (PID $PID)"
else
  echo "Server khong chay."
fi
