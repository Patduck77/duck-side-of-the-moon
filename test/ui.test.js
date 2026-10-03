import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { defaultCatalog } from '../lib/catalog.js';
import * as core from '../distribution-core.js';
test('public player: library, search, playlists, playback, next and application links',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;let plays=0;
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLMediaElement.prototype.play=function(){plays++;this.dispatchEvent(new w.Event('play'));return Promise.resolve();};
 w.HTMLMediaElement.prototype.pause=function(){this.dispatchEvent(new w.Event('pause'));};
 w.fetch=async()=>({ok:true,json:async()=>({tracks:[{id:'a',title:'Moon',artist:'Duck',audio:'https://example.test/moon.mp3',playlistIds:['moon'],style:[]},{id:'b',title:'Sun',audio:'https://example.test/sun.mp3',style:[]}],playlists:[{id:'moon',name:'Moon',order:['a']}],applications:[{id:'app',name:'HarpaGO',downloadUrl:'https://example.test/app.exe'}]})});
 w.eval(js);await tick();assert.equal(w.document.querySelectorAll('.track-card').length,2);
 w.document.querySelector('.card-play').click();assert.equal(plays,1);assert.equal(w.document.querySelector('#playerTitle').textContent,'Moon');
 w.document.querySelector('#nextBtn').click();assert.equal(w.document.querySelector('#playerTitle').textContent,'Sun');
 const search=w.document.querySelector('#searchInput');search.value='Moon';search.dispatchEvent(new w.Event('input'));
 assert.equal(w.document.querySelectorAll('.track-card').length,1);
 w.document.querySelector('[data-playlist]').click();assert.equal(w.document.querySelectorAll('.track-card').length,1);
 assert.equal(w.document.querySelector('.app-download').getAttribute('href'),'https://example.test/app.exe');
 dom.window.close();
});

const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('existing admin: login, navigation, track edit, settings, save, manual sync and app cards',async()=>{
 const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../admin.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/admin.html',runScripts:'outside-only'});
 const w=dom.window;let catalog=defaultCatalog(),syncCalls=0,saves=0;
 catalog.tracks=[{id:'song',title:'Moon',artist:'Duck',audio:'a',style:[],playlistIds:['moon-sessions'],published:true}];
 w.alert=()=>{};w.confirm=()=>true;
 w.fetch=async(url,opts={})=>{
 if(url==='/api/admin/sync'){syncCalls++;return {ok:true,json:async()=>({imported:1,covers:0,embeddedCovers:0,removed:0,remainingAudio:0})};}
 if(opts.method==='POST'){catalog=JSON.parse(opts.body).catalog;catalog.revision++;saves++;}
 return {ok:true,json:async()=>structuredClone(catalog)};
 };
 w.eval(js);w.document.querySelector('#secretInput').value='test';w.document.querySelector('#loginBtn').click();await tick();
 assert.equal(w.document.querySelector('#adminApp').classList.contains('hidden'),false);
 assert.ok(w.document.querySelector('[data-aidx="0"]').textContent.includes('HarpaGO'));
 assert.ok(w.document.querySelector('[data-aidx="1"]').textContent.includes('ESTELLE'));
 w.document.querySelector('[data-tab="tracks"]').click();assert.ok(w.document.querySelector('#tab-tracks').classList.contains('active'));
 const title=w.document.querySelector('[data-track="song"][data-field="title"]');title.value='Moon revised';title.dispatchEvent(new w.Event('change'));
 w.document.querySelector('#syncNowBtn').click();await tick();assert.equal(syncCalls,0);
 assert.match(w.document.querySelector('#syncResult').textContent,/Enregistre/);
 w.document.querySelector('#saveBtn').click();await tick();assert.equal(saves,1);assert.equal(catalog.tracks[0].title,'Moon revised');
 w.document.querySelector('#syncNowBtn').click();await tick();assert.equal(syncCalls,1);
 assert.match(w.document.querySelector('#syncResult').textContent,/effectuée/);
 const setting=w.document.querySelector('[data-setting="baseline"]');setting.value='Human';setting.dispatchEvent(new w.Event('change'));
 w.document.querySelector('#saveBtn').click();await tick();assert.equal(catalog.settings.baseline,'Human');
 dom.window.close();
});
test('Distribution UI: login, five section statuses, profile, creation, edit and Patrick validation',async()=>{
 const html=await readFile(new URL('../distribution.html',import.meta.url),'utf8');
 const js=(await readFile(new URL('../distribution.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,'');
 const dom=new JSDOM(html,{url:'https://example.test/distribution.html',runScripts:'outside-only'});
 const w=dom.window;Object.assign(w,{PLATFORMS:core.PLATFORMS,validate:core.validate,SOURCES:core.SOURCES});
 let state={revision:0,profile:core.defaultProfile('Duck'),releases:{},audit:[],tracks:[{id:'song',title:'Moon'}]},calls=[];
 w.fetch=async(url,opts={})=>{
 const b=opts.body?JSON.parse(opts.body):null;if(b){calls.push(b);
 if(b.action==='create')state.releases.song=core.newRelease(state.tracks[0],state.profile);
 if(b.action==='edit')Object.assign(state.releases.song,core.cleanEdit(b.release));
 if(b.action==='profile')state.profile=b.profile;
 state.revision++;}
 return {ok:true,json:async()=>structuredClone(state)};
 };
 w.eval(js);w.document.querySelector('#secret').value='test';w.document.querySelector('#login').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(w.document.querySelector('#workspace').hidden,false);
 w.document.querySelector('#create').click();await tick();
 assert.equal(w.document.querySelectorAll('.checks strong').length,5);
 assert.equal(w.document.querySelectorAll('[data-platform]').length,5);
 w.document.querySelector('#prepare').click();await tick();assert.match(w.document.querySelector('#message').textContent,/cocher/);
 assert.equal(calls.filter(x=>x.action==='prepare').length,0);
 const t=w.document.querySelector('[name="title"]');t.value='New title';
 w.document.querySelector('#edit').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(state.releases.song.title,'New title');assert.equal(calls.at(-1).release.status,undefined);
 assert.equal(w.document.querySelector('a[href="https://dittomusic.com/"]').textContent.includes('Continuer'),true);
 dom.window.close();
});

