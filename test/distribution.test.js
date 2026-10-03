import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile,newRelease,validate,cleanEdit,transition,validUPC } from '../distribution-core.js';
import { createHandler } from '../api/admin/distribution.js';
import { sha256,jpegInfo,inspectAsset } from '../lib/distribution-assets.js';
import { normalizeCatalog,publicLibrary,defaultCatalog } from '../lib/catalog.js';
import catalogHandler from '../api/admin/catalog.js';
import { unzipSync,strFromU8 } from 'fflate';

const bytes=Buffer.from('immutable test asset');
function ready() {
 return {...newRelease({id:'song',title:'Lune',artist:'Duck'},defaultProfile()),language:'fr',genre:'Ambient',
 copyrightOwner:'Patrick',masterOwner:'Patrick',composers:'Patrick',performers:'Duck',
 copyrightYear:'2026',releaseDate:'2099-01-01',explicit:false,instrumental:true,
 rightsConfirmed:true,noImpersonation:true,noSpam:true,ai:'none',audioReviewed:true,artworkReviewed:true,
 audio:{pathname:'distribution/assets/abc.wav',sha256:sha256(bytes),format:'wav',channels:2,sampleRate:44100,bitsPerSample:16,duration:60},
 cover:{pathname:'distribution/assets/def.jpg',sha256:sha256(bytes),format:'jpeg',width:3000,height:3000,size:1234,colorSpace:'RGB'}};
}
test('legacy catalog migration preserves tracks, applications and settings',()=>{
 const c=defaultCatalog();c.tracks=[{id:'t',title:'Test',audio:'a',published:true},{id:'hidden',published:false},{id:'gone',status:'removed'}];
 const normalized=normalizeCatalog(c);assert.deepEqual(normalized.tracks,c.tracks);
 assert.deepEqual(normalized.applications,c.applications);
 const pub=publicLibrary(normalized);assert.equal(pub.tracks.length,1);assert.equal(pub.tracks[0].id,'t');
 assert.equal(pub.applications.length,2);assert.equal('rightsEvidence' in pub.tracks[0],false);
});
test('profile defaults are copied and never change an existing release',()=>{
 const p={...defaultProfile('Duck'),genre:'Ambient',masterOwner:'Patrick'};
 const r=newRelease({id:'t',title:'Moon'},p);p.artist='New';assert.equal(r.artist,'Duck');assert.equal(r.masterOwner,'Patrick');
});
test('ready complete instrumental; identifiers optional',()=>assert.equal(validate(ready()).ready,true));
for(const [name,change,section] of [
 ['mono',{audio:{...ready().audio,channels:1}},'Audio'],['sample rate missing',{audio:{...ready().audio,sampleRate:undefined}},'Audio'],
 ['8 bit WAV',{audio:{...ready().audio,bitsPerSample:8}},'Audio'],['audio unreviewed',{audioReviewed:false},'Audio'],
 ['PNG cover',{cover:{...ready().cover,format:'png'}},'Pochette'],['non square',{cover:{...ready().cover,height:2000}},'Pochette'],
 ['small cover',{cover:{...ready().cover,width:1000,height:1000}},'Pochette'],['large cover',{cover:{...ready().cover,size:10000001}},'Pochette'],
 ['unknown cover',{cover:{...ready().cover,width:undefined,height:undefined}},'Pochette'],
 ['rights absent',{rightsConfirmed:false},'Droits'],['IA unknown',{ai:'unknown'},'Droits'],['date in past',{releaseDate:'2020-01-01'},'Métadonnées'],
 ['date impossible',{releaseDate:'2099-02-31'},'Métadonnées'],['explicit unknown',{explicit:null},'Métadonnées'],
 ['no platforms',{platforms:[]},'Métadonnées'],['lyrics missing',{instrumental:false},'Paroles']
])test('blocks '+name,()=>assert.ok(validate({...ready(),...change}).sections[section].length));
test('MP3 has no artificial PCM bit-depth requirement',()=>assert.equal(validate({...ready(),audio:{...ready().audio,format:'mp3',bitsPerSample:null}}).ready,true));
test('Suno free plan blocks, evidence and dates required; full AI Apple warning',()=>{
 const r={...ready(),ai:'full',aiTools:'Suno',sunoPlan:'free',rightsEvidence:'Invoice',sunoCreatedAt:'2026-01-01',sunoDownloadedAt:'2026-01-02'};
 assert.equal(validate(r).ready,false);r.sunoPlan='pro';assert.equal(validate(r).ready,true);
 assert.ok(validate(r).warnings.some(w=>w.includes('Apple Music')));
 r.rightsEvidence='';assert.equal(validate(r).ready,false);
});
test('lyrics author and review required for vocal song',()=>{
 const r={...ready(),instrumental:false,lyrics:'Moon',lyricists:'Patrick',lyricsReviewed:true};
 assert.equal(validate(r).ready,true);r.lyricists='';assert.equal(validate(r).ready,false);
});
test('sanitize edit does not accept fabricated state, packages or assets',()=>{
 assert.deepEqual(cleanEdit({title:' Moon ',status:'publiée',audio:{},packages:[{}]}),{title:'Moon'});
 assert.throws(()=>cleanEdit({rightsConfirmed:'true'}));assert.throws(()=>cleanEdit({platforms:['Fake Store']}));
});
test('UPC checksum and ISRC validation',()=>{
 assert.equal(validUPC('036000291452'),true);assert.equal(validUPC('036000291453'),false);
 assert.ok(validate({...ready(),isrc:'bad'}).sections.Métadonnées.length);
});
test('transitions require Patrick and Ditto evidence, publication requires a link',()=>{
 const r={...ready(),status:'prête'};assert.throws(()=>transition(r,'publiée','Patrick','ref'));
 assert.throws(()=>transition(r,'envoyée','','ref'));transition(r,'envoyée','Patrick','ref');
 transition(r,'en validation','Patrick','ref');assert.throws(()=>transition(r,'publiée','Patrick','ref'));
 r.finalLinks={Deezer:'https://www.deezer.com/track/1'};transition(r,'publiée','Patrick','ref');
 assert.equal(r.status,'publiée');
});
test('JPEG dimensions and rejection of fake/corrupt image',()=>{
 const b=Buffer.from([255,216,255,192,0,17,8,11,184,11,184,3,1,17,0,2,17,0,3,17,0,255,217]);
 assert.equal(jpegInfo(b).width,3000);assert.equal(jpegInfo(b).colorSpace,'RGB');
 assert.throws(()=>jpegInfo(Buffer.from('bad')));assert.throws(()=>jpegInfo(b.subarray(0,10)));
});
test('actual WAV analysis',async()=>{
 const b=Buffer.alloc(44+44100*4);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(176400,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);
 const a=await inspectAsset(b,'distribution/assets/abc.wav','audio');
 assert.equal(a.channels,2);assert.equal(a.sampleRate,44100);assert.equal(a.bitsPerSample,16);assert.equal(Math.round(a.duration),1);
 await assert.rejects(()=>inspectAsset(Buffer.from('fake'),'distribution/assets/abc.wav','audio'));
});
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}};}
function harness(){
 let state={revision:0,profile:defaultProfile('Duck'),releases:{song:ready()},audit:[]},lastZip;
 const handler=createHandler({readState:async()=>({state:structuredClone(state),etag:'etag'}),writeState:async(s)=>{state=structuredClone(s)},
 readCatalog:async()=>({...defaultCatalog(),tracks:[{id:'song',title:'Lune'}]}),
 readAsset:async()=>bytes,inspectAsset:async()=>ready().audio,deliverZip:async(zip)=>{lastZip=zip;return 'https://private.example/export.zip'}});
 return {handler,get state(){return state},get zip(){return lastZip}};
}
process.env.ADMIN_SECRET='test-only';
async function call(h,body,secret='test-only',method='POST') {const res=response();await h.handler({method,headers:{'x-admin-secret':secret},body},res);return res;}
test('API auth protects GET, export and mutation',async()=>{
 const h=harness();assert.equal((await call(h,{},'bad','GET')).code,401);
 assert.equal((await call(h,{action:'export'},'bad')).code,401);
 const r=await call(h,{},'test-only','GET');assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('API revision conflicts and invalid JSON do not mutate',async()=>{
 const h=harness();assert.equal((await call(h,{action:'edit',expectedRevision:9})).code,409);
 assert.equal((await call(h,'{broken')).code,400);assert.equal(h.state.revision,0);
});
test('API prepares immutable versions with audit; edits invalidate readiness',async()=>{
 const h=harness();assert.equal((await call(h,{action:'prepare',trackId:'song',expectedRevision:0})).code,400);
 const p=await call(h,{action:'prepare',trackId:'song',expectedRevision:0,confirmation:'Patrick'});assert.equal(p.code,200);
 assert.equal(h.state.releases.song.status,'prête');assert.equal(h.state.audit.length,1);
 await call(h,{action:'edit',trackId:'song',expectedRevision:1,release:{title:'Changed'}});
 assert.equal(h.state.releases.song.status,'brouillon');assert.equal(h.state.releases.song.packages[0].metadata.title,'Lune');
 await call(h,{action:'prepare',trackId:'song',expectedRevision:2,confirmation:'Patrick'});
 assert.equal(h.state.releases.song.packages[1].version,2);
 const e=await call(h,{action:'export',trackId:'song',version:1});assert.equal(e.code,200);
 const zip=unzipSync(h.zip);assert.deepEqual(Object.keys(zip),['metadata.json','release.txt','checklist.txt','master.wav','cover.jpg']);
 assert.equal(JSON.parse(strFromU8(zip['metadata.json'])).title,'Lune');assert.equal(Buffer.compare(Buffer.from(zip['master.wav']),bytes),0);
});
test('API blocks incomplete preparation and malicious final links',async()=>{
 const h=harness();await call(h,{action:'edit',trackId:'song',expectedRevision:0,release:{rightsConfirmed:false}});
 assert.equal((await call(h,{action:'prepare',trackId:'song',expectedRevision:1,confirmation:'Patrick'})).code,422);
 assert.equal((await call(h,{action:'tracking',trackId:'song',expectedRevision:1,finalLinks:{Deezer:'javascript:alert(1)'}})).code,400);
 assert.equal((await call(h,{action:'tracking',trackId:'song',expectedRevision:1,finalLinks:{Deezer:'https://deezer.com.evil.example/a'}})).code,400);
 assert.equal((await call(h,{action:'tracking',trackId:'song',expectedRevision:1,upc:'123'})).code,400);
});
test('legacy admin endpoint still rejects unauthorized updates',async()=>{
 const res=response();await catalogHandler({method:'POST',headers:{'x-admin-secret':'bad'},body:{}},res);assert.equal(res.code,401);
});

