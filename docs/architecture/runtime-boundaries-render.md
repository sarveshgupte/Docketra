# Runtime boundaries on Render

## Goal
Keep Docketra production behavior unchanged while keeping ownership explicit between web and worker runtimes.

## Boundaries

### 1) Frontend build/runtime
- UI is built from `ui/` via `npm --prefix ui run build`
- Render serves the deployed application according to configured service model

### 2) API runtime (Render web service)
- Entrypoint: `npm start` (`src/server.js`)
- Owns request/response API and socket endpoint
- No in-process worker bootstrap from API runtime

### 3) Worker runtime (Render worker service)
- Entrypoint: `npm run start:worker` (`src/worker.js`)
- Owns BullMQ worker startup
- Owns recurring schedules and maintenance jobs in worker bootstrap/runtime

## Scheduler ownership (Render)

| Task | Owner runtime | Trigger mechanism |
|---|---|---|
| Temp upload cleanup | Worker | Worker interval scheduling |
| Storage health checks | Worker | Worker interval scheduling |
| Nightly storage backups | Worker | Worker schedule service |
| Storage integrity scheduling | Worker | Queue repeat registration in worker bootstrap |
| Auto reopen / metrics jobs | Worker | Worker runtime jobs/schedulers |

## Constraints
- Keep API and worker as separate Render services to avoid duplicate worker startup.
- Keep one ownership model only (Render worker) for schedules.
