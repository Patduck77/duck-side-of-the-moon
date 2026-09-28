import { issueSignedToken, presignUrl } from '@vercel/blob';
import { requireAdmin } from '../../lib/auth.js';

function safePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST uniquement' });
  }

  if (!requireAdmin(req, res)) return;

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

  const appId = safePart(body.appId);
  const fileName = String(body.fileName || '');
  const fileSize = Number(body.fileSize || 0);

  if (!appId || !fileName) {
    return res.status(400).json({
      error: 'Application ou fichier absent'
    });
  }

  if (fileSize <= 0) {
    return res.status(400).json({
      error: 'Fichier vide'
    });
  }

  if (fileSize > 5 * 1024 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Fichier supérieur à 5 Go'
    });
  }

  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';

  const allowed = new Set([
    'exe','msi','zip','7z','rar','dmg','pkg',
    'deb','rpm','appimage','tar','gz'
  ]);

  if (!allowed.has(ext)) {
    return res.status(400).json({
      error: 'Format non autorisé'
    });
  }

  const baseName = safePart(
    fileName.replace(/\.[^.]+$/, '')
  ) || appId;

  const pathname =
    `applications/${appId}/${Date.now()}-${baseName}.${ext}`;

  const validUntil =
    Date.now() + 15 * 60 * 1000;

  const token = await issueSignedToken({
    pathname,
    operations: ['put'],
    validUntil
  });

  const { presignedUrl } =
    await presignUrl(token, {
      pathname,
      operation: 'put',
      validUntil
    });

  const publicUrl =
    presignedUrl.split('?')[0];

  return res.status(200).json({
    ok: true,
    pathname,
    presignedUrl,
    publicUrl,
    expiresAt: validUntil
  });
}
