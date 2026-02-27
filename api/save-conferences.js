// api/save-conferences.js
// Vercel serverless function to update conferences.json in the repo.

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { conferences } = req.body;
  if (!Array.isArray(conferences)) {
    return res.status(400).json({ error: 'conferences must be an array' });
  }

  const token = process.env.GITHUB_TOKEN; // set in Vercel dashboard
  if (!token) {
    return res
      .status(500)
      .json({ error: 'Missing GITHUB_TOKEN environment variable' });
  }

  const owner = 'lengocluyen';                     // replace with your GitHub username/org if different
  const repo  = 'lengocluyen.github.io';           // repository name
  const path  = 'conferences.json';

  try {
    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vercel-save-conferences',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // fetch current file to obtain SHA
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: ghHeaders,
      }
    );
    const getBody = await getRes.json();
    if (!getRes.ok) {
      return res.status(getRes.status).json({
        error: 'GitHub read failed',
        details: getBody,
      });
    }

    const sha = getBody.sha;

    const content = Buffer.from(JSON.stringify(conferences, null, 2)).toString(
      'base64'
    );

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...ghHeaders,
        },
        body: JSON.stringify({
          message: 'Update conferences.json via API',
          content,
          sha,
        }),
      }
    );

    const putBody = await putRes.json();
    if (!putRes.ok) {
      return res.status(putRes.status).json({
        error: 'GitHub update failed',
        details: putBody,
      });
    }

    return res.status(200).json(putBody);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
