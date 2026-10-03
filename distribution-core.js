export const RULES_VERSION = 'ditto-2026-10-03';
export const PLATFORMS = ['Deezer','Spotify','Apple Music','Amazon Music','YouTube Music'];
export const STATES = ['brouillon','prête','envoyée','en validation','publiée','refusée'];
export const SOURCES = [
'https://support.dittomusic.com/en/articles/4283815-what-format-does-my-audio-need-to-be-in',
'https://support.dittomusic.com/en/articles/4283848-why-isn-t-my-artwork-being-accepted',
'https://support.dittomusic.com/en/articles/13973284-can-i-release-ai-generated-music-with-ditto-music',
'https://help.suno.com/en/articles/9601665',
'https://help.suno.com/en/articles/2425729'
];
export function defaultProfile(artist='') {
 return {artist, legalName:'', country:'', label:'', language:'fr', genre:'', copyrightOwner:'', masterOwner:''};
}
export function newRelease(track, profile) {
 return {trackId:track.id,title:track.title||'',artist:track.artist||profile.artist,version:'',
 language:profile.language,genre:profile.genre,label:profile.label,copyrightOwner:profile.copyrightOwner,
 masterOwner:profile.masterOwner,copyrightYear:new Date().getFullYear(),releaseDate:'',territories:'Worldwide',
 composers:'',lyricists:'',performers:'',producers:'',explicit:null,instrumental:false,
 lyrics:track.lyrics||'',lyricsReviewed:false,platforms:[...PLATFORMS],rightsConfirmed:false,
 artworkReviewed:false,audioReviewed:false,noImpersonation:false,noSpam:false,
 ai:'unknown',aiTools:'',sunoPlan:'unknown',sunoCreatedAt:'',sunoDownloadedAt:'',rightsEvidence:'',
 isrc:'',upc:'',finalLinks:{},status:'brouillon',packages:[]};
}
export const EDITABLE = [
'title','artist','version','language','genre','label','copyrightOwner','masterOwner','copyrightYear',
'releaseDate','territories','composers','lyricists','performers','producers','explicit','instrumental',
'lyrics','lyricsReviewed','platforms','rightsConfirmed','artworkReviewed','audioReviewed',
'noImpersonation','noSpam','ai','aiTools','sunoPlan','sunoCreatedAt','sunoDownloadedAt','rightsEvidence'
];
const flags = new Set(['instrumental','lyricsReviewed','rightsConfirmed','artworkReviewed','audioReviewed','noImpersonation','noSpam']);
export function cleanEdit(input) {
 const out={};
 for(const key of EDITABLE) {
  if(!(key in input)) continue;
  const v=input[key];
  if(flags.has(key)) {if(typeof v!=='boolean') throw new Error('Valeur booléenne attendue : '+key);out[key]=v;}
  else if(key==='explicit'){if(v!==null&&typeof v!=='boolean')throw new Error('Contenu explicite invalide');out[key]=v;}
  else if(key==='platforms'){if(!Array.isArray(v)||v.some(p=>!PLATFORMS.includes(p)))throw new Error('Plateforme invalide');out[key]=[...new Set(v)];}
  else {if(typeof v!=='string'&&typeof v!=='number')throw new Error('Champ invalide : '+key);out[key]=String(v).trim();if(out[key].length>20000)throw new Error('Champ trop long');}
 }
 if(out.ai&&!['none','assisted','full','unknown'].includes(out.ai))throw new Error('Origine IA invalide');
 if(out.sunoPlan&&!['unknown','free','pro','premier','written-license'].includes(out.sunoPlan))throw new Error('Licence Suno invalide');
 return out;
}
export function validate(r, today=new Date().toISOString().slice(0,10)) {
 const sections=Object.fromEntries(['Audio','Pochette','Métadonnées','Droits','Paroles'].map(x=>[x,[]]));
 const warnings=[];
 const a=r.audio,c=r.cover;
 if(!a?.sha256||!['wav','mp3'].includes(a.format)||a.channels!==2||!Number.isFinite(a.sampleRate)||a.sampleRate<44100||
 (a.format==='wav'&&(!Number.isFinite(a.bitsPerSample)||a.bitsPerSample<16))||!Number.isFinite(a.duration)||a.duration<=0)sections.Audio.push('Master WAV ≥16 bits ou MP3, stéréo ≥44,1 kHz requis.');
 if(!r.audioReviewed)sections.Audio.push('Confirmer une écoute complète, sans coupure ni silence prolongé.');
 if(!c?.sha256||c.format!=='jpeg'||!Number.isFinite(c.width)||c.width!==c.height||c.width<1400||!Number.isFinite(c.size)||c.size<=0||c.size>10000000||c.colorSpace!=='RGB')sections.Pochette.push('JPEG carré RGB, ≥1400 px, ≤10 Mo requis.');
 if(c?.width<3000)warnings.push('Pochette 3000 × 3000 recommandée par Ditto.');
 if(!r.artworkReviewed)sections.Pochette.push('Vérifier les droits visuels, la netteté, les logos, liens et QR codes.');
 for(const key of ['title','artist','language','genre','copyrightOwner','masterOwner','composers','performers','territories'])if(!String(r[key]||'').trim())sections.Métadonnées.push('À renseigner : '+key);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate||'')||!Number.isFinite(Date.parse(r.releaseDate))||new Date(r.releaseDate).toISOString().slice(0,10)!==r.releaseDate||r.releaseDate<today)sections.Métadonnées.push('Date de sortie valide, présente ou future requise.');
 if(!/^\d{4}$/.test(String(r.copyrightYear)))sections.Métadonnées.push('Année de copyright invalide.');
 if(typeof r.explicit!=='boolean')sections.Métadonnées.push('Préciser le contenu explicite.');
 if(!Array.isArray(r.platforms)||!r.platforms.length||r.platforms.some(p=>!PLATFORMS.includes(p)))sections.Métadonnées.push('Choisir les plateformes.');
 if(r.isrc&&!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(r.isrc))sections.Métadonnées.push('ISRC invalide (12 caractères sans tirets).');
 if(r.upc&&!validUPC(r.upc))sections.Métadonnées.push('UPC/EAN invalide.');
 if(!r.rightsConfirmed||!r.noImpersonation||!r.noSpam)sections.Droits.push('Confirmer tous les droits audio/paroles/samples, absence d’usurpation et de spam.');
 if(!['none','assisted','full'].includes(r.ai))sections.Droits.push('Déclarer le recours à l’IA.');
 if(r.ai!=='none'&&(!r.aiTools||!r.rightsEvidence))sections.Droits.push('Renseigner les outils IA et les justificatifs de licence.');
 if(/suno/i.test(r.aiTools||'')) {
  if(!r.sunoCreatedAt||!r.sunoDownloadedAt||!['pro','premier','written-license'].includes(r.sunoPlan)||!r.rightsEvidence)
   sections.Droits.push('Suno : dates de création/téléchargement et preuve de licence commerciale requises. Le gratuit ou un abonnement actuel seul ne suffisent pas.');
  warnings.push('Suno : règles récentes et anciens articles divergent ; Patrick doit vérifier la licence applicable au morceau et au téléchargement, y compris les extensions.');
 }
 if(r.ai==='full'&&r.platforms?.includes('Apple Music'))warnings.push('Apple Music peut refuser une création entièrement IA. YouTube Music ne signifie pas YouTube Content ID.');
 if(!r.instrumental&&(!r.lyrics?.trim()||!r.lyricists?.trim()||!r.lyricsReviewed))sections.Paroles.push('Paroles, auteurs et relecture requises, ou cocher Instrumental.');
 return {sections,warnings,ready:Object.values(sections).every(x=>x.length===0),rulesVersion:RULES_VERSION};
}
export function validUPC(s) {
 if(!/^\d{12,13}$/.test(s))return false;
 const d=[...s].map(Number), check=d.pop();
 return (10-d.reverse().reduce((sum,n,i)=>sum+n*(i%2?1:3),0)%10)%10===check;
}
export function transition(r,next,confirmation,reference) {
 const allowed={'prête':['envoyée','brouillon'],'envoyée':['en validation','refusée'],'en validation':['publiée','refusée'],'refusée':['brouillon'],'publiée':[],'brouillon':[]};
 if(!allowed[r.status]?.includes(next))throw new Error('Transition interdite');
 if(next!=='brouillon'&&(confirmation!=='Patrick'||!reference?.trim()))throw new Error('Confirmation explicite de Patrick et référence Ditto requises.');
 if(next==='publiée'&&!Object.values(r.finalLinks||{}).some(Boolean))throw new Error('Ajouter au moins un lien final vérifié.');
 r.status=next;r.dittoReference=reference||r.dittoReference;
}

