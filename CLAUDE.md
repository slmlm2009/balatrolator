# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Balatrolator is a score calculator for the card game *Balatro*. It is a client-side-only static web app (no backend) built with Vite, vanilla TypeScript, and web components. The scoring engine is framework-agnostic and also runnable as a CLI. This repo is the "Claude Edition" fork of [kleinfreund/balatrolator](https://github.com/kleinfreund/balatrolator).

## Commands

- `npm run start` — Vite dev server.
- `npm run build` — production build. **Outputs to `docs/`** (not `dist/`) via `vite-plugin-singlefile`, which inlines everything into a single `index.html` for GitHub Pages deployment.
- `npm run test:node` — Vitest (jsdom) unit tests. Use `npm run test:node:watch` for watch mode.
- Run a single unit test file: `npx vitest run src/lib/getHand.test.ts`. Filter by name: `npx vitest run -t 'Two pair'`.
- `npm run test:browser` — Playwright end-to-end tests (against the built/served app). First-time setup: `npx playwright install chromium`. `npm run test:browser:ui` for the interactive UI.
- `npm run lint` — runs all linters in parallel: `eslint`, `tsc --build` (types), `knip` (unused exports), and lockfile-lint. `npm run fix` auto-fixes ESLint issues.
- CLI scoring: `node --experimental-strip-types balatrolator.ts 'Current hand.json'` where the JSON is a Balatrolator save export.

TypeScript runs with `allowImportingTsExtensions` — **import with explicit `.ts` extensions** (e.g. `from './getHand.ts'`). The `#*` import alias maps to `./src/*` (e.g. `#lib/types.ts`).

## Code style (enforced by ESLint)

Tabs for indentation, single quotes, **no semicolons**, space before function parens (`function foo ()`), trailing commas on multiline. Conventional Commits are enforced via commitlint + husky (e.g. `feat: add support for Blueprint joker`, `fix: red seal applying twice`).

## Architecture

Two layers with a clean boundary: the **scoring engine** (`src/lib/`, pure/DOM-free) and the **UI** (`src/ui/`).

### Scoring engine (`src/lib/`)

The scoring pipeline, given a save/state object:

1. `getState.ts` — normalizes a loose `InitialState` (user/save input with optional fields) into a fully-resolved `State`, applying defaults, computing hand base scores from hand levels, and pre-computing debuff status per card. **`InitialState` is the input shape; `State` is the resolved shape** — keep this distinction.
2. `getHand.ts` — given played cards, determines the poker hand (`HandName`) and which cards are the scoring cards. Exports hand detectors (`flush`, `straight`, `nOfAKind`, `twoPair`, etc.) that `data.ts` also reuses for joker logic.
3. `calculateScore.ts` — the orchestrator. Expands jokers/cards by their `count`, then for **each of the three luck modes** (`'none' | 'average' | 'all'`, from `LUCKS`) walks ordered scoring **phases** (`base` → `played-cards` → `held-cards` → `jokers` → `consumables` → `balancing`), pushing `ScoreValue` entries. Also computes per-joker contributions.
4. `doBigMath.ts` — folds the ordered `ScoreValue[]` into a final chips/mult/score. **Uses `decimal.js` (precision 64), not JS numbers**, because endless-mode scores overflow floats. Order of operations matters — `ScoreValue`s are applied in sequence.

`data.ts` is the heart of game knowledge: `JOKER_DEFINITIONS` maps every `JokerName` to a definition with optional effect hooks (`effect`, `playedCardEffect`, `heldCardEffect`) that push `ScoreValue`s. Adding/fixing a joker almost always means editing its definition here. `resolveJokers.ts` handles Blueprint/Brainstorm copy-targeting (with cycle detection).

Luck modes exist because probabilistic effects (Lucky cards, Bloodstone) are never rolled randomly; instead the engine reports lower bound (`none`), expected value (`average`), and upper bound (`all`). See README "Tell me the odds" for the semantics, including "Oops! All 6s" odds interaction.

### UI (`src/ui/`)

`main.ts` is a thin entry that calls `init()` in `UiState.ts`. **`UiState.ts` is the real UI controller** — it wires the DOM form to the engine, recalculating (debounced) on form changes and rendering results. Custom elements (`src/ui/components/`, extending `BaseElement` and using `lit-html`) render jokers, playing cards, and hand-level cards.

State persistence: `minifier.ts` compresses a `State` into a compact, URL-safe string (context-aware, position-based encoding using `-` `_` `*` separators) for the `?state=` URL param and localStorage; `Storage.ts` and `SaveManager.ts` handle URL/localStorage read-write and named saves. The `minifier` format is positional and order-sensitive — changing field order or enum ordering in `data.ts` (`BLINDS`, `DECKS`, `JOKER_NAMES`, etc.) can break existing saved URLs.

### Tests

`calculateScore.test.ts` is data-driven: each `src/lib/test-files/NNN.ts` exports a `TestCase` (an `initialState` plus `expected` hand/scoringCards/results across all three luck modes). **To add a scoring regression test, add a new numbered file and register it in `calculateScore.test.ts`.** These cases are the source of truth for engine correctness; many were captured from real Balatro hands.
