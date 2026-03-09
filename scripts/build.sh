#!/usr/bin/env bash
set -euo pipefail

OUTDIR="$HOME/bin"
BINARY="$OUTDIR/sift"

mkdir -p "$OUTDIR"

echo "Building sift CLI..."
bun build --compile src/main.ts --outfile "$BINARY"

echo "Built: $BINARY"
"$BINARY" --version
