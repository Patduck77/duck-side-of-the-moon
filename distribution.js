import { PLATFORMS, validate, SOURCES } from './distribution-core.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,tracks=[],secret=sessionStorage.getItem('duckAdminSecret')||'',selected='',busy=false;
const labels={artist:'Nom d’artiste',legalName:'Nom légal',country:'Pays',label:'Label',language:'Langue',genre:'Genre',
copyrightOwner:'Titulaire ©',masterOwner:'Titulaire ℗',title:'Titre',version:'Version (original, remix…)',copyrightYear:'Année ©/℗',releaseDate:'Date de sortie',territories:'Territoires',composers:'Compositeurs (noms légaux)',lyricists:'Auteurs des paroles (noms légaux)',performers:'Interprètes',producers:'Producteurs',lyrics:'Paroles',
aiTools:'Outils IA utilisés (audio, paroles, pochette)',sunoCreatedAt:'Date de création Suno',sunoDownloadedAt:'Date de téléchargement Suno',
rightsEvidence:'Preuves des droits / licence commerciale / autorisations des samples et voix (références)',
instrumental:'Instrumental',lyricsReviewed:'Paroles relues et droits vérifiés',rightsConfirmed:'Je détiens tous les droits nécessaires (master, paroles, samples, pochette)',
artworkReviewed:'Pochette vérifiée : droits, netteté, aucun lien/QR/logo interdit',audioReviewed:'Master écouté intégralement, sans coupure ni silence prolongé',
noImpersonation:'Aucune imitation de voix/persona sans autorisation',noSpam:'Aucune diffusion de spam ou manipulation'};
const flags=['instrumental','lyricsReviewed','rightsConfirmed','artworkReviewed','audioReviewed','noImpersonation','noSpam'];
function field(k,v) {
 const label=esc(labels[k]||k);
 if(flags.includes(k))return '<label><input type="checkbox" name="'+k+'" '+(v?'checked':'')+'> '+label+'</label>';
 if(['lyrics','rightsEvidence'].includes(k))return '<label>'+label+'<textarea name="'+k+'">'+esc(v)+'</textarea></label>';
 const choices={explicit:[['','À préciser'],['true','Explicite'],['false','Non explicite']],ai:[['unknown','À préciser'],['none','Sans IA'],['assisted','IA assistée'],['full','Entièrement IA']],sunoPlan:[['unknown','À préciser'],['free','Gratuit'],['pro','Pro : licence vérifiée'],['premier','Premier : licence vérifiée'],['written-license','Autorisation écrite spécifique']]};
 if(choices[k])return '<label>'+({explicit:'Contenu explicite',ai:'Origine IA',sunoPlan:'Licence Suno applicable'}[k])+'<select name="'+k+'">'+choices[k].map(([x,n])=>'<option value="'+x+'" '+(String(v??'')===x?'selected':'')+'>'+n+'</option>').join('')+'</select></label>';
 return '<label>'+label+'<input name="'+k+'" type="'+(k.endsWith('Date')||k.endsWith('At')?'date':'text')+'" value="'+esc(v)+'"></label>';
}
async function request(body) {
 const response=await fetch('/api/admin/distribution',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Admin-Secret':secret},...(body?{body:JSON.stringify({...body,expectedRevision:state?.revision})}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error+(data.report?' : '+Object.values(data.report.sections).flat().join(' '):''));
 return data;
}
async function run(fn) {
 if(busy)return;busy=true;const controls=[...document.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
 try{await fn();$('#message').textContent='Opération terminée.';}catch(e){$('#message').textContent=e.message;}
 finally{busy=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});}
}
async function refresh(){state=await request();tracks=state.tracks;selected=selected||tracks[0]?.id||'';render();}
async function mutate(body){const next=await request(body);state={...next,profile:next.profile||state.profile,tracks};render();}
function ensureSaved() {
 const form=$('#edit'),r=state?.releases[selected];if(!form||!r)return;
 const values=collect(form);
 if(Object.keys(values).some(k=>JSON.stringify(values[k])!==JSON.stringify(k==='copyrightYear'?String(r[k]):r[k])))throw new Error('Enregistrer la fiche avant cette opération.');
}
function collect(form) {
 const out={};for(const el of form.elements){if(!el.name)continue;out[el.name]=el.type==='checkbox'?el.checked:el.value;}
 if('explicit' in out)out.explicit=out.explicit===''?null:out.explicit==='true';
 if(form.id==='edit')out.platforms=[...form.querySelectorAll('[data-platform]:checked')].map(x=>x.value);
 return out;
}
function render() {
 $('#workspace').hidden=false;$('#login').hidden=true;
 $('#profile').innerHTML='<div class="grid">'+Object.entries(state.profile||{}).map(([k,v])=>field(k,v)).join('')+'</div><button>Enregistrer le profil</button>';
 $('#profile').onsubmit=e=>{e.preventDefault();run(()=>mutate({action:'profile',profile:collect(e.target)}));};
 $('#track').innerHTML=tracks.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(t.title)+(t.status==='removed'?' (retiré du site)':'')+'</option>').join('');
 const r=state.releases[selected];$('#create').hidden=!!r||!selected;
 $('#audit').textContent=state.audit.map(e=>e.at+' · '+e.action+' · '+(e.trackId||'profil')+' · '+e.detail+' · '+(e.confirmation||e.actor)).join('\n');
 if(!r){$('#release').innerHTML='';return;}
 const report=validate(r);
 const readonly=['envoyée','en validation','publiée'].includes(r.status);
 $('#release').innerHTML='<h2>'+esc(r.title)+' · '+esc(r.status)+'</h2><div class="checks">'+Object.entries(report.sections).map(([k,v])=>'<div><strong>'+k+'</strong><p class="'+(v.length?'issue':'ok')+'">'+esc(v.length?v.join(' '):'Complet')+'</p></div>').join('')+'</div>'+
 report.warnings.map(w=>'<p class="notice">'+esc(w)+'</p>').join('')+
 '<form id="edit"><fieldset '+(readonly?'disabled':'')+'><legend>Fiche de la chanson</legend><div class="grid">'+
 ['title','artist','version','language','genre','label','copyrightOwner','masterOwner','copyrightYear','releaseDate','territories','composers','lyricists','performers','producers','explicit','instrumental','lyrics','lyricsReviewed','ai','aiTools','sunoPlan','sunoCreatedAt','sunoDownloadedAt','rightsEvidence',...flags.filter(x=>!['instrumental','lyricsReviewed'].includes(x))].map(k=>field(k,r[k])).join('')+'</div><h3>Plateformes demandées</h3>'+PLATFORMS.map(p=>'<label><input data-platform type="checkbox" value="'+p+'" '+(r.platforms.includes(p)?'checked':'')+'> '+p+'</label>').join('')+'<button>Enregistrer la fiche</button></fieldset></form>'+
 '<fieldset '+(readonly?'disabled':'')+'><legend>Master et pochette de distribution (distincts des fichiers du site)</legend>'+
 ['audio','cover'].map(k=>'<label>'+(k==='audio'?'Master WAV/MP3 ≤100 Mo':'Pochette JPEG ≤10 Mo')+'<input type="file" data-asset="'+k+'" accept="'+(k==='audio'?'.wav,.mp3':'.jpg,.jpeg')+'"></label><p>'+esc(r[k]?JSON.stringify(r[k]):'Aucun fichier associé')+'</p>').join('')+'</fieldset>'+
 '<label><input type="checkbox" id="approve"> Je suis Patrick et je valide la préparation de cette version, ses droits et les réserves indiquées.</label><button id="prepare" '+(readonly?'disabled':'')+'>Préparer la sortie</button>'+
 '<h3>Packages versionnés</h3>'+r.packages.map(p=>'<button data-export="'+p.version+'">Télécharger v'+p.version+' (ZIP)</button>').join('')+
 '<form id="tracking"><h3>Identifiants et liens finaux</h3><p>ISRC et UPC peuvent rester vides avant leur attribution par Ditto.</p>'+field('isrc',r.isrc)+field('upc',r.upc)+PLATFORMS.map(p=>'<label>'+p+'<input type="url" name="'+p+'" value="'+esc(r.finalLinks?.[p]||'')+'"></label>').join('')+'<button>Enregistrer le suivi</button></form>'+
 '<h3>Suivi manuel dans Ditto</h3><p>Ces boutons enregistrent un constat, sans contacter Ditto.</p>'+({'brouillon':[],'prête':['envoyée','brouillon'],'envoyée':['en validation','refusée'],'en validation':['publiée','refusée'],'refusée':['brouillon'],'publiée':[]}[r.status]||[]).map(s=>'<button data-state="'+s+'">Marquer '+s+'</button>').join('')+
 '<details><summary>Règles vérifiées le 3 octobre 2026</summary>'+SOURCES.map(u=>'<p><a href="'+u+'" target="_blank" rel="noopener noreferrer">'+esc(u)+'</a></p>').join('')+'<p>Recontrôler les règles avant toute soumission. Une fiche complète ne garantit pas l’acceptation.</p></details>';
 $('#edit').onsubmit=e=>{e.preventDefault();run(()=>mutate({action:'edit',trackId:selected,release:collect(e.target)}));};
 $('#tracking').onsubmit=e=>{e.preventDefault();const v=collect(e.target);run(()=>mutate({action:'tracking',trackId:selected,isrc:v.isrc,upc:v.upc,finalLinks:Object.fromEntries(PLATFORMS.map(p=>[p,v[p]]))}));};
 document.querySelectorAll('[data-asset]').forEach(el=>el.onchange=()=>run(async()=>{
  ensureSaved();
  const file=el.files[0];if(!file)return;
  const response=await fetch('/api/admin/distribution-upload',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Secret':secret},body:JSON.stringify({kind:el.dataset.asset,filename:file.name,size:file.size})});
  const ticket=await response.json();if(!response.ok)throw new Error(ticket.error);
  $('#message').textContent='Téléversement et vérification du fichier…';
  const up=await fetch(ticket.presignedUrl,{method:'PUT',body:file,headers:{'Content-Type':ticket.contentType}});
  if(!up.ok)throw new Error('Téléversement impossible');
  await mutate({action:'asset',trackId:selected,kind:el.dataset.asset,pathname:ticket.pathname});
 }));
 $('#prepare').onclick=()=>run(async()=>{if(!$('#approve').checked)throw new Error('Patrick doit cocher la validation de préparation.');
 ensureSaved();
 await mutate({action:'prepare',trackId:selected,confirmation:'Patrick'});});
 document.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>run(async()=>{const d=await request({action:'export',trackId:selected,version:Number(el.dataset.export)});const a=document.createElement('a');a.href=d.url;a.rel='noopener';a.click();}));
 document.querySelectorAll('[data-state]').forEach(el=>el.onclick=()=>run(async()=>{
  const status=el.dataset.state;
  const confirmation=status==='brouillon'?'':prompt('Patrick : saisir Patrick pour confirmer ce constat effectué dans Ditto.');
  if(status!=='brouillon'&&confirmation!=='Patrick')throw new Error('Confirmation annulée.');
  const reference=status==='brouillon'?'':prompt('Référence Ditto / preuve du statut constaté');
  await mutate({action:'transition',trackId:selected,status,confirmation,reference});
 }));
}
$('#login').onsubmit=e=>{e.preventDefault();secret=$('#secret').value;run(async()=>{await refresh();sessionStorage.setItem('duckAdminSecret',secret);});};
$('#refresh').onclick=()=>run(async()=>{ensureSaved();await refresh();});
$('#track').onchange=()=>{try{ensureSaved();selected=$('#track').value;render();}catch(e){$('#track').value=selected;$('#message').textContent=e.message;}};
$('#create').onclick=()=>run(()=>mutate({action:'create',trackId:selected}));
if(secret)run(refresh);

