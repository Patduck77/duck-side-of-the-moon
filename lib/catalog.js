import { list, put } from '@vercel/blob';

export const CATALOG_PATH = 'catalog/library.json';

export function defaultCatalog() {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    settings: {
      siteTitle: 'Duck Side OF The Moon',
      baseline: 'Human Before Data',
      defaultArtist: 'duckofthemoon',
      defaultPlaylistId: 'moon-sessions',
      defaultCover: 'duck-side-of-the-moon.jpg',
      autoPublishNewTracks: true
    },
    playlists: [
      {
        id: 'moon-sessions',
        name: 'Moon Sessions',
        description: 'Atmosphères nocturnes, contemplatives et cinématiques.',
        cover: 'duck-side-of-the-moon.jpg',
        published: true,
        featured: true,
        order: []
      }
    ],
    tracks: []
  };
}

export async function readCatalog() {
  try {
    const result = await list({ prefix: CATALOG_PATH, limit: 1 });
    const blob = result.blobs.find(b => b.pathname === CATALOG_PATH);
    if (!blob) return defaultCatalog();
    const response = await fetch(blob.url, { cache: 'no-store' });
    if (!response.ok) return defaultCatalog();
    const catalog = await response.json();
    return normalizeCatalog(catalog);
  } catch (error) {
    console.error('readCatalog', error);
    return defaultCatalog();
  }
}

export async function writeCatalog(catalog) {
  const next = normalizeCatalog(catalog);
  next.revision = Number(next.revision || 0) + 1;
  next.updatedAt = new Date().toISOString();
  await put(CATALOG_PATH, JSON.stringify(next, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 30
  });
  return next;
}

export function normalizeCatalog(catalog) {
  const base = defaultCatalog();
  const c = catalog && typeof catalog === 'object' ? catalog : {};
  return {
    revision: Number(c.revision || 0),
    updatedAt: c.updatedAt || base.updatedAt,
    settings: { ...base.settings, ...(c.settings || {}) },
    playlists: Array.isArray(c.playlists) && c.playlists.length ? c.playlists : base.playlists,
    tracks: Array.isArray(c.tracks) ? c.tracks : []
  };
}

export function publicLibrary(catalog) {
  const tracks = catalog.tracks
    .filter(t => t.published !== false && t.status !== 'removed')
    .map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist || catalog.settings.defaultArtist,
      audio: t.audio,
      cover: t.cover || catalog.settings.defaultCover,
      style: t.style || [],
      tags: t.tags || [],
      playlists: (t.playlistIds || []).map(id => catalog.playlists.find(p => p.id === id)?.name || id),
      playlistIds: t.playlistIds || [],
      lyrics: t.lyrics || '',
      createdAt: t.createdAt,
      durationLabel: t.durationLabel || ''
    }));

  const playlists = catalog.playlists
    .filter(p => p.published !== false)
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      cover: p.cover || catalog.settings.defaultCover,
      featured: Boolean(p.featured),
      order: Array.isArray(p.order) ? p.order.filter(id => tracks.some(t => t.id === id)) : []
    }));

  return { tracks, playlists, settings: catalog.settings, updatedAt: catalog.updatedAt };
}

export function cleanTitle(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[✨⭐🌙🎵🎶🎧🦆🌑🌕🕎🖋️]/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function baseKey(name) {
  return cleanTitle(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function extensionFromName(name, fallback = '') {
  const m = String(name || '').match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : fallback;
}
