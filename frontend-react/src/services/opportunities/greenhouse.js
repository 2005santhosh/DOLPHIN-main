/**
 * greenhouse.js — Fetches public job listings from Greenhouse-hosted companies.
 *
 * Greenhouse exposes a public API for any company that uses their ATS:
 *   GET https://api.greenhouse.io/v1/boards/{company}/jobs?content=true
 *
 * ── ADD/REMOVE COMPANIES HERE ──────────────────────────────────────────────
 * Replace or extend this array with any Greenhouse company slug.
 * Find slugs at: https://boards.greenhouse.io/{slug}
 */
import { normalizeGreenhouse } from './normalizeOpportunity';

const GREENHOUSE_COMPANIES = [
  'airbyte',
  'sourcegraph',
  'posthog',
  'linear',
  'dbt',
  'vercel',
];

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
