// api/admin-auth.js
// Vercel serverless function for the static admin dashboard login.

import crypto from 'node:crypto';

function setCors(req, res) {
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
    'Content-Type, X-Admin-User, X-Admin-Password, Authorization'
  );
}

function getProvidedPassword(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return req.headers['x-admin-password'] || req.body?.password || '';
}

function getProvidedUsername(req) {
  return req.headers['x-admin-user'] || req.body?.username || '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: 'Missing ADMIN_PASSWORD environment variable' });
  }

  const providedUsername = getProvidedUsername(req);
  const providedPassword = getProvidedPassword(req);
  if (!providedUsername || !safeEqual(providedUsername, adminUsername)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  if (!providedPassword || !safeEqual(providedPassword, adminPassword)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  return res.status(200).json({ ok: true });
}
