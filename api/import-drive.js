import { put } from '@vercel/blob';
import crypto from 'node:crypto';

export const config = {
  maxDuration: 60
};

const MAX_BYTES = 50 * 1024 * 1024;

function secureEqual(a, b) {
  const aa = Buffer.from(a || '');
  const bb = Buffer.from(b || '');

  if (aa.length !== bb.length) return false;

  return crypto.timingSafeEqual(aa, bb);
}

function cleanTitle(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[✨⭐🌙🎵🎶🎧🦆🌑🌕]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST uniquement' });
  }

  const suppliedSecret = req.headers['x-ingest-secret'];

  if (!process.env.INGEST_SECRET) {
    return res.status(500).json({ error: 'INGEST_SECRET absent sur Vercel' });
  }

  if (!secureEqual(suppliedSecret, process.env.INGEST_SECRET)) {
    return res.status(401).json({ error: 'Secret invalide' });
  }

  const googleAuth = req.headers.authorization || '';

  if (!googleAuth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Jeton Google absent' });
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body || {};

  const {
    fileId,
    name,
    mimeType,
    size,
    createdAt
  } = body;

  if (!fileId || !name) {
    return res.status(400).json({ error: 'fileId ou name absent' });
  }

  if (mimeType !== 'audio/mpeg') {
    return res.status(400).json({ error: 'Seuls les MP3 sont acceptés' });
  }

  if (Number(size) > MAX_BYTES) {
    return res.status(413).json({ error: 'Fichier supérieur à 50 Mo' });
  }

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: googleAuth
      }
    }
  );

  if (!driveResponse.ok) {
    return res.status(502).json({
      error: 'Lecture Google Drive impossible',
      status: driveResponse.status
    });
  }

  const title = cleanTitle(name);
  const slug = slugify(title) || 'track';

  const pathname =
    `audio/${fileId}-${slug}.mp3`;

  const blob = await put(
    pathname,
    driveResponse.body,
    {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'audio/mpeg',
      cacheControlMaxAge: 31536000
    }
  );

  return res.status(200).json({
    ok: true,
    driveFileId: fileId,
    title,
    createdAt,
    audio: blob.url,
    pathname: blob.pathname
  });
}
