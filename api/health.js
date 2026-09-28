import { readCatalog } from '../lib/catalog.js';

export default async function handler(req, res) {
  const catalog = await readCatalog();
  const active = catalog.tracks.filter(t => t.published !== false && t.status !== 'removed').length;
  const removed = catalog.tracks.filter(t => t.status === 'removed').length;
  return res.status(200).json({
    ok: true,
    revision: catalog.revision,
    updatedAt: catalog.updatedAt,
    tracks: catalog.tracks.length,
    active,
    removed,
    playlists: catalog.playlists.length
  });
}
