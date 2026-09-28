const CONFIG = {
  DRIVE_FOLDER_ID: '1mgWY3IE7jXWZ9HtxaGk8w9a5AP_H6X9e',
  MAX_ITEMS: 500
};

function syncMusic() {
  const props = PropertiesService.getScriptProperties();
  const importUrl = props.getProperty('VERCEL_IMPORT_URL');
  const ingestSecret = props.getProperty('INGEST_SECRET');
  if (!importUrl || !ingestSecret) throw new Error('VERCEL_IMPORT_URL ou INGEST_SECRET absent.');

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const it = folder.getFiles();
  const files = [];
  let count = 0;

  while (it.hasNext() && count < CONFIG.MAX_ITEMS) {
    const f = it.next();
    const mime = f.getMimeType();
    if (!mime.startsWith('audio/') && !['image/jpeg','image/png','image/webp'].includes(mime)) continue;
    files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: mime,
      size: f.getSize(),
      createdAt: f.getDateCreated().toISOString(),
      modifiedAt: f.getLastUpdated().toISOString()
    });
    count++;
  }

  const response = UrlFetchApp.fetch(importUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Ingest-Secret': ingestSecret,
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({ files, republishRestored: true }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  console.log('HTTP ' + code + ' — ' + body);
  if (code < 200 || code >= 300) throw new Error(body);
}

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncMusic')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncMusic').timeBased().everyMinutes(1).create();
}

function testSync() { syncMusic(); }
