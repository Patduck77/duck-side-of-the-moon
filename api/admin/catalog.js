import { requireAdmin } from '../../lib/auth.js';
import { readCatalog, writeCatalog } from '../../lib/catalog.js';

const ALLOWED_TRACK_FIELDS = new Set([
  'title','titleLocked','artist','style','tags','playlistIds','lyrics','published','cover','coverLocked','durationLabel'
]);
const ALLOWED_SETTING_FIELDS = new Set([
  'siteTitle','baseline','defaultArtist','defaultPlaylistId','defaultCover','autoPublishNewTracks'
]);

function sanitizeId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const current = await readCatalog();

  if (req.method === 'GET') return res.status(200).json(current);
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET ou POST uniquement' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const expected = Number(body.expectedRevision);
  if (Number.isFinite(expected) && expected !== Number(current.revision)) {
    return res.status(409).json({ error: 'Catalogue modifié ailleurs. Recharge la page.', revision: current.revision });
  }

  const incoming = body.catalog || {};
  const byId = new Map((incoming.tracks || []).map(t => [t.id, t]));
  for (const track of current.tracks) {
    const next = byId.get(track.id);
    if (!next) continue;
    for (const key of ALLOWED_TRACK_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(next, key)) track[key] = next[key];
    }
    if (track.title !== track.sourceTitle) track.titleLocked = true;
    track.updatedAt = new Date().toISOString();
  }

  if (Array.isArray(incoming.playlists)) {
    const clean = [];
    for (const p of incoming.playlists) {
      const id = sanitizeId(p.id || p.name);
      if (!id) continue;
      clean.push({
        id,
        name: String(p.name || id),
        description: String(p.description || ''),
        cover: p.cover || current.settings.defaultCover,
        published: p.published !== false,
        featured: Boolean(p.featured),
        order: Array.isArray(p.order) ? p.order.filter(x => current.tracks.some(t => t.id === x)) : []
      });
    }
    current.playlists = clean;
    const validIds = new Set(clean.map(p => p.id));
    for (const track of current.tracks) {
      track.playlistIds = (track.playlistIds || []).filter(id => validIds.has(id));
    }
  }

  if (incoming.settings && typeof incoming.settings === 'object') {
    for (const key of ALLOWED_SETTING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(incoming.settings, key)) current.settings[key] = incoming.settings[key];
    }
  }

  const saved = await writeCatalog(current);
  return res.status(200).json(saved);
}
