/**
 * greenhouse.js — Fetches public job listings from Greenhouse-hosted companies.
 *
 * Only companies with VERIFIED active Greenhouse job boards are listed here.
 * Before adding a company, confirm the board exists:
 *   https://api.greenhouse.io/v1/boards/{slug}/jobs
 *
 * ── ADD/REMOVE COMPANIES HERE ──────────────────────────────────────────────
 * Find working slugs at: https://boards.greenhouse.io/{slug}
 */
import { normalizeGreenhouse } from './normalizeOpportunity';

// Verified working Greenhouse slugs (checked June 2026)
// India-relevant or remote-friendly companies
export const GREENHOUSE_COMPANIES = [
  // India-connected / strong India hiring
  'postman',       // Postman — Bangalore/SF (verify: boards.greenhouse.io/postman)
  'chargebee',     // Chargebee — Chennai/Remote
  'browserstack',  // BrowserStack — Mumbai/Remote
  'moengage',      // MoEngage — Bangalore

  // Global remote-friendly — frequently hire Indian talent
  'vercel',        // Vercel
  'linear',        // Linear
  'planetscale',   // PlanetScale
  'retool',        // Retool (moved to Greenhouse from Lever)
  'loom',          // Loom
  'grammarly',     // Grammarly
  'zapier',        // Zapier — fully remote

  // Large tech companies with India offices on Greenhouse
  'stripe',        // Stripe
  'figma',         // Figma (backup — also on Lever)
  'notion',        // Notion
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
