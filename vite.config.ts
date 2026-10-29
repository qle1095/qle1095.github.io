import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** The static sub-sites in public/ (inference/, playground/, bookshelf/) are
 *  linked by folder URL. GitHub Pages serves a folder's index.html, but the
 *  Vite dev server falls back to the app's root index.html instead, so every
 *  such link "goes home" in dev. Rewrite folder URLs to their index.html. */
function publicFolderIndex(): Plugin {
  return {
    name: 'public-folder-index',
    configureServer(server) {
      const publicDir = server.config.publicDir;
      server.middlewares.use((req, _res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        if (path !== '/' && path.endsWith('/') && existsSync(join(publicDir, path, 'index.html'))) {
          req.url = `${path}index.html${query ? `?${query}` : ''}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publicFolderIndex()],
});
