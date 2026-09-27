const state={tracks:[],filtered:[],currentIndex:-1};
const audio=document.getElementById('audio');
const playBtn=document.getElementById('playBtn');
const trackGrid=document.getElementById('trackGrid');
const emptyState=document.getElementById('emptyState');
const playerTitle=document.getElementById('playerTitle');
const playerArtist=document.getElementById('playerArtist');
const playerCover=document.getElementById('playerCover');
const progress=document.getElementById('progress');
const currentTime=document.getElementById('currentTime');
const duration=document.getElementById('duration');
const playlists=[
  {title:'Moon Sessions',text:'Atmosphères nocturnes, contemplatives et cinématiques.'},
  {title:'Human Before Data',text:'Chansons autour de l’humain, de la technologie et de la société.'},
  {title:'Coin Coin Theory',text:'Expérimentations, ironie, contrastes et signatures inattendues.'},
  {title:'Stories From Earth',text:'Chansons narratives, personnages, souvenirs et fragments de vie.'}
];
function formatTime(s){if(!isFinite(s))return '0:00';const m=Math.floor(s/60);const sec=Math.floor(s%60).toString().padStart(2,'0');return `${m}:${sec}`}
function toast(msg){const d=document.createElement('div');d.className='toast';d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function renderPlaylists(){document.getElementById('playlistGrid').innerHTML=playlists.map(p=>`<article class="playlist-card"><h3>${p.title}</h3><p>${p.text}</p></article>`).join('')}
function renderTracks(list){trackGrid.innerHTML='';emptyState.classList.toggle('hidden',list.length>0);list.forEach((t,i)=>{const a=document.createElement('article');a.className='track-card';a.innerHTML=`<div class="cover-wrap"><img src="${t.cover||'assets/duck-side-of-the-moon.jpg'}" alt=""><button class="card-play">▶</button></div><div class="track-info"><h3>${t.title}</h3><p>${(t.style||[]).join(' · ')}${t.durationLabel?' · '+t.durationLabel:''}</p></div>`;a.querySelector('.card-play').onclick=()=>loadTrack(i,true,list);trackGrid.appendChild(a)})}
function loadTrack(i,autoplay=false,list=state.filtered){if(!list.length){toast('Aucun morceau publié pour le moment');return}const t=list[i];state.currentIndex=state.tracks.findIndex(x=>x.id===t.id);playerTitle.textContent=t.title;playerArtist.textContent=t.artist||'Duck Side OF The Moon';playerCover.src=t.cover||'assets/duck-side-of-the-moon.jpg';if(t.audio){audio.src=t.audio;if(autoplay)audio.play().catch(()=>{});}else{audio.removeAttribute('src');audio.load();toast('Le lecteur est prêt. Il manque encore le fichier audio publié.')}}
async function loadLibrary(){try{const r=await fetch('/api/library');if(!r.ok)throw new Error();const data=await r.json();state.tracks=data.tracks||[]}catch(e){try{const r=await fetch('data/library.json');const data=await r.json();state.tracks=data.tracks||[]}catch(_){state.tracks=[]}}state.filtered=[...state.tracks];renderTracks(state.filtered);if(state.tracks.length)loadTrack(0,false,state.tracks)}
document.getElementById('searchInput').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();state.filtered=state.tracks.filter(t=>[t.title,t.artist,(t.style||[]).join(' '),(t.playlists||[]).join(' ')].join(' ').toLowerCase().includes(q));renderTracks(state.filtered)});
document.getElementById('listenNow').onclick=()=>state.tracks.length?loadTrack(0,true,state.tracks):toast('Ajoute d’abord un morceau publié dans la bibliothèque.');
playBtn.onclick=()=>{if(!audio.src){toast('Aucun fichier audio chargé');return}audio.paused?audio.play():audio.pause()};
document.getElementById('prevBtn').onclick=()=>{if(!state.tracks.length)return;const i=(state.currentIndex-1+state.tracks.length)%state.tracks.length;loadTrack(i,true,state.tracks)};
document.getElementById('nextBtn').onclick=()=>{if(!state.tracks.length)return;const i=(state.currentIndex+1)%state.tracks.length;loadTrack(i,true,state.tracks)};
document.getElementById('muteBtn').onclick=()=>{audio.muted=!audio.muted;document.getElementById('muteBtn').textContent=audio.muted?'🔇':'🔊'};
audio.addEventListener('play',()=>playBtn.textContent='❚❚');audio.addEventListener('pause',()=>playBtn.textContent='▶');audio.addEventListener('loadedmetadata',()=>duration.textContent=formatTime(audio.duration));audio.addEventListener('timeupdate',()=>{currentTime.textContent=formatTime(audio.currentTime);progress.value=audio.duration?(audio.currentTime/audio.duration)*100:0});progress.addEventListener('input',()=>{if(audio.duration)audio.currentTime=(progress.value/100)*audio.duration});audio.addEventListener('ended',()=>document.getElementById('nextBtn').click());
document.querySelector('.menu-toggle').onclick=()=>toast('Navigation : Musique · Playlists · Lyrics · About');
document.getElementById('year').textContent=new Date().getFullYear();renderPlaylists();loadLibrary();
