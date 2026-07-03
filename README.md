# WW2: World Dominance

A browser-based digital Game Master Engine for a WW2 grand-strategy board game
(Axis & Allies × Diplomacy hybrid) for 1–7 players — human, AI, or NPN.

## Features

- Realistic SVG world map (177 territory paths + 25 sea zones tiling the ocean)
- IPC economy, unit purchasing, and production queues
- Full round loop: **diplomacy → purchase → orders → reveal → battle → income**
- Dice-based combat engine (per the rulebook: artillery support, sub first-strike, etc.)
- PIN-locked **secret simultaneous orders**
- Diplomacy command system — alliances, IPC transfers, non-aggression pacts, mercenaries
- Espionage — spy points, code-breaking, encryption
- **AI opponents** powered by Google Gemini (with a mock fallback that needs no key)
- **LLM narrative** — dramatized battle reports, world-news bulletins, and a closing documentary
- Victory detection (7 Victory Cities solo / 9 combined for an alliance)

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Zustand + Tailwind — in `client/`
- **Backend:** Vercel serverless functions — in `api/` (`ai-move`, `narrative`), calling Gemini
- No database; game state lives in the browser (single-machine hotseat + AI).

## Deploy to Vercel (GitHub auto-publish)

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project → Import** that repo. `vercel.json` already
   configures the build (client → `client/dist`) and the `api/` functions — no
   framework overrides needed.
3. **Add the AI key:** Project → Settings → Environment Variables →
   `GEMINI_API_KEY = your_key` (Production). Get one at
   https://aistudio.google.com/apikey
4. Deploy. Every push to the repo now auto-publishes.

> Without `GEMINI_API_KEY` the game still runs — AI and narrative fall back to a
> deterministic heuristic/template. Add the key to enable real Gemini reasoning.

## Local development

```bash
cd client
npm install
# optional, for real Gemini locally: create client/.env with GEMINI_API_KEY=...
npm run dev
```

See [AI_SETUP.md](AI_SETUP.md) for details on the AI/narrative endpoints.
