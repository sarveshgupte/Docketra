# Local Development

This guide is for running Docketra on a developer machine, including Windows setups where Docker or local Redis may not be installed.

## Environment Files

- Root `.env` is for the backend API in `src/`.
- `ui/.env` is for the Vite frontend in `ui/`.
- Frontend variables must start with `VITE_` because they are bundled into the browser app.

For local frontend-to-backend calls, use:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
```

## Backend Minimum

Create the root backend env file:

```powershell
Copy-Item .env.example .env
```

Use local development values similar to:

```dotenv
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/docketra
ENCRYPTION_PROVIDER=disabled
REDIS_URL=
```

`REDIS_URL` may be left blank in `development` and `test`. The backend will use an in-memory idempotency store so local firm login and other idempotent writes are not blocked by Redis.

## Optional Local Redis

If Redis is installed locally, set:

```dotenv
REDIS_URL=redis://localhost:6379
```

When Redis connects successfully, the backend uses Redis-backed idempotency and Redis-backed rate-limit stores as before. If Redis is absent or unreachable in local development, the backend falls back to memory for idempotency instead of failing auth login init.

## Production Rule

Production is strict:

```dotenv
NODE_ENV=production
REDIS_URL=rediss://...
```

`REDIS_URL` is required in production and must be a valid `redis://` or `rediss://` URL. Startup/config validation fails before serving traffic if it is missing, blank, or invalid. Do not use the development memory fallback in production.

## Start Locally

Install dependencies:

```powershell
npm install
npm --prefix ui install
```

Start the backend:

```powershell
npm run dev
```

Start the frontend in a second terminal:

```powershell
npm --prefix ui run dev
```
