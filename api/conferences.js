// api/conferences.js
// Vercel serverless function to return the latest conferences.json from GitHub.

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'https://lengocluyen.github.io',
    'https://lengocluyen.vercel.app',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).end('Method Not Allowed');
  }

  const owner = 'lengocluyen';
  const repo = 'lengocluyen.github.io';
  const path = 'conferences.json';
  const token = process.env.GITHUB_TOKEN;

  try {
    const ghHeaders = {
      Accept: 'application/vnd.github.raw',
      'User-Agent': 'vercel-conferences',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) ghHeaders.Authorization = `Bearer ${token}`;

    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: ghHeaders }
    );

    const bodyText = await ghRes.text();
    if (!ghRes.ok) {
      return res.status(ghRes.status).json({
        error: 'GitHub read failed',
        details: bodyText,
      });
    }

    // Validate JSON before returning.
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return res.status(502).json({ error: 'Invalid JSON in conferences.json' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

