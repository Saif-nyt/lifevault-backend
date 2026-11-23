# LifeVault — Backend API

Express 5 + MongoDB REST API for LifeVault, a private personal life archive. Plain JavaScript, JWT cookie authentication, Mongoose models and Cloudinary uploads.

The frontend (`../lifevault-frontend`) is a separate Next.js app that talks to this API under `/api/v1`. All business logic lives here.

> Full project documentation (features, complete API reference, data model, deployment): [`../README.md`](../README.md)

---

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | Node.js 20+ (developed on Node 26), CommonJS |
| Framework | Express 5 |
| Database | MongoDB 6+ / MongoDB Atlas via Mongoose 8 |
| Auth | JWT in an HTTP-only cookie, `bcryptjs` (12 rounds) |
| Validation | Zod schemas per endpoint |
| Uploads | Multer (memory) → Cloudinary |
| Hardening | Helmet, CORS allowlist, Origin/Referer check, rate limiting |
| Tests | `node:test` + Supertest + `mongodb-memory-server` |

## Quick start

```bash
npm install
cp .env.example .env       # fill in MONGODB_URI and JWT_SECRET
npm run db:init            # verify the connection, build indexes
npm run dev                # nodemon
# or: npm start
```

Health check:

```bash
curl http://localhost:5000/api/v1/health
# {"success":true,"data":{"status":"ok","timestamp":"..."}}
```

The process refuses to boot without `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters.

### Database setup

`npm run db:init` connects with the configured URI, verifies it names a real database (and refuses `test`), builds every Mongoose index and prints collection counts. Accounts and their ten default categories are created by `POST /auth/register`; no seed data is shipped.

To use MongoDB Atlas:

1. Create a cluster and database user, then allow your host's IP in Network Access.
2. Copy the SRV string and **append a database name** — `...mongodb.net/lifevault?retryWrites=true&w=majority`. Atlas URIs without a path silently use `test`, which may be shared with other projects.
3. Set `MONGODB_URI` in `.env`, then run `npm run db:init`.

> **macOS note:** AirPlay listens on port 5000. If `curl localhost:5000` answers with `Server: AirTunes`, set `PORT=5001` here and `NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1` in the frontend `.env.local`.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | Listen port. |
| `NODE_ENV` | no | `development` | `development`, `test` or `production`; controls secure cookies and CORS behavior. |
| `MONGODB_URI` | **yes** | — | Local URI or Atlas SRV string. Always include a database name — Atlas strings without a path connect to `test`. |
| `JWT_SECRET` | **yes** | — | 32+ random characters (`openssl rand -hex 32`). |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime; keep aligned with the cookie max-age. |
| `FRONTEND_URL` | **yes** in practice | `http://localhost:3000` | Primary allowed CORS origin; set it to the deployed frontend. |
| `EXTRA_ORIGINS` | no | empty | Comma-separated additional origins (previews). |
| `CLOUDINARY_CLOUD_NAME` | for uploads | — | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | for uploads | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | for uploads | — | Cloudinary API secret. |
| `GOOGLE_WEB_CLIENT_ID` | for Google sign-in | — | OAuth 2.0 web client ID. |
| `GOOGLE_ANDROID_CLIENT_ID` | for Google sign-in (Android) | — | OAuth 2.0 Android client ID. |

`COOKIE_SECRET` appears in some docs for parity with the original brief but is not used — the cookie carries a JWT signed with `JWT_SECRET`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Nodemon with reload. |
| `npm run db:init` | Connect to `MONGODB_URI`, build all indexes, print collection counts. Safe to re-run. |
| `npm start` | Plain `node src/server.js`. |
| `npm test` | Integration suite on an in-memory MongoDB. |

## Architecture

```
server.js        connect DB → listen → graceful shutdown
app.js           express app (testable, no listen): helmet, cors, cookie-parser,
                 origin check, rate limit, /api/v1 routes, error mapping
routes/          endpoint declarations + middleware wiring
controllers/     HTTP → service, response shaping
services/        business logic: ownership scoping, metadata validation,
                 reminder sync, aggregation
models/          Mongoose schemas + indexes
middleware/      auth, csrf, rateLimit, validate, error
validators/      Zod request schemas
utils/           ApiError, asyncHandler, http helpers, token signing
```

```
src/
├── config/          # env schema, Mongo connection, defaults
├── controllers/     # auth, archive, category, tag, collection, reminder, upload, dashboard
├── middleware/
├── models/          # User, Archive, Category, Tag, Collection, Reminder, Upload
├── routes/
├── services/
├── utils/
├── validators/schemas.js
├── app.js
└── server.js
tests/integration.test.js
```

## API overview

Base path `/api/v1`. JSON everywhere except uploads (`multipart/form-data`).

Envelope:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 12, "total": 0, "totalPages": 1, "hasMore": false } }
{ "success": false, "message": "Validation failed", "details": [{ "field": "title", "message": "Title is required" }] }
```

| Group | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/password` |
| Archives | `POST/GET /archives`, `GET/PATCH/DELETE /archives/:id`, `PATCH /archives/:id/favorite`, `GET /archives/timeline` |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Tags | `GET/POST /tags`, `DELETE /tags/:id` |
| Collections | `GET/POST /collections`, `GET/PATCH/DELETE /collections/:id`, `POST /collections/:id/items`, `DELETE /collections/:id/items/:itemId` |
| Reminders | `GET/POST /reminders`, `PATCH/DELETE /reminders/:id` |
| Uploads | `POST /uploads`, `DELETE /uploads/:id` |
| Dashboard | `GET /dashboard/stats`, `/recent`, `/favorites`, `/upcoming-reminders`, `/rediscover` |

Archives accept ten types (`note`, `link`, `memory`, `video`, `image`, `document`, `book`, `movie`, `idea`, `event`) with per-type metadata validation. List queries support `page`, `limit`, `q`, `type`, `category`, `tag`, `favorite`, `from`, `to`, `sort`. Timeline adds `year`, `month`, `dateField`. See the root README for request/response examples and the exact metadata schema per type.

Status codes: `400` validation, `401` unauthenticated, `403` rejected origin, `404` not found/not owned, `409` duplicate, `429` rate limited, `500` unexpected, `503` storage not configured.

## Data model

| Model | Key fields |
| --- | --- |
| `User` | `name`, unique `email`, `passwordHash` (`select: false`), `avatar`, `bio`, timestamps |
| `Archive` | `user`, `title`, `description`, `content`, `type`, `category`, `tags[]`, `tagNames[]`, `sourceUrl`, `attachments[]`, `isFavorite`, `reminderAt`, `metadata`, timestamps |
| `Category` | `user`, `name`, `nameKey`, `color`, `isDefault`; unique per user + `nameKey` |
| `Tag` | `user`, `name`, `nameKey`; unique per user + `nameKey` |
| `Collection` | `user`, `name`, `nameKey`, `description`, `color`, `items[] → Archive` |
| `Reminder` | `user`, `archive?`, `source` (`manual`/`archive`), `title`, `note`, `remindAt`, `completed`, `completedAt` |
| `Upload` | `user`, `url`, `publicId`, `resourceType`, `format`, `bytes`, `originalName` |

Every new user receives ten default categories. Deleting a category uncategorises its items; deleting a collection keeps its items; deleting an archive removes its linked reminder and pulls it from all collections.

## Security

- `bcryptjs` hashing at 12 rounds; `passwordHash` is never serialised.
- JWT signed with `JWT_SECRET`; only `{ sub }` is stored and verified on every protected request.
- Cookie `lifevault_token`: `httpOnly`, `path=/`, 7-day max-age; `SameSite=Lax` in development and `SameSite=None; Secure` in production. `trust proxy` is enabled in production.
- CORS allowlist from `FRONTEND_URL` + `EXTRA_ORIGINS`, credentials enabled.
- CSRF defence: cookie-authenticated state-changing requests must carry an allowlisted `Origin`/`Referer`.
- Helmet headers, `x-powered-by` disabled.
- Rate limits: 600 requests / 15 min per IP overall; 30 / 15 min on login and registration.
- Zod validation on every body and query; strict Mongoose schemas and enums.
- Ownership is enforced in every query from the session user — another user's id returns `404`.
- Uploads: MIME + 10 MB limit, memory storage, streamed to Cloudinary.

## Testing

```bash
npm test
```

The suite boots a real in-memory MongoDB (`mongodb-memory-server`) and drives the API with Supertest — no external services or credentials required. Current result: **21 of 21 passing**, covering auth, protected routes, archive CRUD, metadata validation, search/filter, ownership isolation, categories, collections, reminders, timeline, dashboard aggregation, upload validation, the unconfigured-storage `503` path, cascade cleanup and logout.

Not automated: real Cloudinary uploads (credentials required), MongoDB Atlas connectivity and long-lived session expiry.

## Deployment

Render / Railway / Fly / any Node host works.

- Root directory: `lifevault-backend`. Install `npm install`, start `npm start`.
- Environment: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (fresh random value), `FRONTEND_URL=https://your-frontend`, optional `EXTRA_ORIGINS`, and the three `CLOUDINARY_*` values for uploads.
- Leave `PORT` unset — the platform injects it.
- Health check path: `/api/v1/health`.
- After the first deploy (or when rotating databases), run `npm run db:init` once from the host shell to build indexes.
- Terminate TLS at the host: production cookies are `Secure`, so both the API and the frontend must be HTTPS.

For MongoDB Atlas, add the host IP (or `0.0.0.0/0` for a demo) to Network Access and append a database name to the SRV string.

## Known limitations

- Uploads need Cloudinary; without credentials `POST /uploads` returns a deliberate `503`.
- Reminders are stored data only — no scheduler, email, push or SMS delivery.
- No refresh-token rotation: one 7-day JWT, reissued on login.
- Search is regex-based over indexed fields plus a Mongo text index; there is no relevance ranking.
- No real-time transport (websockets/SSE); clients refresh on navigation/action.
- Single-user ownership only — no sharing, teams or public links.
- No password reset or email verification flow.
- No caching layer; MongoDB is queried directly per request.

## License

ISC.
