import { put } from '@vercel/blob';
import { parseBuffer } from 'music-metadata';
import { requireIngest } from '../lib/auth.js';
import { readCatalog, writeCatalog, cleanTitle, slugify, baseKey, extensionFromName } from '../lib/catalog.js';

export const config = { maxDuration: 60 };

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IMPORTS = 4;
const MAX_EMBEDDED_COVERS = 1;

const AUDIO = new Set([
  'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a',
  'audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg'
]);

const IMAGES = new Set(['image/jpeg','image/png','image/webp']);

async function fetchDrive(fileId, auth) {
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: auth } }
  );
}

async function uploadDriveStream(file, auth, pathname) {
  const r = await fetchDrive(file.id, auth);
  if (!r.ok) throw new Error(`Drive HTTP ${r.status} pour ${file.name}`);

  return put(pathname, r.body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.mimeType,
    cacheControlMaxAge: 31536000
  });
}

async function readDriveBuffer(file, auth) {
  const r = await fetchDrive(file.id, auth);
  if (!r.ok) throw new Error(`Drive HTTP ${r.status} pour ${file.name}`);
  return Buffer.from(await r.arrayBuffer());
}

async function uploadBuffer(buffer, pathname, contentType) {
  return put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 31536000
  });
}

function audioExt(file) {
  const ext = extensionFromName(file.name);
  if (ext) return ext;
  if (file.mimeType.includes('wav')) return 'wav';
  if (file.mimeType.includes('flac')) return 'flac';
  if (file.mimeType.includes('ogg')) return 'ogg';
  if (file.mimeType.includes('m4a') || file.mimeType === 'audio/mp4') return 'm4a';
  return 'mp3';
}

function imageExt(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  return 'jpg';
}

async function extractEmbeddedCover(file, auth) {
  try {
    const buffer = await readDriveBuffer(file, auth);
    const meta = await parseBuffer(
      buffer,
      { mimeType: file.mimeType, size: buffer.length },
      { duration: false, skipCovers: false }
    );
    const pic = meta.common?.picture?.[0];
    if (!pic?.data?.length) return null;
    return { data: Buffer.from(pic.data), mimeType: pic.format || 'image/jpeg' };
  } catch (e) {
    console.error('Pochette intégrée illisible', file.name, e);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!requireIngest(req, res)) return;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Jeton Google absent' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  // Bloque l'ancien script planifié avant toute opération Drive ou Blob.
  if (body.manualSync !== true) {
    return res.status(403).json({ error: 'Synchronisation automatique désactivée. Utilise le script de synchronisation manuelle à jour.' });
  }
  const legacy = !Array.isArray(body.files) && Boolean(body.fileId);

  const files = Array.isArray(body.files) ? body.files : (legacy ? [{
    id: body.fileId,
    name: body.name,
    mimeType: body.mimeType,
    size: body.size,
    createdAt: body.createdAt,
    modifiedAt: body.modifiedAt || body.createdAt
  }] : []);

  const audioFiles = files.filter(f => AUDIO.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const imageFiles = files.filter(f => IMAGES.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const imagesByBase = new Map(imageFiles.map(f => [baseKey(f.name), f]));

  let catalog = await readCatalog();
  const now = new Date().toISOString();
  const seen = new Set(audioFiles.map(f => f.id));

  let imported = 0;
  let covers = 0;
  let embeddedCovers = 0;
  let removed = 0;
  let restored = 0;

  // Phase 1 : priorité absolue à la publication audio.
  for (const file of audioFiles) {
    const sourceTitle = cleanTitle(file.name);
    const key = baseKey(file.name);
    const separateCover = imagesByBase.get(key);
    let track = catalog.tracks.find(t => t.driveFileId === file.id);

    if (!track) {
      track = {
        id: file.id,
        driveFileId: file.id,
        sourceName: file.name,
        sourceTitle,
        sourceBaseKey: key,
        sourceModifiedAt: file.modifiedAt,
        title: sourceTitle,
        titleLocked: false,
        artist: catalog.settings.defaultArtist,
        audio: '',
        audioPath: '',
        cover: catalog.settings.defaultCover,
        coverPath: '',
        coverDriveFileId: '',
        coverSourceModifiedAt: '',
        embeddedCoverSourceModifiedAt: '',
        coverLocked: false,
        style: [],
        tags: [],
        playlistIds: catalog.settings.defaultPlaylistId ? [catalog.settings.defaultPlaylistId] : [],
        lyrics: '',
        published: catalog.settings.autoPublishNewTracks !== false,
        status: 'active',
        createdAt: file.createdAt || now,
        updatedAt: now,
        durationLabel: ''
      };
      catalog.tracks.push(track);

      const p = catalog.playlists.find(x => x.id === catalog.settings.defaultPlaylistId);
      if (p && !(p.order || []).includes(track.id)) p.order = [track.id, ...(p.order || [])];
    }

    if (track.status === 'removed') {
      track.status = 'active';
      if (body.republishRestored !== false) track.published = true;
      restored++;
    }

    const changed = track.sourceModifiedAt !== file.modifiedAt || !track.audio;

    track.sourceName = file.name;
    track.sourceTitle = sourceTitle;
    track.sourceBaseKey = key;
    if (!track.titleLocked) track.title = sourceTitle;

    if (changed && imported < MAX_IMPORTS) {
      const slug = slugify(sourceTitle) || 'track';
      const blob = await uploadDriveStream(
        file,
        auth,
        `audio/${file.id}-${slug}.${audioExt(file)}`
      );
      track.audio = blob.url;
      track.audioPath = blob.pathname;
      track.sourceModifiedAt = file.modifiedAt;
      imported++;
    }

    if (separateCover && !track.coverLocked) {
      const coverChanged =
        track.coverDriveFileId !== separateCover.id ||
        track.coverSourceModifiedAt !== separateCover.modifiedAt ||
        !track.coverPath;

      if (coverChanged) {
        const ext = extensionFromName(separateCover.name, imageExt(separateCover.mimeType));
        const slug = slugify(sourceTitle) || 'cover';
        const blob = await uploadDriveStream(
          separateCover,
          auth,
          `covers/${separateCover.id}-${slug}.${ext}`
        );
        track.cover = blob.url;
        track.coverPath = blob.pathname;
        track.coverDriveFileId = separateCover.id;
        track.coverSourceModifiedAt = separateCover.modifiedAt;
        track.embeddedCoverSourceModifiedAt = '';
        covers++;
      }
    }

    track.updatedAt = now;
  }

  if (!legacy) {
    for (const track of catalog.tracks) {
      if (track.driveFileId && !seen.has(track.driveFileId) && track.status !== 'removed') {
        track.status = 'removed';
        track.published = false;
        track.removedAt = now;
        track.updatedAt = now;
        removed++;
      }
    }
  }

  // Sauvegarde immédiate : les nouveaux morceaux apparaissent même si l'extraction d'une pochette prend trop de temps.
  catalog = await writeCatalog(catalog);

  // Phase 2 : au maximum une pochette intégrée par passage.
  let scanned = 0;
  for (const file of audioFiles) {
    if (scanned >= MAX_EMBEDDED_COVERS) break;

    const track = catalog.tracks.find(t => t.driveFileId === file.id);
    if (!track || track.coverLocked) continue;
    if (imagesByBase.has(baseKey(file.name))) continue;
    if (track.embeddedCoverSourceModifiedAt === file.modifiedAt) continue;

    scanned++;

    const pic = await extractEmbeddedCover(file, auth);
    track.embeddedCoverSourceModifiedAt = file.modifiedAt;

    if (pic) {
      const sourceTitle = cleanTitle(file.name);
      const slug = slugify(sourceTitle) || 'cover';
      const ext = imageExt(pic.mimeType);
      const blob = await uploadBuffer(
        pic.data,
        `covers/embedded/${file.id}-${slug}.${ext}`,
        pic.mimeType
      );
      track.cover = blob.url;
      track.coverPath = blob.pathname;
      track.coverDriveFileId = `embedded:${file.id}`;
      track.coverSourceModifiedAt = file.modifiedAt;
      embeddedCovers++;
    }

    track.updatedAt = new Date().toISOString();
    catalog = await writeCatalog(catalog);
  }

  return res.status(200).json({
    ok: true,
    revision: catalog.revision,
    detectedAudio: audioFiles.length,
    detectedImages: imageFiles.length,
    remainingAudio: audioFiles.filter(file => {
      const track = catalog.tracks.find(t => t.driveFileId === file.id);
      return !track?.audio || track.sourceModifiedAt !== file.modifiedAt;
    }).length,
    imported,
    covers,
    embeddedCovers,
    embeddedScans: scanned,
    removed,
    restored
  });
}
