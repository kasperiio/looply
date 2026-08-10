import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// src/sw.js is not part of the module graph — it is emitted verbatim to
// /sw.js with the release version stamped in. The stamp is what makes the
// file's bytes differ between releases, which is the only signal a browser
// uses to decide a service worker has been updated. Build-only: in dev there
// is no /sw.js, so no worker gets installed to serve stale code.
function serviceWorkerPlugin(version) {
  return {
    name: 'looply-service-worker',
    apply: 'build',
    generateBundle() {
      // replaceAll, not replace: the token appears in sw.js's own doc comment
      // as well as in the code, and replace() would only substitute the first.
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replaceAll('__LOOPLY_VERSION__', version)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerPlugin(pkg.version)],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
