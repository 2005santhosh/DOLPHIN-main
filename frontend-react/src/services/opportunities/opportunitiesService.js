/**
 * opportunitiesService.js — Aggregates all opportunity sources.
 *
 * Usage:
 *   import { fetchAllOpportunities } from '../services/opportunities/opportunitiesService';
 *   const jobs = await fetchAllOpportunities();
 *
 * To add a new source:
 *   1. Create a new file in this folder (e.g. remoteok.js)
 *   2. Export an async fetchXxxJobs() function that returns normalized opportunities
 *   3. Add it to the fetchers array below
 *
 * To move fetching to your backend later:
 *   Replace each fetchXxx() call with a call to your own API endpoint.
 */
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs       } from './lever';
import { fetchArbeitnowJobs   } from './arbeitnow';
import { fetchJobicyJobs      } from './jobicy';
import { MOCK_OPPORTUNITIES   } from './mockData';

// Simple in-memory cache: { data, fetchedAt }
let _cache = null;
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

export async function fetchAllOpportunities({ useMockFallback = true } = {}) {
  // Return cached data if fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data;
  }

  const fetchers = [
    fetchGreenhouseJobs(),
    fetchLeverJobs(),
    fetchArbeitnowJobs(),
    fetchJobicyJobs(),
  ];

  const results = await Promise.allSettled(fetchers);

  let allOpps = [];
  let anySucceeded = false;

  results.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allOpps = allOpps.concat(result.value);
      if (result.value.length > 0) anySucceeded = true;
    }
  });

  // Fall back to mock data if all APIs failed or returned nothing
  if (!anySucceeded && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  } else if (allOpps.length === 0 && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  }

  // Deduplicate and sort newest first
  const deduped = deduplicateOpportunities(allOpps);
  deduped.sort((a, b) => {
    const da = a.postedAt ? new Date(a.postedAt) : new Date(0);
    const db = b.postedAt ? new Date(b.postedAt) : new Date(0);
    return db - da;
  });

  _cache = { data: deduped, fetchedAt: Date.now() };
  return deduped;
}

/** Clear cache (call after user saves/applies to an opportunity) */
export function clearOpportunitiesCache() {
  _cache = null;
}
