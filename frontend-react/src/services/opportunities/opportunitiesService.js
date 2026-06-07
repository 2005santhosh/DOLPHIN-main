/**
 * opportunitiesService.js — Aggregates all opportunity sources with India-first ranking.
 *
 * Sources:
 *   Greenhouse    — Tech companies, India + global remote
 *   Lever         — Tech + product companies, India + global remote
 *   Arbeitnow     — Broad multi-sector international jobs board
 *   Jobicy        — Remote-only jobs worldwide
 *   Adzuna India  — ALL sectors: IT, healthcare, nursing, agriculture, govt, finance
 *                   Requires free API key: VITE_ADZUNA_APP_ID + VITE_ADZUNA_APP_KEY
 *   RemoteOK      — Remote jobs, no key required
 *   Govt RSS      — Indian government job notifications (UPSC, SSC, NHM, Employment News)
 *
 * India-first scoring applied to all results via indiaRelevance.js.
 */
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs       } from './lever';
import { fetchArbeitnowJobs   } from './arbeitnow';
import { fetchJobicyJobs      } from './jobicy';
import { fetchAdzunaJobs      } from './adzuna';
import { fetchRemoteOkJobs    } from './remoteok';
import { fetchGovtRssJobs     } from './govtRss';
import { MOCK_OPPORTUNITIES   } from './mockData';
import { applyIndiaFilter     } from './indiaRelevance';

// Cache keyed by option string — clears on each module load (new deploy)
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

export async function fetchAllOpportunities({
  useMockFallback = true,
  showGlobal      = false,
  englishOnly     = true,
} = {}) {
  const cacheKey = `${showGlobal}_${englishOnly}`;
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch all sources in parallel — partial failures are tolerated
  const [ghResult, lvResult, abResult, jcResult, azResult, roResult, grResult] =
    await Promise.allSettled([
      fetchGreenhouseJobs(),
      fetchLeverJobs(),
      fetchArbeitnowJobs(),
      fetchJobicyJobs(),
      fetchAdzunaJobs(),     // All sectors — requires free Adzuna key
      fetchRemoteOkJobs(),   // Remote jobs, no key
      fetchGovtRssJobs(),    // Government RSS notifications
    ]);

  let allOpps     = [];
  let anySucceeded = false;

  [ghResult, lvResult, abResult, jcResult, azResult, roResult, grResult].forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
      allOpps = allOpps.concat(result.value);
      anySucceeded = true;
    }
  });

  if (!anySucceeded && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  } else if (allOpps.length === 0 && useMockFallback) {
    allOpps = MOCK_OPPORTUNITIES.map(o => ({ ...o }));
  }

  const deduped = deduplicateOpportunities(allOpps);
  const scored  = applyIndiaFilter(deduped, {
    showGlobal,
    englishOnly,
    minScore: showGlobal ? -999 : 1,
  });

  _cache.set(cacheKey, { data: scored, fetchedAt: Date.now() });
  return scored;
}

export function clearOpportunitiesCache() {
  _cache.clear();
}
