import { del } from '@vercel/blob';
import { requireAdmin } from '../../lib/auth.js';
import { readCatalog, writeCatalog } from '../../lib/catalog.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!requireAdmin(req, res)) return;
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const id = body.id;
  const catalog = await readCatalog();
  const track = catalog.tracks.find(t => t.id === id);
  if (!track) return res.status(404).json({ error: 'Morceau introuvable' });

  const urls = [track.audio];
  if (track.cover && /^https:\/\/.+blob\.vercel-storage\.com\//.test(track.cover)) urls.push(track.cover);
  try { await del(urls.filter(Boolean)); } catch (e) { console.error('del', e); }

  catalog.tracks = catalog.tracks.filter(t => t.id !== id);
  for (const p of catalog.playlists) p.order = (p.order || []).filter(x => x !== id);
  const saved = await writeCatalog(catalog);
  return res.status(200).json({ ok: true, revision: saved.revision });
}
