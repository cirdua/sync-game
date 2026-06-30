# Guild Live 🎮

A real-time, multiplayer audience-engagement game (Mentimeter / Kahoot style) for a
single **~200-player, 1-hour event**. No authentication — players join with a short
**code** or by scanning a **QR**. Built end-to-end: Terraform IaC → Azure Functions
backend → React frontend → live Azure deployment.

> **Branding:** ING-inspired — ING orange `#FF6200` primary, gray/white base, violet
> + blue secondary. Persistent **Cloud Engineering Guild** badge on every screen.

---

## 💸 Cost — read this first

| Resource | Tier | Cost |
|---|---|---|
| **Azure Web PubSub** | Standard, 1 unit | **~$1.61/day** — the only metered cost |
| Cosmos DB | **Serverless** | Pay-per-request (cents for one event) |
| Azure Functions | Consumption | Effectively free at this scale |
| Static Web Apps | **Free** | $0 |

Web PubSub bills **per unit per day with no hourly proration** — a 1-hour event still
costs one day (~$1.61). Everything else stays on free/serverless tiers.

> ## ⚠️ DESTROY AFTER THE EVENT
> Web PubSub keeps billing until you tear it down. When the event is over:
> ```bash
> cd infra && terraform destroy
> ```
> This deletes the whole resource group and stops **all** charges.

---

## Architecture

See [architecture.md](architecture.md) for data flow, the data model, the
question-type abstraction, and sequence diagrams. The one rule that matters at
200 players: the host **publishes once to the session group** and Web PubSub fans
out — there is no per-connection send anywhere.

```
React (SWA, Free) ──REST──▶ Azure Functions (Consumption) ──▶ Cosmos DB (serverless)
       ▲                              │
       └──────── Web PubSub ◀─────────┘   (one publish → group fan-out to all 200)
```

| Layer | Folder | Milestone |
|---|---|---|
| Terraform IaC | [infra/](infra/) | 1 |
| Backend (Functions) | [api/](api/) | 2 |
| Frontend (React) | [web/](web/) | 3 |
| Deploy scripts | [scripts/](scripts/) | 4 |

---

## Prerequisites

Install on the machine you deploy from:

| Tool | Install (Windows / winget) | Notes |
|---|---|---|
| Terraform ≥ 1.5 | `winget install Hashicorp.Terraform` | |
| Azure CLI | `winget install Microsoft.AzureCLI` | then `az login` |
| Node.js 20+ | `winget install OpenJS.NodeJS.LTS` | |
| Functions Core Tools v4 | `npm i -g azure-functions-core-tools@4` | publishes the backend |
| SWA CLI | `npm i -g @azure/static-web-apps-cli` | deploys the frontend |

> On macOS/Linux use Homebrew/apt equivalents; the bash deploy script
> ([scripts/deploy.sh](scripts/deploy.sh)) mirrors the PowerShell one.

---

## Deploy (clean machine → live app)

### 1. Provision infrastructure

```bash
az login
cd infra
terraform init
terraform apply        # creates the resource group + all resources
```

Verify outputs are populated:

```bash
terraform output
```

### 2. Deploy backend + frontend

From the repo root, one command does both (reads Terraform outputs, publishes the
Functions app, builds the frontend with the API URL baked in, deploys to SWA):

**Windows (PowerShell):**
```powershell
./scripts/deploy.ps1
```

**macOS / Linux (bash):**
```bash
./scripts/deploy.sh
```

The script prints the live URLs at the end:
- App:  `https://<swa>.azurestaticapps.net`
- Host: `…/host`
- Join: `…/join`

> **Manual step — SWA deployment token:** the scripts read it automatically from
> `terraform output -raw static_web_app_api_key`. If you deploy the frontend by
> hand instead, pass that token to `swa deploy ./web/dist --deployment-token <token> --env production`.

> **CORS:** Terraform sets the Function App CORS to `*` (the app is token-based and
> sends no credentials, so this is safe). If `func ... publish` ever resets it,
> re-apply with `az functionapp cors add -g rg-guildlive -n <func-name> --allowed-origins '*'`.

---

## Run the event

1. **Presenter** opens `https://<app>/host` on the projector → **Create session**.
   A QR + 6-char code appear full-screen.
2. **Players** open `https://<app>/join` (or scan the QR), enter the code, pick a
   name. The lobby count ticks up live.
3. Presenter clicks **Start game**:
   - **Word Flash** — flash words/phrases one at a time with **Next/Prev** (no scoring).
   - **Next Q** advances to the next question.
   - **Multiple Choice** — players tap an answer; **faster correct = more points**
     (server-timestamped). **Reveal** shows the answer on the projector.
   - **Leaderboard** shows the running ranking; **Finish** shows the final podium.
4. Refreshing any screen (host or player) rehydrates from the backend — safe mid-game.

### Customizing questions

By default a session seeds a demo deck (one Word Flash + one Multiple Choice). To
supply your own, POST a `questions` array to `/api/session` — see the shapes in
[api/src/questiontypes/](api/src/questiontypes/) (`wordflash`, `multiplechoice`).
Adding a new question **type** = one handler file + one registry line on the backend
and one renderer on the frontend; nothing in the core loop changes.

---

## Local development

Run the whole stack locally without deploying:

```bash
# 1. Backend (needs Cosmos + Web PubSub; pull real ones from Terraform):
./scripts/setup-local.ps1          # writes api/local.settings.json from tf outputs
cd api && npm install && npm start # http://localhost:7071

# 2. Frontend (proxies /api -> :7071):
cd web && npm install && npm run dev   # http://localhost:5173
```

See [api/README.md](api/README.md) and [web/README.md](web/README.md) for the
per-milestone verification checklists.

---

## Teardown (again, because it matters)

```bash
cd infra && terraform destroy
```

Confirm in the Azure Portal that the `rg-guildlive` resource group is gone.

---

## Assumptions

- **No authentication** by design (single trusted presenter, one room). Anyone with
  the session code can issue host controls — acceptable for a live event, not for
  public/multi-tenant use.
- Single environment, single resource group, **local Terraform state** (don't commit
  `terraform.tfstate` — it holds secrets; see [.gitignore](.gitignore)).
- Sized for ~200 concurrent players on 1 Web PubSub unit (10k concurrent connections
  / 1M messages per unit per day — comfortably within budget for a 1-hour event).
