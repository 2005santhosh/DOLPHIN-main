/**
 * lever.js — Fetches public job listings from Lever-hosted companies.
 *
 * Only companies with VERIFIED active Lever job boards are listed here.
 * Before adding a company, confirm the board exists:
 *   https://api.lever.co/v0/postings/{slug}
 *
 * ── ADD/REMOVE COMPANIES HERE ──────────────────────────────────────────────
 * Find working slugs at: https://jobs.lever.co/{slug}
 *
 * REMOVED (use Greenhouse, not Lever):
 *   airbyte, sourcegraph, posthog, retool, loom, figma, notion
 *   netlify, miro, dunzo, zepto, swiggy, sharechat, groww, cred-club, meesho
 */
import { normalizeLever } from './normalizeOpportunity';

// Verified working Lever slugs (checked June 2026)
export const LEVER_COMPANIES = [
  // India offices or strong India remote hiring
  'freshworks',    // Freshworks — Chennai/Hyderabad
  'razorpay',      // Razorpay — Bangalore

  // Global remote-friendly confirmed on Lever
  'dbt-labs',      // dbt Labs
  'hashicorp',     // HashiCorp — remote-first
  'plaid',         // Plaid
  'robinhood',     // Robinhood
  'segment',       // Segment (Twilio)
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
        // 404 = company doesn't use Lever or slug is wrong — skip silently
        if (!res.ok) return;
        const jobs = await res.json();
        if (!Array.isArray(jobs)) return;
        jobs.forEach(job => results.push(normalizeLever(job, company)));
      } catch {
        // Network error or timeout — skip silently
      }
    })
  );

  return results;
}
