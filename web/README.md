# Guild Live — Frontend (Milestone 3)

React + TypeScript (Vite). Two routes:

- **`/host`** — create session, full-screen QR, projector display, controls
- **`/join`** — enter code / land via QR, pick name, answer, personal score

ING theme (orange `#FF6200` primary; gray/white base; violet + blue secondary) and
a persistent **Cloud Engineering Guild** badge on every screen. Host views are
large/projector-friendly; player views are mobile-first.

## Question-type extensibility

Renderers live in [src/questiontypes/renderers.tsx](src/questiontypes/renderers.tsx),
keyed by `type` — the mirror of the backend handler registry. Pages look up the
renderer by `state.currentQuestion.type` and never hard-code a type. Implemented:
`wordflash`, `multiplechoice`; `opentext` has a stub renderer.

## Real-time

[src/api/useRealtime.ts](src/api/useRealtime.ts) connects to Web PubSub with the
`json.webpubsub.azure.v1` subprotocol, joins the session group, and receives the
server's single group broadcast. Auto-reconnects with backoff for flaky room wifi.
On refresh, host/player rehydrate full state from the backend (Cosmos = truth).

## Run locally

Needs the backend (Milestone 2) running on `localhost:7071` (`cd ../api && npm start`).
Vite proxies `/api` there automatically.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

## Verify (Milestone 3 "done" check)

1. Open `http://localhost:5173/host` → **Create session** → QR + code show.
2. In a second browser/incognito (or phone on same network), open `/join`,
   enter the code (or scan the QR), pick a name → lands in the lobby.
3. Host **Start game** → Word Flash shows; **Next/Prev** pace words on both screens.
4. Host **Next Q** → Multiple Choice; player taps an option → sees correct/points;
   host **Reveal** highlights the answer.
5. Host **Leaderboard** / **Finish** → ranking renders; player sees their place.

## Build

```bash
npm run build      # tsc + vite build -> dist/
```

`public/staticwebapp.config.json` handles SPA fallback so `/host` and `/join`
deep-links work on Azure Static Web Apps.

## Production config

Set `VITE_API_BASE_URL` to the deployed Function App URL at build time (see
[.env.example](.env.example)). Empty in dev = use the Vite proxy.
