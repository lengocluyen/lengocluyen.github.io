// api/save-conferences.js
// Vercel serverless function to update conferences.json in the repo.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { conferences } = req.body;
  if (!Array.isArray(conferences)) {
    return res.status(400).json({ error: 'conferences must be an array' });
  }

  const token = process.env.GITHUB_TOKEN;          // set in Vercel dashboard
  const owner = 'lengocluyen';                     // replace with your GitHub username/org if different
  const repo  = 'lengocluyen.github.io';           // repository name
  const path  = 'conferences.json';

  try {
    // fetch current file to obtain SHA
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (!getRes.ok) throw new Error('could not read file');

    const fileData = await getRes.json();
    const sha = fileData.sha;

    const content = Buffer.from(JSON.stringify(conferences, null, 2)).toString(
      'base64'
    );

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: 'Update conferences.json via API',
          content,
          sha,
        }),
      }
    );

    const result = await putRes.json();
    return res.status(putRes.status).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
