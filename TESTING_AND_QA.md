# Dolphin Platform — Testing & QA Guide

## 1. Application Feature Map

| Area | Features |
|---|---|
| Auth | Register (OTP), Login, Logout, Forgot/Reset Password, Profile update, Password change, Account delete, Profile picture upload |
| Founder | Startup CRUD, 5-stage Gemini AI validation, Milestone tasks, Roadmap tasks, Investors/Providers discovery, Send connection requests, Chat |
| Investor | Validated startups listing, Watchlist, Express interest, Requests, Chat |
| Provider | Profile, Eligible founders, Send request, Manage requests, Chat |
| Admin | User approval/rejection/block, Stage advancement, Task approval/rejection, Provider verification |
| Posts | Create (text + media), Feed (role-based), Like, View count, Delete, Reels viewer |
| Connections | Send request, Accept/Reject (Connection + IntroRequest models), Chat with connected users |
| Gamification | Streaks, Reward milestones (30/60/90 days), Leaderboard (per role), Points, Claim reward |
| Verification | Cashfree payment flow, Webhook, Badge expiry, Invoice email, 2-day reminder |
| Notifications | In-app, mark read, clear all |
| Chat | Real-time via Socket.io, conversations list, message history, polling fallback |
| Payments | Cashfree order create, session-based checkout, webhook idempotency, receipt email |

---

## 2. Run Tests

### Integration tests (requires server running)
```bash
# Local (server on port 8080)
cd backend && npm test

# Against production
cd backend && npm run test:prod
```

### Frontend build verification
```bash
cd frontend-react && npm run build
```

### Manual smoke test (after deployment)
```bash
curl https://api.dolphinorg.in/api/health
curl https://api.dolphinorg.in/api/ready
```

---

## 3. Fixes Implemented (this QA cycle)

| # | Issue | Severity | File(s) Changed |
|---|---|---|---|
| 1 | `req.user.id` undefined — `.lean()` objects have no Mongoose virtual `.id` | CRITICAL | `authMiddleware.js` |
| 2 | `mongoose` used before `require` — server crash on startup | CRITICAL | `server.js` |
| 3 | `admin.js` premature `module.exports` — half the admin routes unreachable | HIGH | `routes/admin.js` |
| 4 | Register: no email format validation | HIGH | `routes/auth.js` |
| 5 | `send-verification-email` endpoint never actually sent the email | HIGH | `routes/auth.js` |
| 6 | `verify-email` doesn't lowercase email — case mismatch fails lookup | HIGH | `routes/auth.js` |
| 7 | `DELETE /api/auth/account` doesn't clean up `Connection` docs or posts | MEDIUM | `routes/auth.js` |
| 8 | `PUT /api/auth/password` used `bcrypt.genSalt(10)` vs register's `12` | MEDIUM | `routes/auth.js` |
| 9 | Post creation: no content length validation beyond global 2mb body limit | MEDIUM | `routes/posts.js` |
| 10 | Auth middleware cache never invalidated on admin block | LOW | noted — cache TTL is 60s |

---

## 4. Manual Test Checklist

### Auth flows
- [ ] Register with valid data → OTP email arrives → verify OTP → lands on dashboard
- [ ] Register with invalid email format → friendly error shown
- [ ] Register with password < 8 chars → friendly error shown
- [ ] Register duplicate email → "email already in use" error
- [ ] Register as `admin` role → blocked
- [ ] Login with correct credentials → dashboard loads
- [ ] Login with wrong password → "Invalid email or password"
- [ ] Login unverified account → resends OTP, shows verification screen
- [ ] Logout → token cleared, redirect to /login
- [ ] Forgot password flow → email arrives → reset link works → can login with new password
- [ ] Session persists on page refresh (no flash to login)
- [ ] Open dashboard URL when not logged in → redirect to /login
- [ ] Open /dashboard as investor → redirect to /investor-dashboard

### Founder dashboard
- [ ] Dashboard shows correct startup name and validation progress
- [ ] Validation stages show correct status (Locked / Not Started / Validated)
- [ ] All 5 stages appear correctly
- [ ] Reward Points shows correct value
- [ ] Navigate to Stages page → answer questions → Gemini scores and shows result
- [ ] Complete a stage → stage unlocks next one

### Investor dashboard
- [ ] Validated startups list loads (70%+ score)
- [ ] Verified founders show "Featured" badge
- [ ] Send request to a founder → shows "Pending"
- [ ] Accept an incoming request → shows "Connected", updates leaderboard

### Provider dashboard
- [ ] Eligible founders list loads
- [ ] Send request to a startup → shows in founder's incoming requests
- [ ] Founder accepts → both parties get points in gamification

### Gamification
- [ ] Streak tab shows current streak, best streak, days active
- [ ] Posts / Connections / Points numbers are accurate (not 0)
- [ ] Leaderboard tab shows correct ranked list
- [ ] My rank banner shows correct rank
- [ ] Connection accepted → leaderboard updates immediately (no page reload)
- [ ] Prize announcement banner shows (before June 30, 2026)

### Verification / Payment
- [ ] Unverified user sees "Get Verified – ₹99/month" button
- [ ] Verified promo popup shows on dashboard open (session-once behavior)
- [ ] Payment flow opens Cashfree checkout
- [ ] After successful payment → badge appears immediately
- [ ] Verified badge shows on profile image (Header)
- [ ] Verified badge shows on post author name
- [ ] Verified badge shows on request cards
- [ ] Verified user no longer sees "Get Verified" CTA

### Posts / Feed
- [ ] Post with text only → creates successfully
- [ ] Post with image/video → uploads to Cloudinary, appears in feed
- [ ] Feed shows role-appropriate content (founder sees investor posts, etc.)
- [ ] Like/unlike toggles correctly
- [ ] Delete own post → post removed
- [ ] Cannot delete other user's post

### Chat
- [ ] Connected users appear in chat list
- [ ] Send message → appears immediately (optimistic)
- [ ] Recipient receives message (polling/socket)
- [ ] Long messages display correctly
- [ ] Small text is readable (≥16px on mobile, ≥14px desktop)
- [ ] Back button works on mobile

### Admin
- [ ] All admin routes respond (not 404) — regression for module.exports bug
- [ ] Approve user → user can now login and access platform
- [ ] Block user → blocked user gets 403 on next request
- [ ] Task approval updates validation score

---

## 5. Regression Checklist (run after every deploy)

### Smoke (30 seconds)
```bash
curl https://api.dolphinorg.in/api/health     # → {"status":"ok"}
curl https://api.dolphinorg.in/api/ready      # → {"status":"ready"}
curl https://api.dolphinorg.in/api/auth/profile  # → 401 (not 500, not 404)
```

### API integration (2 minutes)
```bash
cd backend && npm run test:prod
```

### Frontend
- [ ] `npm run build` passes with 0 errors
- [ ] Login page loads at `https://www.dolphinorg.in/login`
- [ ] Dashboard loads after login
- [ ] Browser console shows `🐬 Dolphin v{version}` (verifies correct build deployed)

---

## 6. Production Monitoring

### Current observability
- Request timing: every API request logs `[INFO/SLOW/ERROR] METHOD /path → STATUS | Xms`
- Slow requests (>500ms) logged as `[SLOW]`
- Errors logged as `[ERROR]` with method + path
- Health endpoint: `GET /api/health` — returns DB state + uptime
- Ready endpoint: `GET /api/ready` — used by Railway healthcheck
- Build version: logged to browser console on every page load

### Check production health
```bash
# API health
curl https://api.dolphinorg.in/api/health

# Check logs on Railway dashboard for [ERROR] or [SLOW] lines
# Filter by: "[ERROR]" or "[SLOW]" or "UNCAUGHT EXCEPTION"
```

### Adding Sentry (recommended next step)
1. Install: `npm install @sentry/node` (backend) + `npm install @sentry/react` (frontend)
2. Backend init in `server.js` before any other middleware:
   ```js
   const Sentry = require('@sentry/node');
   Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
   ```
3. Frontend init in `main.jsx`:
   ```js
   import * as Sentry from '@sentry/react';
   Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, release: import.meta.env.VITE_APP_VERSION });
   ```
4. Add `SENTRY_DSN` and `VITE_SENTRY_DSN` to Railway + Vercel env vars

---

## 7. Bug Severity Levels

| Level | Definition | Response time |
|---|---|---|
| P0 — Critical | App down, login broken, payment broken, data loss | Fix within 1 hour |
| P1 — High | Core feature broken for all users, security issue | Fix same day |
| P2 — Medium | Feature broken for some users, wrong data shown | Fix within 2 days |
| P3 — Low | UI glitch, minor UX issue, edge case | Fix in next sprint |

---

## 8. Verifying a User-Reported Issue

1. **Reproduce** — get the exact steps, browser, role (founder/investor/provider), account state
2. **Check logs** — Railway dashboard → filter for `[ERROR]` around the reported time
3. **Check version** — ask user to open DevTools → Console → find `🐬 Dolphin v{version}`
4. **Test the specific endpoint** — use `curl` with the user's token (or test account)
5. **Check DB state** — MongoDB Atlas → check the specific user document
6. **Fix + regression test** — add a test case that would have caught this issue
7. **Deploy + verify** — run smoke test after deploy, confirm fix with user

---

## 9. Deployment Verification Checklist

After every Railway deploy:
- [ ] Railway healthcheck passes (green in dashboard)
- [ ] `GET /api/health` returns `{"status":"ok","db":"connected"}`
- [ ] `GET /api/ready` returns `{"status":"ready"}`
- [ ] Login works (try with a real test account)
- [ ] Feed loads without errors
- [ ] Run `npm run test:prod` — all tests pass
- [ ] Browser console shows new build version (not same as previous deploy)
- [ ] No `[ERROR]` lines in Railway logs in first 5 minutes
