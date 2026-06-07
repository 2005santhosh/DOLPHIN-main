/**
 * indiaRelevance.js — India-first scoring and filtering helpers.
 *
 * Scoring tiers (higher = shown first):
 *   100+ → India location explicitly mentioned
 *   60   → Remote + explicitly eligible for India / "Worldwide"
 *   40   → Remote (no geo restriction detected, likely India-eligible)
 *   20   → Verified listing
 *   10   → Recent (posted within 7 days)
 *    0   → Foreign / non-India
 *  -50   → Non-English listing (filtered out when englishOnly = true)
 *
 * The final relevanceScore is the SUM of applicable tiers.
 */

// ── India geo keywords ────────────────────────────────────────────────────────
const INDIA_CITIES = [
  'india', 'hyderabad', 'bangalore', 'bengaluru', 'chennai',
  'pune', 'mumbai', 'delhi', 'noida', 'gurugram', 'gurgaon',
  'kolkata', 'ahmedabad', 'kochi', 'coimbatore', 'jaipur',
  'chandigarh', 'indore', 'nagpur', 'vizag', 'visakhapatnam',
  'bhubaneswar', 'lucknow', 'surat', 'vadodara', 'thiruvananthapuram',
  'trivandrum', 'mysore', 'mysuru', 'mangalore', 'hubli',
];

// Keywords that explicitly indicate India-eligible remote work
const INDIA_REMOTE_SIGNALS = [
  'india', 'worldwide', 'global', 'anywhere', 'emea', 'apac',
  'asia', 'asia pacific', 'south asia',
];

// Strong signals that a job is NOT meant for Indian candidates
const EXCLUDE_REGIONS = [
  'united states only', 'us only', 'us citizens', 'uk only',
  'eu only', 'europe only', 'canada only', 'australia only',
  'germany only', 'france only', 'netherlands only',
];

// Common non-English character ranges / patterns
const NON_ENGLISH_REGEX = /[\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if this opportunity is explicitly India-based.
 * Checks location, city, country, and description for India keywords.
 */
export function isIndiaOpportunity(opp) {
  const haystack = [
    opp.location, opp.city, opp.country,
    opp.companyName, opp.title,
  ].join(' ').toLowerCase();

  return INDIA_CITIES.some(k => haystack.includes(k));
}

/**
 * Returns true if the listing is likely accessible to Indian remote workers.
 * Remote jobs with no explicit geo restriction are considered eligible.
 */
export function isRemoteEligible(opp) {
  if (opp.workMode !== 'Remote') return false;

  const haystack = [
    opp.location, opp.description, opp.shortDescription,
  ].join(' ').toLowerCase();

  // Exclude if explicitly restricted to a non-India region
  if (EXCLUDE_REGIONS.some(excl => haystack.includes(excl))) return false;

  // Positive signal: explicitly mentions India or global eligibility
  if (INDIA_REMOTE_SIGNALS.some(sig => haystack.includes(sig))) return true;

  // No region restriction detected on a remote job → assume eligible
  return true;
}

/**
 * Returns true if the listing is likely written in English.
 * Heuristic: no non-latin character blocks in title + short description.
 */
export function isLikelyEnglish(opp) {
  const sample = [opp.title, opp.shortDescription].join(' ');
  return !NON_ENGLISH_REGEX.test(sample);
}

/**
 * Compute an India-relevance score for sorting.
 * Higher score = shown earlier in the feed.
 *
 * @param {object} opp  — normalized opportunity
 * @returns {number}    — relevanceScore (added to the opp object)
 */
export function scoreOpportunity(opp) {
  let score = 0;

  // Tier 1 — India location
  if (isIndiaOpportunity(opp)) score += 100;

  // Tier 2 — Remote eligible for India
  else if (isRemoteEligible(opp)) score += 60;

  // Tier 3 — Generic remote (no restriction, but workMode = Remote)
  else if (opp.workMode === 'Remote') score += 40;

  // Tier 4 — Verified badge
  if (opp.isVerified) score += 20;

  // Tier 5 — Recency bonus (posted within 7 days)
  if (opp.postedAt) {
    const ageDays = (Date.now() - new Date(opp.postedAt)) / 86400000;
    if (ageDays <= 1) score += 15;
    else if (ageDays <= 3) score += 10;
    else if (ageDays <= 7) score += 5;
  }

  // Penalty — non-English listing
  if (!isLikelyEnglish(opp)) score -= 50;

  return score;
}

/**
 * Filter and sort an array of opportunities for India-first display.
 *
 * @param {object[]} opps
 * @param {object}   opts
 * @param {boolean}  opts.showGlobal    — include non-India, non-remote jobs
 * @param {boolean}  opts.englishOnly   — exclude likely non-English listings
 * @param {number}   opts.minScore      — minimum relevance score to include (default: 0)
 * @returns {object[]}  — scored + filtered + sorted array
 */
export function applyIndiaFilter(opps, {
  showGlobal  = false,
  englishOnly = true,
  minScore    = 0,
} = {}) {
  // Score every opportunity
  const scored = opps.map(opp => ({ ...opp, relevanceScore: scoreOpportunity(opp) }));

  // Filter
  const filtered = scored.filter(opp => {
    if (englishOnly && !isLikelyEnglish(opp)) return false;
    if (!showGlobal && opp.relevanceScore < minScore) return false;
    return true;
  });

  // Sort: relevanceScore DESC, then postedAt DESC
  filtered.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    const da = a.postedAt ? new Date(a.postedAt) : new Date(0);
    const db = b.postedAt ? new Date(b.postedAt) : new Date(0);
    return db - da;
  });

  return filtered;
}
