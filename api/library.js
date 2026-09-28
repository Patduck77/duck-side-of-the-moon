import { list } from '@vercel/blob';

function titleFromPath(pathname) {
  let name = pathname
    .replace(/^audio\//, '')
    .replace(/\.mp3$/i, '');

  // Retire l'identifiant Drive placé devant le titre
  const match = name.match(/^[^-]+-(.+)$/);
  if (match) name = match[1];

  return name
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

export default async function handler(req, res) {
  try {
    const result = await list({
      prefix: 'audio/'
    });

    const tracks = result.blobs
      .filter(blob => blob.pathname.toLowerCase().endsWith('.mp3'))
      .map((blob, index) => ({
        id: blob.pathname,
        title: titleFromPath(blob.pathname),
        artist: 'duckofthemoon',
        audio: blob.url,
        cover: 'duck-side-of-the-moon.jpg',
        style: ['Cinematic', 'Poetic'],
        playlists: ['Moon Sessions'],
        createdAt: blob.uploadedAt,
        durationLabel: ''
      }))
      .sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json({ tracks });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Impossible de charger la bibliothèque',
      tracks: []
    });
  }
}
