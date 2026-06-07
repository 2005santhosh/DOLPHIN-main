/**
 * greenhouse.js — Fetches public job listings from Greenhouse-hosted companies.
 *
 * Only companies with VERIFIED active Greenhouse job boards are listed here.
 * Before adding a company, confirm the board exists:
 *   https://api.greenhouse.io/v1/boards/{slug}/jobs
 *
 * ── ADD/REMOVE COMPANIES HERE ──────────────────────────────────────────────
 * Find working slugs at: https://boards.greenhouse.io/{slug}
 *
 * REMOVED (404 — not on Greenhouse or slug mismatch):
 *   freshworks, zoho, razorpay, sourcegraph, posthog, browserstack,
 *   dbt (slug is dbt-labs on Lever), moengage, airbyte, chargebee, linear,
 *   retool, loom, figma, notion, planetscale
 */
import { normalizeGreenhouse } from './normalizeOpportunity';

// Verified working Greenhouse slugs (checked June 2026)
export const GREENHOUSE_COMPANIES = [
  // India-connected / strong India hiring — confirmed Greenhouse
  'postman',       // Postman — Bangalore/SF

  // Global remote-friendly — confirmed Greenhouse boards
  'grammarly',     // Grammarly — remote-friendly
  'zapier',        // Zapier — fully remote
  'stripe',        // Stripe — large India presence
  'coinbase',      // Coinbase — remote-friendly
  'brex',          // Brex
  'gusto',         // Gusto
  'doordash',      // DoorDash
  'lyft',          // Lyft
  'twilio',        // Twilio — strong India presence
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
        // 404 = company doesn't use Greenhouse or slug is wrong — skip silently
        if (!res.ok) return;
        const data = await res.json();
        const jobs = data.jobs || [];
        jobs.forEach(job => results.push(normalizeGreenhouse(job, company)));
      } catch {
        // Network error or timeout — skip silently
      }
    })
  );

  return results;
}
