/**
 * opportunitiesService.js — Aggregates all opportunity sources with India-first ranking.
 *
 * Usage:
 *   import { fetchAllOpportunities } from '../services/opportunities/opportunitiesService';
 *   const jobs = await fetchAllOpportunities({ showGlobal: false, englishOnly: true });
 *
 * India-first logic:
 *   - Every job gets a relevanceScore via scoreOpportunity()
 *   - India-located jobs score 100+
 *   - Remote-eligible jobs score 60+
 *   - Non-English jobs are filtered out when englishOnly=true
 *   - Foreign non-remote jobs are filtered out when showGlobal=false
 *   - Results are sorted: relevanceScore DESC, then postedAt DESC
 *
 * To add a new source:
 *   1. Create a connector file (e.g. remoteok.js)
 *   2. Export async fetchXxxJobs() → normalized opportunities[]
 *   3. Add to the fetchers array below
 *
 * To move fetching to your backend later:
 *   Replace each fetchXxx() call with a call to your own API endpoint.
 */
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs       } from './lever';
import { fetchArbeitnowJobs   } from './arbeitnow';
import { fetchJobicyJobs      } from './jobicy';
import { MOCK_OPPORTUNITIES   } from './mockData';
import { applyIndiaFilter     } from './indiaRelevance';

// Simple in-memory cache: keyed by option string → { data, fetchedAt }
// Cleared on module load so stale pre-deploy data never survives a redeployment.
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Deduplicate by title+company+location+applyUrl */
function deduplicateOpportunities(opps) {
  const seen = new Set();
  return opps.filter(opp => {
    const key = [
      (opp.title || '').toLowerCase().trim(),
      (opp.companyName || '').toLowerCase().trim(),
      (opp.location || '').toLowerCase().trim(),
      (opp.applyUrl || '').trim(),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch, merge, deduplicate, score, filter, and sort all opportunities.
 *
 * @param {object}  opts
 * @param {boolean} opts.useMockFallback  — use mock data when all APIs fail
 * @param {boolean} opts.showGlobal       — include non-India, non-remote jobs
 * @param {boolean} opts.englishOnly      — exclude likely non-English listings
 * @returns {Promise<object[]>}           — scored + sorted opportunities
 */
export async function fetchAllOpportunities({
  useMockFallback = true,
  showGlobal      = false,
  englishOnly     = true,
} = {}) {
  const cacheKey = `${showGlobal}_${englishOnly}`;

  // Return cached data if fresh
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch all sources in parallel — partial failures are tolerated
  const [ghResult, lvResult, abResult, jcResult] = await Promise.allSettled([
    fetchGreenhouseJobs(),
    fetchLeverJobs(),
    fetchArbeitnowJobs(),   // Secondary — global feed, lower India relevance
    fetchJobicyJobs(),      // Secondary — remote-only, moderate India relevance
  ]);

  let allOpps = [];
  let anySucceeded = false;

  [ghResult, lvResult, abResult, jcResult].forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
      allOpps = allOpps.concat(result.value);
      anySucceeded = true;
    }
  });

  // Fall back to mock data when all APIs failed or returned nothing
  if (!anySucceeded && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  } else if (allOpps.length === 0 && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  }

  // Deduplicate first
  const deduped = deduplicateOpportunities(allOpps);

  // Apply India-first scoring, filtering, and sorting
  // minScore: 0 means any job with some India relevance (remote jobs pass);
  //           jobs scoring below 0 (foreign, non-remote) are hidden unless showGlobal=true
  const scored = applyIndiaFilter(deduped, {
    showGlobal,
    englishOnly,
    minScore: showGlobal ? -999 : 1, // score >= 1 means at least remote-eligible
  });

  _cache.set(cacheKey, { data: scored, fetchedAt: Date.now() });
  return scored;
}

/** Clear cache — call when user saves/applies, or when filters change */
export function clearOpportunitiesCache() {
  _cache.clear();
}
