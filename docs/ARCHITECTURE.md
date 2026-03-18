# Disavow Tool — Architecture & Design

## 1. Recommended architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React SPA (Vite) — Firebase Auth client, Axios → API           │
│  shadcn/ui + Tailwind — light default; add class "dark" on <html> for dark   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS / JSON + multipart
┌───────────────────────────────▼─────────────────────────────────┐
│  Express API — Firebase Admin (ID token verify)                  │
│  Middleware: auth → workspace membership → route handlers          │
│  Services: import, aggregate, heuristics, classify, disavow        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  MongoDB (Mongoose) — workspaces, domains, rows, rules, exports   │
└─────────────────────────────────────────────────────────────────┘
```

- **Separation**: `client/` and `server/` own dependencies and env.
- **Auth**: Browser obtains Firebase ID token; every API call sends `Authorization: Bearer <token>`. Server verifies with Firebase Admin and loads/creates `User` + checks `WorkspaceMember`.
- **Multi-tenancy**: All domain data keyed by `workspaceId`; managed assets keyed by `managedDomainId` + `workspaceId`.
- **Extensibility**: Heuristics as pluggable scorers; CSV mapping in one module; disavow builder as pure function + persistence layer.

**Tradeoffs**

| Choice | Pro | Con |
|--------|-----|-----|
| Store raw + normalized rows | Auditable, re-aggregate if heuristics change | Larger DB; mitigated with indexes + optional TTL later |
| One `SourceDomainAnalysis` per (managedDomain, root) | Fast UI reads | Recompute on new upload (batch or async job); start sync, move to queue later |
| Rules in one collection with nullable `managedDomainId` | Simple queries; clear override (MD-specific whitelist beats workspace blacklist) | Complex rules need clear resolver order (documented below) |

---

## 2. MongoDB schema design

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | Mirror Firebase users (uid, email, displayName) |
| `workspaces` | Team/company container |
| `workspace_members` | userId + workspaceId + role |
| `managed_domains` | Site/project under a workspace |
| `backlink_uploads` | CSV metadata per managed domain |
| `backlink_rows` | Parsed rows (normalized + raw subset) |
| `source_domain_analyses` | Aggregates + heuristic recommendation per root domain per managed domain |
| `classification_rules` | Workspace-wide or per–managed-domain domain/URL decisions |
| `generated_disavows` | Saved disavow.txt snapshots |

### Key fields & relationships

- **users**: `firebaseUid` (unique), `email`, `displayName`, `createdAt`
- **workspaces**: `name`, `createdBy` (userId), `createdAt`
- **workspace_members**: `workspaceId`, `userId`, `role` (`owner` | `admin` | `member`), unique compound `(workspaceId, userId)`
- **managed_domains**: `workspaceId`, `domainName` (normalized root), `displayName`, `notes`, `createdBy`, `createdAt`
- **backlink_uploads**: `managedDomainId`, `workspaceId`, `filename`, `uploadedBy`, `uploadedAt`, `rowCount`, `duplicateCount`, `status`
- **backlink_rows**: `uploadId`, `managedDomainId`, `workspaceId`, `sourceRootDomain`, normalized SEMrush fields, `rawRow` (object), dedupe hash `(uploadId, sourceUrl, targetUrl, anchor)` optional
- **source_domain_analyses**: `managedDomainId`, `workspaceId`, `sourceRootDomain`, aggregates (counts, min/max ascore, dates), `recommendation` `{ score, level, flags[], heuristicVersion }`, `userApprovedForDisavow` (boolean, for “approved recommendations only” path)
- **classification_rules**:  
  - `workspaceId`  
  - `managedDomainId` — `null` = workspace default for all managed domains under workspace  
  - `entityType`: `source_domain` | `source_url`  
  - `value`: normalized domain or full URL string  
  - `decision`: `whitelist` | `blacklist` | `needs_review` | `ignore`  
  - `notes`, `createdBy`, `updatedAt`  
  - **Override**: Same `sourceRootDomain` with `managedDomainId` set + `whitelist` overrides workspace `blacklist` for disavow for that managed domain only.
- **generated_disavows**: `managedDomainId`, `workspaceId`, `content`, `lineCount`, `createdBy`, `createdAt`, `includeApprovedRecommendationsSnapshot`

### Indexes

- `users`: `{ firebaseUid: 1 }` unique  
- `workspace_members`: `{ workspaceId: 1, userId: 1 }` unique; `{ userId: 1 }`  
- `managed_domains`: `{ workspaceId: 1, domainName: 1 }` unique  
- `backlink_uploads`: `{ managedDomainId: 1, uploadedAt: -1 }`  
- `backlink_rows`: `{ managedDomainId: 1, sourceRootDomain: 1 }`; `{ uploadId: 1 }`  
- `source_domain_analyses`: `{ managedDomainId: 1, sourceRootDomain: 1 }` unique  
- `classification_rules`: `{ workspaceId: 1, managedDomainId: 1, entityType: 1, value: 1 }` (sparse on managedDomainId for workspace rules)  
- `generated_disavows`: `{ managedDomainId: 1, createdAt: -1 }`

### Disavow resolution order (per managed domain)

1. Collect **blacklist** entries: workspace domain/URL rules + MD-specific blacklists + **user-approved** analysis flags.
2. **CSV scope**: keep only domains and source URLs that appear in `backlink_rows` for this managed domain (workspace blacklists alone do not add lines for referrers that never appeared in this property’s upload).
3. Subtract: **whitelist** at MD level for that domain/URL (overrides workspace blacklist) — applied while resolving effective decisions before collection.
4. **Documented default**:  
   - Effective decision = max-specific rule wins: **managedDomainId-specific rule** > **workspace rule** for same entity.  
   - For same scope, later `updatedAt` wins or explicit priority field later.

---

## 3. API route design

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Public |
| POST | `/api/auth/bootstrap` | Verify token; upsert user; optional default workspace |
| GET | `/api/workspaces` | List workspaces for user |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces/:workspaceId` | Workspace detail |
| GET | `/api/workspaces/:workspaceId/members` | List members |
| POST | `/api/workspaces/:workspaceId/members` | Invite/add (by email — future) |
| CRUD | `/api/workspaces/:workspaceId/managed-domains` | Managed domains |
| POST | `/api/workspaces/:workspaceId/managed-domains/:domainId/uploads` | Multipart CSV upload |
| GET | `/api/.../managed-domains/:domainId/uploads` | Upload history |
| GET | `/api/.../managed-domains/:domainId/rows` | Paginated backlink rows (filters) |
| GET | `/api/.../managed-domains/:domainId/source-domains` | Aggregated analysis list |
| GET | `/api/.../managed-domains/:domainId/source-domains/:root` | Drill-in URLs/anchors |
| CRUD | `/api/workspaces/:workspaceId/classifications` | Workspace rules |
| CRUD | `/api/.../managed-domains/:domainId/classifications` | MD overrides + manual entries |
| POST | `/api/.../managed-domains/:domainId/disavow/preview` | Build text (no persist) |
| POST | `/api/.../managed-domains/:domainId/disavow/export` | Save + return file |
| GET | `/api/.../managed-domains/:domainId/disavows` | History |
| POST | `/api/.../managed-domains/:domainId/analysis/recompute` | Re-run aggregates (optional) |

All `/api/workspaces/...` routes (except create/list if scoped) require workspace membership middleware.

---

## 4. Frontend page/component design

| Route | Screen |
|-------|--------|
| `/login` | Firebase email/password or Google (configurable) |
| `/` | Redirect to last workspace or workspace list |
| `/w/:workspaceId` | Dashboard (stats, quick links) |
| `/w/:workspaceId/domains` | Managed domains table |
| `/w/:workspaceId/domains/:domainId` | Detail: summary cards, uploads, tabs: Source domains / Review queue / Disavow |
| `/w/:workspaceId/domains/:domainId/upload` | CSV upload |
| `/w/:workspaceId/rules` | Shared workspace classifications |
| Layout | `AppShell`: sidebar (workspace switcher, nav), header (search, user menu), `<Outlet />` |

**Components**: `SourceDomainTable`, `ClassificationDialog`, `DisavowPreview`, `UploadDropzone`, `SummaryCards`, `FilterBar`, `BulkActionBar`.

---

## 5. Phased implementation plan

| Phase | Deliverable |
|-------|-------------|
| **1** | This doc + folder layout + env examples |
| **2** | Express app, Firebase middleware, Mongoose models, CSV import pipeline |
| **3** | Aggregation job, heuristic module, classification CRUD, disavow builder |
| **4** | React app, shadcn shell, flows for upload → review → export |
| **5** | Validation, edge cases, seed script, README runbook |

---

## SEMrush column mapping

| CSV header | Internal key |
|------------|--------------|
| Page ascore | pageAscore |
| Source title | sourceTitle |
| Source url | sourceUrl |
| Target url | targetUrl |
| Anchor | anchor |
| External links | externalLinks |
| Internal links | internalLinks |
| Nofollow / Sponsored / Ugc / Text / Frame / Form / Image / Sitewide / New link / Lost link | booleans |
| First seen / Last seen | dates |

Root domain from `Source url` (or Agency **Link**) via `URL` + eTLD+1 (`tldts`).

### Upload formats

- **CSV** (UTF-8), or **Excel** `.xlsx` / `.xls` — **first worksheet only**; row 1 = headers (same names as below).

### Agency Analytics export

| CSV header | Internal key |
|------------|--------------|
| Link | sourceUrl (referring page) |
| Anchor Text | anchor |
| Trust Flow | drives `pageAscore` when Page ascore absent: **TF &lt; 10** → compressed low scores (flagged as weak); **TF ≥ 10** → scaled so typical rows clear low-authority noise |
| Citation Flow | stored in `rawRow` |

If **Target url** is missing and anchor looks like a URL, it is used as target for deduplication.
