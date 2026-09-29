#!/bin/zsh
cd "${0:A:h}"
if curl --silent --fail http://localhost:5187/ | /usr/bin/grep -q '<title>LiraTime'; then
  open http://localhost:5187
  exit 0
fi
liratime_node="$(command -v node)"
if [[ -z "$liratime_node" ]]; then
  liratime_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$liratime_node" ]]; then
  print 'Node.js saknas. Installera Node.js och öppna den här filen igen.'
  read '?Tryck Enter för att stänga.'
  exit 1
fi
print 'Öppna http://localhost:5187 i din vanliga webbläsare.'
print 'Behåll det här fönstret öppet medan du använder LiraTime.'
"$liratime_node" server.mjs
