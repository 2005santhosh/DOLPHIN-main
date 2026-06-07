/**
 * govtRss.js — Fetches Indian government job notifications from public RSS feeds.
 *
 * Sources used (all 100% public, no scraping, no ToS violation):
 *   - Sarkari Result RSS  — aggregates UPSC, SSC, banking, railway, state PSC
 *   - Employment News RSS — official GOI weekly employment newspaper
 *   - NHM Jobs RSS        — National Health Mission (doctors, nurses, paramedics)
 *   - ICAR Jobs           — Indian Council of Agricultural Research
 *
 * RSS is fetched via a public CORS proxy (rss2json.com free tier).
 * If the proxy is down, this source is silently skipped.
 *
 * No API key required.
 */

import { normalizeGovtRss } from './normalizeOpportunity';

// rss2json converts any public RSS feed to JSON and handles CORS
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

const GOVT_FEEDS = [
  {
    name: 'Sarkari Result',
    url:  'https://www.sarkariresult.com/feed/',
    sector: 'Government',
  },
  {
    name: 'Employment News',
    url:  'https://www.employmentnews.gov.in/rss.aspx',
    sector: 'Government',
  },
  {
    name: 'NHM Jobs',
    url:  'https://nhmrajasthan.org/feed/',
    sector: 'Healthcare',
  },
];

export async function fetchGovtRssJobs() {
  const results = [];

  await Promise.allSettled(
    GOVT_FEEDS.map(async ({ name, url, sector }) => {
      try {
        const apiUrl = `${RSS2JSON}${encodeURIComponent(url)}&count=20`;
        const res    = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'ok' || !Array.isArray(data.items)) return;
        data.items.forEach(item => results.push(normalizeGovtRss(item, name, sector)));
      } catch {
        // Silently skip failed feeds
      }
    })
  );

  return results;
}
