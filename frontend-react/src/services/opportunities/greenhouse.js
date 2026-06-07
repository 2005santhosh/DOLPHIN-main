/**
 * greenhouse.js — Fetches public job listings from Greenhouse-hosted companies.
 *
 * Greenhouse exposes a public API for any company that uses their ATS:
 *   GET https://api.greenhouse.io/v1/boards/{company}/jobs?content=true
 *
 * ── INDIA-FIRST COMPANY LIST ──────────────────────────────────────────────
 * Priority 1 — Companies known to hire in India:
 *   Companies with India offices that post India-based or India-eligible remote roles.
 *
 * Priority 2 — Global remote-friendly companies that commonly hire Indian talent.
 *
 * Find slugs at: https://boards.greenhouse.io/{slug}
 * ── ADD/REMOVE COMPANIES HERE ────────────────────────────────────────────────
 */
import { normalizeGreenhouse } from './normalizeOpportunity';

// Priority 1 — companies with India offices or India-specific postings
const INDIA_COMPANIES = [
  'freshworks',    // Freshworks — Chennai/Hyderabad HQ
  'zoho',          // Zoho Corp — Chennai HQ
  'razorpay',      // Razorpay — Bangalore
  'groww',         // Groww — Bangalore
  'moengage',      // MoEngage — Bangalore
  'browserstack',  // BrowserStack — Mumbai/Remote
  'postman',       // Postman — Bangalore/San Francisco
  'chargebee',     // Chargebee — Chennai/Remote
];

// Priority 2 — global companies that actively hire Indian talent remotely
const GLOBAL_REMOTE_COMPANIES = [
  'airbyte',
  'sourcegraph',
  'posthog',
  'vercel',
  'dbt',
  'linear',
];

// All companies: India-first, then global
export const GREENHOUSE_COMPANIES = [...INDIA_COMPANIES, ...GLOBAL_REMOTE_COMPANIES];

export async function fetchGreenhouseJobs(companies = GREENHOUSE_COMPANIES) {
  const results = [];

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        const res = await fetch(
          `https://api.greenhouse.io/v1/boards/${company}/jobs?content=true`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        const jobs = data.jobs || [];
        jobs.forEach(job => results.push(normalizeGreenhouse(job, company)));
      } catch {
        // Silently skip failed company — don't break the whole fetch
      }
    })
  );

  return results;
}
