import crypto from 'node:crypto';

export function secureEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function requireIngest(req, res) {
  const expected = process.env.INGEST_SECRET;
  const supplied = req.headers['x-ingest-secret'];
  if (!expected) {
    res.status(500).json({ error: 'INGEST_SECRET absent sur Vercel' });
    return false;
  }
  if (!secureEqual(supplied, expected)) {
    res.status(401).json({ error: 'Secret invalide' });
    return false;
  }
  return true;
}

export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_SECRET || process.env.INGEST_SECRET;
  const supplied = req.headers['x-admin-secret'];
  if (!expected) {
    res.status(500).json({ error: 'Secret admin absent' });
    return false;
  }
  if (!secureEqual(supplied, expected)) {
    res.status(401).json({ error: 'Accès refusé' });
    return false;
  }
  return true;
}
