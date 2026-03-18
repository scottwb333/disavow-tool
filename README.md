# Disavow Tool

Full-stack workspace for SEMrush backlink CSV review and Google `disavow.txt` generation. **JavaScript only** (React + Express + MongoDB + Firebase Auth).

## Documentation

- **[Architecture, schema, API, UI plan](./docs/ARCHITECTURE.md)** — design reference

## Prerequisites

- Node 18+
- MongoDB
- Firebase project (Authentication + Admin service account)

## Quick start

### 1. Firebase

1. Create a Firebase project, enable **Email/Password** (and optionally Google) sign-in.
2. Project settings → Service accounts → **Generate new private key** → JSON file.
3. Client: Web app config → `apiKey`, `authDomain`, `projectId`.

### 2. Server

```bash
cd server
cp .env.example .env
# Set MONGODB_URI and FIREBASE_SERVICE_ACCOUNT_JSON (entire JSON as one line, or use jq -c)
npm install
npm run dev
```

`FIREBASE_SERVICE_ACCOUNT_JSON` example:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON=$(jq -c . /path/to/serviceAccount.json)
```

### 3. Client

```bash
cd client
cp .env.example .env.local
# VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
npm install
npm run dev
```

Open `http://localhost:3005` — API is proxied to `:4000`.

## Project layout

```
client/          # Vite + React + shadcn-style UI
server/          # Express + Mongoose + Firebase Admin
docs/            # ARCHITECTURE.md
```

## API summary

| Area | Base path |
|------|-----------|
| Bootstrap | `POST /api/auth/bootstrap` |
| Workspaces | `/api/workspaces` |
| Domains | `/api/workspaces/:id/managed-domains` |
| CSV | `POST .../uploads-sync` (multipart `file`) |
| Source domains | `GET .../source-domains` |
| Classifications | `/api/workspaces/:id/classifications` |
| Disavow | `POST .../disavow/preview` · `export` |

All protected routes require `Authorization: Bearer <Firebase ID token>`.

## Product logic (short)

- **Workspace rules** (`managedDomainId: null`): shared blacklist/whitelist across all managed domains.
- **Managed-domain rules**: override workspace (e.g. whitelist on one site excludes that domain from disavow even if workspace-blacklisted).
- **Disavow file**: only **blacklist** decisions + optional **user-approved** analysis flags — never auto-disavow from heuristics alone.

## Recent additions

- **Workspace invites**: `POST/GET/DELETE .../workspaces/:id/invites` — share link `/invite/:token` (14-day expiry). Accept at `POST /api/invites/:token/accept` (must sign in with invited email). Login supports `?next=/invite/...`
- **Alert dialogs** for remove member, revoke invite, delete domain (replaces `window.confirm`)
- **Streaming CSV import**, bulk classify, theme toggle, role-based deletes, etc.

## Invites (quick flow)

1. Owner/admin: Team → **Create invite** → copy link (or use **Pending invites** → Copy link).
2. Invitee: open link → **Sign in** (Firebase email must match invite) → **Accept invite**.
3. **Add existing user** still available if they already have an account.

## Phased delivery status

| Phase | Status |
|-------|--------|
| 1 Plan | ✅ `docs/ARCHITECTURE.md` |
| 2 Backend + CSV | ✅ |
| 3 Analysis + rules + disavow | ✅ |
| 4 Frontend | ✅ core flows |
| 5 Polish | Ongoing — true streaming CSV, tests |

## Tradeoffs

- **CSV**: Sync upload loads file in memory; for very large exports, switch to streaming import (queue job).
- **Source domain list**: Capped at 500 per sort/filter; add pagination for huge profiles.
- **Heuristics**: Versioned in code (`heuristics.js`); store `heuristicVersion` on analyses for future recomputation.
