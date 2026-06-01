// MediaLog app.js v4
'use strict';

// ── État ──────────────────────────────────────────────────
let state={categories:[]}, currentUser=null, activeCatId=null;
let searchQuery='', sortKey='', sortDir='desc';
let viewMode='cards', cardLayout='cards-list';
let filterFav=false, filterStatus='all';
let saveTimer=null, saveStatus='saved';
let tempCatColor='#7C6FE0', tempNewCols=[], tempColumns=[];
let colDragSrcIdx=null, colDragOverIdx=null;
let entryDragSrcId=null, entryDragOverId=null;
let editingEntryId=null;
let tableSelectMode=false, tableSelected=new Set();
let searchDebounce=null;
let tutorialSteps=[];

// ── Utils ─────────────────────────────────────────────────
const uid=()=>Math.random().toString(36).slice(2,10);
const getCat=id=>state.categories.find(c=>c.id===id);
const getActiveCat=()=>getCat(activeCatId);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function formatDate(str){if(!str)return'';const[y,m,d]=str.split('-').map(Number);if(!y)return str;return new Date(y,m-1,d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function parseDate(str){
  if(!str)return 0;
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)){const[y,m,d]=str.split('-').map(Number);return new Date(y,m-1,d).getTime();}
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(str)){const[d,m,y]=str.split('/').map(Number);return new Date(y,m-1,d).getTime();}
  const t=new Date(str).getTime();return isNaN(t)?0:t;
}function isUnseen(e){const s=(e.statut||'').toLowerCase();return s.includes('à voir')||s.includes('à faire')||s.includes('à lire')||s.includes('à paraître');}
function renderMd(text){if(!text)return'';return text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/^- (.+)/gm,'<li>$1</li>').replace(/<li>/g,'<ul><li>').replace(/<\/li>(?![\s\S]*<li>)/g,'</li></ul>').replace(/\n\n/g,'</p><p>').replace(/^(?!<)/gm,'<p>').replace(/$(?!>)/gm,'</p>').replace(/<p><\/p>/g,'');}

// ── Sauvegarde auto ───────────────────────────────────────
function scheduleSave(){
  saveStatus='saving'; updateSaveIndicator();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{await API.saveData(state.categories);saveStatus='saved';}
    catch(e){saveStatus='error';console.error(e);}
    updateSaveIndicator();
  },1500);
}
function updateSaveIndicator(){
  const el=document.getElementById('save-indicator');
  if(!el)return;
  const map={saving:'💾 Sauvegarde…',saved:'✓ Sauvegardé',error:'⚠ Erreur'};
  el.textContent=map[saveStatus]||'';
  el.className=`save-indicator save-${saveStatus}`;
}

// ── Routing ───────────────────────────────────────────────
async function route(){
  const path=window.location.pathname;
  if(path==='/confirm')return showConfirmPage();
  const shareMatch=path.match(/^\/share\/([a-zA-Z0-9-]+)$/i);
  if(shareMatch)return initSharePage(shareMatch[1]);
  try{applySiteConfig(await API.getConfig());}catch{}
  if(!API.isLoggedIn()){showPage('auth');initAuthPage();return;}
  try{
    currentUser=await API.me();
    const data=await API.getData();
    state.categories=data.categories||[];
    activeCatId=state.categories[0]?.id||null;
    try{tutorialSteps=await API.getTutorial();}catch{tutorialSteps=[];}
    showPage('app');initApp();
  }catch{API.clearTokens();showPage('auth');initAuthPage();}
}

function showPage(name){['auth','app','share','confirm'].forEach(p=>{const el=document.getElementById(`page-${p}`);if(el)el.style.display=p===name?'':'none';});}

async function showConfirmPage(){
  showPage('confirm');
  const content = document.getElementById('confirm-content');

  // Supabase envoie token_hash + type en query params (pas dans le hash)
  const params = new URLSearchParams(window.location.search);
  const token_hash = params.get('token_hash');
  const type = params.get('type');

  // Fallback : Supabase peut aussi utiliser le hash (#access_token=...) pour les anciens flows
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (type === 'recovery' && token_hash) {
    // Réinitialisation de mot de passe via token_hash
    try {
      await API.verifyOtp(token_hash, 'recovery');
    } catch(e) {
      content.innerHTML = `<div style="font-size:64px;">❌</div><h2 class="auth-title">Lien invalide</h2><p style="color:var(--text2);margin-bottom:20px;">${esc(e.message||'Lien expiré ou déjà utilisé.')}</p><a href="/" class="btn btn-primary">Retour</a>`;
      return;
    }
    content.innerHTML = `
      <div style="font-size:64px;margin-bottom:16px;">🔑</div>
      <h2 class="auth-title">Nouveau mot de passe</h2>
      <p style="color:var(--text2);margin-bottom:20px;">Tu peux maintenant définir un nouveau mot de passe.</p>
      <input type="password" id="new-pw-reset" class="field-input" placeholder="8 caractères minimum" style="margin-bottom:12px;"/>
      <div id="pw-reset-error" class="auth-error" style="display:none;"></div>
      <button class="btn btn-primary" id="btn-pw-reset" style="width:100%;">Enregistrer</button>`;
    document.getElementById('btn-pw-reset').addEventListener('click', async()=>{
      const pw = document.getElementById('new-pw-reset').value;
      const err = document.getElementById('pw-reset-error'); err.style.display='none';
      try {
        await API.updatePassword(pw);
        content.innerHTML = `<div style="font-size:64px;">✅</div><h2 class="auth-title">Mot de passe mis à jour !</h2><p style="margin-top:12px;"><a href="/" class="btn btn-primary">Se connecter</a></p>`;
      } catch(e) { err.textContent=e.message; err.style.display=''; }
    });

  } else if ((type === 'email' || type === 'signup') && token_hash) {
    // Confirmation email classique via token_hash
    try {
      await API.verifyOtp(token_hash, type === 'signup' ? 'signup' : 'email');
      content.innerHTML = `<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Compte confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Ton adresse email a bien été vérifiée. Tu peux maintenant te connecter.</p><a href="/" class="btn btn-primary">Se connecter</a>`;
    } catch(e) {
      content.innerHTML = `<div style="font-size:64px;">❌</div><h2 class="auth-title">Lien invalide</h2><p style="color:var(--text2);margin-bottom:20px;">${esc(e.message||'Lien expiré ou déjà utilisé.')}</p><a href="/" class="btn btn-primary">Retour</a>`;
    }

  } else if (accessToken && refreshToken) {
    // Ancien flow implicite (hash) — Supabase JS SDK détecte ça automatiquement
    // La session est déjà établie, on affiche juste la confirmation
    content.innerHTML = `<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Compte confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Tu peux maintenant te connecter.</p><a href="/" class="btn btn-primary">Se connecter</a>`;

  } else {
    // Page générique de confirmation (lien sans paramètres connus)
    content.innerHTML = `<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Email confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Tu peux maintenant te connecter à ton compte.</p><a href="/" class="btn btn-primary">Se connecter</a>`;
  }
}

function applySiteConfig(cfg){
  if(!cfg)return;
  const name=cfg.site_name||'MediaLog',logo=cfg.site_logo||'ML',sub=cfg.site_subtitle||'Mon journal culturel';
  document.title=name;
  ['app-logo','auth-logo-text','share-logo'].forEach(id=>{const el=document.getElementById(id);if(!el)return;if(cfg.site_logo_url){el.innerHTML=`<img src="${esc(cfg.site_logo_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>`;el.style.padding='0';}else el.textContent=logo;});
  ['app-site-name','auth-site-name','share-site-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=name;});
  ['app-site-sub','auth-site-sub'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=sub;});
}

// ── AUTH ──────────────────────────────────────────────────
function initAuthPage(){
  document.querySelectorAll('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');
    document.getElementById('auth-login').style.display=tab.dataset.tab==='login'?'':'none';
    document.getElementById('auth-register').style.display=tab.dataset.tab==='register'?'':'none';
  }));

  document.getElementById('btn-login').addEventListener('click',async()=>{
    const email=document.getElementById('login-email').value.trim();
    const pw=document.getElementById('login-pw').value;
    const errEl=document.getElementById('login-error');errEl.style.display='none';
    const btn=document.getElementById('btn-login');btn.disabled=true;btn.textContent='Connexion…';
    try{
      const data=await API.login(email,pw);currentUser=data.user;
      const d=await API.getData();state.categories=d.categories||[];
      activeCatId=state.categories[0]?.id||null;
      try{tutorialSteps=await API.getTutorial();}catch{tutorialSteps=[];}
      showPage('app');initApp();
    }catch(e){
      errEl.textContent=e.message==='Email not confirmed'?'📧 Confirme ton email avant de te connecter.':e.message;
      errEl.style.display='';
    }finally{btn.disabled=false;btn.textContent='Se connecter';}
  });
  ['login-email','login-pw'].forEach(id=>document.getElementById(id)?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('btn-login').click();}));

  document.getElementById('btn-register').addEventListener('click',async()=>{
    const username=document.getElementById('reg-username').value.trim();
    const email=document.getElementById('reg-email').value.trim();
    const pw=document.getElementById('reg-pw').value;
    const errEl=document.getElementById('reg-error');errEl.style.display='none';
    if(!username||username.length<3){errEl.textContent='Pseudo trop court (3 car. min.)';errEl.style.display='';return;}
    if(!email.includes('@')){errEl.textContent='Email invalide.';errEl.style.display='';return;}
    if(pw.length<8){errEl.textContent='Mot de passe trop court (8 car. min.)';errEl.style.display='';return;}
    const btn=document.getElementById('btn-register');btn.disabled=true;btn.textContent='Inscription…';
    try{
      await API.register(username,email,pw);
      document.getElementById('auth-register').innerHTML=`
        <div class="auth-confirm-msg">
          <div style="font-size:48px;margin-bottom:16px;">📧</div>
          <h3>Vérifie ta boîte mail !</h3>
          <p>Un email de confirmation a été envoyé à <strong>${esc(email)}</strong>.</p>
          <p style="margin-top:8px;color:var(--text3);">Clique sur le lien dans l'email pour activer ton compte, puis connecte-toi ici.</p>
        </div>`;
    }catch(e){errEl.textContent=e.message;errEl.style.display='';}
    finally{btn.disabled=false;btn.textContent='Créer mon compte';}
  });

  document.getElementById('btn-forgot-pw')?.addEventListener('click',async()=>{
    const email=document.getElementById('login-email').value.trim();
    if(!email){alert('Saisis ton email d\'abord.');return;}
    try{await API.resetPassword(email);alert('📧 Email envoyé !');}catch(e){alert(e.message);}
  });
}

// ── PARTAGE ───────────────────────────────────────────────
async function initSharePage(token){
  showPage('share');
  try{applySiteConfig(await API.getConfig());}catch{}
  try{
    const data=await API.getShareData(token);
    if(data.error)throw new Error(data.error);
    document.getElementById('share-owner-name').textContent=`Collection de ${data.username}`;
    const ss={categories:data.categories||[]};
    const firstCat=ss.categories[0]?.id||null;
    renderShareTabs(ss,firstCat);renderShareContent(ss,firstCat);
  }catch(e){
    document.getElementById('share-main-content').innerHTML=`<div class="empty-state"><span class="empty-icon">🔒</span><h3>Collection introuvable</h3><p>${esc(e.message)}</p></div>`;
  }
}
function renderShareTabs(ss,active){
  const nav=document.getElementById('share-tabs-nav');
  nav.innerHTML=ss.categories.map(cat=>`<button class="tab-btn ${cat.id===active?'active':''}" style="--tab-color:${cat.color}" data-id="${cat.id}"><span class="tab-icon">${cat.icon}</span>${esc(cat.name)}</button>`).join('');
  nav.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{nav.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderShareContent(ss,btn.dataset.id);}));
}
function renderShareContent(ss,catId){
  const cat=ss.categories.find(c=>c.id===catId);
  const main=document.getElementById('share-main-content');if(!cat){main.innerHTML='';return;}
  const nameCol=cat.columns.find(c=>c.required&&c.type==='text')||cat.columns[0];
  const visibleCols=cat.columns.filter(c=>!c.required);
  const withNote=cat.entries.filter(e=>e.note>0);
  const moy=withNote.length?(withNote.reduce((a,e)=>a+e.note,0)/withNote.length).toFixed(1):'—';
  document.getElementById('share-stats-bar').innerHTML=`<div class="stat-chip" style="--chip-color:${cat.color}"><span class="stat-num">${cat.entries.length}</span><span class="stat-lbl">Total</span></div><div class="stat-chip" style="--chip-color:#F0C040"><span class="stat-num">${moy}${withNote.length?'★':''}</span><span class="stat-lbl">Moyenne</span></div>`;
  main.innerHTML=`<div class="entries-list">${cat.entries.length===0?`<div class="empty-state"><span class="empty-icon">${cat.icon}</span><h3>Aucune entrée</h3></div>`:cat.entries.map((entry,idx)=>{
    const name=entry[nameCol?.id]||'(sans titre)';
    const fields=visibleCols.map(col=>{const val=entry[col.id];if(val===null||val===undefined||val==='')return'';if(col.type==='rating'){const n=Number(val);return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-rating">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>`;}if(col.type==='textarea')return`<div class="entry-field entry-field-full"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val entry-text-preview">${esc(val)}</span></div>`;return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val">${col.type==='date'?formatDate(val):esc(String(val))}</span></div>`;}).filter(Boolean).join('');
    return`<div class="entry-card" style="--card-accent:${cat.color};animation-delay:${Math.min(idx*.03,.3)}s"><div class="entry-card-header"><div class="entry-card-name">${esc(name)}</div>${entry.favorite?'<span class="fav-badge">⭐</span>':''}</div><div class="entry-fields">${fields}</div></div>`;
  }).join('')}</div>`;
}

// ── APP INIT ──────────────────────────────────────────────
function initApp(){
  updateUserAvatar();
  document.getElementById('btn-user-menu').addEventListener('click',e=>{e.stopPropagation();const m=document.getElementById('user-menu');m.style.display=m.style.display==='none'?'':'none';});
  document.addEventListener('click',()=>{document.getElementById('user-menu').style.display='none';});
  document.getElementById('btn-logout').addEventListener('click',async()=>{await API.logout();location.reload();});
  document.getElementById('btn-share-settings').addEventListener('click',openShareModal);
  document.getElementById('btn-account-settings').addEventListener('click',openAccountModal);
  document.getElementById('btn-admin-panel').addEventListener('click',openAdminModal);
  document.getElementById('btn-roulette').addEventListener('click',openRouletteModal);
  document.getElementById('btn-tutorial').addEventListener('click',openTutorial);
  document.getElementById('btn-stats').addEventListener('click',openStatsModal);
  document.getElementById('btn-news').addEventListener('click',openNewsModal);
  window.addEventListener('ml:session-expired',()=>location.reload());

  // Raccourcis clavier (désactivés dans les inputs)
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable)return;
    if(e.key==='n'||e.key==='N'){e.preventDefault();openEntryModal();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();filterFav=!filterFav;renderContent();}
    if(e.key==='Escape')closeModals();
  });

  // Bouton remonter en haut
  const fab=document.getElementById('fab-back-top');
  window.addEventListener('scroll',()=>{if(fab)fab.style.display=window.scrollY>300?'flex':'none';},{passive:true});
  fab?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  if(state.categories.length===0){render();openTutorial();}
  else render();
  renderNews(); // async, non-bloquant
  initStaticEvents();
}

function updateUserAvatar(){
  const btn=document.getElementById('btn-user-menu');
  if(currentUser.avatar_url){btn.innerHTML=`<img src="${esc(currentUser.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;btn.style.padding='0';}
  else{btn.textContent=(currentUser.username[0]||'?').toUpperCase();btn.style.padding='';}
  document.getElementById('user-menu-name').textContent=currentUser.username;
  document.getElementById('user-menu-email').textContent=currentUser.email;
  if(currentUser.role==='admin')document.getElementById('btn-admin-panel').style.display='';
}

// ── RENDER ────────────────────────────────────────────────
function render(){renderTabs();renderStats();renderContent();}

function renderTabs(){
  const nav=document.getElementById('tabs-nav');
  nav.innerHTML=state.categories.map(cat=>`<button class="tab-btn ${cat.id===activeCatId?'active':''}" style="--tab-color:${cat.color}" data-id="${cat.id}"><span class="tab-icon">${cat.icon}</span>${esc(cat.name)}</button>`).join('');
  nav.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{activeCatId=btn.dataset.id;searchQuery='';sortKey='';sortDir='desc';filterFav=false;filterStatus='all';tableSelectMode=false;tableSelected.clear();render();}));
}

function renderStats(){
  const bar=document.getElementById('stats-bar'),cat=getActiveCat();
  if(!cat){bar.innerHTML='';return;}
  const total=cat.entries.length,favs=cat.entries.filter(e=>e.favorite).length;
  let extra='';
  if(cat.id==='jeux'){const t=cat.entries.filter(e=>e.statut==='Terminé').length,c=cat.entries.filter(e=>e.statut==='En cours').length;extra=`<div class="stat-chip" style="--chip-color:${cat.color}"><span class="stat-num">${t}</span><span class="stat-lbl">Terminés</span></div><div class="stat-chip" style="--chip-color:#52C07A"><span class="stat-num">${c}</span><span class="stat-lbl">En cours</span></div>`;}
  else if(cat.id==='films'){const now=new Date(),cm=cat.entries.filter(e=>{if(!e.date_visu)return false;const[y,m]=e.date_visu.split('-');return parseInt(m)-1===now.getMonth()&&parseInt(y)===now.getFullYear();}).length;extra=`<div class="stat-chip" style="--chip-color:#52C07A"><span class="stat-num">${cm}</span><span class="stat-lbl">Ce mois</span></div>`;}
  else if(cat.id==='mangas'){const el=cat.entries.filter(e=>e.statut==='En lecture').length;extra=`<div class="stat-chip" style="--chip-color:#52C07A"><span class="stat-num">${el}</span><span class="stat-lbl">En lecture</span></div>`;}
  const withNote=cat.entries.filter(e=>e.note>0),moy=withNote.length?(withNote.reduce((a,e)=>a+e.note,0)/withNote.length).toFixed(1):'—';
  bar.innerHTML=`<div class="stat-chip" style="--chip-color:${cat.color}"><span class="stat-num">${total}</span><span class="stat-lbl">Total</span></div>${extra}<div class="stat-chip" style="--chip-color:#F0C040"><span class="stat-num">${moy}${withNote.length?'★':''}</span><span class="stat-lbl">Moyenne</span></div>${favs>0?`<div class="stat-chip" style="--chip-color:#E09E52"><span class="stat-num">${favs}</span><span class="stat-lbl">Favoris</span></div>`:''}`;
}

// ── NEWS BADGE ────────────────────────────────────────────
let newsData=null,lastSeenNews=localStorage.getItem('ml_last_news')||'';
async function renderNews(){
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  const badge=document.getElementById('news-badge');
  if(badge&&newsData.length>0){
    const latest=newsData[0]?.created_at||'';
    badge.style.display=latest>lastSeenNews?'':'none';
  }
}

async function openNewsModal(){
  closeInlinePopup();openModal('modal-news');
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  // Marquer comme lu
  if(newsData.length>0){lastSeenNews=newsData[0].created_at;localStorage.setItem('ml_last_news',lastSeenNews);}
  const badge=document.getElementById('news-badge');if(badge)badge.style.display='none';
  const body=document.getElementById('news-body');
  if(!newsData.length){body.innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Aucune actualité pour le moment.</p>';return;}
  body.innerHTML=newsData.map(n=>`
    <article class="news-article${n.pinned?' news-pinned':''}">
      ${n.pinned?'<div class="news-pin-badge">📌 Épinglé</div>':''}
      ${n.image_url?`<div class="news-article-img"><img src="${esc(n.image_url)}" alt="${esc(n.title)}" onerror="this.parentElement.style.display='none'"/></div>`:''}
      <h2 class="news-article-title">${esc(n.title)}</h2>
      <div class="news-article-date">${new Date(n.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
      ${n.content?`<div class="news-article-content">${renderMd(n.content)}</div>`:''}
    </article>`).join('');
}

// ── CONTENT ───────────────────────────────────────────────
function renderContent(){
  const main=document.getElementById('main-content'),cat=getActiveCat();
  if(!cat){main.innerHTML=`<div class="empty-state"><span class="empty-icon">📂</span><h3>Aucune catégorie</h3><p>Crée ta première catégorie avec ⊕ ou consulte le tutoriel.</p></div>`;return;}

  let entries=[...cat.entries];
  if(searchQuery){const q=searchQuery.toLowerCase();entries=entries.filter(e=>cat.columns.some(col=>String(e[col.id]??'').toLowerCase().includes(q)));}
  if(filterFav)entries=entries.filter(e=>e.favorite);
  if(filterStatus==='unseen')entries=entries.filter(e=>isUnseen(e));
  if(filterStatus==='hide-unseen')entries=entries.filter(e=>!isUnseen(e));

  if(sortKey){
    const col=cat.columns.find(c=>c.id===sortKey);
    entries.sort((a,b)=>{
      let va=a[sortKey]??null,vb=b[sortKey]??null;
      if(col&&(col.type==='number'||col.type==='rating')){va=(va===null||va==='')?-Infinity:Number(va);vb=(vb===null||vb==='')?-Infinity:Number(vb);return sortDir==='asc'?va-vb:vb-va;}
      if(col&&col.type==='date'){va=va?parseDate(va):0;vb=vb?parseDate(vb):0;return sortDir==='asc'?va-vb:vb-va;}
      va=String(va??'');vb=String(vb??'');const cmp=va.localeCompare(vb,'fr',{numeric:true,sensitivity:'base'});return sortDir==='asc'?cmp:-cmp;
    });
  }else entries.sort((a,b)=>{if(a._order!==undefined&&b._order!==undefined)return a._order-b._order;return(b._created||0)-(a._created||0);});

  const nameCol=cat.columns.find(c=>c.required&&c.type==='text')||cat.columns[0];
  const sortOptions=cat.columns.map(c=>`<option value="${c.id}" ${sortKey===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  main.innerHTML=`
    <div id="save-indicator" class="save-indicator save-saved">✓ Sauvegardé</div>
    <div class="cat-actions-bar">
      <button class="btn-manage-cols" id="btn-manage-cols"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg> Colonnes</button>
      <button class="btn-export" id="btn-export-csv" title="Exporter en CSV">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        CSV
      </button>
      <div class="view-toggle">
        <button class="view-btn ${cardLayout==='cards-list'&&viewMode!=='table'?'active':''}" id="vb-list" title="Liste"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <button class="view-btn ${cardLayout==='cards-grid'&&viewMode!=='table'?'active':''}" id="vb-grid" title="Grille"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
        <button class="view-btn ${cardLayout==='cards-compact'&&viewMode!=='table'?'active':''}" id="vb-compact" title="Compact"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="17" width="18" height="4"/></svg></button>
        <button class="view-btn ${viewMode==='table'?'active':''}" id="vb-table" title="Tableur"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg></button>
      </div>
      <button class="btn-danger-ghost" id="btn-delete-cat">Supprimer</button>
    </div>
    <div class="toolbar">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" class="search-input" id="search-input" placeholder="Rechercher… (N=nouvelle entrée, F=favoris)" value="${esc(searchQuery)}" />
      </div>
      <div class="sort-wrap">
        <select class="sort-select" id="sort-select"><option value="">Ordre manuel</option>${sortOptions}</select>
        <button class="sort-dir-btn" id="sort-dir-btn">${sortDir==='asc'?'↑':'↓'}</button>
      </div>
    </div>
    <div class="filter-bar">
      <button class="filter-btn ${filterFav?'active':''}" id="filter-fav">⭐ Favoris</button>
      <button class="filter-btn ${filterStatus==='unseen'?'active':''}" id="filter-unseen">👁 À voir</button>
      <button class="filter-btn ${filterStatus==='hide-unseen'?'active':''}" id="filter-hide-unseen">✓ Vus</button>
      <button class="filter-btn" id="filter-reset" style="${filterFav||filterStatus!=='all'?'':'opacity:.4;pointer-events:none;'}">✕ Reset</button>
    </div>
    <div id="view-container"></div>`;

  // Debounce recherche
  document.getElementById('search-input').addEventListener('input',e=>{
    clearTimeout(searchDebounce);
    searchDebounce=setTimeout(()=>{searchQuery=e.target.value;renderContent();},180);
  });
  document.getElementById('sort-select').addEventListener('change',e=>{sortKey=e.target.value;renderContent();});
  document.getElementById('sort-dir-btn').addEventListener('click',()=>{sortDir=sortDir==='asc'?'desc':'asc';renderContent();});
  document.getElementById('btn-manage-cols').addEventListener('click',openColumnsModal);
  document.getElementById('btn-export-csv').addEventListener('click',exportCSV);
  document.getElementById('btn-delete-cat').addEventListener('click',deleteCategory);
  document.getElementById('vb-list').addEventListener('click',()=>{cardLayout='cards-list';viewMode='cards';tableSelectMode=false;tableSelected.clear();renderContent();});
  document.getElementById('vb-grid').addEventListener('click',()=>{cardLayout='cards-grid';viewMode='cards';tableSelectMode=false;tableSelected.clear();renderContent();});
  document.getElementById('vb-compact').addEventListener('click',()=>{cardLayout='cards-compact';viewMode='cards';tableSelectMode=false;tableSelected.clear();renderContent();});
  document.getElementById('vb-table').addEventListener('click',()=>{viewMode='table';renderContent();});
  document.getElementById('filter-fav').addEventListener('click',()=>{filterFav=!filterFav;renderContent();});
  document.getElementById('filter-unseen').addEventListener('click',()=>{filterStatus=filterStatus==='unseen'?'all':'unseen';renderContent();});
  document.getElementById('filter-hide-unseen').addEventListener('click',()=>{filterStatus=filterStatus==='hide-unseen'?'all':'hide-unseen';renderContent();});
  document.getElementById('filter-reset').addEventListener('click',()=>{filterFav=false;filterStatus='all';renderContent();});

  if(viewMode==='table')renderTableView(cat,entries,nameCol);
  else renderCardsView(cat,entries,nameCol);
}

// ── VUE CARTES ────────────────────────────────────────────
function renderCardsView(cat,entries,nameCol){
  const container=document.getElementById('view-container');
  const visibleCols=cat.columns.filter(c=>!c.required);
  const isCompact=cardLayout==='cards-compact',isGrid=cardLayout==='cards-grid';
  const listClass=isGrid?'entries-grid':isCompact?'entries-compact':'entries-list';

  container.innerHTML=`<div class="${listClass}" id="entries-list">
    ${entries.length===0
      ?`<div class="empty-state"><span class="empty-icon">${cat.icon}</span><h3>${searchQuery||filterFav||filterStatus!=='all'?'Aucun résultat':'Aucune entrée'}</h3><p>${searchQuery?'Essaie un autre terme.':filterFav?'Aucun favori.':'Appuie sur + pour ajouter.'}</p></div>`
      :entries.map((entry,idx)=>{
        const name=entry[nameCol?.id]||'(sans titre)',isFav=!!entry.favorite;
        let progressBar='';
        const sucObt=Number(entry.succes||0),sucTot=Number(entry.succes_tot||0);
        if(sucTot>0){const pct=Math.min(100,Math.round((sucObt/sucTot)*100));const trophy=pct>=100?' 🏆':'';progressBar=`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;${pct>=100?'background:var(--success);':''}"></div></div><span class="progress-lbl" style="font-size:13px;font-weight:600;">${sucObt}/${sucTot}${trophy}</span></div>`;}

        const fields=isCompact?'':visibleCols.map(col=>{
          const val=entry[col.id];
          if(val===null||val===undefined||val==='')return'';
          if(col.type==='rating'){const n=Number(val);return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-rating field-clickable" data-col="${col.id}" data-entry="${entry.id}" style="font-size:18px;">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>`;}
          if(col.type==='textarea')return`<div class="entry-field entry-field-full"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val entry-text-preview field-clickable" data-col="${col.id}" data-entry="${entry.id}">${esc(val)}</span></div>`;
          const display=col.type==='date'?formatDate(val):esc(String(val));
          return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val field-clickable" data-col="${col.id}" data-entry="${entry.id}">${display}</span></div>`;
        }).filter(Boolean).join('');

        const draggable=!sortKey&&cardLayout==='cards-list';
        return`<div class="entry-card${draggable?' is-draggable':''}${isCompact?' entry-compact':''}" data-entry-id="${entry.id}" style="--card-accent:${cat.color};animation-delay:${Math.min(idx*.02,.3)}s" ${draggable?'draggable="true"':''}>
          <div class="entry-card-header">
            <div class="entry-card-name field-clickable" data-col="${nameCol?.id}" data-entry="${entry.id}">${esc(name)}</div>
            <button class="fav-btn ${isFav?'active':''}" data-entry="${entry.id}" title="${isFav?'Retirer des favoris':'Ajouter aux favoris'}">${isFav?'⭐':'☆'}</button>
            ${draggable?'<div class="drag-handle" title="Réordonner">⠿</div>':''}
          </div>
          ${progressBar}
          <div class="entry-fields">${fields}</div>
        </div>`;
      }).join('')}
  </div>`;

  container.querySelectorAll('.fav-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const entry=getActiveCat().entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;entry.favorite=!entry.favorite;scheduleSave();renderContent();renderStats();}));
  container.querySelectorAll('.field-clickable').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openInlinePopup(el.dataset.entry,el.dataset.col,el);}));
  container.querySelectorAll('.entry-card').forEach(card=>card.addEventListener('click',e=>{if(!e.target.closest('.field-clickable')&&!e.target.closest('.drag-handle')&&!e.target.closest('.fav-btn'))openEntryModal(card.dataset.entryId);}));
  if(!sortKey&&cardLayout==='cards-list')initEntryDrag(cat);
}

// ── VUE TABLEUR ───────────────────────────────────────────
function renderTableView(cat,entries,nameCol){
  const container=document.getElementById('view-container');
  const newRowCells=cat.columns.map(col=>`<td class="tbl-td tbl-new-cell" data-col="${col.id}" contenteditable="${col.type!=='rating'?'true':'false'}" data-type="${col.type}" placeholder="${esc(col.name)}…"></td>`).join('');

  container.innerHTML=`
    <div class="tbl-toolbar-sticky" id="tbl-sticky-bar">
      <div class="tbl-toolbar-left">
        <button class="filter-btn ${tableSelectMode?'active':''}" id="btn-tbl-select">☑ Sélection</button>
        <label class="toggle-switch" title="En-têtes fixes">
          <input type="checkbox" id="tbl-sticky-headers" checked />
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:12px;color:var(--text3);">En-têtes fixes</span>
      </div>
      <div class="tbl-toolbar-right" id="tbl-selection-actions" style="display:none;">
        <span id="tbl-selected-count" style="font-size:13px;color:var(--text2);"></span>
        <button class="btn btn-ghost btn-sm" id="btn-tbl-fill">Remplir un champ</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" id="btn-tbl-delete-sel">Supprimer</button>
        <button class="btn btn-ghost btn-sm" id="btn-tbl-deselect">✕</button>
      </div>
    </div>
    <div class="table-wrapper" id="table-scroll-wrap">
      <table class="tbl" id="main-tbl">
        <thead id="tbl-head"><tr>
          ${tableSelectMode?'<th class="tbl-th" style="width:36px;"><input type="checkbox" id="tbl-check-all"/></th>':''}
          <th class="tbl-th tbl-th-num">#</th>
          <th class="tbl-th" style="width:36px;">⭐</th>
          ${cat.columns.map(c=>`<th class="tbl-th">${esc(c.name)}</th>`).join('')}
          <th class="tbl-th tbl-th-act"></th>
        </tr></thead>
        <tbody id="tbl-body">
          ${entries.map((entry,idx)=>{
            const isSel=tableSelected.has(entry.id);
            const cells=cat.columns.map(col=>{
              const val=entry[col.id],raw=val===null||val===undefined||val===''?'':String(val);
              if(col.type==='text'||col.type==='number'||col.type==='textarea'){
                return`<td class="tbl-td tbl-editable" data-col="${col.id}" data-entry="${entry.id}" data-type="${col.type}" contenteditable="true">${esc(raw)}</td>`;
              }
              const display=raw===''?'':col.type==='date'?formatDate(val):col.type==='rating'?('★'.repeat(Number(val))+'☆'.repeat(5-Number(val))):esc(raw);
              return`<td class="tbl-td tbl-cell-click" data-col="${col.id}" data-entry="${entry.id}">${display}</td>`;
            }).join('');
            return`<tr class="tbl-row${isSel?' tbl-row-selected':''}" data-entry-id="${entry.id}">
              ${tableSelectMode?`<td class="tbl-td tbl-check-cell"><input type="checkbox" class="tbl-row-check" data-entry="${entry.id}" ${isSel?'checked':''}/></td>`:''}
              <td class="tbl-td tbl-num">${idx+1}</td>
              <td class="tbl-td tbl-fav-cell"><button class="fav-btn ${entry.favorite?'active':''}" data-entry="${entry.id}">${entry.favorite?'⭐':'☆'}</button></td>
              ${cells}
              <td class="tbl-td"><button class="tbl-del-btn" data-entry="${entry.id}">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr class="tbl-new-row" id="tbl-new-row">
          ${tableSelectMode?'<td class="tbl-td"></td>':''}
          <td class="tbl-td tbl-num" style="color:var(--text3);">+</td>
          <td class="tbl-td"></td>
          ${newRowCells}
          <td class="tbl-td"><button class="tbl-add-btn" id="tbl-add-row-btn">Ajouter</button></td>
        </tr></tfoot>
      </table>
    </div>
    <p class="tbl-hint">Texte/nombres : éditable directement. Dates/notes/listes : cliquer. En-têtes et barre d'outils restent visibles.</p>`;

  // Sticky headers toggle
  document.getElementById('tbl-sticky-headers').addEventListener('change',function(){
    document.getElementById('tbl-head').style.position=this.checked?'sticky':'relative';
  });

  // Mode sélection
  document.getElementById('btn-tbl-select').addEventListener('click',()=>{
    tableSelectMode=!tableSelectMode;tableSelected.clear();renderContent();
  });
  if(tableSelectMode){
    document.getElementById('tbl-check-all').addEventListener('change',function(){
      entries.forEach(e=>{if(this.checked)tableSelected.add(e.id);else tableSelected.delete(e.id);});
      renderContent();
    });
    container.querySelectorAll('.tbl-row-check').forEach(cb=>{
      cb.addEventListener('change',function(){
        if(this.checked)tableSelected.add(this.dataset.entry);
        else tableSelected.delete(this.dataset.entry);
        updateSelectionActions();
        this.closest('tr').classList.toggle('tbl-row-selected',this.checked);
      });
    });
    updateSelectionActions();

    document.getElementById('btn-tbl-deselect').addEventListener('click',()=>{tableSelected.clear();renderContent();});
    document.getElementById('btn-tbl-delete-sel').addEventListener('click',()=>{
      if(!tableSelected.size||!confirm(`Supprimer ${tableSelected.size} entrée(s) ?`))return;
      const c=getActiveCat();c.entries=c.entries.filter(e=>!tableSelected.has(e.id));
      tableSelected.clear();scheduleSave();render();
    });
    document.getElementById('btn-tbl-fill').addEventListener('click',()=>openFillSelectionModal(cat));
  }

  // Édition directe
  container.querySelectorAll('.tbl-editable').forEach(td=>{
    td.addEventListener('blur',()=>{
      const entry=getActiveCat().entries.find(e=>e.id===td.dataset.entry);if(!entry)return;
      const col=getActiveCat().columns.find(c=>c.id===td.dataset.col);
      let val=td.textContent.trim();
      if(col.type==='number')val=val===''?null:parseFloat(val)||null;
      entry[td.dataset.col]=val;scheduleSave();
    });
    td.addEventListener('keydown',e=>{if(e.key==='Enter'&&td.dataset.type!=='textarea'){e.preventDefault();td.blur();}if(e.key==='Escape')td.blur();});
  });

  container.querySelectorAll('.tbl-cell-click').forEach(td=>td.addEventListener('click',e=>{e.stopPropagation();openInlinePopup(td.dataset.entry,td.dataset.col,td);}));
  container.querySelectorAll('.fav-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const entry=getActiveCat().entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;entry.favorite=!entry.favorite;scheduleSave();renderContent();}));
  container.querySelectorAll('.tbl-del-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();if(!confirm('Supprimer?'))return;const c=getActiveCat();c.entries=c.entries.filter(en=>en.id!==btn.dataset.entry);scheduleSave();render();}));

  // Ajouter ligne
  container.querySelector('#tbl-add-row-btn').addEventListener('click',()=>{
    const cells=container.querySelectorAll('.tbl-new-cell');
    const entry={id:uid(),_created:Date.now(),_order:cat.entries.length};
    cells.forEach(cell=>{const col=cat.columns.find(c=>c.id===cell.dataset.col);let val=cell.textContent.trim();if(val){if(col.type==='number')val=parseFloat(val)||null;if(col.type==='rating')val=Math.min(5,Math.max(0,parseInt(val)||0));entry[col.id]=val;}else entry[col.id]=col.type==='number'||col.type==='rating'?null:'';});
    const nameC=cat.columns.find(c=>c.required);if(!entry[nameC?.id]){alert('Le titre est obligatoire.');return;}
    cat.entries.push(entry);scheduleSave();renderContent();
  });
  container.querySelectorAll('.tbl-new-cell').forEach((cell,i,all)=>{
    cell.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();all[i+1]?.focus();}if(e.key==='Enter'){e.preventDefault();container.querySelector('#tbl-add-row-btn').click();}});
    cell.addEventListener('paste',e=>{e.preventDefault();const text=(e.clipboardData||window.clipboardData).getData('text');if(text.includes('\n'))importTSV(text,cat);else document.execCommand('insertText',false,text);});
  });
}

function updateSelectionActions(){
  const actions=document.getElementById('tbl-selection-actions');
  const count=document.getElementById('tbl-selected-count');
  if(!actions||!count)return;
  if(tableSelected.size>0){actions.style.display='flex';count.textContent=`${tableSelected.size} sélectionné(s)`;}
  else actions.style.display='none';
}

function openFillSelectionModal(cat){
  const colOptions=cat.columns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML=`<div style="background:var(--bg2);border-radius:var(--radius);padding:24px;width:100%;max-width:380px;border:1px solid var(--border);">
    <h3 style="font-family:var(--font-display);margin-bottom:16px;">Remplir ${tableSelected.size} entrée(s)</h3>
    <div class="field-group"><label class="field-label">Colonne à modifier</label><select class="field-select field-input" id="fill-col">${colOptions}</select></div>
    <div class="field-group"><label class="field-label">Valeur</label><input type="text" class="field-input" id="fill-val" placeholder="Nouvelle valeur…"/></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-ghost" id="fill-cancel">Annuler</button>
      <button class="btn btn-primary" id="fill-ok">Appliquer</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#fill-cancel').addEventListener('click',()=>modal.remove());
  modal.querySelector('#fill-ok').addEventListener('click',()=>{
    const colId=modal.querySelector('#fill-col').value;
    const val=modal.querySelector('#fill-val').value.trim();
    const col=cat.columns.find(c=>c.id===colId);
    cat.entries.forEach(e=>{if(tableSelected.has(e.id)){let v=val;if(col.type==='number')v=parseFloat(val)||null;if(col.type==='rating')v=Math.min(5,Math.max(0,parseInt(val)||0));e[colId]=v;}});
    scheduleSave();modal.remove();renderContent();
  });
}

function importTSV(text,cat){
  const lines=text.split('\n').filter(l=>l.trim());
  const first=lines[0].split('\t');
  const isHeader=first.some(v=>cat.columns.some(c=>c.name.toLowerCase().trim()===v.toLowerCase().trim()));
  const headers=isHeader?first:null;
  const dataLines=isHeader?lines.slice(1):lines;
  let added=0;
  dataLines.forEach(line=>{
    if(!line.trim())return;
    const vals=line.split('\t');
    const entry={id:uid(),_created:Date.now(),_order:cat.entries.length};
    cat.columns.forEach((col,ci)=>{let idx=headers?headers.findIndex(h=>h.toLowerCase().trim()===col.name.toLowerCase().trim()):ci;const raw=idx>=0?(vals[idx]||'').trim():'';let val=raw;if(col.type==='number'&&val)val=parseFloat(val.replace(',','.'))||null;if(col.type==='rating'&&val)val=Math.min(5,Math.max(0,parseInt(val)||0));entry[col.id]=val;});
    const nameC=cat.columns.find(c=>c.required);if(entry[nameC?.id]){cat.entries.push(entry);added++;}
  });
  if(added>0){scheduleSave();renderContent();}else alert('Aucune donnée reconnue.');
}

// ── POPUP INLINE ──────────────────────────────────────────
function openInlinePopup(entryId,colId,anchor){
  closeInlinePopup();
  const cat=getActiveCat(),entry=cat?.entries.find(e=>e.id===entryId),col=cat?.columns.find(c=>c.id===colId);
  if(!cat||!entry||!col)return;
  const val=entry[colId]??'';
  const popup=document.createElement('div');popup.className='inline-popup';popup.id='active-inline-popup';
  let fHTML='';
  if(col.type==='text')fHTML=`<input type="text" id="ip-f" class="ip-input" value="${esc(val)}" placeholder="${esc(col.name)}…"/>`;
  else if(col.type==='number')fHTML=`<input type="number" id="ip-f" class="ip-input" value="${val??''}" min="0" placeholder="0"/>`;
  else if(col.type==='date')fHTML=`<div style="display:flex;gap:6px;"><input type="date" id="ip-f" class="ip-input" value="${val}" style="flex:1;"/><button class="btn-today ip-today">Auj.</button></div>`;
  else if(col.type==='select'&&col.options)fHTML=`<select id="ip-f" class="ip-input"><option value="">— Choisir —</option>${col.options.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(col.type==='rating'){const n=Number(val)||0;fHTML=`<div class="ip-stars" id="ip-stars" data-val="${n}">${[1,2,3,4,5].map(i=>`<span data-n="${i}" class="${i<=n?'active':''}">${i<=n?'★':'☆'}</span>`).join('')}</div>`;}
  else if(col.type==='textarea')fHTML=`<textarea id="ip-f" class="ip-input ip-textarea" placeholder="${esc(col.name)}…">${esc(val)}</textarea>`;
  popup.innerHTML=`<div class="ip-label">${esc(col.name)}</div>${fHTML}<div class="ip-actions"><button class="btn btn-ghost btn-sm" id="ip-cancel">Annuler</button><button class="btn btn-primary btn-sm" id="ip-save">OK</button></div>`;
  document.body.appendChild(popup);
  const rect=anchor.getBoundingClientRect(),pw=Math.min(280,window.innerWidth-16);
  popup.style.width=pw+'px';
  let left=rect.left+window.scrollX;if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;
  popup.style.left=Math.max(8,left)+'px';
  const top=rect.bottom+window.scrollY+6;popup.style.top=(top+160>window.scrollY+window.innerHeight?rect.top+window.scrollY-170:top)+'px';
  const stars=popup.querySelector('#ip-stars');
  if(stars)stars.querySelectorAll('span').forEach(s=>s.addEventListener('click',()=>{const n=parseInt(s.dataset.n),cur=parseInt(stars.dataset.val),nv=cur===n?0:n;stars.dataset.val=nv;stars.querySelectorAll('span').forEach(sp=>{const sn=parseInt(sp.dataset.n);sp.textContent=sn<=nv?'★':'☆';sp.className=sn<=nv?'active':'';})}));
  popup.querySelector('.ip-today')?.addEventListener('click',()=>{const f=popup.querySelector('#ip-f');if(f)f.value=todayStr();});
  const field=popup.querySelector('#ip-f');if(field)setTimeout(()=>{field.focus();if(field.select)field.select();},40);
  function doSave(){let nv;if(col.type==='rating')nv=parseInt(stars?.dataset.val||'0');else if(col.type==='number')nv=field.value===''?null:parseFloat(field.value);else nv=field?.value??'';entry[colId]=nv;scheduleSave();closeInlinePopup();renderContent();renderStats();}
  popup.querySelector('#ip-save').addEventListener('click',doSave);
  popup.querySelector('#ip-cancel').addEventListener('click',closeInlinePopup);
  field?.addEventListener('keydown',e=>{if(e.key==='Enter'&&col.type!=='textarea'){e.preventDefault();doSave();}if(e.key==='Escape')closeInlinePopup();});
  setTimeout(()=>document.addEventListener('click',outsidePopup),10);
}
function outsidePopup(e){const p=document.getElementById('active-inline-popup');if(p&&!p.contains(e.target))closeInlinePopup();}
function closeInlinePopup(){document.getElementById('active-inline-popup')?.remove();document.removeEventListener('click',outsidePopup);}

// ── DRAG ENTRÉES ──────────────────────────────────────────
function initEntryDrag(cat){
  const list=document.getElementById('entries-list');if(!list)return;
  list.querySelectorAll('.entry-card.is-draggable').forEach(card=>{
    card.addEventListener('dragstart',e=>{entryDragSrcId=card.dataset.entryId;e.dataTransfer.effectAllowed='move';setTimeout(()=>card.classList.add('dragging'),0);});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');list.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));applyEntryReorder(cat);});
    card.addEventListener('dragover',e=>{e.preventDefault();if(card.dataset.entryId===entryDragSrcId)return;list.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));card.classList.add('drag-over');entryDragOverId=card.dataset.entryId;});
    card.addEventListener('drop',e=>e.preventDefault());
    const handle=card.querySelector('.drag-handle');if(!handle)return;
    handle.addEventListener('touchstart',e=>{entryDragSrcId=card.dataset.entryId;card.classList.add('dragging');e.preventDefault();},{passive:false});
    handle.addEventListener('touchmove',e=>{if(!entryDragSrcId)return;e.preventDefault();const t=e.touches[0];const over=document.elementFromPoint(t.clientX,t.clientY)?.closest('.entry-card.is-draggable');if(over&&over.dataset.entryId!==entryDragSrcId){list.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));over.classList.add('drag-over');entryDragOverId=over.dataset.entryId;}},{passive:false});
    handle.addEventListener('touchend',()=>{card.classList.remove('dragging');list.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));applyEntryReorder(cat);entryDragSrcId=null;entryDragOverId=null;});
  });
}
function applyEntryReorder(cat){
  if(!entryDragSrcId||!entryDragOverId||entryDragSrcId===entryDragOverId){entryDragSrcId=null;entryDragOverId=null;return;}
  cat.entries.forEach((e,i)=>{if(e._order===undefined)e._order=i;});cat.entries.sort((a,b)=>a._order-b._order);
  const si=cat.entries.findIndex(e=>e.id===entryDragSrcId),oi=cat.entries.findIndex(e=>e.id===entryDragOverId);
  if(si===-1||oi===-1)return;const[moved]=cat.entries.splice(si,1);cat.entries.splice(oi,0,moved);
  cat.entries.forEach((e,i)=>e._order=i);entryDragSrcId=null;entryDragOverId=null;scheduleSave();renderContent();
}

// ── MODAL ENTRÉE ──────────────────────────────────────────
function openEntryModal(entryId=null){
  closeInlinePopup();const cat=getActiveCat();if(!cat)return;
  editingEntryId=entryId;const entry=entryId?cat.entries.find(e=>e.id===entryId):null;
  document.getElementById('modal-entry-title').textContent=entry?"Modifier l'entrée":'Nouvelle entrée';
  document.getElementById('btn-delete-entry').style.display=entry?'inline-flex':'none';
  const body=document.getElementById('modal-entry-body');

  // Calculer quelles colonnes sont visibles selon les conditions
  function isColVisible(col, currentData){
    if(!col.showIf) return true;
    const triggerVal = currentData[col.showIf.colId] || '';
    return triggerVal === col.showIf.value;
  }

  // Mettre à jour la visibilité des champs en live
  function updateConditionalVisibility(){
    cat.columns.forEach(col=>{
      if(!col.showIf) return;
      const wrapper = document.getElementById(`field-wrap-${col.id}`);
      if(!wrapper) return;
      const triggerEl = document.getElementById(`field-${col.showIf.colId}`);
      const triggerVal = triggerEl ? (triggerEl.value || triggerEl.textContent || '') : '';
      wrapper.style.display = triggerVal === col.showIf.value ? '' : 'none';
    });
  }

  body.innerHTML=cat.columns.map(col=>{
    const val=entry?(entry[col.id]??''):'';let f='';
    if(col.type==='text')f=`<input type="text" class="field-input" id="field-${col.id}" value="${esc(val)}" placeholder="${esc(col.name)}…" ${col.required?'required':''}/>`;
    else if(col.type==='number')f=`<input type="number" class="field-input" id="field-${col.id}" value="${val??''}" min="0" placeholder="0"/>`;
    else if(col.type==='date')f=`<div class="date-input-wrap"><input type="date" class="field-input" id="field-${col.id}" value="${val}"/><button type="button" class="btn-today" onclick="document.getElementById('field-${col.id}').value='${todayStr()}'">Aujourd'hui</button></div>`;
    else if(col.type==='textarea')f=`<textarea class="field-textarea" id="field-${col.id}" placeholder="${esc(col.name)}…">${esc(val)}</textarea>`;
    else if(col.type==='select'&&col.options)f=`<select class="field-select field-input" id="field-${col.id}"><option value="">— Choisir —</option>${col.options.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else if(col.type==='rating'){const n=Number(val)||0;f=`<div class="star-input" id="field-${col.id}" data-val="${n}">${[1,2,3,4,5].map(i=>`<span data-n="${i}" class="${i<=n?'active':''}">${i<=n?'★':'☆'}</span>`).join('')}</div>`;}
    const initHidden = col.showIf && (!entry || entry[col.showIf.colId] !== col.showIf.value); return`<div class="field-group" id="field-wrap-${col.id}" style="${initHidden?'display:none':''}"><label class="field-label" for="field-${col.id}">${esc(col.name)}${col.required?' *':''}</label>${f}</div>`;
  }).join('');
  // Attacher les écouteurs pour la visibilité conditionnelle
  cat.columns.forEach(col=>{
    if(!col.showIf) return;
    const triggerEl = document.getElementById(`field-${col.showIf.colId}`);
    if(triggerEl) triggerEl.addEventListener('change', updateConditionalVisibility);
  });
  updateConditionalVisibility();

  body.querySelectorAll('.star-input').forEach(wrap=>wrap.querySelectorAll('span').forEach(s=>s.addEventListener('click',()=>{const n=parseInt(s.dataset.n),nv=parseInt(wrap.dataset.val)===n?0:n;wrap.dataset.val=nv;wrap.querySelectorAll('span').forEach(sp=>{const sn=parseInt(sp.dataset.n);sp.textContent=sn<=nv?'★':'☆';sp.className=sn<=nv?'active':'';});})));
  openModal('modal-entry');
}
function saveEntry(){
  const cat=getActiveCat();if(!cat)return;
  const data={id:editingEntryId||uid(),_created:Date.now()};let valid=true;
  cat.columns.forEach(col=>{
    if(col.type==='rating')data[col.id]=parseInt(document.getElementById(`field-${col.id}`)?.dataset.val||'0');
    else if(col.type==='number'){const el=document.getElementById(`field-${col.id}`);data[col.id]=el?(el.value===''?null:parseFloat(el.value)):null;}
    else{const el=document.getElementById(`field-${col.id}`);data[col.id]=el?el.value.trim():'';}
    if(col.required&&!data[col.id])valid=false;
  });
  if(!valid){alert(`"${cat.columns.find(c=>c.required)?.name||'Titre'}" est obligatoire.`);return;}
  if(editingEntryId){const idx=cat.entries.findIndex(e=>e.id===editingEntryId);if(idx!==-1){data._created=cat.entries[idx]._created;data._order=cat.entries[idx]._order;data.favorite=cat.entries[idx].favorite;cat.entries[idx]=data;}}
  else{data._order=cat.entries.length;cat.entries.push(data);}
  scheduleSave();closeModals();render();
}
function deleteEntry(){if(!editingEntryId)return;if(!confirm('Supprimer?'))return;const cat=getActiveCat();cat.entries=cat.entries.filter(e=>e.id!==editingEntryId);scheduleSave();closeModals();render();}

// ── COLONNES ──────────────────────────────────────────────
function openColumnsModal(){const cat=getActiveCat();if(!cat)return;tempColumns=cat.columns.map(c=>({...c,options:c.options?[...c.options]:undefined}));renderColsList();document.getElementById('modal-columns-title').textContent=`${cat.icon} ${cat.name} — Colonnes`;openModal('modal-columns');}
function renderColsList(){
  const list=document.getElementById('cols-list');
  list.innerHTML=tempColumns.map((col,i)=>`<div class="col-row col-draggable" draggable="true" data-ci="${i}"><div class="col-drag-handle">⠿</div><input type="text" value="${esc(col.name)}" data-i="${i}" class="tc-name"/><select data-i="${i}" class="tc-type" ${col.required?'disabled':''}><option value="text" ${col.type==='text'?'selected':''}>Texte</option><option value="number" ${col.type==='number'?'selected':''}>Nombre</option><option value="date" ${col.type==='date'?'selected':''}>Date</option><option value="rating" ${col.type==='rating'?'selected':''}>Note ★</option><option value="select" ${col.type==='select'?'selected':''}>Liste</option><option value="textarea" ${col.type==='textarea'?'selected':''}>Texte long</option></select>${col.required?'<span class="col-tag">obligatoire</span>':`<button class="btn-del" data-del="${i}">✕</button>`}</div>${col.type==='select'&&col.options?`<div class="col-options-bar">Options : <em>${col.options.map(esc).join(', ')}</em> <button onclick="editOptions(${i})">Modifier</button></div>`:''}${!col.required?`<div class="col-options-bar" style="margin-top:-6px;">${col.showIf?`<span style="color:var(--accent);font-size:12px;">🔀 Visible si <strong>${esc(tempColumns.find(c=>c.id===col.showIf.colId)?.name||col.showIf.colId)}</strong> = "${esc(col.showIf.value)}"</span>`:'<span style="color:var(--text3);font-size:12px;">Toujours visible</span>'} <button onclick="editCondition(${i})" style="margin-left:8px;font-size:12px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;padding:2px 8px;">Condition</button></div>`:''}`)
.join('');
  list.querySelectorAll('.tc-name').forEach(el=>el.addEventListener('input',e=>{tempColumns[+e.target.dataset.i].name=e.target.value;}));
  list.querySelectorAll('.tc-type').forEach(el=>el.addEventListener('change',e=>{const i=+e.target.dataset.i;tempColumns[i].type=e.target.value;if(e.target.value==='select'&&!tempColumns[i].options)tempColumns[i].options=['Option 1','Option 2'];renderColsList();}));
  list.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',e=>{tempColumns.splice(+e.target.dataset.del,1);renderColsList();}));
  list.querySelectorAll('.col-draggable').forEach(row=>{
    row.addEventListener('dragstart',e=>{colDragSrcIdx=parseInt(row.dataset.ci);e.dataTransfer.effectAllowed='move';setTimeout(()=>row.classList.add('col-dragging'),0);});
    row.addEventListener('dragend',()=>{row.classList.remove('col-dragging');list.querySelectorAll('.col-drag-over').forEach(r=>r.classList.remove('col-drag-over'));if(colDragSrcIdx!==null&&colDragOverIdx!==null&&colDragSrcIdx!==colDragOverIdx){const[m]=tempColumns.splice(colDragSrcIdx,1);tempColumns.splice(colDragOverIdx,0,m);renderColsList();}colDragSrcIdx=null;colDragOverIdx=null;});
    row.addEventListener('dragover',e=>{e.preventDefault();const idx=parseInt(row.dataset.ci);if(idx===colDragSrcIdx)return;list.querySelectorAll('.col-drag-over').forEach(r=>r.classList.remove('col-drag-over'));row.classList.add('col-drag-over');colDragOverIdx=idx;});
    row.addEventListener('drop',e=>e.preventDefault());
  });
}
window.editOptions=function(i){const col=tempColumns[i];const raw=prompt('Options (une par ligne) :',col.options.join('\n'));if(raw===null)return;col.options=raw.split('\n').map(s=>s.trim()).filter(Boolean);renderColsList();};

window.editCondition=function(i){
  const col=tempColumns[i];
  // Trouver les colonnes de type select pour créer une condition
  const selectCols=tempColumns.filter((c,ci)=>ci!==i&&c.type==='select'&&c.options?.length);
  if(!selectCols.length){alert('Ajoute d\'abord une colonne de type Liste pour créer une condition.');return;}
  const currentCond=col.showIf||null;
  const colOpts=selectCols.map(c=>`${c.id}:${esc(c.name)}`).join('\n');
  const colSel=prompt('Colonne déclencheur (laisse vide pour supprimer la condition):\n'+selectCols.map(c=>`- ${c.name} (id: ${c.id})`).join('\n')+'\n\nSaisis l\'id de la colonne:',currentCond?.colId||'');
  if(colSel===null)return;
  if(!colSel.trim()){col.showIf=null;renderColsList();return;}
  const triggerCol=tempColumns.find(c=>c.id===colSel.trim());
  if(!triggerCol){alert('Colonne introuvable.');return;}
  const valSel=prompt(`Valeur requise dans "${triggerCol.name}" pour afficher "${col.name}":\n(Options: ${triggerCol.options?.join(', ')})`,currentCond?.value||'');
  if(valSel===null)return;
  col.showIf={colId:colSel.trim(),value:valSel.trim()};
  renderColsList();
};
function saveColumns(){const cat=getActiveCat();if(!cat)return;cat.columns=tempColumns.filter(c=>c.name.trim());scheduleSave();closeModals();render();}

// ── CATÉGORIES ────────────────────────────────────────────
function openCategoryModal(withPresets=false){
  if(withPresets){openPresetsModal();return;}
  tempCatColor='#7C6FE0';tempNewCols=[];
  document.getElementById('cat-name').value='';document.getElementById('cat-icon').value='';
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('active',s.dataset.color===tempCatColor));
  renderNewCols();openModal('modal-category');
}
function renderNewCols(){
  const list=document.getElementById('cat-cols-list');if(!list)return;
  list.innerHTML=tempNewCols.map((col,i)=>`<div class="col-row"><input type="text" placeholder="Nom" value="${esc(col.name)}" data-i="${i}" class="new-col-name"/><select data-i="${i}" class="new-col-type"><option value="text" ${col.type==='text'?'selected':''}>Texte</option><option value="number" ${col.type==='number'?'selected':''}>Nombre</option><option value="date" ${col.type==='date'?'selected':''}>Date</option><option value="rating" ${col.type==='rating'?'selected':''}>Note ★</option><option value="select" ${col.type==='select'?'selected':''}>Liste</option><option value="textarea" ${col.type==='textarea'?'selected':''}>Texte long</option></select><button class="btn-del" data-del="${i}">✕</button></div>`).join('');
  list.querySelectorAll('.new-col-name').forEach(el=>el.addEventListener('input',e=>{tempNewCols[+e.target.dataset.i].name=e.target.value;}));
  list.querySelectorAll('.new-col-type').forEach(el=>el.addEventListener('change',e=>{tempNewCols[+e.target.dataset.i].type=e.target.value;}));
  list.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',e=>{tempNewCols.splice(+e.target.dataset.del,1);renderNewCols();}));
}
function saveCategory(){
  const name=document.getElementById('cat-name').value.trim(),icon=document.getElementById('cat-icon').value.trim()||'📁';
  if(!name){alert('Donne un nom.');return;}
  const extraCols=tempNewCols.filter(c=>c.name).map(c=>({id:uid(),name:c.name,type:c.type,...(c.type==='select'?{options:['Option 1','Option 2']}:{})}));
  state.categories.push({id:uid(),name,icon,color:tempCatColor,columns:[{id:'titre',name:'Titre',type:'text',required:true},...extraCols],entries:[]});
  activeCatId=state.categories[state.categories.length-1].id;scheduleSave();closeModals();render();
}
function deleteCategory(){const cat=getActiveCat();if(!cat)return;if(!confirm(`Supprimer "${cat.name}" ?`))return;state.categories=state.categories.filter(c=>c.id!==cat.id);activeCatId=state.categories[0]?.id||null;scheduleSave();render();}

// ── PRÉSETS ───────────────────────────────────────────────
const PRESETS={
  'Jeux vidéo':{icon:'🎮',color:'#7C6FE0',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'plateforme',name:'Plateforme',type:'select',options:['PC','PS5','PS4','Xbox','Nintendo Switch','Mobile','Autre']},{id:'statut',name:'Statut',type:'select',options:['En cours','Terminé','Abandonné','À faire']},{id:'date_fin',name:'Date de fin',type:'date'},{id:'succes',name:'Succès obtenus',type:'number'},{id:'succes_tot',name:'Succès total',type:'number'},{id:'heures',name:'Heures de jeu',type:'number'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Films':{icon:'🎬',color:'#E05252',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'realisateur',name:'Réalisateur',type:'text'},{id:'annee',name:'Année',type:'number'},{id:'genre',name:'Genre',type:'text'},{id:'date_visu',name:'Date de visionnage',type:'date'},{id:'ou_vu',name:'Où vu',type:'select',options:['Cinéma','Netflix','Prime Video','Disney+','Canal+','DVD','Autre']},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Séries':{icon:'📺',color:'#52A0E0',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'statut',name:'Statut',type:'select',options:['En cours','Terminé','Abandonné','À voir']},{id:'saison',name:'Saison en cours',type:'number'},{id:'episode',name:'Épisode en cours',type:'number'},{id:'ou_vu',name:'Plateforme',type:'select',options:['Netflix','Prime','Disney+','Canal+','Autre']},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Mangas':{icon:'📚',color:'#E09E52',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'auteur',name:'Auteur',type:'text'},{id:'statut',name:'Statut',type:'select',options:['En lecture','Terminé','Abandonné','À lire','À paraître']},{id:'tome_lu',name:'Tome lu',type:'number'},{id:'tome_tot',name:'Tomes parus',type:'number'},{id:'date_debut',name:'Date de début',type:'date'},{id:'date_fin',name:'Date de fin',type:'date'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Livres':{icon:'📖',color:'#52C07A',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'auteur',name:'Auteur',type:'text'},{id:'genre',name:'Genre',type:'text'},{id:'statut',name:'Statut',type:'select',options:['En lecture','Terminé','Abandonné','À lire']},{id:'date_fin',name:'Date de fin',type:'date'},{id:'pages',name:'Pages',type:'number'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Comics':{icon:'💥',color:'#C052E0',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'editeur',name:'Éditeur',type:'text'},{id:'statut',name:'Statut',type:'select',options:['En lecture','Terminé','Abandonné','À lire']},{id:'numero',name:'Numéro en cours',type:'number'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Musique':{icon:'🎵',color:'#E05292',columns:[{id:'titre',name:'Titre / Album',type:'text',required:true},{id:'artiste',name:'Artiste',type:'text'},{id:'genre',name:'Genre',type:'text'},{id:'annee',name:'Année',type:'number'},{id:'date_ecoute',name:'Date d\'écoute',type:'date'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
  'Podcasts':{icon:'🎙️',color:'#52D4E0',columns:[{id:'titre',name:'Titre',type:'text',required:true},{id:'createur',name:'Créateur',type:'text'},{id:'statut',name:'Statut',type:'select',options:['Abonné','Terminé','Abandonné','À écouter']},{id:'episodes',name:'Épisodes écoutés',type:'number'},{id:'note',name:'Note',type:'rating'},{id:'avis',name:'Avis',type:'textarea'}]},
};

function openPresetsModal(){
  closeInlinePopup();
  openModal('modal-presets');
  document.getElementById('presets-grid').innerHTML=Object.entries(PRESETS).map(([name,p])=>`
    <div class="preset-card" data-preset="${esc(name)}" style="--preset-color:${p.color};">
      <div class="preset-icon">${p.icon}</div>
      <div class="preset-name">${esc(name)}</div>
      <div class="preset-check">✓</div>
    </div>`).join('');
  document.querySelectorAll('.preset-card').forEach(card=>card.addEventListener('click',()=>card.classList.toggle('selected')));
}

function applyPresets(){
  const selected=document.querySelectorAll('.preset-card.selected');
  if(!selected.length){alert('Sélectionne au moins un préset.');return;}
  selected.forEach(card=>{
    const name=card.dataset.preset,preset=PRESETS[name];if(!preset)return;
    state.categories.push({id:uid(),name,icon:preset.icon,color:preset.color,columns:preset.columns.map(c=>({...c})),entries:[]});
  });
  activeCatId=state.categories[0]?.id||null;scheduleSave();closeModals();render();
}

// ── EXPORT CSV ────────────────────────────────────────────
function exportCSV(){
  const cat=getActiveCat();
  if(!cat||!cat.entries.length){alert('Aucune donnée à exporter.');return;}
  const headers=cat.columns.map(c=>c.name);
  const rows=cat.entries.map(entry=>
    cat.columns.map(col=>{
      const val=entry[col.id];
      if(val===null||val===undefined||val==='')return'';
      const str=String(val);
      return str.includes(',')||str.includes('"')||str.includes('\n')?`"${str.replace(/"/g,'""')}"`:str;
    })
  );
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`${cat.name}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();URL.revokeObjectURL(url);
}

// ── IMPORT ────────────────────────────────────────────────
function openImportModal(){
  const sel=document.getElementById('import-cat');
  sel.innerHTML=state.categories.map(c=>`<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
  sel.value=activeCatId||state.categories[0]?.id;
  document.getElementById('import-url').value='';document.getElementById('import-paste').value='';
  document.getElementById('import-status').style.display='none';openModal('modal-import');
}
function parseCSVLine(line,sep){if(sep==='\t')return line.split('\t');const r=[];let cur='',inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(ch===sep&&!inQ){r.push(cur);cur='';}else cur+=ch;}r.push(cur);return r;}
function parseDelimited(text,sep){const lines=text.split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)return[];const headers=parseCSVLine(lines[0],sep);return lines.slice(1).map(line=>{const vals=parseCSVLine(line,sep);const obj={};headers.forEach((h,i)=>{obj[h.trim()]=(vals[i]||'').trim();});return obj;}).filter(row=>Object.values(row).some(v=>v));}
async function doImport(){
  const catId=document.getElementById('import-cat').value,cat=getCat(catId);if(!cat)return;
  const tab=document.querySelector('.import-tab.active')?.dataset.itab;
  const btn=document.getElementById('btn-do-import');btn.textContent='Import…';btn.disabled=true;
  try{
    let rows=[];
    if(tab==='paste'){const text=document.getElementById('import-paste').value.trim();if(!text){showImportStatus('error','Colle des données.');return;}rows=parseDelimited(text,text.includes('\t')?'\t':',');}
    else{const url=document.getElementById('import-url').value.trim();if(!url){showImportStatus('error','URL manquante.');return;}const resp=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);if(!resp.ok)throw new Error('Impossible de récupérer.');rows=parseDelimited((await resp.json()).contents,',');}
    if(!rows.length){showImportStatus('error','Aucune donnée reconnue.');return;}
    let imported=0;
    rows.forEach(row=>{const entry={id:uid(),_created:Date.now(),_order:cat.entries.length};cat.columns.forEach(col=>{const key=Object.keys(row).find(k=>k.toLowerCase().trim()===col.name.toLowerCase().trim()||col.name.toLowerCase().trim().startsWith(k.toLowerCase().trim().slice(0,5)));let val=key?row[key]:'';if(col.type==='number'&&val)val=parseFloat(val.replace(',','.'))||null;if(col.type==='rating'&&val)val=Math.min(5,Math.max(0,parseInt(val)||0));entry[col.id]=val;});const nameC=cat.columns.find(c=>c.required);if(entry[nameC?.id]){cat.entries.push(entry);imported++;}});
    scheduleSave();showImportStatus('success',`${imported} entrée(s) importée(s) !`);setTimeout(()=>{closeModals();render();},1600);
  }catch(e){showImportStatus('error',`Erreur : ${e.message}`);}
  finally{btn.textContent='Importer';btn.disabled=false;}
}
function showImportStatus(type,msg){const s=document.getElementById('import-status');s.style.display='';s.className=`import-status import-status-${type}`;s.textContent=msg;}

// ── GRAPHIQUES ────────────────────────────────────────────
function openStatsModal(){
  closeInlinePopup();openModal('modal-stats');
  const cat=getActiveCat();
  if(!cat){document.getElementById('stats-charts').innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Sélectionne une catégorie d\'abord.</p>';return;}
  setTimeout(()=>renderCharts(cat),100);
}
function renderCharts(cat){
  const container=document.getElementById('stats-charts');
  const entries=cat.entries;
  if(!entries.length){container.innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Aucune entrée à afficher.</p>';return;}
  container.innerHTML='';

  // Camembert statut
  const statutCol=cat.columns.find(c=>c.id==='statut'||c.name.toLowerCase()==='statut');
  if(statutCol){
    const counts={};entries.forEach(e=>{const v=e[statutCol.id]||'Non défini';counts[v]=(counts[v]||0)+1;});
    addChart(container,'Répartition par statut','doughnut',Object.keys(counts),Object.values(counts),['#7C6FE0','#52C07A','#E05252','#E09E52','#52A0E0','#C052E0']);
  }

  // Barres notes
  const noteCol=cat.columns.find(c=>c.type==='rating');
  if(noteCol){
    const counts=[0,0,0,0,0];entries.forEach(e=>{const n=parseInt(e[noteCol.id])||0;if(n>=1&&n<=5)counts[n-1]++;});
    addChart(container,'Distribution des notes','bar',['1★','2★','3★','4★','5★'],counts,['#F0C040']);
  }

  // Courbe temporelle (entrées par mois)
  const dateCol=cat.columns.find(c=>c.type==='date');
  if(dateCol){
    const byMonth={};entries.forEach(e=>{const d=e[dateCol.id];if(!d)return;const key=d.slice(0,7);byMonth[key]=(byMonth[key]||0)+1;});
    const sorted=Object.keys(byMonth).sort();
    if(sorted.length>1)addChart(container,'Œuvres par mois','line',sorted,sorted.map(k=>byMonth[k]),['#7C6FE0']);
  }

  // Top plateformes / select columns
  const selectCols=cat.columns.filter(c=>c.type==='select'&&c.id!=='statut');
  selectCols.slice(0,2).forEach(col=>{
    const counts={};entries.forEach(e=>{const v=e[col.id]||'Non défini';counts[v]=(counts[v]||0)+1;});
    if(Object.keys(counts).length>1)addChart(container,`Répartition — ${col.name}`,'doughnut',Object.keys(counts),Object.values(counts),['#52A0E0','#E09E52','#52C07A','#E05252','#C052E0','#52D4E0']);
  });

  if(!container.children.length)container.innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Pas assez de données pour afficher des graphiques.</p>';
}
function addChart(container,title,type,labels,data,colors){
  const wrap=document.createElement('div');wrap.className='chart-wrap';
  wrap.innerHTML=`<h4 class="chart-title">${title}</h4><div style="position:relative;height:220px;"><canvas></canvas></div>`;
  container.appendChild(wrap);
  const ctx=wrap.querySelector('canvas').getContext('2d');
  new Chart(ctx,{type,data:{labels,datasets:[{data,backgroundColor:type==='line'?'transparent':labels.map((_,i)=>colors[i%colors.length]),borderColor:colors[0],borderWidth:type==='line'?2:0,fill:type==='line',tension:.3,pointBackgroundColor:colors[0]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==='doughnut',labels:{color:'rgba(240,239,254,.65)',font:{size:11}}}},scales:type!=='doughnut'?{x:{ticks:{color:'rgba(240,239,254,.4)',font:{size:10}}},y:{ticks:{color:'rgba(240,239,254,.4)',font:{size:10}},beginAtZero:true}}:{}}});
}

// ── ROULETTE ──────────────────────────────────────────────
function openRouletteModal(){
  closeInlinePopup();
  const cats=state.categories;
  const catOptions=cats.map(c=>`<option value="${c.id}" ${c.id===activeCatId?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join('');
  document.getElementById('modal-roulette-body').innerHTML=`
    <div class="field-group"><label class="field-label">Catégorie</label><select class="field-select field-input" id="roulette-cat">${catOptions}</select></div>
    <div class="field-group"><label class="field-label">Critère de filtre</label><select class="field-select field-input" id="roulette-filter">
      <option value="unseen">À voir / À faire / À lire</option>
      <option value="all">Toutes les entrées</option>
      <option value="fav">Favoris seulement</option>
      <option value="note_min">Note minimum</option>
      <option value="statut">Par statut</option>
    </select></div>
    <div id="roulette-extra" style="display:none;"></div>
    <div class="roulette-container" id="roulette-container">
      <div class="roulette-icon">🎰</div>
      <div id="roulette-result" style="display:none;"></div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <button class="btn btn-primary" id="btn-spin" style="font-size:18px;padding:14px 40px;">Lancer !</button>
    </div>`;

  document.getElementById('roulette-filter').addEventListener('change',function(){
    const extra=document.getElementById('roulette-extra');
    extra.style.display='';
    if(this.value==='note_min'){extra.innerHTML=`<div class="field-group"><label class="field-label">Note minimum</label><select class="field-select field-input" id="roulette-note-min"><option value="1">1★</option><option value="2">2★</option><option value="3" selected>3★</option><option value="4">4★</option><option value="5">5★</option></select></div>`;}
    else if(this.value==='statut'){const cat=getCat(document.getElementById('roulette-cat').value);const statutCol=cat?.columns.find(c=>c.id==='statut'||c.name.toLowerCase()==='statut');const opts=statutCol?.options||[];extra.innerHTML=`<div class="field-group"><label class="field-label">Statut</label><select class="field-select field-input" id="roulette-statut">${opts.map(o=>`<option>${esc(o)}</option>`).join('')}</select></div>`;}
    else extra.style.display='none';
  });

  document.getElementById('btn-spin').addEventListener('click',()=>{
    const catId=document.getElementById('roulette-cat').value,filter=document.getElementById('roulette-filter').value;
    const c=getCat(catId);if(!c||!c.entries.length){alert('Aucune entrée.');return;}
    let pool=c.entries;
    if(filter==='unseen')pool=pool.filter(e=>isUnseen(e));
    else if(filter==='fav')pool=pool.filter(e=>e.favorite);
    else if(filter==='note_min'){const min=parseInt(document.getElementById('roulette-note-min')?.value||'3');pool=pool.filter(e=>Number(e.note||0)>=min);}
    else if(filter==='statut'){const st=document.getElementById('roulette-statut')?.value;if(st)pool=pool.filter(e=>e.statut===st);}
    if(!pool.length){alert('Aucune entrée ne correspond.');return;}
    const nameCol=c.columns.find(col=>col.required&&col.type==='text')||c.columns[0];
    const resultEl=document.getElementById('roulette-result');resultEl.style.display='';
    let spins=0;
    const interval=setInterval(()=>{
      const r=pool[Math.floor(Math.random()*pool.length)];
      resultEl.innerHTML=`<div class="roulette-spinning">${esc(r[nameCol?.id]||'?')}</div>`;
      spins++;
      if(spins>=25){clearInterval(interval);const winner=pool[Math.floor(Math.random()*pool.length)];resultEl.innerHTML=`<div class="roulette-winner">🎉 ${esc(winner[nameCol?.id]||'?')}</div>`;}
    },80);
  });
  openModal('modal-roulette');
}

// ── TUTORIEL ──────────────────────────────────────────────
function openTutorial(){
  closeInlinePopup();
  const steps=tutorialSteps.length>0?tutorialSteps:[
    {icon:'📂',title:'Catégories',content:'Clique sur ⊕ dans le header pour créer une catégorie. Chaque catégorie a ses propres colonnes personnalisables.'},
    {icon:'➕',title:'Ajouter une entrée',content:'Clique sur + en bas à droite pour ajouter une œuvre. Tu peux aussi appuyer sur N depuis n\'importe où (hors champ de saisie).'},
    {icon:'✏️',title:'Modifier rapidement',content:'Clique directement sur une valeur dans la liste pour la modifier. En vue tableur, textes et nombres sont éditables en place.'},
    {icon:'⭐',title:'Favoris & filtres',content:'Le ☆ met une œuvre en favori. La barre de filtres permet de voir uniquement tes favoris, les œuvres à voir, ou celles déjà vues.'},
    {icon:'🔀',title:'Vues & tri',content:'Choisis entre liste, grille, compact ou tableur. Trie par n\'importe quelle colonne. En liste, glisse ⠿ pour réordonner.'},
    {icon:'🎰',title:'Roulette',content:'Clique sur la roulette dans le header pour laisser le hasard choisir une œuvre selon des critères que tu définis.'},
    {icon:'📊',title:'Graphiques',content:'Clique sur 📊 pour voir les statistiques visuelles : statuts, notes, évolution dans le temps.'},
    {icon:'🔗',title:'Partage',content:'Menu utilisateur → Partage : active un lien public pour que d\'autres consultent ta collection en lecture seule.'},
  ];
  document.getElementById('tutorial-steps-body').innerHTML=steps.map(s=>`
    <div class="tutorial-step">
      <div class="tutorial-icon">${esc(s.icon||'📌')}</div>
      <div><strong>${esc(s.title)}</strong><p>${esc(s.content)}</p></div>
    </div>`).join('');
  openModal('modal-tutorial');
}

// ── PARTAGE ───────────────────────────────────────────────
async function openShareModal(){
  closeInlinePopup();
  const me=await API.me();
  document.getElementById('share-toggle').checked=!!me.share_enabled;
  document.getElementById('share-link-block').style.display=me.share_enabled?'':'none';
  if(me.share_token&&me.share_enabled)document.getElementById('share-link-input').value=`${location.origin}/share/${me.share_token}`;
  openModal('modal-share');
}

// ── COMPTE ────────────────────────────────────────────────
function openAccountModal(){
  closeInlinePopup();
  const avatarPreview=currentUser.avatar_url?`<img src="${esc(currentUser.avatar_url)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;"/>`:
    `<div style="width:64px;height:64px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;">${(currentUser.username[0]||'?').toUpperCase()}</div>`;
  document.getElementById('account-info').innerHTML=`
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
      <div id="avatar-preview">${avatarPreview}</div>
      <div><strong style="font-size:16px;">${esc(currentUser.username)}</strong><br/><span style="font-size:13px;color:var(--text3);">${esc(currentUser.email)}</span><br/><span class="col-tag" style="margin-top:4px;display:inline-flex;">${currentUser.role}</span></div>
    </div>
    <div class="field-group"><label class="field-label">Pseudo</label><input type="text" id="acc-username" class="field-input" value="${esc(currentUser.username)}"/></div>
    <div class="field-group"><label class="field-label">Photo de profil (URL)</label><input type="url" id="acc-avatar-url" class="field-input" value="${esc(currentUser.avatar_url||'')}" placeholder="https://…"/><p style="font-size:12px;color:var(--text3);margin-top:4px;">Colle l'URL d'une image (imgur, gravatar…)</p></div>
    <div id="acc-profile-error" class="auth-error" style="display:none;"></div>
    <button class="btn btn-ghost" id="btn-save-profile" style="margin-bottom:20px;">Mettre à jour le profil</button>
    <hr style="border-color:var(--border);margin-bottom:20px;"/>`;
  document.getElementById('acc-new-pw').value='';document.getElementById('acc-pw-error').style.display='none';
  document.getElementById('acc-avatar-url').addEventListener('input',e=>{const url=e.target.value.trim();const preview=document.getElementById('avatar-preview');if(url)preview.innerHTML=`<img src="${esc(url)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'"/>`;});
  document.getElementById('btn-save-profile').addEventListener('click',async()=>{
    const username=document.getElementById('acc-username').value.trim(),avatar_url=document.getElementById('acc-avatar-url').value.trim();
    const errEl=document.getElementById('acc-profile-error');errEl.style.display='none';
    try{await API.updateProfile({username,avatar_url});currentUser.username=username;currentUser.avatar_url=avatar_url||null;updateUserAvatar();errEl.className='auth-error auth-success';errEl.textContent='✓ Profil mis à jour !';errEl.style.display='';}
    catch(e){errEl.textContent=e.message;errEl.style.display='';}
    setTimeout(()=>errEl.style.display='none',2500);
  });
  openModal('modal-account');
}

// ── ADMIN ─────────────────────────────────────────────────
async function openAdminModal(){
  closeInlinePopup();openModal('modal-admin');
  try{
    const[cfg,stats,usersData]=await Promise.all([API.adminGetConfig(),API.adminGetStats(),API.adminGetUsers()]);
    document.getElementById('admin-site-name').value=cfg.site_name||'';
    document.getElementById('admin-site-logo').value=cfg.site_logo||'';
    document.getElementById('admin-site-sub').value=cfg.site_subtitle||'';
    document.getElementById('admin-logo-url').value=cfg.site_logo_url||'';
    document.getElementById('admin-stats').innerHTML=`<div class="admin-stat"><span>${stats.total_users}</span>Membres</div><div class="admin-stat"><span>${stats.new_last_7_days}</span>Nouveaux (7j)</div><div class="admin-stat"><span>${stats.sharing_enabled}</span>Partages actifs</div><div class="admin-stat"><span>${stats.admins}</span>Admins</div>`;
    renderAdminUsers(usersData.users);
    loadAdminNews();
    loadAdminTutorial();
  }catch(e){document.getElementById('admin-stats').textContent=`Erreur : ${e.message}`;}
}

async function loadAdminNews(){
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  const container=document.getElementById('admin-news-list');
  container.innerHTML=!newsData.length?'<p style="color:var(--text3);font-size:13px;">Aucun article.</p>':
    newsData.map(n=>`<div class="admin-news-item" data-id="${n.id}">
      <div style="flex:1;"><strong>${esc(n.title)}</strong>${n.pinned?' 📌':''}<p style="font-size:13px;color:var(--text3);">${n.content?esc(n.content.slice(0,80))+'…':''}</p></div>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-nid="${n.id}">✕</button>
    </div>`).join('');
  container.querySelectorAll('[data-nid]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer?'))return;await API.deleteNews(btn.dataset.nid);newsData=null;loadAdminNews();}));
}

async function loadAdminTutorial(){
  const steps=await API.adminGetTutorial();
  document.getElementById('admin-tutorial-steps').innerHTML=`<div style="font-size:13px;color:var(--text3);margin-bottom:12px;">Modifie les étapes du tutoriel :</div>`+
    steps.map((s,i)=>`<div class="col-row" style="flex-direction:column;align-items:stretch;gap:6px;margin-bottom:12px;">
      <div style="display:flex;gap:8px;align-items:center;"><input type="text" class="field-input" style="width:50px;font-size:20px;text-align:center;" value="${esc(s.icon)}" data-ti="${i}" data-field="icon"/><input type="text" class="field-input" value="${esc(s.title)}" placeholder="Titre" data-ti="${i}" data-field="title"/></div>
      <textarea class="field-textarea" style="min-height:60px;" data-ti="${i}" data-field="content" placeholder="Description…">${esc(s.content)}</textarea>
    </div>`).join('');
  // Store for save
  document.getElementById('admin-tutorial-steps').dataset.steps=JSON.stringify(steps);
}

function renderAdminUsers(users){
  const el=document.getElementById('admin-users-list');
  if(!users.length){el.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun utilisateur.</p>';return;}
  el.innerHTML=`<div class="admin-users-table">${users.map(u=>`<div class="admin-user-row"><div class="admin-user-avatar">${(u.username[0]||'?').toUpperCase()}</div><div class="admin-user-info"><strong>${esc(u.username)}</strong> <span class="col-tag">${u.role}</span><div style="font-size:12px;color:var(--text3);">${esc(u.email)}</div><div style="font-size:11px;color:var(--text3);">Inscrit ${new Date(u.created_at).toLocaleDateString('fr-FR')} · Connexion : ${u.last_login?new Date(u.last_login).toLocaleDateString('fr-FR'):'jamais'}</div></div><div class="admin-user-actions">${u.role!=='admin'?`<button class="btn btn-ghost btn-sm" data-uid="${u.id}" data-action="promote">Admin</button>`:''}${u.id!==currentUser.id?`<button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-uid="${u.id}" data-action="delete">✕</button>`:''}</div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer ?'))return;try{await API.adminDeleteUser(btn.dataset.uid);openAdminModal();}catch(e){alert(e.message);}}));
  el.querySelectorAll('[data-action="promote"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Promouvoir en admin ?'))return;try{await API.adminSetRole(btn.dataset.uid,'admin');openAdminModal();}catch(e){alert(e.message);}}));
}

// ── MODALS ────────────────────────────────────────────────
function openModal(id){closeInlinePopup();document.getElementById('modal-backdrop').classList.add('open');const m=document.getElementById(id);m.style.display='flex';requestAnimationFrame(()=>m.classList.add('open'));}
function closeModals(){document.getElementById('modal-backdrop').classList.remove('open');document.querySelectorAll('.modal').forEach(m=>{m.classList.remove('open');setTimeout(()=>{if(!m.classList.contains('open'))m.style.display='none';},300);});}

// ── EVENTS STATIQUES ──────────────────────────────────────
function initStaticEvents(){
  document.getElementById('fab-add-entry').addEventListener('click',()=>openEntryModal());
  document.getElementById('btn-add-category').addEventListener('click',()=>{
    if(!state.categories.length)openPresetsModal();
    else openCategoryModal();
  });
  document.getElementById('btn-import').addEventListener('click',openImportModal);
  document.getElementById('btn-close-entry').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-entry').addEventListener('click',closeModals);
  document.getElementById('btn-save-entry').addEventListener('click',saveEntry);
  document.getElementById('btn-delete-entry').addEventListener('click',deleteEntry);
  document.getElementById('btn-close-category').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-category').addEventListener('click',closeModals);
  document.getElementById('btn-save-category').addEventListener('click',saveCategory);
  document.getElementById('btn-add-col-cat').addEventListener('click',()=>{tempNewCols.push({name:'',type:'text'});renderNewCols();});
  document.getElementById('btn-close-columns').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-columns').addEventListener('click',closeModals);
  document.getElementById('btn-save-columns').addEventListener('click',saveColumns);
  document.getElementById('btn-add-col').addEventListener('click',()=>{tempColumns.push({id:uid(),name:'',type:'text'});renderColsList();});
  document.getElementById('btn-close-import').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-import').addEventListener('click',closeModals);
  document.getElementById('btn-do-import').addEventListener('click',doImport);
  document.getElementById('btn-close-share').addEventListener('click',closeModals);
  document.getElementById('btn-close-share-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-account').addEventListener('click',closeModals);
  document.getElementById('btn-close-account-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-admin').addEventListener('click',closeModals);
  document.getElementById('btn-close-admin-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-roulette').addEventListener('click',closeModals);
  document.getElementById('btn-close-tutorial').addEventListener('click',closeModals);
  document.getElementById('btn-close-tutorial-ok')?.addEventListener('click',closeModals);
  document.getElementById('btn-close-stats').addEventListener('click',closeModals);
  document.getElementById('btn-close-news').addEventListener('click',closeModals);
  document.getElementById('btn-close-presets').addEventListener('click',closeModals);
  document.getElementById('btn-presets-zero').addEventListener('click',()=>{closeModals();setTimeout(()=>openCategoryModal(false),300);});
  document.getElementById('btn-presets-apply').addEventListener('click',applyPresets);
  document.getElementById('modal-backdrop').addEventListener('click',()=>{closeInlinePopup();closeModals();});

  document.getElementById('cat-color-picker').addEventListener('click',e=>{const s=e.target.closest('.color-swatch');if(!s)return;tempCatColor=s.dataset.color;document.querySelectorAll('.color-swatch').forEach(sw=>sw.classList.toggle('active',sw===s));});
  document.querySelectorAll('.import-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.import-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('itab-csv').style.display=btn.dataset.itab==='csv'?'':'none';document.getElementById('itab-paste').style.display=btn.dataset.itab==='paste'?'':'none';}));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('touchmove',e=>e.stopPropagation()));

  // Share
  document.getElementById('share-toggle').addEventListener('change',async function(){
    try{const data=await API.toggleShare();this.checked=data.share_enabled;document.getElementById('share-link-block').style.display=data.share_enabled?'':'none';if(data.share_token)document.getElementById('share-link-input').value=`${location.origin}/share/${data.share_token}`;}catch(e){alert(e.message);}
  });
  document.getElementById('btn-copy-link').addEventListener('click',()=>{const input=document.getElementById('share-link-input');input.select();navigator.clipboard?.writeText(input.value)||document.execCommand('copy');document.getElementById('btn-copy-link').textContent='Copié !';setTimeout(()=>{document.getElementById('btn-copy-link').textContent='Copier';},2000);});
  document.getElementById('btn-regen-token').addEventListener('click',async()=>{if(!confirm('Nouveau lien ? L\'ancien sera invalidé.'))return;try{const data=await API.regenToken();document.getElementById('share-link-input').value=`${location.origin}/share/${data.share_token}`;document.getElementById('share-toggle').checked=true;document.getElementById('share-link-block').style.display='';}catch(e){alert(e.message);}});

  // Account
  document.getElementById('btn-change-pw').addEventListener('click',async()=>{
    const newPw=document.getElementById('acc-new-pw').value,errEl=document.getElementById('acc-pw-error');errEl.style.display='none';
    try{await API.updatePassword(newPw);alert('Mot de passe mis à jour !');closeModals();}catch(e){errEl.textContent=e.message;errEl.style.display='';}
  });

  // Admin config
  document.getElementById('btn-save-config').addEventListener('click',async()=>{
    const cfg={site_name:document.getElementById('admin-site-name').value,site_logo:document.getElementById('admin-site-logo').value,site_subtitle:document.getElementById('admin-site-sub').value,site_logo_url:document.getElementById('admin-logo-url').value};
    const msgEl=document.getElementById('admin-config-msg');msgEl.style.display='none';
    try{await API.adminSaveConfig(cfg);applySiteConfig(cfg);msgEl.className='auth-error auth-success';msgEl.textContent='✓ Sauvegardé !';msgEl.style.display='';}
    catch(e){msgEl.className='auth-error';msgEl.textContent=e.message;msgEl.style.display='';}
    setTimeout(()=>msgEl.style.display='none',3000);
  });

  // Admin news
  document.getElementById('btn-add-news').addEventListener('click',async()=>{
    const title=document.getElementById('news-title').value.trim(),content=document.getElementById('news-content').value.trim(),image_url=document.getElementById('news-image-url').value.trim(),pinned=document.getElementById('news-pinned').checked;
    if(!title){alert('Titre obligatoire.');return;}
    try{await API.addNews({title,content,image_url,pinned});document.getElementById('news-title').value='';document.getElementById('news-content').value='';document.getElementById('news-image-url').value='';document.getElementById('news-pinned').checked=false;newsData=null;loadAdminNews();}
    catch(e){alert(e.message);}
  });

  // Admin tutorial save
  document.getElementById('btn-save-tutorial').addEventListener('click',async()=>{
    const stepsEl=document.getElementById('admin-tutorial-steps');
    let steps=JSON.parse(stepsEl.dataset.steps||'[]');
    stepsEl.querySelectorAll('[data-ti]').forEach(el=>{const i=parseInt(el.dataset.ti),field=el.dataset.field;if(!steps[i])steps[i]={};steps[i][field]=el.value||el.textContent;});
    try{await API.adminSaveTutorial(steps);tutorialSteps=steps;alert('Tutoriel sauvegardé !');}catch(e){alert(e.message);}
  });
}

// ── BOOT ─────────────────────────────────────────────────
route();
