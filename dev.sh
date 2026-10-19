#!/usr/bin/env bash
# Run any command inside the dev container (bun + playwright browsers). Host stays clean.
# usage: ./dev.sh bun test   |   PORT=5173 ./dev.sh bun run dev --host
set -e
cd "$(dirname "$0")"
IMG=energy-empire-dev
run() { if docker info >/dev/null 2>&1; then docker "$@"; else sg docker -c "docker $(printf '%q ' "$@")"; fi; }
run image inspect $IMG >/dev/null 2>&1 || run build -t $IMG -f Dockerfile.dev .
PORTARGS=()
[ -n "$PORT" ] && PORTARGS=(-p 127.0.0.1:$PORT:$PORT)
TTY=(); [ -t 0 ] && TTY=(-t)
run run --rm -i "${TTY[@]}" --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp/home -e CI=1 \
  -v "$PWD":/app "${PORTARGS[@]}" ${NAME:+--name $NAME} $IMG "$@"
