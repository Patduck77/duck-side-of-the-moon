const S={secret:sessionStorage.getItem('duckAdminSecret')||'',catalog:null,coverTrackId:null,appUploadIndex:-1,appUploadButton:null};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function headers(){return {'Content-Type':'application/json','X-Admin-Secret':S.secret}}
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{...headers(),...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d}
async function login(){S.secret=$('#secretInput').value.trim();try{S.catalog=await api('/api/admin/catalog');sessionStorage.setItem('duckAdminSecret',S.secret);$('#login').classList.add('hidden');$('#adminApp').classList.remove('hidden');renderAll()}catch(e){$('#loginError').textContent=e.message}}
async function refresh(){try{S.catalog=await api('/api/admin/catalog');renderAll()}catch(e){alert(e.message)}}
async function save(){try{S.catalog=await api('/api/admin/catalog',{method:'POST',body:JSON.stringify({expectedRevision:S.catalog.revision,catalog:S.catalog})});renderAll();alert('Enregistré')}catch(e){alert(e.message)}}
function renderAll(){renderDashboard();renderTracks();renderPlaylists();renderApplications();renderSync();renderSettings()}
function renderDashboard(){const c=S.catalog;const pub=c.tracks.filter(t=>t.published!==false&&t.status!=='removed').length;const rem=c.tracks.filter(t=>t.status==='removed').length;const apps=(c.applications||[]).filter(a=>a.published!==false).length;$('#tab-dashboard').innerHTML='<div class="heading"><div><h1>Tableau de bord</h1><p>Duck Side OF The Moon</p></div></div><div class="cards"><div class="stat"><strong>'+c.tracks.length+'</strong><span>Morceaux</span></div><div class="stat"><strong>'+pub+'</strong><span>Publiés</span></div><div class="stat"><strong>'+c.playlists.length+'</strong><span>Playlists</span></div><div class="stat"><strong>'+apps+'</strong><span>Applications</span></div></div><div class="notice" style="margin-top:18px">Révision '+c.revision+' · '+new Date(c.updatedAt).toLocaleString('fr-FR')+'</div>'}
function playlistChecks(t){return S.catalog.playlists.map(p=>'<label class="small"><input type="checkbox" data-track-playlist="'+esc(t.id)+'" value="'+esc(p.id)+'" '+((t.playlistIds||[]).includes(p.id)?'checked':'')+'> '+esc(p.name)+'</label>').join('<br>')}
function renderTracks(){const rows=S.catalog.tracks.map(t=>'<tr><td><img class="cover-thumb" src="'+esc(t.cover||S.catalog.settings.defaultCover)+'"><br><button data-cover="'+esc(t.id)+'">Pochette</button></td><td><input data-track="'+esc(t.id)+'" data-field="title" value="'+esc(t.title)+'"><div class="small">Source : '+esc(t.sourceName||'')+'</div></td><td><input data-track="'+esc(t.id)+'" data-field="artist" value="'+esc(t.artist||'')+'"></td><td><input data-track="'+esc(t.id)+'" data-field="style" value="'+esc((t.style||[]).join(', '))+'"></td><td>'+playlistChecks(t)+'</td><td><textarea data-track="'+esc(t.id)+'" data-field="lyrics">'+esc(t.lyrics||'')+'</textarea></td><td><label><input type="checkbox" data-track="'+esc(t.id)+'" data-field="published" '+(t.published!==false?'checked':'')+'> publié</label><br><span class="status '+(t.status==='removed'?'removed':'active')+'">'+esc(t.status||'active')+'</span><br><button data-delete="'+esc(t.id)+'" class="danger">Supprimer</button></td></tr>').join('');
$('#tab-tracks').innerHTML='<div class="heading"><div><h1>Morceaux</h1><p>Nom, artiste, styles, playlists, paroles, visibilité et pochette.</p></div></div><div class="table-wrap"><table><thead><tr><th>Pochette</th><th>Titre</th><th>Artiste</th><th>Styles</th><th>Playlists</th><th>Lyrics</th><th>État</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
$$('[data-track]').forEach(el=>el.addEventListener('change',onTrackField));
$$('[data-track-playlist]').forEach(el=>el.addEventListener('change',onPlaylistCheck));
$$('[data-cover]').forEach(b=>b.onclick=()=>{S.coverTrackId=b.dataset.cover;$('#coverFile').click()});
$$('[data-delete]').forEach(b=>b.onclick=()=>deleteTrack(b.dataset.delete))}
function onTrackField(e){const t=S.catalog.tracks.find(x=>x.id===e.target.dataset.track);const f=e.target.dataset.field;if(!t)return;if(f==='published')t[f]=e.target.checked;else if(f==='style')t[f]=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);else t[f]=e.target.value;if(f==='title')t.titleLocked=true}
function onPlaylistCheck(e){const t=S.catalog.tracks.find(x=>x.id===e.target.dataset.trackPlaylist);if(!t)return;t.playlistIds=t.playlistIds||[];if(e.target.checked&&!t.playlistIds.includes(e.target.value))t.playlistIds.push(e.target.value);if(!e.target.checked)t.playlistIds=t.playlistIds.filter(x=>x!==e.target.value)}
async function deleteTrack(id){if(!confirm('Supprimer définitivement ce morceau du site et de Blob ?'))return;try{await api('/api/admin/delete-track',{method:'POST',body:JSON.stringify({id})});await refresh()}catch(e){alert(e.message)}}
function renderPlaylists(){const cards=S.catalog.playlists.map((p,i)=>'<div class="playlist-edit" data-pidx="'+i+'"><h3>'+esc(p.name)+'</h3><label>Nom<input data-pfield="name" value="'+esc(p.name)+'"></label><label>Description<textarea data-pfield="description">'+esc(p.description||'')+'</textarea></label><label><input type="checkbox" data-pfield="published" '+(p.published!==false?'checked':'')+'> Publique</label> <label><input type="checkbox" data-pfield="featured" '+(p.featured?'checked':'')+'> Mise en avant</label><div class="track-order">'+(p.order||[]).map(id=>{const t=S.catalog.tracks.find(x=>x.id===id);return t?'<div class="draggable">'+esc(t.title)+'</div>':''}).join('')+'</div><button data-pdelete="'+i+'" class="danger">Supprimer la playlist</button></div>').join('');
$('#tab-playlists').innerHTML='<div class="heading"><div><h1>Playlists</h1><p>Crée, renomme et organise les collections.</p></div><button id="addPlaylist">+ Nouvelle playlist</button></div><div class="playlist-list">'+cards+'</div>';
$('#addPlaylist').onclick=()=>{const name=prompt('Nom de la playlist');if(!name)return;const id=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');S.catalog.playlists.push({id,name,description:'',cover:S.catalog.settings.defaultCover,published:true,featured:false,order:[]});renderPlaylists();renderTracks()};
$$('[data-pidx] input,[data-pidx] textarea').forEach(el=>el.addEventListener('change',e=>{const card=e.target.closest('[data-pidx]');const p=S.catalog.playlists[Number(card.dataset.pidx)];const f=e.target.dataset.pfield;if(!f)return;p[f]=e.target.type==='checkbox'?e.target.checked:e.target.value}));
$$('[data-pdelete]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.pdelete);const id=S.catalog.playlists[i].id;if(confirm('Supprimer cette playlist ? Les morceaux restent publiés.')){S.catalog.playlists.splice(i,1);S.catalog.tracks.forEach(t=>t.playlistIds=(t.playlistIds||[]).filter(x=>x!==id));renderPlaylists();renderTracks()}})}
function formatBytes(n){n=Number(n||0);if(!n)return '—';const u=['o','Ko','Mo','Go'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return (i?n.toFixed(n<10?1:0):Math.round(n))+' '+u[i]}
function renderApplications(){const apps=S.catalog.applications||[];const cards=apps.map((a,i)=>'<div class="playlist-edit" data-aidx="'+i+'"><h3>'+esc(a.name||'Application')+'</h3><div class="form"><label>Nom<input data-afield="name" value="'+esc(a.name||'')+'"></label><label>Accroche<input data-afield="tagline" value="'+esc(a.tagline||'')+'"></label><label>Description<textarea data-afield="description">'+esc(a.description||'')+'</textarea></label><div class="row"><label>Version<input data-afield="version" value="'+esc(a.version||'')+'"></label><label>Plateforme<input data-afield="platform" value="'+esc(a.platform||'Windows')+'"></label></div><label>Notes de version<textarea data-afield="notes">'+esc(a.notes||'')+'</textarea></label><div class="notice"><strong>Fichier :</strong> '+esc(a.fileName||'aucun')+' · '+formatBytes(a.fileSize)+'<br><span class="small">'+(a.downloadUrl?'<a href="'+esc(a.downloadUrl)+'" target="_blank">Tester le téléchargement</a>':'Aucun fichier hébergé')+'</span></div><div class="row"><label><input type="checkbox" data-afield="published" '+(a.published!==false?'checked':'')+'> Publique</label><label><input type="checkbox" data-afield="featured" '+(a.featured?'checked':'')+'> Mise en avant</label></div><button data-app-upload="'+i+'" class="primary">Téléverser une version</button><button data-app-delete="'+i+'" class="danger">Supprimer la fiche</button></div></div>').join('');
$('#tab-applications').innerHTML='<div class="heading"><div><h1>Applications</h1><p>Héberge et publie HarpaGO, ESTELLE et tes futures applications.</p></div><button id="addApplication">+ Nouvelle application</button></div><div class="playlist-list">'+cards+'</div>';
$('#addApplication').onclick=()=>{const name=prompt('Nom de l\'application');if(!name)return;const id=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');S.catalog.applications=S.catalog.applications||[];S.catalog.applications.push({id,name,tagline:'',description:'',version:'',platform:'Windows',published:true,featured:false,downloadUrl:'',fileName:'',fileSize:0,releaseDate:'',icon:'',notes:''});renderApplications()};
$$('[data-aidx] input,[data-aidx] textarea').forEach(el=>el.addEventListener('change',e=>{const card=e.target.closest('[data-aidx]');const a=S.catalog.applications[Number(card.dataset.aidx)];const f=e.target.dataset.afield;if(!f)return;a[f]=e.target.type==='checkbox'?e.target.checked:e.target.value}));
$$('[data-app-upload]').forEach(b=>b.onclick=()=>chooseApplicationFile(Number(b.dataset.appUpload),b));
$$('[data-app-delete]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.appDelete);if(confirm('Supprimer cette fiche application ?')){S.catalog.applications.splice(i,1);renderApplications()}});
}
function chooseApplicationFile(index,button){S.appUploadIndex=index;S.appUploadButton=button;const input=$('#appFile');input.value='';input.click()}
async function uploadApplicationFile(index,file,button){
  const app=S.catalog.applications[index];
  if(!app)return;

  const old=button?button.textContent:'Téléverser une version';

  if(button){
    button.disabled=true;
    button.textContent='Préparation…';
  }

  try{
    const ticket=await api('/api/admin/app-upload-url',{
      method:'POST',
      body:JSON.stringify({
        appId:app.id,
        fileName:file.name,
        fileSize:file.size,
        contentType:file.type||'application/octet-stream'
      })
    });

    if(button)button.textContent='Envoi en cours…';

    const r=await fetch(ticket.presignedUrl,{
      method:'PUT',
      body:file,
      headers:{
        'Content-Type':file.type||'application/octet-stream'
      }
    });

    if(!r.ok){
      const txt=await r.text().catch(()=> '');
      throw new Error('Échec du téléversement : HTTP '+r.status+(txt?' — '+txt:''));
    }

    let uploaded={};
    try{uploaded=await r.json()}catch(_){}

    const publicUrl=
      uploaded.url ||
      uploaded.downloadUrl ||
      ticket.presignedUrl.split('?')[0];

    app.downloadUrl=publicUrl;
    app.fileName=file.name;
    app.fileSize=file.size;
    app.releaseDate=new Date().toISOString();

    if(button)button.textContent='Enregistrement…';

    S.catalog=await api('/api/admin/catalog',{
      method:'POST',
      body:JSON.stringify({
        expectedRevision:S.catalog.revision,
        catalog:S.catalog
      })
    });

    alert('Version téléversée avec succès.');
    renderAll();
  }catch(e){
    alert(e.message||'Téléversement impossible');
  }finally{
    if(button){
      button.disabled=false;
      button.textContent=old;
    }
  }
}
function renderSync(){const rows=S.catalog.tracks.map(t=>'<tr><td>'+esc(t.sourceName||t.title)+'</td><td>'+esc(t.driveFileId||'—')+'</td><td><span class="status '+(t.status==='removed'?'removed':'active')+'">'+esc(t.status||'active')+'</span></td><td>'+new Date(t.updatedAt||t.createdAt||Date.now()).toLocaleString('fr-FR')+'</td></tr>').join('');$('#tab-sync').innerHTML='<div class="heading"><div><h1>Synchronisation Drive</h1><p>État des fichiers détectés.</p></div></div><div class="notice">Drive est la source physique. Un fichier supprimé du dossier est automatiquement dépublié. Sa suppression définitive reste manuelle dans Morceaux.</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Fichier source</th><th>ID Drive</th><th>État</th><th>Dernière mise à jour</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
function renderSettings(){const s=S.catalog.settings;$('#tab-settings').innerHTML='<div class="heading"><div><h1>Paramètres</h1><p>Valeurs par défaut du site.</p></div></div><div class="form"><label>Titre du site<input data-setting="siteTitle" value="'+esc(s.siteTitle)+'"></label><label>Baseline<input data-setting="baseline" value="'+esc(s.baseline)+'"></label><label>Artiste par défaut<input data-setting="defaultArtist" value="'+esc(s.defaultArtist)+'"></label><label>Playlist par défaut<select data-setting="defaultPlaylistId">'+S.catalog.playlists.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===s.defaultPlaylistId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label><input type="checkbox" data-setting="autoPublishNewTracks" '+(s.autoPublishNewTracks?'checked':'')+'> Publier automatiquement les nouveaux morceaux</label></div>';$$('[data-setting]').forEach(el=>el.addEventListener('change',e=>{const f=e.target.dataset.setting;S.catalog.settings[f]=e.target.type==='checkbox'?e.target.checked:e.target.value}))}
async function uploadCover(file){if(!S.coverTrackId||!file)return;const reader=new FileReader();reader.onload=async()=>{const base64=String(reader.result).split(',')[1];try{await api('/api/admin/upload-cover',{method:'POST',body:JSON.stringify({trackId:S.coverTrackId,filename:file.name,contentType:file.type,dataBase64:base64})});await refresh()}catch(e){alert(e.message)}};reader.readAsDataURL(file)}
$('#loginBtn').onclick=login;$('#secretInput').addEventListener('keydown',e=>{if(e.key==='Enter')login()});$('#refreshBtn').onclick=refresh;$('#saveBtn').onclick=save;$('#coverFile').addEventListener('change',e=>uploadCover(e.target.files[0]));$('#appFile').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(file&&S.appUploadIndex>=0)uploadApplicationFile(S.appUploadIndex,file,S.appUploadButton)});
$$('aside button[data-tab]').forEach(b=>b.onclick=()=>{$$('aside button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tab').forEach(x=>x.classList.remove('active'));$('#tab-'+b.dataset.tab).classList.add('active')});
if(S.secret){$('#secretInput').value=S.secret;login()}
