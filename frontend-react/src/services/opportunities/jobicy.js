/**
 * jobicy.js — Fetches remote jobs from Jobicy's free public API.
 * Endpoint: https://jobicy.com/api/v2/remote-jobs
 * No API key required.
 */
import { normalizeJobicy } from './normalizeOpportunity';

export async function fetchJobicyJobs() {
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.jobs || [];
    return jobs.map(normalizeJobicy);
  } catch {
    return [];
  }
}
