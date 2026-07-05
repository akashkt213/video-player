#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-src/assets/35860-408654164.mp4}"
OUTPUT_DIR="public/media"

mkdir -p "$OUTPUT_DIR"

ffmpeg -y -i "$INPUT" \
  -c:v libx264 -c:a aac \
  -hls_time 4 \
  -hls_list_size 0 \
  -f hls \
  "$OUTPUT_DIR/stream.m3u8"

echo "HLS packaged to $OUTPUT_DIR/"
