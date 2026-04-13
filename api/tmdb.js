export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TMDB API key not configured' });

  const { path, ...params } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const qs = new URLSearchParams({ ...params, api_key: apiKey, language: 'fr-FR' });
  const url = `https://api.themoviedb.org/3/${path}?${qs}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
