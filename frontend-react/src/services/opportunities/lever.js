/**
 * lever.js — Fetches public job listings from Lever-hosted companies.
 *
 * Lever exposes a public postings API:
 *   GET https://api.lever.co/v0/postings/{company}?mode=json
 *
 * ── INDIA-FIRST COMPANY LIST ──────────────────────────────────────────────
 * Priority 1 — companies with India offices or India-specific postings.
 * Priority 2 — global remote-friendly companies that hire Indian talent.
 *
 * Find slugs at: https://jobs.lever.co/{slug}
 * ── ADD/REMOVE COMPANIES HERE ────────────────────────────────────────────────
 */
import { normalizeLever } from './normalizeOpportunity';

// Priority 1 — India offices or strong India hiring history
const INDIA_COMPANIES = [
  'meesho',        // Meesho — Bangalore
  'swiggy',        // Swiggy — Bangalore
  'dunzo',         // Dunzo — Bangalore
  'cred',          // CRED — Bangalore
  'zepto',         // Zepto — Mumbai
  'sharechat',     // ShareChat — Bangalore
];

// Priority 2 — global remote-friendly, known to hire in India
const GLOBAL_REMOTE_COMPANIES = [
  'netlify',
  'figma',
  'miro',
  'loom',
  'notion',
  'retool',
];

export const LEVER_COMPANIES = [...INDIA_COMPANIES, ...GLOBAL_REMOTE_COMPANIES];

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
