#!/usr/bin/env bash
# Backlog Viewer — mo nhanh tren macOS (double-click trong Finder).
# Neu server dang chay thi chi mo trinh duyet. Server chay an, tu tat khi
# dong het tab (--auto-exit).
cd "$(dirname "$0")"
URL=http://localhost:4321

# Tim node: PATH, nvm, hoac cac vi tri cai dat thong dung.
if ! command -v node >/dev/null 2>&1; then
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  for p in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node"/*/bin; do
    [ -x "$p/node" ] && PATH="$p:$PATH" && break
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Khong tim thay node. Cai Node.js roi chay lai." >&2
  read -r -p "Enter de dong..." _
  exit 1
fi

if ! curl -s -o /dev/null "$URL/api/projects"; then
  nohup node server.js --auto-exit >/dev/null 2>&1 &
  for i in $(seq 10); do curl -s -o /dev/null "$URL/api/projects" && break; sleep 0.5; done
fi
open "$URL"
