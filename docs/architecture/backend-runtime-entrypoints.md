# Backend Runtime Entrypoints

## Overview

The backend runtime is now split into explicit layers so the Express app can be imported safely in tests and diagnostics without starting network listeners or external services.

## 1) App creation (`src/app/createApp.js`)

`createApp()` is responsible for HTTP composition only:

- environment validation and runtime metadata logging;
- Express instance creation;
- middleware registration (security headers, CORS, parsing, request context, rate limits);
- health/metrics endpoints;
- API route mounting;
- terminal not-found and error middleware.

`createApp()` **does not**:

- connect to MongoDB;
- run bootstrap jobs;
- initialize socket server listeners;
- call `app.listen(...)`.

This makes backend app assembly import-safe for smoke/unit tests.

## 2) Server startup (`src/runtime/startServer.js`)

`startServer()` handles operational startup responsibilities:

1. Build app via `createApp()`.
2. Connect to Mongo (`connectDB`).
3. Run startup bootstrap (`runBootstrap`).
4. Start HTTP listener (`app.listen`).
5. Initialize notification socket using app-configured origins.
6. Register unhandled rejection shutdown behavior.

This keeps production startup behavior intact while isolating concerns from request pipeline setup.

## 3) Process entrypoint (`src/server.js`)

`src/server.js` remains the executable backend entrypoint and now only invokes `startServer()` with fail-fast logging.

This preserves existing deployment behavior for:

- `npm start` (`node src/server.js`)
- `npm run dev` (`nodemon src/server.js`)
- root `server.js` shim requiring `src/server.js`

## 4) Worker startup boundaries

Background/worker startup remains outside `createApp()` and is handled by runtime/bootstrap layers (`runBootstrap` and worker-specific scripts such as `src/worker.js` / `npm run start:worker`).

This ensures:

- web app imports do not start workers;
- HTTP runtime and worker runtime can evolve/deploy independently;
- test environments avoid accidental production service side effects.
