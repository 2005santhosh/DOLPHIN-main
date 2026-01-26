# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository layout (big picture)
- `backend/`: Node/Express API + static file server for the frontend.
- `frontend/`: Static HTML/CSS/vanilla-JS dashboards (no bundler).
- Root scripts: `test-dashboards.js` (integration-style checks) and `verify-phases.js` (structure/coverage verification).

## Common commands

### Backend setup
From repo root:
```bash
cd backend
npm install
```

### Run the dev server
From `backend/`:
```bash
npm start
```
Notes:
- `npm start` runs `nodemon server.js` (see `backend/package.json`).
- Default port is `5000` (`backend/server.js`).
- MongoDB connection uses `process.env.MONGO_URI` (see `backend/config/db.js`).

### Open the app
With the server running:
- Landing page: `http://localhost:5000/`
- Dashboards:
  - `http://localhost:5000/dashboard.html` (founder)
  - `http://localhost:5000/investor-dashboard.html` (investor)
  - `http://localhost:5000/provider-dashboard.html` (provider)
  - `http://localhost:5000/admin-dashboard.html` (investor/admin)

### Run tests
This repo does not use Jest/Mocha; tests are implemented as Node scripts.

From repo root:
```bash
node test-dashboards.js
```
What it does (high level):
- Hits a few endpoints on `http://localhost:5000` (expects the backend to be running for the full pass rate).
- Validates dashboard HTML contains `data-require-*` attributes, block message containers, and script references.

#### “Single test” / focused runs
There isn’t a built-in single-test runner. `test-dashboards.js` is a script that calls grouped functions (e.g. `testServerHealth()`, `testAPIEndpoints()`).
- To run a subset, temporarily comment out other groups in `runTests()` in `test-dashboards.js`.

### Verify expected implementation files exist
From repo root:
```bash
node verify-phases.js
```
Note: this script currently expects several docs files that are not present in the repository (it will report failures for them).

### Lint / format
No lint/format command is configured in `backend/package.json` and there is no repo-level tooling config.

## High-level architecture

### Request/response flow (web UI)
1. Express serves static assets from `frontend/` (see `backend/server.js`).
2. Auth flow:
   - `POST /api/auth/register` and `POST /api/auth/login` return a JWT.
   - Frontend stores `token` and `user` in `localStorage` (`frontend/js/app.js`).
3. On page load, the frontend syncs authoritative state from the backend:
   - `StateManager.syncStateWithBackend()` calls `GET /api/auth/profile` with `Authorization: Bearer <token>` (`frontend/js/stateManager.js`, `backend/routes/auth.js`).
4. The UI is then filtered client-side using HTML attributes:
   - `data-require-state`, `data-require-stage`, `data-require-role`, and `data-feature`.
   - `StateManager.renderConditionalUI()` hides/shows/disabled elements accordingly.

### Backend “layers”
- Entry point: `backend/server.js`
  - Security: `helmet` CSP + rate limiting + CORS.
  - Route mounting:
    - `/api/auth` → `backend/routes/auth.js`
    - `/api/founder` → `backend/routes/founder.js`
    - `/api/investor` → `backend/routes/investor.js`
    - `/api/provider` → `backend/routes/provider.js`
    - `/api/admin` → `backend/routes/admin.js`
- Authentication/authorization:
  - API middleware: `backend/middleware/authMiddleware.js` (`protect`, `authorize`).
  - HTML page protection: `backend/middleware/securePage.js` (redirects browsers to `/login.html` when unauthenticated and enforces allowed roles per page).
- Persistence:
  - MongoDB via Mongoose (`backend/config/db.js`).
  - Core models:
    - `User` (`backend/models/User.js`): `role` + `state` + `stage` are the core access-control inputs.
    - `Startup` (`backend/models/Startup.js`): milestone list + `validationScore` drive “stage” progress.

### State/stage gating (the central concept)
This codebase uses **two complementary enforcement points**:
- Backend enforcement (security boundary):
  - API routes use `protect` / `authorize` and additional checks (e.g., state/stage validation).
  - Milestone ordering is enforced when updating milestones (see `backend/routes/startup.js` and `backend/services/milestoneService.js`).
- Frontend enforcement (UX/visibility):
  - `frontend/js/stateManager.js` contains the visibility rules (`initializeVisibilityRules()`) and a `stateConfig` map.
  - Dashboards annotate features with `data-require-*` attributes; the StateManager hides/disables features and can explain why via `getBlockReason()`.

### Where to make changes when adding a new gated feature
Typically you need to touch both sides:
- Backend: add/adjust checks in the relevant route under `backend/routes/` and/or middleware.
- Frontend: add `data-feature`/`data-require-*` annotations in the relevant `frontend/*.html` and update `initializeVisibilityRules()` (if the feature should show a reason/next-steps when blocked).

## Docs that exist in this repo
- `README.md` is the main source of truth for the intended workflow and feature set.
- The repo also contains several “idea validation” docs at the root (e.g., `IDEA_VALIDATION_*.md`, `IMPLEMENTATION_COMPLETE.md`).
