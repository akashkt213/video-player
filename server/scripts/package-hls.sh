#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:?Usage: package-hls.sh <input.mp4> <output_dir>}"
OUTPUT_DIR="${2:?Usage: package-hls.sh <input.mp4> <output_dir>}"

mkdir -p "$OUTPUT_DIR"

ffmpeg -y -i "$INPUT" \
  -filter_complex \
  "[0:v]split=3[v1][v2][v3]; \
   [v1]scale=w=640:h=360[v1out]; \
   [v2]scale=w=1280:h=720[v2out]; \
   [v3]scale=w=1920:h=1080[v3out]" \
  -map "[v1out]" -map 0:a -c:v libx264 -b:v 800k  -c:a aac -b:a 96k \
    -hls_time 4 -hls_list_size 0 \
    -hls_segment_filename "$OUTPUT_DIR/360p_%03d.ts" \
    "$OUTPUT_DIR/360p.m3u8" \
  -map "[v2out]" -map 0:a -c:v libx264 -b:v 2800k -c:a aac -b:a 128k \
    -hls_time 4 -hls_list_size 0 \
    -hls_segment_filename "$OUTPUT_DIR/720p_%03d.ts" \
    "$OUTPUT_DIR/720p.m3u8" \
  -map "[v3out]" -map 0:a -c:v libx264 -b:v 5000k -c:a aac -b:a 128k \
    -hls_time 4 -hls_list_size 0 \
    -hls_segment_filename "$OUTPUT_DIR/1080p_%03d.ts" \
    "$OUTPUT_DIR/1080p.m3u8"

cat > "$OUTPUT_DIR/master.m3u8" <<'EOF'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5128000,RESOLUTION=1920x1080
1080p.m3u8
EOF

echo "HLS packaged to $OUTPUT_DIR/ (master: $OUTPUT_DIR/master.m3u8)"
