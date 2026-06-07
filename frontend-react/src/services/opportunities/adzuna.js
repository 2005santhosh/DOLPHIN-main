/**
 * adzuna.js — Adzuna API connector.
 *
 * ⚠️  CORS LIMITATION: Adzuna does NOT allow direct browser-to-API calls.
 * The Adzuna API must be called from a backend server, not from the browser.
 *
 * ── HOW TO ENABLE ADZUNA ──────────────────────────────────────────────────
 * 1. Add to your Railway backend (.env):
 *      ADZUNA_APP_ID=your_app_id
 *      ADZUNA_APP_KEY=your_app_key
 *
 * 2. Create a proxy route in your backend (backend/routes/opportunities.js):
 *      router.get('/adzuna', protect, async (req, res) => {
 *        const { what = 'developer' } = req.query;
 *        const url = `https://api.adzuna.com/v1/api/jobs/in/search/1` +
 *          `?app_id=${process.env.ADZUNA_APP_ID}` +
 *          `&app_key=${process.env.ADZUNA_APP_KEY}` +
 *          `&what=${encodeURIComponent(what)}&results_per_page=20&sort_by=date`;
 *        const data = await fetch(url).then(r => r.json());
 *        res.json(data.results || []);
 *      });
 *
 * 3. Replace the fetch in this file:
 *      const res = await fetch(`/api/opportunities/adzuna?what=${term}`, ...);
 *
 * For now this connector returns [] to prevent CORS errors.
 * ─────────────────────────────────────────────────────────────────────────
 */

export async function fetchAdzunaJobs() {
  // Adzuna requires a backend proxy — cannot be called directly from browser.
  // Return empty array until a backend proxy is set up.
  return [];
}
