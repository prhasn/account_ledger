#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${root}/docs/architecture.pdf"
source="${root}/docs/architecture.html"

chromium \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="${output}" \
  "file://${source}"

pdfinfo "${output}" | grep '^Pages:'
