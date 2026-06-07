/**
 * arbeitnow.js — Fetches jobs from Arbeitnow's free public job board API.
 * Endpoint: https://www.arbeitnow.com/api/job-board-api
 * No API key required.
 */
import { normalizeArbeitnow } from './normalizeOpportunity';

export async function fetchArbeitnowJobs() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.data || [];
    return jobs.map(normalizeArbeitnow);
  } catch {
    return [];
  }
}
