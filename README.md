# Looply

Generate circular running and cycling routes from any starting point. Built with React, Vite, Leaflet, and BRouter.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
npm ci --legacy-peer-deps
```

`react-leaflet` has a peer dependency mismatch with React 19; `--legacy-peer-deps` matches the lockfile install path.

## Development

```bash
npm run dev
```

Default port is `5173`. On Windows, if that port is blocked, use:

```bash
npm run dev -- --port 5200
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Releases

Versioning uses [release-please](https://github.com/googleapis/release-please) with [Conventional Commits](https://www.conventionalcommits.org/) on `main` (`feat:`, `fix:`, `chore:`, etc.).

1. Push conventional commits to `main`.
2. Release Please opens or updates a release PR (`package.json` version bump + `CHANGELOG.md`).
3. Merge that PR → a GitHub Release is created and **build-release** publishes `ghcr.io/<owner>/<repo>` tags (`vX.Y.Z`, `latest`).

**Repository secret:** `MY_RELEASE_PLEASE_TOKEN` — a fine-grained or classic PAT with **Contents** and **Pull requests** write access. Add **Workflows** write if releases must trigger other Actions (recommended).

## Docker (VPS)

Build and run on port 8080 (override with `LOOPLY_PORT`):

```bash
docker compose up -d --build
```

Open `http://<your-vps-ip>:8080`. The runtime image uses [Chainguard nginx](https://images.chainguard.dev/directory/image/nginx/overview) (non-root, port 8080). Put Caddy or host nginx in front on port 443 if you want HTTPS.

## External APIs

No backend or API keys required. The app calls these services from the browser:

- [BRouter](https://brouter.de/) — route geometry
- [Nominatim](https://nominatim.org/) — geocoding
- [Overpass](https://overpass-api.de/) — trail nodes (trail surface mode)
- Carto / OpenStreetMap — map tiles

## Project structure

```
src/
  App.jsx              # App shell and state wiring
  components/          # UI (map, sidebar, charts)
  services/            # Route generation and recalculation
  utils/               # BRouter client, geo, URL state, GPX export
  constants/           # Shared surface styling tokens
public/                # PWA manifest, favicon, service worker
```
