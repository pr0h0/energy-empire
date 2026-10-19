# Development

## Environment

Everything runs in Docker so the host stays clean. `./dev.sh <command>` builds the `energy-empire-dev` image on
first use (Playwright 1.63 + Chromium + Bun 1.4) and runs the command with the project mounted at `/app` as your
user. If your user cannot reach the Docker socket directly, it falls back to `sg docker`.

```bash
./dev.sh bun install
PORT=5173 ./dev.sh bun run dev --host     # http://localhost:5173
```

Without Docker: Bun ≥ 1.4, then `bun install && bun run dev`.

## Checks

| Command | Purpose |
| --- | --- |
| `./dev.sh bun run typecheck` | `tsc -b`, strict |
| `./dev.sh bun run lint` | ESLint (src + tests) |
| `./dev.sh npx vitest run` | all Vitest suites (~1 min; includes the full progression bot) |
| `./dev.sh npx vitest run tests/unit` | fast unit tests |
| `./dev.sh bunx playwright test` | browser tests; builds `dist/` and previews it first |
| `./dev.sh bun run build` | production build into `dist/` |

Note: the Playwright web server runs `bun run build`, which rewrites `dist/` — the production nginx serves that
folder, so a browser test run also deploys.

## Test layout

* `tests/unit` — systems in isolation (electricity, fuel, maintenance, research, weather, goals, incidents,
  exploits, edge cases such as double clicks and reloading mid-delivery, saves, math, animation art).
* `tests/integration` — workflows and offline/online agreement.
* `tests/balance` — `AutoPlayer` plays a whole run and prints per-map arrival times; asserts it can win.
* `tests/performance` — synthetic late-game save: per-tick cost, save/load time, 12 h offline reconciliation.
* `tests/browser` — Playwright: core flows, tooltips, research tree, weather layer, events, screenshots at
  1280×720 → 4K and mobile (also asserts no horizontal scroll).

Debug hooks are on `window.__ee` (engine, `dev.money()`, `dev.unlock()`, `dev.research()`, `dev.ownAll()`).

## Adding content

* **Building:** add a `b({...})` entry in `src/engine/data/buildings.ts` (cost is derived from `paybackH`), art in
  `src/rendering/SVGAssets.ts` (`ART`, optionally `ANIM`/`OVERLAY`/`SPIN` for animation).
* **Research:** a row in `src/engine/data/research.ts` (`[id, name, branch, stage, mult, prereq, effects, desc]`).
  The tree lays itself out. Repeatables go in `reps`.
* **Upgrade:** `src/engine/data/upgrades.ts` + `UPGRADE_RESEARCH`, add `upg('id')` to the research row and the id to
  the buildings' `upgrades` lists (tests check the wiring).
* **Achievement:** `src/engine/data/achievements.ts`; custom checks in `AchievementSystem.ts`.
* **Save fields:** add defaults in `NewGame.ts` and `SaveMigration.ts` so old saves load.

## Conventions

* The engine (`src/engine`) never imports React and stays deterministic: randomness comes from the save seed.
* UI changes state only through `engine.dispatch(command)`.
* Scratch tests go in `tests/unit` or `tests/browser` and are deleted afterwards.
