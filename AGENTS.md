# AGENTS.md

## Cursor Cloud specific instructions

Motion Editor ("Motion CSV Studio") is a single Next.js app (App Router, TypeScript). Frontend UI and server-side file API routes run in one process — there is no separate backend, database, or other service. Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`); setup/features are documented in `README.md`.

- Run the dev server with `npm run dev` (Next.js dev, Turbopack, port 3000). This is the service to run for development.
- IMPORTANT (non-obvious): open the app at `http://localhost:3000`, NOT `http://127.0.0.1:3000`. Next.js dev treats `127.0.0.1` as a cross-origin dev resource and blocks the HMR websocket, which prevents React from hydrating — the page renders but is completely non-interactive (buttons do nothing, no clicks register). Using `localhost` fixes this. Note the `README.md` says `127.0.0.1`; prefer `localhost` in this environment. (A permanent alternative would be adding `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts`, but that is a repo code change.)
- The production build (`npm run build` && `npm start`) is not affected by the cross-origin block and hydrates fine on either host, but is not the development flow.
- Server-side file features (Open/Save Server, Export/Import Library) read and write CSVs in `MOTION_DIR` (defaults to `./data/motions/`, auto-created). Set `MOTION_DIR` in `.env.local` to point elsewhere. Client-side features (Open Client, Save Bundle, Export CSV) need only the browser.
- `npm run lint` passes with one pre-existing unused-var warning in `components/GraphEditor.tsx`; that is expected, not a regression.
