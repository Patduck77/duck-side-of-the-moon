import { requireAdmin } from '../../lib/auth.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!requireAdmin(req, res)) return;
  const url = process.env.GOOGLE_DRIVE_SYNC_URL || '';
  const secret = process.env.INGEST_SECRET;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || !secret) {
    return res.status(503).json({ error: 'La synchronisation Drive doit encore être reliée au site. Contacte la personne qui configure le site.' });
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', secret }),
      signal: AbortSignal.timeout(55000)
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      return res.status(502).json({ error: 'La synchronisation Drive a échoué. Vérifie la connexion Google et les exécutions du script avant de réessayer.' });
    }
    // Ne renvoie ni secrets ni données arbitraires du script au navigateur.
    const counts = {};
    for (const key of ['imported', 'covers', 'embeddedCovers', 'removed', 'restored', 'embeddedScans', 'remainingAudio']) {
      counts[key] = Number.isFinite(result[key]) && result[key] >= 0 ? result[key] : 0;
    }
    return res.status(200).json({ ok: true, ...counts });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({ error: timedOut
      ? 'Le délai de réponse est dépassé. La synchronisation peut encore se terminer : attends une minute puis actualise avant de relancer.'
      : 'Impossible de joindre la synchronisation Drive. Vérifie sa configuration Google.' });
  }
}
