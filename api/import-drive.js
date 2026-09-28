import { put } from '@vercel/blob';
import { requireIngest } from '../lib/auth.js';
import { readCatalog, writeCatalog, cleanTitle, slugify, baseKey, extensionFromName } from '../lib/catalog.js';

export const config = { maxDuration: 60 };

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_IMPORTS_PER_RUN = 4;
const AUDIO_MIMES = new Set([
  'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a',
  'audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg'
]);
const IMAGE_MIMES = new Set(['image/jpeg','image/png','image/webp']);

async function fetchDrive(fileId, googleAuth) {
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: googleAuth } }
  );
}

async function uploadDriveFile(file, googleAuth, pathname) {
  const response = await fetchDrive(file.id, googleAuth);
  if (!response.ok) throw new Error(`Drive HTTP ${response.status} pour ${file.name}`);
  return put(pathname, response.body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.mimeType,
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  if (!requireIngest(req, res)) return;

  const googleAuth = req.headers.authorization || '';
  if (!googleAuth.startsWith('Bearer ')) return res.status(401).json({ error: 'Jeton Google absent' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const legacyMode = !Array.isArray(body.files) && Boolean(body.fileId);
  const files = Array.isArray(body.files) ? body.files : (legacyMode ? [{ id: body.fileId, name: body.name, mimeType: body.mimeType, size: body.size, createdAt: body.createdAt, modifiedAt: body.modifiedAt || body.createdAt }] : []);
  const republishRestored = body.republishRestored !== false;

  const audioFiles = files.filter(f => AUDIO_MIMES.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const images = files.filter(f => IMAGE_MIMES.has(f.mimeType) && Number(f.size || 0) <= MAX_BYTES);
  const imagesByBase = new Map(images.map(f => [baseKey(f.name), f]));
  const catalog = await readCatalog();
  const now = new Date().toISOString();
  const seenAudioIds = new Set(audioFiles.map(f => f.id));

  let imported = 0;
  let covers = 0;
  let removed = 0;
  let restored = 0;

  for (const file of audioFiles) {
    let track = catalog.tracks.find(t => t.driveFileId === file.id);
    const sourceTitle = cleanTitle(file.name);
    const key = baseKey(file.name);
    const coverFile = imagesByBase.get(key);
    const changed = !track || track.sourceModifiedAt !== file.modifiedAt || !track.audio;

    if (!track) {
      const slug = slugify(sourceTitle) || ('track-' + file.id.slice(-8));
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
      const defaultPlaylist = catalog.playlists.find(p => p.id === catalog.settings.defaultPlaylistId);
      if (defaultPlaylist && !(defaultPlaylist.order || []).includes(track.id)) {
        defaultPlaylist.order = [track.id, ...(defaultPlaylist.order || [])];
      }
    }

    if (track.status === 'removed') {
      track.status = 'active';
      if (republishRestored) track.published = true;
      restored++;
    }

    track.sourceName = file.name;
    track.sourceTitle = sourceTitle;
    track.sourceBaseKey = key;
    track.sourceModifiedAt = file.modifiedAt;
    if (!track.titleLocked) track.title = sourceTitle;

    if (changed && imported < MAX_IMPORTS_PER_RUN) {
      const ext = audioExt(file);
      const slug = slugify(sourceTitle) || 'track';
      const blob = await uploadDriveFile(file, googleAuth, `audio/${file.id}-${slug}.${ext}`);
      track.audio = blob.url;
      track.audioPath = blob.pathname;
      imported++;
    }

    if (coverFile && !track.coverLocked) {
      const coverChanged = track.coverDriveFileId !== coverFile.id || track.coverSourceModifiedAt !== coverFile.modifiedAt || !track.coverPath;
      if (coverChanged) {
        const ext = extensionFromName(coverFile.name, coverFile.mimeType === 'image/png' ? 'png' : (coverFile.mimeType === 'image/webp' ? 'webp' : 'jpg'));
        const slug = slugify(sourceTitle) || 'cover';
        const blob = await uploadDriveFile(coverFile, googleAuth, `covers/${coverFile.id}-${slug}.${ext}`);
        track.cover = blob.url;
        track.coverPath = blob.pathname;
        track.coverDriveFileId = coverFile.id;
        track.coverSourceModifiedAt = coverFile.modifiedAt;
        covers++;
      }
    }

    track.updatedAt = now;
  }

  if (!legacyMode) for (const track of catalog.tracks) {
    if (track.driveFileId && !seenAudioIds.has(track.driveFileId) && track.status !== 'removed') {
      track.status = 'removed';
      track.published = false;
      track.removedAt = now;
      track.updatedAt = now;
      removed++;
    }
  }

  const saved = await writeCatalog(catalog);
  return res.status(200).json({
    ok: true,
    revision: saved.revision,
    detectedAudio: audioFiles.length,
    detectedImages: images.length,
    imported,
    covers,
    removed,
    restored
  });
}
