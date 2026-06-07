/**
 * routes/opportunities.js
 *
 * Backend proxy for all external job/opportunity APIs.
 * Caches results for 10 minutes — all users share one cached payload.
 * This eliminates ~15 browser fetches per user, fixes CORS errors, and
 * allows 1000+ concurrent users with zero extra external API calls.
 *
 * GET /api/opportunities  →  returns normalised opportunities array (JSON)
 */

const express = require('express');
const router  = express.Router();

// ─── In-memory cache ─────────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let _cache = null;
let _cacheAt = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────
let _idCounter = 0;
const uid = () => `opp_${Date.now()}_${++_idCounter}`;

function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function toISO(val) {
  if (!val) return null;
  try { return new Date(val).toISOString(); } catch { return null; }
}

function detectSector(title = '', company = '', tags = [], source = '') {
  const t = (title + ' ' + company + ' ' + tags.join(' ') + ' ' + source).toLowerCase();
  if (/government|govt|upsc|ssc|psc|ias|ips|defence|army|navy|air force|police|railway|municipal|public sector|sarkari|nhm|icar|central government|state government/.test(t))
    return 'Government';
  return 'Private';
}

function detectType(title = '', tags = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (t.includes('intern')) return 'Internship';
  if (t.includes('contract') || t.includes('freelance')) return 'Freelance';
  if (t.includes('part-time') || t.includes('part time')) return 'Part-time';
  if (t.includes('full-time') || t.includes('full time')) return 'Full-time';
  return 'Contract';
}

function detectMode(location = '', tags = []) {
  const t = (location + ' ' + tags.join(' ')).toLowerCase();
  if (t.includes('remote')) return 'Remote';
  if (t.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

function detectCategory(title = '', tags = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (/react|node|javascript|typescript|frontend|backend|fullstack|full.stack|web dev/.test(t)) return 'Web Development';
  if (/android|ios|flutter|react native|mobile/.test(t)) return 'Mobile Development';
  if (/figma|ui.ux|ux.ui|design system|product design/.test(t)) return 'UI/UX';
  if (/graphic|illustrat|brand|logo|visual/.test(t)) return 'Graphic Design';
  if (/market|seo|social media|content market/.test(t)) return 'Marketing';
  if (/content|writ|copy|blog|article/.test(t)) return 'Content Writing';
  if (/ai|machine learn|ml|nlp|llm|gpt/.test(t)) return 'AI';
  if (/data|analytics|sql|python|pandas/.test(t)) return 'Data';
  if (/doctor|physician|mbbs|nurse|nurs|medical|hospital|health|pharma|clinical|paramedic|dentist|radiology/.test(t)) return 'Healthcare';
  if (/agri|farm|horticulture|icar|crop|soil|veterinary|animal husbandry/.test(t)) return 'Agriculture';
  if (/civil|mechanical|electrical|electronics|chemical|aerospace|structural|manufacturing|industrial engineer/.test(t)) return 'Engineering';
  if (/teach|tutor|faculty|lecturer|professor|education|school|college|university|training/.test(t)) return 'Education';
  if (/bank|finance|account|ca|cpa|auditor|fintech|insurance|taxation/.test(t)) return 'Finance';
  if (/government|govt|ias|ips|upsc|ssc|psc|defence|army|navy|air force|police|railway|municipal/.test(t)) return 'Government';
  return 'Other';
}

// India-relevance scoring
function indiaScore(job) {
  const t = (job.title + ' ' + job.location + ' ' + job.companyName + ' ' + (job.tags || []).join(' ')).toLowerCase();
  let score = 0;
  if (/india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|kolkata|noida|gurugram|gurgaon|\bIN\b/.test(t)) score += 10;
  if (/remote/.test(t)) score += 3;
  if (job.country === 'IN') score += 10;
  return score;
}

function dedup(opps) {
  const seen = new Set();
  return opps.filter(o => {
    const k = [(o.title || '').toLowerCase().trim(), (o.companyName || '').toLowerCase().trim(), (o.applyUrl || '').trim()].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Fetch helpers (server-side, no CORS issues) ─────────────────────────────

async function safeFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 10000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Greenhouse ───────────────────────────────────────────────────────────────
// Only slugs confirmed to return 200 (tested June 2026)
const GREENHOUSE_SLUGS = [
  'postman', 'stripe', 'coinbase', 'brex', 'gusto', 'twilio',
  'lyft', 'figma', 'notion', 'netlify', 'retool', 'loom',
  'grammarly', 'zapier', 'doordash',
];

async function fetchGreenhouse() {
  const results = [];
  await Promise.allSettled(
    GREENHOUSE_SLUGS.map(async (slug) => {
      try {
        const res = await safeFetch(
          `https://api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
          { timeout: 10000 }
        );
        if (!res.ok) return;
        const data = await res.json();
        (data.jobs || []).forEach(job => {
          const tags = (job.departments || []).map(d => d.name)
            .concat((job.offices || []).map(o => o.name));
          results.push({
            id: uid(), sourceId: String(job.id), sourceName: 'Greenhouse',
            sourceUrl: job.absolute_url || `https://jobs.greenhouse.io/${slug}`,
            title: job.title || 'Untitled', companyName: slug, companyLogo: null,
            description: stripHtml(job.content || ''),
            shortDescription: stripHtml(job.content || '').slice(0, 160),
            skills: tags.slice(0, 5), category: detectCategory(job.title, tags),
            opportunityType: detectType(job.title, tags),
            workMode: detectMode(job.location?.name || '', tags),
            experienceLevel: 'Intermediate',
            location: job.location?.name || 'Remote', country: '', city: job.location?.name || '',
            sector: detectSector(job.title, slug, tags, 'Greenhouse'),
            budgetMin: null, budgetMax: null, stipend: null, currency: 'USD',
            duration: null, applyType: 'external', applyUrl: job.absolute_url || '',
            isVerified: true, isUrgent: false, postedAt: toISO(job.updated_at),
            deadline: null, employerRating: null, tags, isSaved: false, isApplied: false,
          });
        });
      } catch { /* skip */ }
    })
  );
  return results;
}

// ── Lever ────────────────────────────────────────────────────────────────────
// Confirmed active Lever boards (tested June 2026)
const LEVER_SLUGS = [
  'freshworks', 'hashicorp', 'plaid', 'robinhood',
];

async function fetchLever() {
  const results = [];
  await Promise.allSettled(
    LEVER_SLUGS.map(async (slug) => {
      try {
        const res = await safeFetch(
          `https://api.lever.co/v0/postings/${slug}?mode=json`,
          { timeout: 10000 }
        );
        if (!res.ok) return;
        const jobs = await res.json();
        if (!Array.isArray(jobs)) return;
        jobs.forEach(job => {
          const tags = (job.categories?.allLocations || [])
            .concat(job.tags || [])
            .concat(job.categories?.department ? [job.categories.department] : []);
          results.push({
            id: uid(), sourceId: job.id, sourceName: 'Lever',
            sourceUrl: job.hostedUrl || `https://jobs.lever.co/${slug}`,
            title: job.text || 'Untitled', companyName: slug, companyLogo: null,
            description: stripHtml(job.descriptionPlain || job.description || ''),
            shortDescription: stripHtml(job.descriptionPlain || job.description || '').slice(0, 160),
            skills: (job.tags || []).slice(0, 5), category: detectCategory(job.text, job.tags || []),
            opportunityType: detectType(job.text, job.tags || []),
            workMode: detectMode(job.categories?.location || '', job.tags || []),
            experienceLevel: 'Intermediate',
            location: job.categories?.location || job.categories?.allLocations?.[0] || 'Remote',
            country: '', city: job.categories?.location || '',
            sector: detectSector(job.text, slug, job.tags || [], 'Lever'),
            budgetMin: null, budgetMax: null, stipend: null, currency: 'USD',
            duration: null, applyType: 'external', applyUrl: job.hostedUrl || job.applyUrl || '',
            isVerified: true, isUrgent: false, postedAt: toISO(job.createdAt),
            deadline: null, employerRating: null, tags, isSaved: false, isApplied: false,
          });
        });
      } catch { /* skip */ }
    })
  );
  return results;
}

// ── Arbeitnow ────────────────────────────────────────────────────────────────
async function fetchArbeitnow() {
  try {
    const res = await safeFetch('https://www.arbeitnow.com/api/job-board-api', { timeout: 10000 });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(job => {
      const tags = job.tags || [];
      return {
        id: uid(), sourceId: String(job.slug || job.url), sourceName: 'Arbeitnow',
        sourceUrl: job.url || 'https://www.arbeitnow.com',
        title: job.title || 'Untitled', companyName: job.company_name || 'Company', companyLogo: null,
        description: stripHtml(job.description || ''),
        shortDescription: stripHtml(job.description || '').slice(0, 160),
        skills: tags.slice(0, 5), category: detectCategory(job.title, tags),
        opportunityType: job.job_types?.[0] || detectType(job.title, tags),
        workMode: job.remote ? 'Remote' : detectMode(job.location || '', tags),
        experienceLevel: 'Intermediate', location: job.location || 'Remote',
        country: '', city: job.location || '',
        sector: detectSector(job.title, job.company_name || '', tags, 'Arbeitnow'),
        budgetMin: null, budgetMax: null, stipend: null, currency: 'EUR',
        duration: null, applyType: 'external', applyUrl: job.url || '',
        isVerified: false, isUrgent: false,
        postedAt: toISO(job.created_at ? job.created_at * 1000 : null),
        deadline: null, employerRating: null, tags, isSaved: false, isApplied: false,
      };
    });
  } catch { return []; }
}

// ── Jobicy ───────────────────────────────────────────────────────────────────
async function fetchJobicy() {
  try {
    const res = await safeFetch('https://jobicy.com/api/v2/remote-jobs?count=50', { timeout: 10000 });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(job => {
      const tags = (job.jobIndustry || []).concat(job.jobType ? [job.jobType] : []);
      return {
        id: uid(), sourceId: String(job.id), sourceName: 'Jobicy',
        sourceUrl: job.url || 'https://jobicy.com',
        title: job.jobTitle || 'Untitled', companyName: job.companyName || 'Company', companyLogo: null,
        description: stripHtml(job.jobDescription || ''),
        shortDescription: stripHtml(job.jobExcerpt || job.jobDescription || '').slice(0, 160),
        skills: (job.jobIndustry || []).slice(0, 5), category: detectCategory(job.jobTitle, job.jobIndustry || []),
        opportunityType: 'Freelance', workMode: 'Remote',
        experienceLevel: job.jobLevel || 'Intermediate',
        location: 'Remote', country: job.jobGeo || '', city: '',
        sector: 'Private',
        budgetMin: job.annualSalaryMin ? Math.round(job.annualSalaryMin / 12) : null,
        budgetMax: job.annualSalaryMax ? Math.round(job.annualSalaryMax / 12) : null,
        stipend: null, currency: job.salaryCurrency || 'USD',
        duration: null, applyType: 'external', applyUrl: job.url || '',
        isVerified: true, isUrgent: false, postedAt: toISO(job.pubDate),
        deadline: null, employerRating: null, tags, isSaved: false, isApplied: false,
      };
    });
  } catch { return []; }
}

// ── RemoteOK ─────────────────────────────────────────────────────────────────
async function fetchRemoteOk() {
  try {
    const res = await safeFetch('https://remoteok.com/api', {
      timeout: 10000,
      headers: { 'User-Agent': 'DolphinOpportunities/1.0 (https://www.dolphinorg.in)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.filter(j => j.id && j.position).map(job => {
      const tags = (job.tags || []).slice(0, 6);
      return {
        id: uid(), sourceId: String(job.id || job.slug), sourceName: 'RemoteOK',
        sourceUrl: job.url || 'https://remoteok.com',
        title: job.position || 'Untitled', companyName: job.company || 'Company', companyLogo: null,
        description: stripHtml(job.description || ''),
        shortDescription: stripHtml(job.description || '').slice(0, 160),
        skills: tags, category: detectCategory(job.position, tags),
        opportunityType: 'Freelance', workMode: 'Remote',
        experienceLevel: 'Intermediate', location: 'Remote (Worldwide)', country: '', city: '',
        sector: 'Private',
        budgetMin: job.salary_min || null, budgetMax: job.salary_max || null,
        stipend: null, currency: 'USD', duration: null, applyType: 'external',
        applyUrl: job.url || job.apply_url || '',
        isVerified: !!job.verified, isUrgent: false, postedAt: toISO(job.date),
        deadline: null, employerRating: null, tags, isSaved: false, isApplied: false,
      };
    });
  } catch { return []; }
}

// ── Government RSS (via rss2json) ─────────────────────────────────────────────
// Use only feeds that rss2json can actually parse (tested June 2026)
const GOVT_FEEDS = [
  { name: 'Employment News India', url: 'https://www.employment-news.in/feed/', sector: 'Government' },
  { name: 'Sarkari Naukri',        url: 'https://sarkarinaukriportal.com/feed/', sector: 'Government' },
  { name: 'NDTV Jobs',             url: 'https://feeds.feedburner.com/ndtvjobs', sector: 'Government' },
];

async function fetchGovtRss() {
  const results = [];
  await Promise.allSettled(
    GOVT_FEEDS.map(async ({ name, url, sector }) => {
      try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`;
        const res = await safeFetch(apiUrl, { timeout: 10000 });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'ok' || !Array.isArray(data.items)) return;
        data.items.forEach(item => {
          const title = stripHtml(item.title || '');
          const desc  = stripHtml(item.description || item.content || '');
          let category = 'Government';
          const t = (title + ' ' + desc).toLowerCase();
          if (/doctor|nurse|nurs|medical|health|paramedic/.test(t)) category = 'Healthcare';
          else if (/agri|farm|icar|horticulture/.test(t)) category = 'Agriculture';
          else if (/engineer|technical|tech/.test(t)) category = 'Engineering';
          else if (/teach|education|school|college/.test(t)) category = 'Education';
          else if (/bank|finance|account/.test(t)) category = 'Finance';

          results.push({
            id: uid(), sourceId: item.guid || item.link || uid(), sourceName: name,
            sourceUrl: item.link || '#', title, companyName: name, companyLogo: null,
            description: desc, shortDescription: desc.slice(0, 160),
            skills: [], category, opportunityType: 'Full-time', workMode: 'On-site',
            experienceLevel: 'Intermediate', location: 'India', country: 'IN', city: '',
            sector: 'Government', budgetMin: null, budgetMax: null, stipend: null, currency: 'INR',
            duration: null, applyType: 'external', applyUrl: item.link || '',
            isVerified: true, isUrgent: false, postedAt: toISO(item.pubDate),
            deadline: null, employerRating: null, tags: ['Government', 'India', category],
            isSaved: false, isApplied: false,
          });
        });
      } catch { /* skip */ }
    })
  );
  return results;
}

// ─── Main aggregator ─────────────────────────────────────────────────────────
async function buildOpportunities() {
  const [gh, lv, ab, jc, ro, gr] = await Promise.allSettled([
    fetchGreenhouse(),
    fetchLever(),
    fetchArbeitnow(),
    fetchJobicy(),
    fetchRemoteOk(),
    fetchGovtRss(),
  ]);

  let all = [];
  [gh, lv, ab, jc, ro, gr].forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) all = all.concat(r.value);
  });

  // Deduplicate
  const deduped = dedup(all);

  // Sort: India-relevant first, then by date
  deduped.sort((a, b) => {
    const sd = indiaScore(b) - indiaScore(a);
    if (sd !== 0) return sd;
    const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const db2 = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return db2 - da;
  });

  return deduped;
}

// ─── Route handler ────────────────────────────────────────────────────────────
// Public — no auth required (opportunities are public-facing)
// Rate limited by the global /api/ limiter in server.js (500 req/15 min)
router.get('/', async (req, res) => {
  try {
    // Serve from cache if fresh
    if (_cache && (Date.now() - _cacheAt) < CACHE_TTL_MS) {
      return res.json({ ok: true, count: _cache.length, data: _cache, cached: true });
    }

    // Build fresh
    const data  = await buildOpportunities();
    _cache  = data;
    _cacheAt = Date.now();

    // Override cache-control for this endpoint — we WANT caching here
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json({ ok: true, count: data.length, data, cached: false });
  } catch (err) {
    console.error('[Opportunities] Error:', err.message);
    // Return empty array — never crash the page
    return res.json({ ok: false, count: 0, data: [], error: 'Fetch failed, using local data' });
  }
});

// Manual cache bust — requires admin Authorization header as basic protection
router.post('/refresh', (req, res) => {
  // Simple token check — prevent public cache busting
  const auth = req.headers.authorization || '';
  if (process.env.CACHE_BUST_SECRET && auth !== `Bearer ${process.env.CACHE_BUST_SECRET}`) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }
  _cache  = null;
  _cacheAt = 0;
  res.json({ ok: true, message: 'Cache cleared — next GET will refresh from sources' });
});

module.exports = router;
