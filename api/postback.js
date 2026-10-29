// Universal S2S Postback Webhook Serverless Function (Vercel / Node)
// Handles GET and POST requests for Offerwall.me & PubCrypto
import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Forward postback payload to Cloudflare Worker D1 backend
    const queryString = new URLSearchParams(req.query || {}).toString();
    const workerTargetUrl = `https://lootify-api.sarthaksinghyadav1.workers.dev/api/postback${queryString ? '?' + queryString : ''}`;
    
    fetch(workerTargetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
    }).catch(() => {});

    // Always respond immediately with 200 OK plain text "ok" for Offerwall verifiers
    return res.status(200).send('ok');
  } catch (err) {
    return res.status(200).send('ok');
  }
}
