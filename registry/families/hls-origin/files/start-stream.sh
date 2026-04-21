#!/usr/bin/env bash
# Usage:
#   ./start-stream.sh <input>     <stream-name>
#   ./start-stream.sh my-file.mp4 lobby
#   ./start-stream.sh rtmp://ingest.example.com/live/key concert
#   ./start-stream.sh testsrc     demo           # ffmpeg synthetic test pattern
#
# Writes a rolling HLS window to /var/www/hls/<stream-name>/stream.m3u8 inside
# the ffmpeg container. nginx mounts the same volume and serves it at
# http://localhost:{{nginxPort}}/hls/<stream-name>/stream.m3u8

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <input> <stream-name>" >&2
  exit 2
fi

INPUT="$1"
STREAM="$2"
SEGMENT_SEC="${SEGMENT_SEC:-{{segmentDurationSec}}}"
PLAYLIST_SIZE="${PLAYLIST_SIZE:-{{playlistSize}}}"
OUTDIR="/var/www/hls/${STREAM}"

# Build the input side of the command. `testsrc` is a built-in ffmpeg filter
# — convenient for smoke-testing the pipeline end-to-end without a real feed.
if [[ "$INPUT" == "testsrc" ]]; then
  INPUT_ARGS=(-re -f lavfi -i "testsrc=size=1280x720:rate=30" -f lavfi -i "sine=frequency=1000")
  MAPS=(-map 0:v -map 1:a)
else
  INPUT_ARGS=(-re -i "$INPUT")
  MAPS=()
fi

# -hls_flags delete_segments+append_list+omit_endlist:
#   delete_segments   drop old .ts from disk as they roll off the playlist
#   append_list       keep a stable playlist across reconnects
#   omit_endlist      never write #EXT-X-ENDLIST — the stream is live, not VOD
#
# -hls_time controls segment duration. Shorter = lower glass-to-glass latency,
# more playlist churn. 2s is a sensible default; drop to 1s for sub-5s
# interactive latency, raise to 6s for stability over lossy links.
exec docker compose exec ffmpeg sh -c "
  mkdir -p '${OUTDIR}' &&
  ffmpeg -hide_banner -loglevel warning \
    ${INPUT_ARGS[*]} \
    ${MAPS[*]} \
    -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p \
    -g \$((${SEGMENT_SEC}*30)) -keyint_min \$((${SEGMENT_SEC}*30)) -sc_threshold 0 \
    -b:v 2500k -maxrate 2500k -bufsize 5000k \
    -c:a aac -b:a 128k -ar 48000 \
    -f hls \
    -hls_time ${SEGMENT_SEC} \
    -hls_list_size ${PLAYLIST_SIZE} \
    -hls_flags delete_segments+append_list+omit_endlist \
    -hls_segment_filename '${OUTDIR}/seg_%05d.ts' \
    '${OUTDIR}/stream.m3u8'
"
