// api/save-conferences.js
// Vercel serverless function to update conferences.json in the repo.

import crypto from 'node:crypto';

function getProvidedPassword(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return req.headers['x-admin-password'] || req.body?.adminPassword || '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'https://lengocluyen.github.io',
    'https://lengocluyen.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Admin-Password, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).end('Method Not Allowed');
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: 'Missing ADMIN_PASSWORD environment variable' });
  }

  const providedPassword = getProvidedPassword(req);
  if (!providedPassword || !safeEqual(providedPassword, adminPassword)) {
    return res.status(401).json({ error: 'Invalid admin password' });
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
