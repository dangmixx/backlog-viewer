#!/usr/bin/env bash
# Backlog Viewer - mo nhanh tu Git Bash. Neu server dang chay thi chi mo trinh duyet.
cd "$(dirname "$0")"
URL=http://localhost:4321
if ! curl -s -o /dev/null "$URL/api/projects"; then
  nohup node server.js --auto-exit >/dev/null 2>&1 &
  for i in $(seq 10); do curl -s -o /dev/null "$URL/api/projects" && break; sleep 0.5; done
fi
start "" "$URL" 2>/dev/null || cmd //c start "" "$URL"
