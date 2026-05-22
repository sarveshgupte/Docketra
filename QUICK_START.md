# Quick Start Guide

Get Docketra running locally in under 10 minutes.

## Prerequisites

- **Node.js 20.x (LTS)**
- **npm 10+**
- **MongoDB** — local instance or container
- **Redis** — optional locally; required in production

## Installation Steps

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd docketra
npm install
npm --prefix ui install
```

### 2. Configure backend environment

```bash
cp .env.example .env
```

Minimum variables for local development (edit `.env`):

```dotenv
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/docketra
JWT_SECRET=<at least 32 random characters>
SUPERADMIN_XID=X000001
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD_HASH=<bcrypt hash>
SUPERADMIN_OBJECT_ID=000000000000000000000001
ENCRYPTION_PROVIDER=disabled
REDIS_URL=
```

Leave `REDIS_URL` blank locally. The backend uses an in-memory fallback for idempotency and single-process rate limiting. See `.env.example` for the full variable list.

### 3. Configure frontend environment

```bash
cp ui/.env.example ui/.env
```

The default `ui/.env.example` already points to `http://localhost:5000/api`. No edits needed unless your backend runs on a different port.

### 4. Start MongoDB

**Option A: Local service**
```bash
sudo service mongod start
```

**Option B: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Start backend and frontend

In separate terminals:

```bash
# Terminal 1 — backend API (port 5000)
npm run dev

# Terminal 2 — background worker (optional locally)
npm run start:worker

# Terminal 3 — frontend app (port 5173)
npm --prefix ui run dev
```

### 6. Verify

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "message": "Docketra API is running",
  "environment": "development"
}
```

Open the frontend at `http://localhost:5173`. Log in with your superadmin credentials or create a firm workspace through the superadmin dashboard at `/superadmin/login`.

## Project structure

```
docketra/
├── src/               # Backend API (Node.js + Express)
│   ├── config/        # DB config, env validation
│   ├── controllers/   # Route handlers
│   ├── middleware/     # Auth, rate limiting, request IDs
│   ├── models/        # Mongoose schemas
│   ├── routes/        # API route definitions
│   ├── services/      # Business logic
│   └── server.js      # API entry point
├── ui/                # Frontend (React + Vite)
│   └── src/           # React source
├── tests/             # Backend tests
├── .env.example       # Backend environment template
├── package.json       # Backend dependencies and scripts
└── README.md          # Project overview
```

## Available scripts

### Backend

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start backend with auto-restart (nodemon) |
| `npm start` | Start backend (production) |
| `npm run start:worker` | Start background worker |
| `npm run lint` | Check backend JS syntax |
| `npm run validate:env` | Validate environment variables |
| `npm run test:pure` | Run backend tests (no DB/Redis required) |
| `npm run ci:release-gate` | Full local CI check |

### Frontend

| Command | Purpose |
|---------|---------|
| `npm --prefix ui run dev` | Start frontend dev server |
| `npm --prefix ui run build` | Build frontend for production |
| `npm --prefix ui run test:ci` | Run frontend test suite |

## Common issues

### MongoDB connection error

- Verify MongoDB is running: `sudo service mongod status`
- Use `127.0.0.1` instead of `localhost` in `MONGO_URI` if DNS resolution is slow.

### Port already in use

- Backend defaults to port **5000** (not 3000). Change `PORT` in `.env` if needed.
- Frontend defaults to port 5173 (Vite default).

### Module not found

```bash
rm -rf node_modules ui/node_modules
npm install
npm --prefix ui install
```

## Next steps

- [README.md](README.md) — project overview, architecture, security model
- [docs/README.md](docs/README.md) — full documentation index
- [docs/local-development.md](docs/local-development.md) — Windows/Docker notes
- [docs/testing/local-testing.md](docs/testing/local-testing.md) — testing guide
- [docs/deployment/render-deployment.md](docs/deployment/render-deployment.md) — production deploy on Render
- [DEPLOYMENT.md](DEPLOYMENT.md) — deployment guide
