import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Silence the spammy "ws proxy error / ws proxy socket error" stacks that Vite
// prints whenever uvicorn autoreloads or a phone drops its WS mid-stream.
// Throttled one-line warning replaces the multi-page Node stack.
const logger = createLogger()
const origError = logger.error.bind(logger)
let lastProxyWarn = 0
logger.error = (msg, opts) => {
  if (typeof msg === 'string' && /ws proxy (socket )?error/.test(msg)) {
    const now = Date.now()
    if (now - lastProxyWarn > 2000) {
      lastProxyWarn = now
      origError('[ws] backend unreachable — waiting for uvicorn', opts)
    }
    return
  }
  origError(msg, opts)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  customLogger: logger,
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
        configure: (proxy) => {
          // Swallow the error event so Node doesn't throw; the customLogger
          // above collapses Vite's own log line.
          proxy.on('error', () => {})
          proxy.on('econnreset', () => {})
        },
      },
    },
  },
})
