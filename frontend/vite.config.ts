import { defineConfig } from 'vite';

/**
 * Configuração mínima do Vite.
 *
 * O projeto não usa @vitejs/plugin-react (JSX é transformado pelo próprio Vite),
 * então aqui só ficam ajustes de infraestrutura seguros para build e dev:
 *
 * - `server.watch.ignored`: editores/ferramentas gravam arquivos temporários dentro
 *   da pasta de origem (ex.: `.Arquivo.tsx.1234.<guid>.tmpdir/`). O watcher do Vite
 *   tentava observá-los e morria com `EBUSY` no Windows.
 * - `server.watch.usePolling`: o watch nativo do Windows também estoura `EBUSY`
 *   quando outro processo mantém o arquivo aberto durante o save (caso real:
 *   `src/pages/admin/AdminEvents.tsx`, que derrubou o dev server). Polling não
 *   segura handle nativo no arquivo, então o servidor sobrevive à edição.
 */
export default defineConfig({
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
      ignored: [
        '**/.*.tmpdir/**',
        '**/*.tmpdir/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
