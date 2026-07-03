# AI Agents — Gemini setup

The AI opponents call a serverless function (`/api/ai-move`) that talks to Google
Gemini. **Without a key the game still works** — it falls back to a deterministic
defensive heuristic — so you can play and test immediately. Add a key to switch the
AI to real Gemini reasoning.

## Local development

1. Get a free key from https://aistudio.google.com/apikey
2. Create `client/.env` (git-ignored):
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Install the SDK once (only needed for real Gemini, not the mock):
   ```
   npm install            # in repo root — installs @google/genai for the function
   ```
4. Run the dev server as usual (`npm run dev` in `client/`). The Vite dev
   middleware serves `/api/ai-move` locally using the same logic Vercel runs.

## Production (Vercel)

1. Import the repo into Vercel.
2. In **Project → Settings → Environment Variables**, add `GEMINI_API_KEY`.
3. Deploy. `vercel.json` builds the client to `client/dist` and deploys
   `api/ai-move.ts` as a serverless function.

## How it works

- Client builds a compact **State Briefing** (owned territories + units, world
  ownership) and POSTs it to `/api/ai-move`.
- The function returns an **Action JSON** (`moves` + `reasoning`).
- All moves are re-validated server-side against the briefing, then applied
  through the same store rules a human uses. Illegal/hallucinated moves are dropped.

## Cost

Gemini 2.5 Flash: roughly $0.06 of tokens per full 7-nation game. See the free
tier for development.
