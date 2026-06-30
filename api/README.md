# Guild Live — Backend (Milestone 2)

Azure Functions (Node 20 + TypeScript, **v4 programming model**). All endpoints are
HTTP-triggered and anonymous (no-auth event). Real-time fan-out is done via the
Web PubSub **group-per-session** model: every broadcast is a single `sendToAll`
to the session group — never a per-connection loop.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/session` | Create session (+ seed demo deck or supplied questions) → `{ sessionCode }` |
| POST | `/api/join` | Validate code → create/reuse player, return group-scoped WPS URL + state |
| GET  | `/api/negotiate?code=XXXX` | Group-scoped WPS URL for host/projector/reconnect |
| POST | `/api/answer` | Submit answer; **server-stamped** timestamp, rank, speed score; broadcast |
| POST | `/api/control` | Host actions: start, next/prevQuestion, nextWord/prevWord, reveal, showLeaderboard, showFinal, end |
| GET  | `/api/session/{code}/state` | Rehydrate canonical state (reconnect) |
| GET  | `/api/session/{code}/leaderboard` | Authoritative leaderboard aggregation |

## Question-type extensibility

The core loop (`control`, `submitAnswer`) is type-agnostic. Each type implements
`QuestionTypeHandler` ([src/questiontypes/types.ts](src/questiontypes/types.ts)) and
registers in [registry.ts](src/questiontypes/registry.ts):

- `wordflash` — host-paced words, unscored (built first)
- `multiplechoice` — Kahoot-style **speed scoring**
- `opentext` — **stub / extension example** (not wired into v1 flows)

Add a type = one new handler file + one line in the registry. No core changes.

## Run locally

Prereqs: [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local),
and either the [Cosmos DB emulator](https://learn.microsoft.com/azure/cosmos-db/local-emulator)
or a real serverless Cosmos account, plus a Web PubSub instance for real-time.

```bash
cd api
npm install

# Option A: point at the real Azure resources from Milestone 1:
#   (from infra/)  terraform output -raw functions_local_settings > ../api/local.settings.json
# Option B: copy the example and fill in connection strings:
cp local.settings.json.example local.settings.json

npm run build
npm start          # func start — serves http://localhost:7071/api/*
```

## Verify (Milestone 2 "done" check)

With `func` running and Cosmos reachable:

```bash
# 1. Create a session
curl -s -X POST http://localhost:7071/api/session | tee /tmp/s.json
CODE=$(jq -r .sessionCode /tmp/s.json)

# 2. Join as a player
curl -s -X POST http://localhost:7071/api/join \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"displayName\":\"Alice\"}" | tee /tmp/p.json
PID=$(jq -r .playerId /tmp/p.json)

# 3. Host: start (activates Word Flash), flash next word
curl -s -X POST http://localhost:7071/api/control -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\",\"action\":\"start\"}"
curl -s -X POST http://localhost:7071/api/control -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\",\"action\":\"nextWord\"}"

# 4. Advance to the MC question, answer it (speed scored)
curl -s -X POST http://localhost:7071/api/control -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\",\"action\":\"nextQuestion\"}"
curl -s -X POST http://localhost:7071/api/answer -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"playerId\":\"$PID\",\"questionOrder\":1,\"choice\":1}"

# 5. Leaderboard reflects the score
curl -s http://localhost:7071/api/session/$CODE/leaderboard
```

A second WebSocket client connected with the `wpsUrl` from `/join` will receive a
`{ kind: "state", state }` message on every host action / answer — proving group
broadcast.
