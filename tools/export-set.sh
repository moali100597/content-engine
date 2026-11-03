#!/bin/bash
# Export every still whose id starts with a prefix as PNGs (a carousel, a brand's set, one design in all formats).
#   tools/export-set.sh D-tips-            -> out/export/D-tips-1.png, D-tips-2.png, ...
#   tools/export-set.sh D-my-post          -> the piece and its --story/--square/--tall/--wide versions
# On a desktop GPU drop --browser-executable and use --gl=angle.
set -e
cd "$(dirname "$0")/.."
prefix="$1"; out="${2:-out/export}"; mkdir -p "$out"
ids=$(npx remotion compositions src/index.ts ${BROWSER:+--browser-executable=$BROWSER} 2>/dev/null | awk '{print $1}' | grep "^${prefix}" || true)
[ -z "$ids" ] && { echo "no still starts with $prefix"; exit 1; }
for id in $ids; do
  npx remotion still src/index.ts "$id" "$out/$id.png" ${BROWSER:+--browser-executable=$BROWSER} --gl=${GL:-angle} --log=error
  echo "$out/$id.png"
done
