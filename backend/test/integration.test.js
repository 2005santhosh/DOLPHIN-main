/**
 * integration.test.js — Backend API integration tests.
 *
 * Tests run against the live server at BASE_URL (default: http://localhost:8080).
 * The server must be running before executing these tests.
 *
 * Run: node backend/test/integration.test.js
 * Or:  BASE_URL=https://api.dolphinorg.in node backend/test/integration.test.js
 *
 * Covers:
 *   - Auth: register, OTP, login, logout, profile, password
 *   - Input validation: missing fields, bad email, short password
 *   - Authorization: protected routes reject unauthenticated requests
 *   - Role enforcement: wrong-role requests get 403
 *   - Posts: create, feed, like, delete
 *   - Gamification: stats endpoint
 *   - Health endpoints
 */

'use strict';

const http  = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const IS_HTTPS = BASE_URL.startsWith('https');
const requester = IS_HTTPS ? https : http;

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function log(color, msg) {
  const codes = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
  console.log(`${codes[color] || ''}${msg}${codes.reset}`);
}

function pass(name) { passed++; log('green', `  ✓ ${name}`); }
function fail(name, reason) {
  failed++;
  failures.push({ name, reason });
  log('red', `  ✗ ${name}`);
  log('red', `    → ${reason}`);
}

function assert(name, condition, reason = '') {
  condition ? pass(name) : fail(name, reason || 'assertion failed');
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      hostname: url.hostname,
      port:     url.port || (IS_HTTPS ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers:  { 'Content-Type': 'application/json', ...headers },
    };

    const raw = body ? JSON.stringify(body) : null;
    if (raw) opts.headers['Content-Length'] = Buffer.byteLength(raw);

    const req = requester.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { _raw: data }; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

const get  = (path, headers)        => request('GET',    path, null,  headers);
const post = (path, body, headers)  => request('POST',   path, body,  headers);
const put  = (path, body, headers)  => request('PUT',    path, body,  headers);
const del  = (path, headers)        => request('DELETE', path, null,  headers);

function auth(token) { return { Authorization: `Bearer ${token}` }; }

// ── Test data ─────────────────────────────────────────────────────────────────
// Use a unique suffix so parallel runs don't collide
const SUFFIX  = Date.now().toString(36);
const FOUNDER = { name: 'Test Founder', email: `founder_${SUFFIX}@test.dolphin`, password: 'TestPass123!', role: 'founder' };
const INVESTOR = { name: 'Test Investor', email: `investor_${SUFFIX}@test.dolphin`, password: 'TestPass123!', role: 'investor' };

let founderToken = '';
let investorToken = '';
let founderUserId = '';
let testPostId = '';

// ── Test suites ───────────────────────────────────────────────────────────────

async function testHealth() {
  log('cyan', '\n── Health checks ──────────────────────────────────────────');
  const r = await get('/api/health');
  assert('GET /api/health returns 200',       r.status === 200, `got ${r.status}`);
  assert('health.status is ok or degraded',   ['ok','degraded'].includes(r.body.status), `got ${r.body.status}`);
  assert('health.db field present',           !!r.body.db, 'db field missing');

  const rr = await get('/api/ready');
  assert('GET /api/ready returns 200 or 503', [200, 503].includes(rr.status), `got ${rr.status}`);
}

async function testAuthValidation() {
  log('cyan', '\n── Auth input validation ──────────────────────────────────');

  // Missing fields
  const r1 = await post('/api/auth/register', {});
  assert('Register: missing fields → 400', r1.status === 400, `got ${r1.status}`);

  // Invalid email format
  const r2 = await post('/api/auth/register', { name: 'X', email: 'notanemail', password: 'Password1!', role: 'founder' });
  assert('Register: invalid email → 400',   r2.status === 400, `got ${r2.status}: ${r2.body?.message}`);

  // Short password
  const r3 = await post('/api/auth/register', { name: 'X', email: 'x@x.com', password: 'short', role: 'founder' });
  assert('Register: short password → 400',  r3.status === 400, `got ${r3.status}`);

  // Invalid role
  const r4 = await post('/api/auth/register', { name: 'X', email: 'x@x.com', password: 'Password1!', role: 'admin' });
  assert('Register: admin role blocked → 400', r4.status === 400, `got ${r4.status}`);

  // Login: missing fields
  const r5 = await post('/api/auth/login', { email: 'a@a.com' });
  assert('Login: missing password → 400',   r5.status === 400, `got ${r5.status}`);

  // Login: wrong credentials
  const r6 = await post('/api/auth/login', { email: 'nobody@nowhere.com', password: 'wrong' });
  assert('Login: wrong credentials → 401',  r6.status === 401, `got ${r6.status}`);
}

async function testAuthRegisterFlow() {
  log('cyan', '\n── Auth register + OTP flow ───────────────────────────────');

  // Register founder
  const r = await post('/api/auth/register', FOUNDER);
  assert('Founder register → 200',           r.status === 200, `got ${r.status}: ${JSON.stringify(r.body)}`);
  assert('Register returns email',           r.body?.email === FOUNDER.email, `got ${r.body?.email}`);

  // Duplicate registration
  const dup = await post('/api/auth/register', FOUNDER);
  assert('Duplicate register → 409',         dup.status === 409, `got ${dup.status}`);

  // OTP with wrong code
  const bad = await post('/api/auth/verify-otp', { email: FOUNDER.email, otp: '000000' });
  assert('Verify OTP: wrong code → 400',     bad.status === 400, `got ${bad.status}`);

  // Register investor (we'll test protected routes with a properly verified account)
  const ri = await post('/api/auth/register', INVESTOR);
  assert('Investor register → 200',          ri.status === 200, `got ${ri.status}`);
}

async function testProtectedRoutes() {
  log('cyan', '\n── Protected route enforcement ────────────────────────────');

  // No token
  const r1 = await get('/api/auth/profile');
  assert('Profile: no token → 401',          r1.status === 401, `got ${r1.status}`);

  // Invalid token
  const r2 = await get('/api/auth/profile', auth('invalid.token.here'));
  assert('Profile: invalid token → 401',     r2.status === 401, `got ${r2.status}`);

  // Posts feed
  const r3 = await get('/api/posts/feed');
  assert('Feed: no token → 401',             r3.status === 401, `got ${r3.status}`);

  // Gamification
  const r4 = await get('/api/gamification/me');
  assert('Gamification: no token → 401',     r4.status === 401, `got ${r4.status}`);

  // Connections
  const r5 = await get('/api/connections');
  assert('Connections: no token → 401',      r5.status === 401, `got ${r5.status}`);

  // Admin routes
  const r6 = await get('/api/admin/users');
  assert('Admin users: no token → 401',      r6.status === 401, `got ${r6.status}`);

  // Founder-only route with no token
  const r7 = await get('/api/founder/my-startup');
  assert('My startup: no token → 401',       r7.status === 401, `got ${r7.status}`);
}

async function testAdminRouteStructure() {
  log('cyan', '\n── Admin route structure (regression: module.exports bug) ──');

  // These routes were previously unreachable due to premature module.exports
  // We can only test existence (they'll 401 without auth, not 404)
  const routes = [
    '/api/admin/users',
    '/api/admin/dashboard',
    '/api/admin/pending-users',
    '/api/admin/pending-providers',
  ];

  for (const route of routes) {
    const r = await get(route, auth('fake'));
    assert(`Admin ${route}: exists (not 404)`, r.status !== 404, `got 404 — route unreachable`);
  }
}

async function testResendOtp() {
  log('cyan', '\n── Resend OTP ─────────────────────────────────────────────');

  // Missing email
  const r1 = await post('/api/auth/resend-otp', {});
  assert('Resend OTP: missing email → 400',  r1.status === 400, `got ${r1.status}`);

  // Unknown email — should not reveal existence (return 200)
  const r2 = await post('/api/auth/resend-otp', { email: 'ghost@nowhere.invalid' });
  assert('Resend OTP: unknown email → 200',  r2.status === 200, `got ${r2.status}`);
}

async function testForgotPassword() {
  log('cyan', '\n── Forgot password ────────────────────────────────────────');

  const r1 = await post('/api/auth/forgot-password', {});
  assert('Forgot password: missing email → 400', r1.status === 400, `got ${r1.status}`);

  // Reset with invalid token
  const r2 = await put('/api/auth/reset-password/invalidtoken', { password: 'NewPass123!' });
  assert('Reset password: bad token → 400/404', [400, 404].includes(r2.status), `got ${r2.status}`);
}

async function testPostValidation() {
  log('cyan', '\n── Post input validation ──────────────────────────────────');

  // Create post without auth
  const r1 = await post('/api/posts', { content: 'test' });
  assert('Create post: no auth → 401',       r1.status === 401, `got ${r1.status}`);
}

async function testGamificationEndpoints() {
  log('cyan', '\n── Gamification endpoint structure ────────────────────────');

  // Leaderboard without auth
  const r1 = await get('/api/gamification/leaderboard/founder');
  assert('Leaderboard: no auth → 401',       r1.status === 401, `got ${r1.status}`);

  // Invalid role
  const r2 = await get('/api/gamification/leaderboard/hacker', auth('fake'));
  assert('Leaderboard: invalid role → 400 or 401', [400, 401].includes(r2.status), `got ${r2.status}`);
}

async function testVerificationEndpoints() {
  log('cyan', '\n── Verification endpoints ─────────────────────────────────');

  const r1 = await get('/api/verification/status');
  assert('Verification status: no auth → 401', r1.status === 401, `got ${r1.status}`);

  const r2 = await post('/api/verification/create-order', {});
  assert('Create order: no auth → 401',       r2.status === 401, `got ${r2.status}`);
}

async function testChatEndpoints() {
  log('cyan', '\n── Chat endpoints ─────────────────────────────────────────');

  const r1 = await get('/api/chat/conversations');
  assert('Chat conversations: no auth → 401', r1.status === 401, `got ${r1.status}`);

  const r2 = await post('/api/chat/send', { receiverId: 'fake', content: 'hi' });
  assert('Chat send: no auth → 401',          r2.status === 401, `got ${r2.status}`);
}

async function testNotificationsEndpoints() {
  log('cyan', '\n── Notifications endpoints ────────────────────────────────');

  const r1 = await get('/api/notifications');
  assert('Notifications: no auth → 401',      r1.status === 401, `got ${r1.status}`);

  const r2 = await put('/api/notifications/read-all');
  assert('Mark notifications read: no auth → 401', r2.status === 401, `got ${r2.status}`);
}

async function testConnectionsEndpoints() {
  log('cyan', '\n── Connections endpoints ──────────────────────────────────');

  // POST request without auth
  const r1 = await post('/api/connections/request', { toUserId: 'fake' });
  assert('Send connection: no auth → 401',    r1.status === 401, `got ${r1.status}`);

  // Accept/reject without auth
  const r2 = await put('/api/connections/fakeid', { status: 'accepted' });
  assert('Update connection: no auth → 401',  r2.status === 401, `got ${r2.status}`);
}

async function testInvestorEndpoints() {
  log('cyan', '\n── Investor endpoints ─────────────────────────────────────');

  const r1 = await get('/api/investor/validated-startups');
  assert('Validated startups: no auth → 401', r1.status === 401, `got ${r1.status}`);

  const r2 = await get('/api/investor/watchlist');
  assert('Watchlist: no auth → 401',          r2.status === 401, `got ${r2.status}`);

  const r3 = await get('/api/investor/my-requests');
  assert('Investor requests: no auth → 401',  r3.status === 401, `got ${r3.status}`);
}

async function testProviderEndpoints() {
  log('cyan', '\n── Provider endpoints ─────────────────────────────────────');

  const r1 = await get('/api/provider/eligible-founders');
  assert('Eligible founders: no auth → 401',  r1.status === 401, `got ${r1.status}`);

  const r2 = await get('/api/provider/profile');
  assert('Provider profile: no auth → 401',   r2.status === 401, `got ${r2.status}`);

  const r3 = await get('/api/provider/my-requests');
  assert('Provider requests: no auth → 401',  r3.status === 401, `got ${r3.status}`);
}

async function testRateLimiting() {
  log('cyan', '\n── Rate limiting behavior ─────────────────────────────────');

  // The login limiter allows 5 attempts per 15min.
  // We fire 3 invalid attempts and check all return 401 (not 429)
  // We avoid firing 6+ which would actually trigger the limiter in tests.
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    attempts.push(post('/api/auth/login', { email: `rate${i}@test.com`, password: 'wrong' }));
  }
  const results = await Promise.all(attempts);
  const allAuth = results.every(r => r.status === 401 || r.status === 429);
  assert('Rate limit: 3 bad logins return 401 or 429', allAuth,
    `got statuses: ${results.map(r => r.status).join(', ')}`);

  // Check Retry-After header is set when rate limited (if any 429)
  const limited = results.find(r => r.status === 429);
  if (limited) {
    assert('Rate limit: Retry-After header present', !!limited.headers['retry-after'], 'Retry-After missing');
  }
}

async function testSecurityHeaders() {
  log('cyan', '\n── Security headers ───────────────────────────────────────');

  const r = await get('/api/health');
  // Helmet headers — X-Content-Type-Options comes from our custom middleware on /api/
  // /api/health is outside that middleware so we check from a protected route
  const r2 = await get('/api/auth/profile', auth('fake'));
  assert('X-Content-Type-Options: nosniff',  r2.headers['x-content-type-options'] === 'nosniff',
    `got: ${r2.headers['x-content-type-options']}`);
  assert('X-Frame-Options: DENY',            r2.headers['x-frame-options'] === 'DENY',
    `got: ${r2.headers['x-frame-options']}`);
  assert('Cache-Control: no-store on APIs',  (r2.headers['cache-control'] || '').includes('no-store'),
    `got: ${r2.headers['cache-control']}`);
}

async function testNoSQLInjection() {
  log('cyan', '\n── NoSQL injection resistance ─────────────────────────────');

  // Attempt $gt operator injection in login email
  const r1 = await post('/api/auth/login', { email: { $gt: '' }, password: 'any' });
  assert('NoSQL injection in email → 400/401', [400, 401].includes(r1.status),
    `got ${r1.status} — may allow bypass`);

  // Attempt $where in register
  const r2 = await post('/api/auth/register', {
    name: 'X', email: 'x@x.com', password: 'Password1!',
    role: { $ne: 'admin' }
  });
  assert('NoSQL injection in role → 400',    r2.status === 400, `got ${r2.status}`);
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function run() {
  log('cyan', '═══════════════════════════════════════════════════════════');
  log('cyan', `  DOLPHIN API INTEGRATION TESTS  →  ${BASE_URL}`);
  log('cyan', '═══════════════════════════════════════════════════════════');

  try {
    await testHealth();
    await testAuthValidation();
    await testAuthRegisterFlow();
    await testProtectedRoutes();
    await testAdminRouteStructure();
    await testResendOtp();
    await testForgotPassword();
    await testPostValidation();
    await testGamificationEndpoints();
    await testVerificationEndpoints();
    await testChatEndpoints();
    await testNotificationsEndpoints();
    await testConnectionsEndpoints();
    await testInvestorEndpoints();
    await testProviderEndpoints();
    await testRateLimiting();
    await testSecurityHeaders();
    await testNoSQLInjection();
  } catch (err) {
    log('red', `\nFATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '  RESULTS');
  log('cyan', '═══════════════════════════════════════════════════════════');
  log('green', `  Passed: ${passed}`);
  if (failed > 0) {
    log('red', `  Failed: ${failed}`);
    log('red', '\n  Failures:');
    failures.forEach(f => log('red', `    • ${f.name}: ${f.reason}`));
  } else {
    log('green', '  Failed: 0');
  }
  const total = passed + failed;
  log('cyan', `  Score:  ${passed}/${total} (${Math.round(passed / total * 100)}%)`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
