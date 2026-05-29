// api/site-analytics.js
// Lightweight privacy-friendly analytics for the portfolio admin dashboard.

import crypto from 'node:crypto';

const OWNER = 'lengocluyen';
const REPO = 'lengocluyen.github.io';
const PATH = 'analytics.json';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Admin-Password, Authorization'
  );
}

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

function requireAdmin(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res
      .status(500)
      .json({ error: 'Missing ADMIN_PASSWORD environment variable' });
    return false;
  }

  const providedPassword = getProvidedPassword(req);
  if (!providedPassword || !safeEqual(providedPassword, adminPassword)) {
    res.status(401).json({ error: 'Invalid admin password' });
    return false;
  }

  return true;
}

function createEmptyAnalytics() {
  return {
    version: 1,
    totals: {
      visits: 0,
      visitors: 0,
      pageVisitors: 0,
    },
    days: {},
    pages: {},
    referrers: {},
    updatedAt: null,
  };
}

function normalizeAnalytics(value) {
  const analytics = value && typeof value === 'object' ? value : createEmptyAnalytics();
  analytics.version = 1;
  analytics.totals = analytics.totals || {};
  analytics.totals.visits = Number(analytics.totals.visits || 0);
  analytics.totals.visitors = Number(analytics.totals.visitors || 0);
  analytics.totals.pageVisitors = Number(analytics.totals.pageVisitors || 0);
  analytics.days = analytics.days || {};
  analytics.pages = analytics.pages || {};
  analytics.referrers = analytics.referrers || {};
  analytics.updatedAt = analytics.updatedAt || null;
  return analytics;
}

function githubHeaders(token, accept = 'application/vnd.github+json') {
  const headers = {
    Accept: accept,
    'User-Agent': 'vercel-site-analytics',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readAnalytics(token) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
    { headers: githubHeaders(token) }
  );

  if (response.status === 404) {
    return { analytics: createEmptyAnalytics(), sha: null, exists: false };
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'GitHub analytics read failed');
  }

  const raw = Buffer.from(body.content || '', 'base64').toString('utf8');
  const parsed = raw ? JSON.parse(raw) : createEmptyAnalytics();
  return { analytics: normalizeAnalytics(parsed), sha: body.sha, exists: true };
}

async function writeAnalytics(token, analytics, sha) {
  const payload = {
    message: 'Update site analytics',
    content: Buffer.from(JSON.stringify(analytics, null, 2)).toString('base64'),
  };
  if (sha) payload.sha = sha;

  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...githubHeaders(token),
      },
      body: JSON.stringify(payload),
    }
  );

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.message || 'GitHub analytics write failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

function cleanPath(value) {
  const path = String(value || '/').split('?')[0].split('#')[0].trim();
  if (!path.startsWith('/')) return '/';
  return path.slice(0, 140) || '/';
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanReferrer(value) {
  const referrer = cleanText(value, 180);
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.slice(0, 80);
  } catch {
    return referrer.replace(/^https?:\/\//, '').split('/')[0].slice(0, 80);
  }
}

function pruneAnalytics(analytics) {
  const days = Object.keys(analytics.days).sort();
  while (days.length > 90) {
    const day = days.shift();
    delete analytics.days[day];
  }

  const pages = Object.entries(analytics.pages)
    .sort((a, b) => Number(b[1].visits || 0) - Number(a[1].visits || 0))
    .slice(0, 50);
  analytics.pages = Object.fromEntries(pages);

  const referrers = Object.entries(analytics.referrers)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 30);
  analytics.referrers = Object.fromEntries(referrers);
}

function applyVisit(analytics, visit) {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const path = cleanPath(visit.path);
  const title = cleanText(visit.title, 120);
  const referrer = cleanReferrer(visit.referrer);
  const dailyUnique = Boolean(visit.dailyUnique);
  const pageDailyUnique = Boolean(visit.pageDailyUnique);

  analytics.days[dayKey] = analytics.days[dayKey] || {
    visits: 0,
    visitors: 0,
    pageVisitors: 0,
  };
  analytics.pages[path] = analytics.pages[path] || {
    title,
    visits: 0,
    visitors: 0,
    updatedAt: null,
  };

  analytics.totals.visits += 1;
  analytics.days[dayKey].visits += 1;
  analytics.pages[path].visits += 1;

  if (dailyUnique) {
    analytics.totals.visitors += 1;
    analytics.days[dayKey].visitors += 1;
  }

  if (pageDailyUnique) {
    analytics.totals.pageVisitors += 1;
    analytics.days[dayKey].pageVisitors += 1;
    analytics.pages[path].visitors += 1;
  }

  if (title) analytics.pages[path].title = title;
  analytics.pages[path].updatedAt = now.toISOString();

  if (referrer && !referrer.includes('lengocluyen.github.io') && !referrer.includes('lengocluyen.vercel.app')) {
    analytics.referrers[referrer] = Number(analytics.referrers[referrer] || 0) + 1;
  }

  analytics.updatedAt = now.toISOString();
  pruneAnalytics(analytics);
}

function summarize(analytics, storage) {
  const normalized = normalizeAnalytics(analytics);
  const todayKey = new Date().toISOString().slice(0, 10);
  const days = Object.entries(normalized.days)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, values]) => ({
      date,
      visits: Number(values.visits || 0),
      visitors: Number(values.visitors || 0),
      pageVisitors: Number(values.pageVisitors || 0),
    }));
  const last7 = days
    .slice(0, 7)
    .reduce((sum, day) => sum + day.visits, 0);

  const pages = Object.entries(normalized.pages)
    .sort((a, b) => Number(b[1].visits || 0) - Number(a[1].visits || 0))
    .slice(0, 8)
    .map(([path, values]) => ({
      path,
      title: values.title || path,
      visits: Number(values.visits || 0),
      visitors: Number(values.visitors || 0),
    }));

  return {
    totals: normalized.totals,
    today: normalized.days[todayKey] || { visits: 0, visitors: 0, pageVisitors: 0 },
    last7Visits: last7,
    days: days.slice(0, 14),
    pages,
    updatedAt: normalized.updatedAt,
    storage,
  };
}

async function recordVisit(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'https://lengocluyen.github.io',
    'https://lengocluyen.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ]);

  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(202).json({
      ok: false,
      stored: false,
      error: 'Missing GITHUB_TOKEN environment variable',
    });
  }

  const path = cleanPath(req.body?.path);
  if (path === '/admin.html' || path.startsWith('/api/')) {
    return res.status(204).end();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const current = await readAnalytics(token);
      applyVisit(current.analytics, { ...req.body, path });
      await writeAnalytics(token, current.analytics, current.sha);
      return res.status(200).json({ ok: true, stored: true });
    } catch (error) {
      if (error.status === 409 && attempt === 0) continue;
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(500).json({ error: 'Analytics update failed' });
}

async function getAnalytics(req, res) {
  if (!requireAdmin(req, res)) return;

  const token = process.env.GITHUB_TOKEN;
  try {
    const current = await readAnalytics(token);
    const summary = summarize(current.analytics, {
      configured: Boolean(token),
      exists: current.exists,
      path: PATH,
    });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(summary);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return getAnalytics(req, res);
  }

  if (req.method === 'POST') {
    return recordVisit(req, res);
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
