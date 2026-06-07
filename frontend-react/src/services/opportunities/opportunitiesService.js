/**
 * opportunitiesService.js
 *
 * All opportunity fetching now goes through the backend proxy at
 * GET /api/opportunities
 *
 * Benefits:
 *  - Zero CORS errors (server-to-server calls, not browser-to-external)
 *  - Zero 404 noise (backend silently skips dead slugs)
 *  - 10-minute server-side cache → 1000+ users all share one cached payload
 *  - Fast load: single HTTP call instead of 15+ parallel browser fetches
 *  - No external API keys needed in the browser
 */

import { MOCK_OPPORTUNITIES } from './mockData';
import { applyIndiaFilter    } from './indiaRelevance';

// VITE_API_URL is already "https://api.dolphinorg.in/api" — strip trailing /api if present
// so we can safely append /api/opportunities without doubling up.
const _raw = import.meta.env.VITE_API_URL || 'https://api.dolphinorg.in';
const API_BASE = _raw.replace(/\/api\/?$/, '');

// ── In-browser micro-cache (30 seconds) ─────────────────────────────────────
// Prevents re-fetching when the user navigates away and back quickly.
let _localCache = null;
let _localCacheAt = 0;
const LOCAL_CACHE_TTL = 30 * 1000; // 30 seconds

export async function fetchAllOpportunities({
  useMockFallback = true,
} = {}) {
  // Serve from local micro-cache if still fresh
  if (_localCache && (Date.now() - _localCacheAt) < LOCAL_CACHE_TTL) {
    return _localCache;
  }

  try {
    const res = await fetch(`${API_BASE}/api/opportunities`, {
      signal: AbortSignal.timeout(20000), // generous — backend does the heavy lifting
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const opps = Array.isArray(json.data) ? json.data : [];

    if (opps.length === 0 && useMockFallback) {
      const fallback = applyIndiaFilter(MOCK_OPPORTUNITIES.map(o => ({ ...o })));
      _localCache  = fallback;
      _localCacheAt = Date.now();
      return fallback;
    }

    // Re-attach client-side state (isSaved/isApplied are stored locally)
    const withState = opps.map(o => ({
      ...o,
      isSaved:   false,
      isApplied: false,
    }));

    _localCache  = withState;
    _localCacheAt = Date.now();
    return withState;

  } catch (err) {
    console.warn('[Opportunities] Backend fetch failed, using mock data:', err.message);
    if (useMockFallback) {
      const fallback = applyIndiaFilter(MOCK_OPPORTUNITIES.map(o => ({ ...o })));
      return fallback;
    }
    return [];
  }
}

export function clearOpportunitiesCache() {
  _localCache  = null;
  _localCacheAt = 0;
}
