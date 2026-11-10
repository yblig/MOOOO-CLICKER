#!/usr/bin/env bash
# Salin file game web ke assets Android dan ganti Google Fonts dengan font lokal (biar jalan offline).
set -euo pipefail
cd "$(dirname "$0")"
OUT=app/src/main/assets/www
rm -rf "$OUT" && mkdir -p "$OUT"
cp ../index.html ../*.css ../*.js "$OUT"/
cp -r ../assets "$OUT"/
cp -r web-extra/fonts web-extra/fonts.css "$OUT"/
sed -i -E '/fonts\.(googleapis|gstatic)\.com/d' "$OUT/index.html"
sed -i 's#<link rel="stylesheet" href="style.css" />#<link rel="stylesheet" href="fonts.css" />\n  <link rel="stylesheet" href="style.css" />#' "$OUT/index.html"
grep -q 'fonts.css' "$OUT/index.html"
echo "Web assets siap di $OUT"
