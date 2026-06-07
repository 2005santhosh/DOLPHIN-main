/**
 * adzuna.js — Fetches jobs from Adzuna's free public API.
 *
 * API docs: https://developer.adzuna.com/
 * Registration (free): https://developer.adzuna.com/signup
 *   → Get app_id and app_key (free tier: 1000 calls/day)
 *
 * ── SETUP ──────────────────────────────────────────────────────────────────
 * Add these to your Vercel environment variables:
 *   VITE_ADZUNA_APP_ID=your_app_id
 *   VITE_ADZUNA_APP_KEY=your_app_key
 *
 * Without credentials, this connector is silently skipped — other sources
 * continue to work normally.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Covers ALL sectors: IT, healthcare, nursing, engineering, agriculture,
 * government, finance, education, hospitality — broadest India coverage.
 */

import { normalizeAdzuna } from './normalizeOpportunity';

const APP_ID  = import.meta.env.VITE_ADZUNA_APP_ID;
const APP_KEY = import.meta.env.VITE_ADZUNA_APP_KEY;

// India categories to fetch — covers all major sectors
// Adzuna category tags: https://api.adzuna.com/v1/api/jobs/in/categories
const INDIA_SEARCH_TERMS = [
  'doctor',
  'nurse',
  'engineer',
  'agriculture',
  'government',
  'software developer',
  'data analyst',
  'teacher',
  'accountant',
  'marketing',
];

const MAX_RESULTS_PER_TERM = 10; // keeps total under 100 results and well within free quota

export async function fetchAdzunaJobs() {
  if (!APP_ID || !APP_KEY) {
    // No credentials configured — skip silently
    console.info('[Adzuna] Skipped: VITE_ADZUNA_APP_ID or VITE_ADZUNA_APP_KEY not set.');
    return [];
  }

  const results = [];

  await Promise.allSettled(
    INDIA_SEARCH_TERMS.map(async (term) => {
      try {
        const url = new URL('https://api.adzuna.com/v1/api/jobs/in/search/1');
        url.searchParams.set('app_id',        APP_ID);
        url.searchParams.set('app_key',       APP_KEY);
        url.searchParams.set('what',          term);
        url.searchParams.set('results_per_page', String(MAX_RESULTS_PER_TERM));
        url.searchParams.set('content-type',  'application/json');
        // Sort by date so we get the most recent listings
        url.searchParams.set('sort_by',       'date');

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = await res.json();
        const jobs = data.results || [];
        jobs.forEach(job => results.push(normalizeAdzuna(job, term)));
      } catch {
        // Silently skip failed searches
      }
    })
  );

  return results;
}
