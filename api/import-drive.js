import { put } from '@vercel/blob';
import { parseBuffer } from 'music-metadata';
import { requireIngest } from '../lib/auth.js';
import { readCatalog, writeCatalog, cleanTitle, slugify, baseKey, extensionFromName } from '../lib/catalog.js';

export const config = { maxDuration: 60 };

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IMPORTS = 4;
const MAX_COVER_SCANS = 5;
const AUDIO = new Set(['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg']);
const IMAGES = new Set(['image/jpeg','image/png','image/webp']);

async function driveBuffer(file, auth) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers: { Authorization: auth }
  });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status} pour ${file.name}`);
  return Buffer.from(await r.arrayBuffer());
}

async function blobPut(buffer, pathname, contentType) {
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
  mime = String(mime || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

async function embeddedCover(buffer, file) {
  try {
    const meta = await parseBuffer(buffer, { mimeType: file.mimeType, size: buffer.length }, { duration: false, skipCovers: false });
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
  const legacy = !Array.isArray(body.files) && Boolean(body.fileId);
  const files = Array.isArray(body.files) ? body.files : (legacy ? [{
    id: body.fileId, name: body.name, mimeType: body.mimeType, size: body.size,
    createdAt: body.createdAt, modifiedAt: body.modifiedAt || body.createdAt
  }] : []);

  const audioFiles = files.filter(f => AUDIO.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const imageFiles = files.filter(f => IMAGES.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const imageByBase = new Map(imageFiles.map(f => [baseKey(f.name), f]));

  const catalog = await readCatalog();
  const now = new Date().toISOString();
  const seen = new Set(audioFiles.map(f => f.id));

  let imported = 0, covers = 0, embeddedCovers = 0, scanned = 0, removed = 0, restored = 0;

  for (const file of audioFiles) {
    const sourceTitle = cleanTitle(file.name);
    const key = baseKey(file.name);
    const separateCover = imageByBase.get(key);
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
    track.sourceModifiedAt = file.modifiedAt;
    if (!track.titleLocked) track.title = sourceTitle;

    let audioBuffer = null;

    if (changed && imported < MAX_IMPORTS) {
      audioBuffer = await driveBuffer(file, auth);
      const slug = slugify(sourceTitle) || 'track';
      const blob = await blobPut(audioBuffer, `audio/${file.id}-${slug}.${audioExt(file)}`, file.mimeType);
      track.audio = blob.url;
      track.audioPath = blob.pathname;
      imported++;
    }

    if (separateCover && !track.coverLocked) {
      const changedCover = track.coverDriveFileId !== separateCover.id ||
        track.coverSourceModifiedAt !== separateCover.modifiedAt || !track.coverPath;

      if (changedCover) {
        const buffer = await driveBuffer(separateCover, auth);
        const ext = extensionFromName(separateCover.name, imageExt(separateCover.mimeType));
        const slug = slugify(sourceTitle) || 'cover';
        const blob = await blobPut(buffer, `covers/${separateCover.id}-${slug}.${ext}`, separateCover.mimeType);
        track.cover = blob.url;
        track.coverPath = blob.pathname;
        track.coverDriveFileId = separateCover.id;
        track.coverSourceModifiedAt = separateCover.modifiedAt;
        track.embeddedCoverSourceModifiedAt = '';
        covers++;
      }
    } else if (!track.coverLocked &&
      track.embeddedCoverSourceModifiedAt !== file.modifiedAt &&
      scanned < MAX_COVER_SCANS) {

      if (!audioBuffer) audioBuffer = await driveBuffer(file, auth);
      scanned++;

      const pic = await embeddedCover(audioBuffer, file);
      track.embeddedCoverSourceModifiedAt = file.modifiedAt;

      if (pic) {
        const slug = slugify(sourceTitle) || 'cover';
        const ext = imageExt(pic.mimeType);
        const blob = await blobPut(pic.data, `covers/embedded/${file.id}-${slug}.${ext}`, pic.mimeType);
        track.cover = blob.url;
        track.coverPath = blob.pathname;
        track.coverDriveFileId = `embedded:${file.id}`;
        track.coverSourceModifiedAt = file.modifiedAt;
        embeddedCovers++;
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

  const saved = await writeCatalog(catalog);

  return res.status(200).json({
    ok: true,
    revision: saved.revision,
    detectedAudio: audioFiles.length,
    detectedImages: imageFiles.length,
    imported,
    covers,
    embeddedCovers,
    embeddedScans: scanned,
    removed,
    restored
  });
}
