#!/usr/bin/env bash
# Собирает публикуемую версию сайта в dist/: только то, что нужно браузеру.
set -euo pipefail

cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist

cp -r css js dist/
cp ./*.html dist/

echo "dist/ собран:"
find dist -type f | sort
