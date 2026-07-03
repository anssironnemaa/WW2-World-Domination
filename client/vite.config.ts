import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Serves the /api serverless functions locally during `vite dev`, reusing the
// exact same logic the Vercel functions use in production. Keeps the Gemini key
// server-side. Each route maps to a shared lib module + exported function name.
const API_ROUTES: { path: string; lib: string; fn: string }[] = [
  { path: '/api/ai-move', lib: '../api/_lib/aiMove.ts', fn: 'runAiMove' },
  { path: '/api/narrative', lib: '../api/_lib/narrative.ts', fn: 'runNarrative' },
]

function apiDevPlugin(apiKey: string): Plugin {
  return {
    name: 'api-dev',
    configureServer(server: ViteDevServer) {
      for (const route of API_ROUTES) {
        const libPath = path.resolve(import.meta.dirname, route.lib)
        server.middlewares.use(route.path, async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }
          try {
            let raw = ''
            for await (const chunk of req) raw += chunk
            const body = raw ? JSON.parse(raw) : {}
            const mod = await server.ssrLoadModule(libPath)
            const result = await mod[route.fn](body, apiKey || undefined)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'API error' }))
          }
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Read GEMINI_API_KEY from client/.env (git-ignored) for local dev.
  const env = loadEnv(mode, import.meta.dirname, '')
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin(env.GEMINI_API_KEY ?? '')],
    server: { fs: { allow: ['..'] } },
  }
})
