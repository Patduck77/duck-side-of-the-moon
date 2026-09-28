import { put } from '@vercel/blob';
import { requireAdmin } from '../../lib/auth.js';
import { readCatalog, writeCatalog, extensionFromName } from '../../lib/catalog.js';

export const config = { maxDuration: 30 };
const MAX = 4 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!requireAdmin(req, res)) return;
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { trackId, filename, contentType, dataBase64 } = body;
  if (!trackId || !dataBase64) return res.status(400).json({ error: 'trackId ou image absent' });
  if (!String(contentType || '').startsWith('image/')) return res.status(400).json({ error: 'Image requise' });
  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length > MAX) return res.status(413).json({ error: 'Pochette supérieure à 4 Mo' });

  const catalog = await readCatalog();
  const track = catalog.tracks.find(t => t.id === trackId);
  if (!track) return res.status(404).json({ error: 'Morceau introuvable' });
  const ext = extensionFromName(filename, contentType.includes('png') ? 'png' : 'jpg');
  const blob = await put(`covers/admin/${track.id}-${Date.now()}.${ext}`, buffer, {
    access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType, cacheControlMaxAge: 31536000
  });
  track.cover = blob.url;
  track.coverPath = blob.pathname;
  track.coverLocked = true;
  track.updatedAt = new Date().toISOString();
  const saved = await writeCatalog(catalog);
  return res.status(200).json({ ok: true, cover: blob.url, revision: saved.revision });
}
