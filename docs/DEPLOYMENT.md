# Deployment

The game is a static single-page app: no backend, no accounts, saves live in the player's browser (IndexedDB).

## Build and serve

```bash
./dev.sh bun run build                              # → dist/
docker compose -f docker-compose.prod.yml up -d     # nginx:alpine serving dist/ on 127.0.0.1:3700
```

`deploy/nginx.conf` gzips text assets, caches `/assets/` (hashed) for a year, serves `index.html` uncached, and
falls back to `index.html` for unknown paths. The container mounts `dist/`
read-only, so rebuilding is enough to publish a new version (no container restart).

## Public URL (Cloudflare tunnel)

`deploy/cloudflared-energy.yml` routes `game-energy.pr0h0.me` to `http://localhost:3700`. It references the tunnel
credentials file in `~/.cloudflared/` on the host; the credentials themselves are **not** in this repository.

On the current host a copy of this file lives at `~/.cloudflared/energy-empire.yml` and runs as its own
process:

```bash
cloudflared tunnel --config ~/.cloudflared/energy-empire.yml run
```

The tunnel runs alongside other tunnels on the same host; it only claims its own hostname.

To set it up on another machine: `cloudflared tunnel create <name>`, put the new tunnel id and credentials path in
the config, and `cloudflared tunnel route dns <name> <hostname>`.
