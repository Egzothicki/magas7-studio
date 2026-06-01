# AGENTS.md — magas7-studio

**READ THIS FIRST.** This service runs on the beehive-main droplet (139.59.126.68) and follows the same GitHub → webhook → deploy.sh pipeline as all other services.

## What it does

The Studio agent is a "marketing agent" demonstration for MAGAS7. It:

1. Wakes up on a cron schedule (default: every 6h)
2. Picks a topic from a rotating list (agent spotlight, feature, comparison, demo)
3. Calls Claude Sonnet (`ANTHROPIC_API_KEY`) to draft a 20-second video script
4. Picks one of 5 HTML/CSS/JS templates in `templates/`
5. Injects the script into the template
6. Renders it via Playwright headless Chromium, capturing video (WebM)
7. Re-encodes to MP4 (H.264, 1080×1080, X-ready) with ffmpeg
8. Extracts a poster frame
9. Writes both into `/var/www/magas7.com/studio/videos/` on the droplet
10. Regenerates `/var/www/magas7.com/studio/index.html` — the public showcase
11. Optionally posts to X if `MAGAS7_X_*` env vars are set

The public showcase lives at https://magas7.com/studio and is fully static — nginx serves it directly, no need for the magas7 (Next.js) site to know about it.

## Deploy

- Pushes to `main` fire GitHub webhook → `/usr/local/bin/deploy.sh magas7-studio`
- This is a Docker service. `Dockerfile` lives at the root.
- Container is started with PORT mapping defined in `PORT_MAP` (3013:3000).
- Output dir `/var/www/magas7.com/studio/` is bind-mounted into the container via the `docker run` flags in deploy.sh (need to add `-v /var/www/magas7.com/studio:/var/www/magas7.com/studio` for this service).

## Environment

Required:
- `ANTHROPIC_API_KEY` — Claude Sonnet 4.6 for scripts
- `DATA_DIR=/var/data` — state file location

Optional:
- `STUDIO_GEN_CRON` — default `0 */6 * * *` (every 6 hours)
- `STUDIO_OUTPUT_DIR` — default `/var/www/magas7.com/studio`
- `MAGAS7_X_CONSUMER_KEY`, `MAGAS7_X_CONSUMER_SECRET`, `MAGAS7_X_ACCESS_TOKEN`, `MAGAS7_X_ACCESS_TOKEN_SECRET` — only if auto-posting

## Manual trigger

```
curl -X POST http://localhost:3013/trigger -H "Authorization: Bearer $STUDIO_ADMIN_TOKEN"
```
