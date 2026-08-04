# Data Admin Security

Local tooling for editing panel/controller JSON. The API binds to `127.0.0.1` only.

## Admin token (`DATA_ADMIN_TOKEN`)

When **`DATA_ADMIN_TOKEN`** is set in the environment for `node server.mjs`:

- `PUT` and `POST` under `/api` require either:
  - `Authorization: Bearer <token>`, or
  - `X-Admin-Token: <token>`
- Unauthenticated mutating requests receive `401`.

When the token is **unset**, the server logs a startup warning and allows localhost callers as before (host binding remains the primary gate).

### UI env var

Set **`VITE_DATA_ADMIN_TOKEN`** to the same value so the Vite UI (`src/api.js`) attaches the token on `apiPut` / `apiPost`. Restart the data-admin process after changing env vars.

Example (PowerShell):

```powershell
$env:DATA_ADMIN_TOKEN = "your-secret"
$env:VITE_DATA_ADMIN_TOKEN = "your-secret"
npm run dev
```

## Other hardening (Phase 5)

- **SSRF**: `checkUrl` allows only `http`/`https`, blocks private/special IPs (including after DNS lookup), prefers `HEAD` then `GET`, discards bodies, and follows redirects manually with re-validation (max 5 hops).
- **Log reads**: `/api/logs/read` only serves paths returned by the changelog/verification list endpoints.
- **Writes**: panel/controller `PUT` bodies are checked against schema field/type rules before disk write.
