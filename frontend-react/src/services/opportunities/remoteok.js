/**
 * remoteok.js — Fetches remote jobs from RemoteOK's public JSON API.
 *
 * Endpoint: https://remoteok.com/api
 * No API key required. Covers tech + non-tech remote roles.
 *
 * Rate limit: be polite — don't call more than once per 5 minutes (handled by cache).
 */

import { normalizeRemoteOk } from './normalizeOpportunity';

export async function fetchRemoteOkJobs() {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        // RemoteOK requires a User-Agent header otherwise it returns 403
        'User-Agent': 'DolphinOpportunities/1.0 (https://www.dolphinorg.in)',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // First element is a legal notice object — filter it out
    const jobs = data.filter(j => j.id && j.position);
    return jobs.map(normalizeRemoteOk);
  } catch {
    return [];
  }
}
