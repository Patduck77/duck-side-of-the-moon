import { readCatalog, publicLibrary } from '../lib/catalog.js';

export default async function handler(req, res) {
  try {
    const catalog = await readCatalog();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(publicLibrary(catalog));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Impossible de charger la bibliothèque', tracks: [], playlists: [] });
  }
}
