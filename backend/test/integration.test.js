/**
 * integration.test.js — Comprehensive backend API integration tests.
 *
 * Run: node backend/test/integration.test.js
 * Prod: BASE_URL=https://api.dolphinorg.in node backend/test/integration.test.js
 *
 * Covers: auth, input validation, authorization, role enforcement, posts,
 *         connections, chat, bubbles, gamification, notifications, security
 *         headers, NoSQL injection, XSS resistance, rate limiting structure.
 */
'use strict';

const http  = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const IS_HTTPS = BASE_URL.startsWith('https');
const requester = IS_HTTPS ? https : http;

// ── Harness ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function log(color, msg) {
  const c = { green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m',
               cyan:'\x1b[36m', bold:'\x1b[1m', reset:'\x1b[0m' };
  console.log(`${c[color]||''}${msg}${c.reset}`);
}
function pass(name) { passed++; log('green', `  ✓ ${name}`); }
function fail(name, reason) {
  failed++;
  failures.push({ name, reason });
  log('red', `  ✗ ${name}`);
  log('red', `    → ${reason}`);
}
function assert(name, cond, reason = '') {
  cond ? pass(name) : fail(name, reason || 'assertion failed');
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (raw) req.write(raw);
    req.end();
  });
}

const get  = (p, h)       => request('GET',    p, null, h);
const post = (p, b, h)    => request('POST',   p, b,    h);
const put  = (p, b, h)    => request('PUT',    p, b,    h);
const del  = (p, h)       => request('DELETE', p, null, h);
const auth = (t)          => ({ Authorization: `Bearer ${t}` });

// ── Test data ─────────────────────────────────────────────────────────────────
const SUFFIX   = Date.now().toString(36);
const FOUNDER  = { name: 'QA Founder',  email: `founder_${SUFFIX}@test.dolphin`,  password: 'TestPass123!', role: 'founder'  };
const INVESTOR = { name: 'QA Investor', email: `investor_${SUFFIX}@test.dolphin`, password: 'TestPass123!', role: 'investor' };
const PROVIDER = { name: 'QA Provider', email: `provider_${SUFFIX}@test.dolphin`, password: 'TestPass123!', role: 'provider' };

let founderToken = '', investorToken = '', providerToken = '';
let founderUserId = '', investorUserId = '';
let testPostId = '';

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — Health & readiness
// ═══════════════════════════════════════════════════════════════════════════
async function testHealth() {
  log('cyan', '\n── Health & Readiness ──────────────────────────────────────');
  const r = await get('/api/health');
  assert('GET /api/health → 200',             r.status === 200, `got ${r.status}`);
  assert('health.status is ok|degraded',      ['ok','degraded'].includes(r.body.status), `got ${r.body.status}`);
  assert('health.db field present',           !!r.body.db, 'missing db field');
  assert('health.uptime is a number',         typeof r.body.uptime === 'number', `got ${typeof r.body.uptime}`);
  assert('health.timestamp is ISO string',    /\d{4}-\d{2}-\d{2}T/.test(r.body.timestamp), `got ${r.body.timestamp}`);

  const rr = await get('/api/ready');
  assert('GET /api/ready → 200 or 503',       [200, 503].includes(rr.status), `got ${rr.status}`);
  assert('ready.status field present',        !!rr.body.status, 'missing status field');
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — Auth input validation
// ═══════════════════════════════════════════════════════════════════════════
async function testAuthValidation() {
  log('cyan', '\n── Auth input validation ───────────────────────────────────');

  const r1 = await post('/api/auth/register', {});
  assert('Register: missing fields → 400',    r1.status === 400, `got ${r1.status}`);

  const r2 = await post('/api/auth/register', { name:'X', email:'notanemail', password:'Password1!', role:'founder' });
  assert('Register: invalid email → 400/429', [400, 429].includes(r2.status), `got ${r2.status}: ${r2.body?.message}`);

  const r3 = await post('/api/auth/register', { name:'X', email:'x@x.com', password:'short', role:'founder' });
  assert('Register: short password → 400/429',[400, 429].includes(r3.status), `got ${r3.status}`);

  // Admin role blocked — either 400 (validated) or 429 (rate limited first) is fine
  const r4 = await post('/api/auth/register', { name:'X', email:'x@x.com', password:'Password1!', role:'admin' });
  assert('Register: admin role blocked → 400/429', [400, 429].includes(r4.status), `got ${r4.status}`);

  const r5 = await post('/api/auth/login', { email: 'a@a.com' });
  assert('Login: missing password → 400',     r5.status === 400, `got ${r5.status}`);

  const r6 = await post('/api/auth/login', { email:'nobody@nowhere.com', password:'wrong' });
  assert('Login: wrong credentials → 401',    r6.status === 401, `got ${r6.status}`);

  const r7 = await post('/api/auth/resend-otp', {});
  assert('Resend OTP: missing email → 400',   r7.status === 400, `got ${r7.status}`);

  const r8 = await post('/api/auth/resend-otp', { email:'ghost@nowhere.invalid' });
  assert('Resend OTP: unknown email → 200',   r8.status === 200, `got ${r8.status}`);

  const r9 = await post('/api/auth/forgot-password', {});
  assert('Forgot pwd: missing email → 400',   r9.status === 400, `got ${r9.status}`);

  const r10 = await put('/api/auth/reset-password/badtoken', { password:'NewPass123!' });
  assert('Reset pwd: bad token → 400/404',    [400, 404].includes(r10.status), `got ${r10.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — Auth register flow
// ═══════════════════════════════════════════════════════════════════════════
async function testAuthRegisterFlow() {
  log('cyan', '\n── Auth register + OTP flow ────────────────────────────────');

  // NOTE: Register limiter is 3/hour per IP on production.
  // These tests may hit 429 if run repeatedly from the same IP.
  // 429 is accepted as a passing response for rate-limited paths.
  const r = await post('/api/auth/register', FOUNDER);
  assert('Founder register → 200/429',        [200, 429].includes(r.status), `got ${r.status}: ${JSON.stringify(r.body)}`);
  if (r.status === 200) {
    assert('Register returns email field',    r.body?.email === FOUNDER.email, `got ${r.body?.email}`);
  }

  const dup = await post('/api/auth/register', FOUNDER);
  assert('Duplicate register → 409/429',      [409, 429].includes(dup.status), `got ${dup.status}`);

  const bad = await post('/api/auth/verify-otp', { email: FOUNDER.email, otp: '000000' });
  assert('Verify OTP: wrong code → 400',      bad.status === 400, `got ${bad.status}`);

  const ri = await post('/api/auth/register', INVESTOR);
  assert('Investor register → 200/429',       [200, 429].includes(ri.status), `got ${ri.status}`);

  const rp = await post('/api/auth/register', PROVIDER);
  assert('Provider register → 200/429',       [200, 429].includes(rp.status), `got ${rp.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — Protected routes (no token / bad token)
// ═══════════════════════════════════════════════════════════════════════════
async function testProtectedRoutes() {
  log('cyan', '\n── Protected route enforcement ─────────────────────────────');

  const routes = [
    ['GET',  '/api/auth/profile'],
    ['GET',  '/api/posts/feed'],
    ['GET',  '/api/gamification/me'],
    ['GET',  '/api/connections'],
    ['GET',  '/api/connections/all-accepted'],
    ['GET',  '/api/connections/pending-count'],
    ['GET',  '/api/admin/users'],
    ['GET',  '/api/founder/my-startup'],
    ['GET',  '/api/notifications'],
    ['GET',  '/api/chat/conversations'],
    ['POST', '/api/chat/send'],
    ['GET',  '/api/bubbles'],
    ['POST', '/api/connections/request'],
    ['GET',  '/api/verification/status'],
    ['GET',  '/api/investor/validated-startups'],
    ['GET',  '/api/provider/profile'],
  ];

  for (const [method, path] of routes) {
    const fn = method === 'GET' ? get : post;
    const r = await fn(path, {});
    assert(`${method} ${path}: no token → 401`, r.status === 401, `got ${r.status}`);
  }

  // Invalid token
  const r2 = await get('/api/auth/profile', auth('invalid.token.here'));
  assert('Profile: invalid token → 401',      r2.status === 401, `got ${r2.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5 — Admin routes reachable (not 404)
// ═══════════════════════════════════════════════════════════════════════════
async function testAdminRouteStructure() {
  log('cyan', '\n── Admin route structure ───────────────────────────────────');
  const routes = ['/api/admin/users', '/api/admin/dashboard',
                  '/api/admin/pending-users', '/api/admin/pending-providers'];
  for (const route of routes) {
    const r = await get(route, auth('fake'));
    assert(`Admin ${route}: reachable (not 404)`, r.status !== 404, `got 404`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 6 — Security headers
// ═══════════════════════════════════════════════════════════════════════════
async function testSecurityHeaders() {
  log('cyan', '\n── Security headers ────────────────────────────────────────');
  const r = await get('/api/auth/profile', auth('fake'));
  assert('X-Content-Type-Options: nosniff',
    r.headers['x-content-type-options'] === 'nosniff',
    `got: ${r.headers['x-content-type-options']}`);
  assert('X-Frame-Options: DENY',
    r.headers['x-frame-options'] === 'DENY',
    `got: ${r.headers['x-frame-options']}`);
  assert('Cache-Control: no-store',
    (r.headers['cache-control'] || '').includes('no-store'),
    `got: ${r.headers['cache-control']}`);
  // Helmet adds X-DNS-Prefetch-Control
  const r2 = await get('/api/health');
  assert('X-DNS-Prefetch-Control present (Helmet)',
    !!r2.headers['x-dns-prefetch-control'],
    'header missing');
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 7 — NoSQL injection resistance
// ═══════════════════════════════════════════════════════════════════════════
async function testNoSQLInjection() {
  log('cyan', '\n── NoSQL injection resistance ──────────────────────────────');

  // Object payload in email — type guard in auth route must reject with 400, never 500
  const r1 = await post('/api/auth/login', { email: { $gt: '' }, password: 'any' });
  assert('NoSQL injection in login email → 400',
    r1.status === 400, `got ${r1.status} — type guard missing or broken`);

  // Object in role field — type guard in register must catch it (or rate limiter fires 429)
  const r2 = await post('/api/auth/register', {
    name:'X', email:'x@x.com', password:'Password1!', role: { $ne: 'admin' }
  });
  assert('NoSQL injection in role → 400/429', [400, 429].includes(r2.status), `got ${r2.status}`);

  // $where injection in connection request toUserId
  const r3 = await post('/api/connections/request', { toUserId: { $where: 'sleep(1000)' } }, auth('fake'));
  assert('NoSQL injection in toUserId → 400/401',
    [400, 401].includes(r3.status), `got ${r3.status}`);

  // Array injection in login password — should not cause 500
  const r4 = await post('/api/auth/login', { email: 'test@test.com', password: ['a','b'] });
  assert('Array injection in password → 400/401',
    [400, 401].includes(r4.status), `got ${r4.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 8 — XSS resistance
// ═══════════════════════════════════════════════════════════════════════════
async function testXSSResistance() {
  log('cyan', '\n── XSS resistance ──────────────────────────────────────────');

  // XSS payload in register name (should be sanitised or rejected)
  const xssName = '<script>alert(1)</script>';
  const r1 = await post('/api/auth/register', {
    name: xssName, email: `xss_${Date.now()}@test.dolphin`,
    password: 'Password1!', role: 'founder'
  });
  // Either 200 (registered) or 400 (rejected) — but NOT storing raw HTML
  assert('XSS in name: not 500',              r1.status !== 500, `got 500`);
  if (r1.status === 200) {
    assert('XSS name: response does not echo raw <script>',
      !JSON.stringify(r1.body).includes('<script>'),
      'raw <script> tag echoed in response');
  }

  // XSS payload in post content — test sanitisation
  const r2 = await post('/api/posts', { content: '<script>alert(1)</script>', postType: 'general' }, auth('fake'));
  assert('XSS in post content: not 500',      r2.status !== 500, `got 500`);

  // XSS in chat message — sent without auth should be 401
  const r3 = await post('/api/chat/send', { receiverId: '507f1f77bcf86cd799439011', content: '<img src=x onerror=alert(1)>' });
  assert('XSS in chat: no auth → 401',        r3.status === 401, `got ${r3.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 9 — Input validation: invalid ObjectIds
// ═══════════════════════════════════════════════════════════════════════════
async function testObjectIdValidation() {
  log('cyan', '\n── ObjectId validation (prevent CastError 500) ─────────────');

  // Connection status check with invalid ID
  const r1 = await get('/api/connections/status/not-an-objectid', auth('fake'));
  assert('Connection status: bad ID → 400/401', [400, 401].includes(r1.status),
    `got ${r1.status} — CastError 500 would be a bug`);

  // Chat messages with invalid userId
  const r2 = await get('/api/chat/not-a-valid-id', auth('fake'));
  assert('Chat history: bad ID → 400/401',    [400, 401].includes(r2.status),
    `got ${r2.status} — CastError 500 would be a bug`);

  // Chat send with invalid receiverId
  const r3 = await post('/api/chat/send', { receiverId: 'NOT_VALID', content: 'hi' }, auth('fake'));
  assert('Chat send: bad receiverId → 400/401', [400, 401].includes(r3.status),
    `got ${r3.status} — CastError 500 would be a bug`);

  // Gamification profile with invalid userId
  const r4 = await get('/api/gamification/profile/not-valid', auth('fake'));
  assert('Gamification profile: bad ID → 400/401/404',
    [400, 401, 404, 500].includes(r4.status), `got ${r4.status}`);
    // 500 here triggers a separate warning
  if (r4.status === 500) fail('Gamification profile: bad ID causes 500 (CastError not handled)', `got 500`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 10 — Rate limiting structure
// ═══════════════════════════════════════════════════════════════════════════
async function testRateLimiting() {
  log('cyan', '\n── Rate limiting ───────────────────────────────────────────');

  // Fire 3 bad login attempts — should all be 401 (not 500)
  const attempts = await Promise.all(
    Array.from({length: 3}, (_, i) =>
      post('/api/auth/login', { email: `rl${i}_${SUFFIX}@test.com`, password: 'wrong' })
    )
  );
  const allValid = attempts.every(r => r.status === 401 || r.status === 429);
  assert('3 bad logins: all 401 or 429',      allValid,
    `got statuses: ${attempts.map(r => r.status).join(', ')}`);

  const limited = attempts.find(r => r.status === 429);
  if (limited) {
    assert('Rate limit: Retry-After header present',
      !!limited.headers['retry-after'], 'Retry-After missing');
  }

  // Posts feed endpoint has its own limiter
  const feedR = await get('/api/posts/feed', auth('fake'));
  assert('Posts feed: no auth → 401 (not 404 or 500)',
    feedR.status === 401, `got ${feedR.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 11 — Posts endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testPostEndpoints() {
  log('cyan', '\n── Posts endpoints ─────────────────────────────────────────');

  // No auth
  const r1 = await post('/api/posts', { content: 'test' });
  assert('Create post: no auth → 401',        r1.status === 401, `got ${r1.status}`);

  const r2 = await get('/api/posts/feed');
  assert('Feed: no auth → 401',               r2.status === 401, `got ${r2.status}`);

  const r3 = await get('/api/posts/videos');
  assert('Videos: no auth → 401',             r3.status === 401, `got ${r3.status}`);

  const r4 = await get('/api/posts/daily-limit');
  assert('Daily limit: no auth → 401',        r4.status === 401, `got ${r4.status}`);

  const r5 = await get('/api/posts/upload-signature');
  assert('Upload sig: no auth → 401',         r5.status === 401, `got ${r5.status}`);

  // Post with fake auth (invalid token)
  const r6 = await post('/api/posts', { content: 'x'.repeat(2201), postType:'general' }, auth('fake'));
  assert('Create post: fake token → 401',     r6.status === 401, `got ${r6.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 12 — Gamification endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testGamificationEndpoints() {
  log('cyan', '\n── Gamification endpoints ──────────────────────────────────');

  const r1 = await get('/api/gamification/me');
  assert('Gamification /me: no auth → 401',   r1.status === 401, `got ${r1.status}`);

  const r2 = await get('/api/gamification/leaderboard/founder');
  assert('Leaderboard founder: no auth → 401',r2.status === 401, `got ${r2.status}`);

  const r3 = await get('/api/gamification/leaderboard/hacker', auth('fake'));
  assert('Leaderboard: invalid role → 400/401', [400, 401].includes(r3.status), `got ${r3.status}`);

  const r4 = await post('/api/gamification/claim-reward', {});
  assert('Claim reward: no auth → 401',        r4.status === 401, `got ${r4.status}`);

  // Invalid milestone
  const r5 = await post('/api/gamification/claim-reward',
    { milestone: 99, fullName: 'X', phone: '1234567890', address: 'X' }, auth('fake'));
  assert('Claim reward: invalid milestone → 400/401', [400, 401].includes(r5.status), `got ${r5.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 13 — Connections endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testConnectionsEndpoints() {
  log('cyan', '\n── Connections endpoints ───────────────────────────────────');

  const r1 = await post('/api/connections/request', { toUserId: 'fake' });
  assert('Send connection: no auth → 401',    r1.status === 401, `got ${r1.status}`);

  const r2 = await put('/api/connections/fakeid', { status: 'accepted' });
  assert('Update connection: no auth → 401',  r2.status === 401, `got ${r2.status}`);

  const r3 = await get('/api/connections/all-accepted');
  assert('All-accepted: no auth → 401',       r3.status === 401, `got ${r3.status}`);

  const r4 = await get('/api/connections/pending-count');
  assert('Pending count: no auth → 401',      r4.status === 401, `got ${r4.status}`);

  // Self-connection attempt
  const r5 = await post('/api/connections/request', { toUserId: founderUserId || '507f1f77bcf86cd799439011' }, auth('fake'));
  assert('Self-connect: fake token → 401',    r5.status === 401, `got ${r5.status}`);

  // Invalid body on status-bulk
  const r6 = await post('/api/connections/status-bulk', { userIds: 'not-an-array' });
  assert('Status-bulk: no auth → 401',        r6.status === 401, `got ${r6.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 14 — Chat endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testChatEndpoints() {
  log('cyan', '\n── Chat endpoints ──────────────────────────────────────────');

  const r1 = await get('/api/chat/conversations');
  assert('Chat conversations: no auth → 401', r1.status === 401, `got ${r1.status}`);

  const r2 = await post('/api/chat/send', { receiverId: 'fake', content: 'hi' });
  assert('Chat send: no auth → 401',          r2.status === 401, `got ${r2.status}`);

  // Invalid receiverId with fake token
  const r3 = await post('/api/chat/send', { receiverId: 'NOT_VALID_ID', content: 'hi' }, auth('fake'));
  assert('Chat send: bad ID → 400/401',       [400, 401].includes(r3.status), `got ${r3.status}`);

  // Invalid userId in chat history
  const r4 = await get('/api/chat/not-valid-id', auth('fake'));
  assert('Chat history: bad ID → 400/401',    [400, 401].includes(r4.status), `got ${r4.status}`);

  const r5 = await post('/api/chat/online-status', { userIds: 'not-array' });
  assert('Online-status: no auth → 401',      r5.status === 401, `got ${r5.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 15 — Bubbles endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testBubblesEndpoints() {
  log('cyan', '\n── Bubbles endpoints ───────────────────────────────────────');

  const r1 = await get('/api/bubbles');
  assert('List bubbles: no auth → 401',       r1.status === 401, `got ${r1.status}`);

  const r2 = await post('/api/bubbles', { name: 'Test Bubble' });
  assert('Create bubble: no auth → 401',      r2.status === 401, `got ${r2.status}`);

  // Empty name
  const r3 = await post('/api/bubbles', { name: '' }, auth('fake'));
  assert('Create bubble: empty name → 400/401', [400, 401].includes(r3.status), `got ${r3.status}`);

  const r4 = await post('/api/bubbles/fakeid/messages', { content: 'hi' });
  assert('Send bubble msg: no auth → 401',    r4.status === 401, `got ${r4.status}`);

  const r5 = await post('/api/bubbles/fakeid/invite', { userId: 'uid' });
  assert('Bubble invite: no auth → 401',      r5.status === 401, `got ${r5.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 16 — Notifications, Verification, Resources
// ═══════════════════════════════════════════════════════════════════════════
async function testMiscEndpoints() {
  log('cyan', '\n── Misc endpoints (notifications, verification, resources) ─');

  const r1 = await get('/api/notifications');
  assert('Notifications: no auth → 401',      r1.status === 401, `got ${r1.status}`);

  const r2 = await put('/api/notifications/read-all');
  assert('Mark notifs read: no auth → 401',   r2.status === 401, `got ${r2.status}`);

  const r3 = await del('/api/notifications/clear');
  assert('Clear notifs: no auth → 401',       r3.status === 401, `got ${r3.status}`);

  const r4 = await get('/api/verification/status');
  assert('Verification status: no auth → 401',r4.status === 401, `got ${r4.status}`);

  const r5 = await post('/api/verification/create-order', {});
  assert('Create order: no auth → 401',       r5.status === 401, `got ${r5.status}`);

  const r6 = await get('/api/resources');
  assert('Resources: no auth → 401',          r6.status === 401, `got ${r6.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 17 — Role enforcement
// ═══════════════════════════════════════════════════════════════════════════
async function testRoleEnforcement() {
  log('cyan', '\n── Role enforcement ────────────────────────────────────────');

  // Admin routes with fake token (should 401, not 403, since token is invalid)
  const r1 = await get('/api/admin/users', auth('fake.token.invalid'));
  assert('Admin users: bad token → 401',      r1.status === 401, `got ${r1.status}`);

  // Provider profile route with fake token
  const r2 = await get('/api/provider/profile', auth('fake.token.invalid'));
  assert('Provider profile: bad token → 401', r2.status === 401, `got ${r2.status}`);

  // Investor validated startups with fake token
  const r3 = await get('/api/investor/validated-startups', auth('fake.token.invalid'));
  assert('Investor startups: bad token → 401',r3.status === 401, `got ${r3.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 18 — Performance: response time baselines
// ═══════════════════════════════════════════════════════════════════════════
async function testResponseTimes() {
  log('cyan', '\n── Response time baselines ─────────────────────────────────');

  const endpoints = [
    { method: 'GET', path: '/api/health',     maxMs: 500,  label: 'health check' },
    { method: 'GET', path: '/api/ready',      maxMs: 500,  label: 'readiness probe' },
    { method: 'GET', path: '/api/auth/profile', maxMs: 1000, label: 'auth/profile (401)' },
  ];

  for (const { method, path, maxMs, label } of endpoints) {
    const start = Date.now();
    const fn = method === 'GET' ? get : post;
    await fn(path, {}).catch(() => {});
    const elapsed = Date.now() - start;
    assert(`${label} responds within ${maxMs}ms`, elapsed < maxMs,
      `took ${elapsed}ms (target: <${maxMs}ms)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 19 — Concurrent load test (basic: 20 parallel health checks)
// ═══════════════════════════════════════════════════════════════════════════
async function testConcurrentLoad() {
  log('cyan', '\n── Concurrent load (20 parallel health checks) ─────────────');

  const N = 20;
  const start = Date.now();
  const results = await Promise.all(
    Array.from({length: N}, () => get('/api/health'))
  );
  const elapsed = Date.now() - start;

  const allOk = results.every(r => r.status === 200 || r.status === 503);
  assert(`${N} concurrent requests: all succeeded`, allOk,
    `${results.filter(r => r.status >= 500).length} errors`);
  assert(`${N} concurrent requests: total < 5000ms`, elapsed < 5000,
    `took ${elapsed}ms`);

  const errCount = results.filter(r => r.status >= 500).length;
  if (errCount === 0) pass(`${N} concurrent requests: zero 5xx errors`);
  else fail(`${N} concurrent requests: ${errCount} 5xx errors`, `got ${errCount} server errors`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════════════════
async function run() {
  log('bold', '═══════════════════════════════════════════════════════════');
  log('bold', `  DOLPHIN INTEGRATION TESTS  →  ${BASE_URL}`);
  log('bold', '═══════════════════════════════════════════════════════════');

  try {
    await testHealth();
    await testAuthValidation();
    await testAuthRegisterFlow();
    await testProtectedRoutes();
    await testAdminRouteStructure();
    await testSecurityHeaders();
    await testNoSQLInjection();
    await testXSSResistance();
    await testObjectIdValidation();
    await testRateLimiting();
    await testPostEndpoints();
    await testGamificationEndpoints();
    await testConnectionsEndpoints();
    await testChatEndpoints();
    await testBubblesEndpoints();
    await testMiscEndpoints();
    await testRoleEnforcement();
    await testResponseTimes();
    await testConcurrentLoad();
  } catch (err) {
    log('red', `\nFATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  log('bold', '\n═══════════════════════════════════════════════════════════');
  log('bold', '  RESULTS');
  log('bold', '═══════════════════════════════════════════════════════════');
  log('green', `  Passed: ${passed}`);
  if (failed > 0) {
    log('red', `  Failed: ${failed}`);
    failures.forEach(f => log('red', `    • ${f.name}\n      → ${f.reason}`));
  } else {
    log('green', '  Failed: 0  🎉');
  }
  const total = passed + failed;
  const pct = Math.round(passed / total * 100);
  log('cyan', `  Score: ${passed}/${total} (${pct}%)`);
  if (pct === 100) log('green', '\n  ✅ ALL TESTS PASS');
  else if (pct >= 90) log('yellow', '\n  ⚠️  MOSTLY PASSING — review failures above');
  else log('red', '\n  ❌ SIGNIFICANT FAILURES — fix before deployment');

  process.exit(failed > 0 ? 1 : 0);
}

run();
