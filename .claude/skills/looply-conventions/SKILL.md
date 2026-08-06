---
name: looply-conventions
description: Looply coding conventions — DRY single-sources-of-truth, state flow, BRouter API rules, and verification workflow. Use when writing or reviewing any Looply code.
---

# Looply conventions

## DRY — single sources of truth

Logic shared by more than one flow lives in ONE place. Never re-inline any of
these; extend them where they live:

- **Route shaping**: `withEditableWaypoints()` in `src/utils/routeEditing.js`
  is the only place a BRouter result becomes app state. Both generation
  (`routeGenerator.js`) and manual-edit recalculation (`routeRecalculator.js`)
  must go through it — duplicating the shaping is how those flows drift apart.
- **Surface styling and vocabulary**: `src/constants/surface.js`
  (colors, labels, `VALID_SURFACE_PREFS`). UI components import from here.
- **Profile tunables**: `src/utils/brouter/profiles.js` documents every
  `profile:<var>` override in its header comment. Add the doc line when
  adding a variable.
- **Mode → routing behavior mapping**: `effectiveSurface()` in
  `routeGenerator.js` and `buildCustomParams()` in `brouter/client.js`.
  Cycling discipline (road/gravel/mtb) determines surface; the surface
  selector applies to running only.
- **URL state**: read/write only via `src/utils/urlState.js`. New persistent
  settings get a param there (with validation + legacy migration), never
  ad-hoc `URLSearchParams` elsewhere.
- **App state ownership**: `App.jsx` owns all state; components are
  presentational and receive values + handlers via props. When two flows
  update the same state (e.g. generate vs manual edit), they must converge on
  the same shape — an edit updates the current alternative in place rather
  than resetting sibling state.

## BRouter API rules (learned empirically — do not regress)

- Tuning params are honored ONLY with the `profile:` prefix
  (`profile:uphillcost=40`); bare params are silently ignored.
- Sending a `profile:` variable a profile doesn't declare returns HTTP 500 on
  some profiles (mtb, hiking-mountain). Custom profiles declare every knob we
  send; the standard-profile fallback path gates params per profile.
- Profile names are case-sensitive (`mtb`, not `MTB`).
- Custom profiles upload via `POST /brouter/profile`, are session-cached, may
  be purged server-side — `fetchRoute` re-uploads once, then falls back.
- Identical requests are deterministic → cacheable (`cachedFetchRoute`).
  Cache keys must include every request-affecting input (see `requestKey`).
- Be polite to the public server: keep global request concurrency ≈6.

## Code style

- Plain JS ESM with explicit `.js` extensions in imports; no TypeScript.
- Comments state constraints or non-obvious rationale, not narration.
- Tailwind, dark-only palette: `bg-gray-950` surfaces, `lime-400` accent,
  `border-gray-800`. Mobile-first: verify layouts at 375 px; use
  `hidden sm:*` to shed secondary info on narrow screens.
- Conventional Commits (`feat:`, `fix:`) — release-please builds the
  changelog from them.

## Verification workflow (definition of done)

1. `npm run lint` passes.
2. Pipeline changes: run a live end-to-end check with
   `node --input-type=module -e "import { generateRoutes } from './src/services/routeGenerator.js'; …"`
   and assert on real numbers (distance error, surface shares, backtrack).
3. UI changes: verify in the running app (dev server via `.claude/launch.json`)
   on desktop AND the mobile preset, including the manual-edit flow
   (drag a waypoint / double-click the route), not just generation.
4. Claims about external APIs (BRouter, Overpass) are verified empirically
   with curl before being coded against — compare response bytes, not vibes.
