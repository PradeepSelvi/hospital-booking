/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A unique id for this build. On Vercel we prefer the git commit SHA (stable per
// deploy); otherwise fall back to the build timestamp. The running app compares
// its own baked-in id against /version.json to detect new deployments.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now())

// Emits /version.json into the build output so clients can poll for updates.
function emitVersionFile(buildId) {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildId }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersionFile(BUILD_ID)],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/services/**', 'src/security/**'],
    },
  },
})
