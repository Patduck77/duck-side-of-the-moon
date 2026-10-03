import { requireAdmin } from '../../lib/auth.js';
import { readCatalog } from '../../lib/catalog.js';
import { readState, writeState, readAsset } from '../../lib/distribution-store.js';
import { inspectAsset, sha256 } from '../../lib/distribution-assets.js';
import { defaultProfile, newRelease, cleanEdit, validate, transition, PLATFORMS, RULES_VERSION, SOURCES } from '../../distribution-core.js';
import { zipSync, strToU8 } from 'fflate';
import { put, issueSignedToken, presignUrl } from '@vercel/blob';
import { token } from '../../lib/distribution-store.js';
import { randomUUID } from 'node:crypto';
async function deliverZip(zip) {
 const pathname='distribution/exports/'+randomUUID()+'.zip';
 await put(pathname,zip,{access:'private',token:token(),addRandomSuffix:false,contentType:'application/zip'});
 const validUntil=Date.now()+5*60*1000;
 const signed=await issueSignedToken({token:token(),pathname,operations:['get'],validUntil});
 const {presignedUrl}=await presignUrl(signed,{pathname,operation:'get',validUntil});
 return presignedUrl;
}
export function createHandler(deps={readState,writeState,readCatalog,readAsset,inspectAsset,deliverZip}) {
 return async function handler(req,res) {
 res.setHeader('Cache-Control','private, no-store');
 if(!requireAdmin(req,res))return;
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'GET ou POST uniquement'});
 try {
  const {state,etag}=await deps.readState();
  if(req.method==='GET') {
   const catalog=await deps.readCatalog();
   return res.status(200).json({...state,profile:state.profile||defaultProfile(catalog.settings.defaultArtist),
    tracks:catalog.tracks.map(t=>({id:t.id,title:t.title,artist:t.artist,status:t.status}))});
  }
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(b.action==='export') {
   const r=state.releases[b.trackId],p=r?.packages.find(x=>x.version===Number(b.version));
   if(!p)throw new Error('Version introuvable');
   const audio=await deps.readAsset(p.metadata.audio.pathname),cover=await deps.readAsset(p.metadata.cover.pathname);
   if(sha256(audio)!==p.metadata.audio.sha256||sha256(cover)!==p.metadata.cover.sha256)throw new Error('Fichiers modifiés : export bloqué.');
   const zip=zipSync({'metadata.json':strToU8(JSON.stringify(p.metadata,null,2)),
    'release.txt':strToU8(p.readable),'checklist.txt':strToU8(p.checklist),
    ['master.'+p.metadata.audio.format]:new Uint8Array(audio),'cover.jpg':new Uint8Array(cover)}, {level:0});
   return res.status(200).json({url:await deps.deliverZip(Buffer.from(zip))});
  }
  if(!Number.isInteger(b.expectedRevision)||b.expectedRevision!==state.revision)return res.status(409).json({error:'Distribution modifiée ailleurs : actualiser avant de recommencer.'});
  let detail='',r=state.releases[b.trackId];
  const before=sha256(Buffer.from(JSON.stringify(b.action==='profile'?state.profile:r||null)));
  if(b.action==='profile') {
   const profile={};for(const k of Object.keys(defaultProfile())) {profile[k]=String(b.profile?.[k]||'').trim();if(profile[k].length>500)throw new Error('Profil trop long');}
   state.profile=profile;
  }else if(b.action==='create') {
   if(r)throw new Error('Fiche déjà créée');
   const c=await deps.readCatalog(),t=c.tracks.find(x=>x.id===b.trackId);
   if(!t)throw new Error('Morceau introuvable');
   state.releases[t.id]=newRelease(t,state.profile||defaultProfile(c.settings.defaultArtist));
  }else {
   if(!r)throw new Error('Fiche introuvable');
   if(['edit','asset'].includes(b.action)) {
    if(!['brouillon','prête','refusée'].includes(r.status))throw new Error('Sortie envoyée : données figées. Revenir au brouillon après un refus.');
    if(b.action==='edit')Object.assign(r,cleanEdit(b.release||{}));
    else {
     if(!['audio','cover'].includes(b.kind))throw new Error('Type invalide');
     r[b.kind]=await deps.inspectAsset(await deps.readAsset(b.pathname),b.pathname,b.kind);
     r[b.kind==='audio'?'audioReviewed':'artworkReviewed']=false;
    }
    r.status='brouillon';
   }else if(b.action==='tracking') {
    const isrc=String(b.isrc||'').toUpperCase().replace(/-/g,''),upc=String(b.upc||'').trim();
    if(isrc&&!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc))throw new Error('ISRC invalide');
    const links={};for(const [p,url] of Object.entries(b.finalLinks||{})){
     if(!PLATFORMS.includes(p))throw new Error('Plateforme inconnue');
     if(url){const u=new URL(url);const domains={'Deezer':['deezer.com'],'Spotify':['open.spotify.com'],'Apple Music':['music.apple.com'],'Amazon Music':['music.amazon.com','music.amazon.fr'],'YouTube Music':['music.youtube.com']};
      if(u.protocol!=='https:'||u.username||u.password||!domains[p].some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw new Error('Lien final invalide : '+p);}
     links[p]=String(url||'');
    }
    const proposed={...r,isrc,upc};const issues=validate(proposed).sections.Métadonnées;
    if(issues.some(x=>x.includes('UPC')))throw new Error('UPC/EAN invalide');
    Object.assign(r,{isrc,upc,finalLinks:links});
    if(r.status==='prête')r.status='brouillon';
   }else if(b.action==='prepare') {
    if(!['brouillon','prête','refusée'].includes(r.status))throw new Error('Sortie déjà envoyée.');
    if(b.confirmation!=='Patrick')throw new Error('Validation explicite de Patrick requise pour préparer.');
    const report=validate(r);if(!report.ready)return res.status(422).json({error:'Fiche incomplète',report});
    for(const kind of ['audio','cover'])if(sha256(await deps.readAsset(r[kind].pathname))!==r[kind].sha256)throw new Error('Asset modifié');
    const version=r.packages.length+1;
    const metadata=structuredClone({...r,status:'prête',packages:undefined,schemaVersion:1,packageVersion:version,rulesVersion:RULES_VERSION,sources:SOURCES,preparedAt:new Date().toISOString(),approvedBy:'Patrick',warnings:report.warnings});
    const readable=Object.entries(metadata).filter(([k])=>!['audio','cover','finalLinks'].includes(k)).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):v)).join('\n');
    const checklist=['Validation humaine de Patrick effectuée pour la préparation.',...Object.keys(report.sections).map(k=>k+' : contrôlé'),...report.warnings,'Recontrôler les règles et les plateformes dans le Release Builder Ditto.','Téléverser master et cover, saisir les crédits et les métadonnées.','Vérifier les ISRC/UPC attribués ou existants.','Patrick doit valider séparément toute soumission réelle.','Renseigner ensuite la référence Ditto et les liens finaux.'].join('\n');
    r.packages.push({version,metadata,readable,checklist});r.status='prête';detail='v'+version;
   }else if(b.action==='transition'){transition(r,b.status,b.confirmation,b.reference);detail=b.status;}
   else throw new Error('Action inconnue');
  }
  state.revision++;
  const after=sha256(Buffer.from(JSON.stringify(b.action==='profile'?state.profile:state.releases[b.trackId]||null)));
  state.audit.push({revision:state.revision,at:new Date().toISOString(),actor:'administrateur authentifié',action:b.action,trackId:b.trackId||null,detail,before,after,fields:b.action==='edit'?Object.keys(cleanEdit(b.release||{})):[],confirmation:b.confirmation==='Patrick'?'Patrick':null});
  await deps.writeState(state,etag);
  return res.status(200).json(state);
 }catch(e) {
  if(e.name==='BlobPreconditionFailedError'||e.name==='BlobAlreadyExistsError')return res.status(409).json({error:'Modification concurrente : actualiser.'});
  return res.status(400).json({error:e.message});
 }
 };
}
export default createHandler();

