/**
 * lever.js — Fetches public job listings from Lever-hosted companies.
 *
 * Lever exposes a public postings API:
 *   GET https://api.lever.co/v0/postings/{company}?mode=json
 *
 * ── ADD/REMOVE COMPANIES HERE ──────────────────────────────────────────────
 * Replace or extend this array with any Lever company slug.
 * Find slugs at: https://jobs.lever.co/{slug}
 */
import { normalizeLever } from './normalizeOpportunity';

const LEVER_COMPANIES = [
  'netlify',
  'figma',
  'miro',
  'loom',
  'notion',
  'retool',
];

export async function fetchLeverJobs(companies = LEVER_COMPANIES) {
  const results = [];

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        const res = await fetch(
          `https://api.lever.co/v0/postings/${company}?mode=json`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return;
        const jobs = await res.json();
        if (!Array.isArray(jobs)) return;
        jobs.forEach(job => results.push(normalizeLever(job, company)));
      } catch {
        // Silently skip failed company
      }
    })
  );

  return results;
}
