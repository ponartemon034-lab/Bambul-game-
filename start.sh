#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null; then (sleep 1; (xdg-open http://localhost:8080 || open http://localhost:8080) >/dev/null 2>&1 &) ; python3 -m http.server 8080
elif command -v node >/dev/null; then node tools/serve.js
else echo "Нужен Python или Node.js"; fi
