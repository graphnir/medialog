// ml-admin.js — Panel admin
'use strict';

let adminTutoSteps=[];

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
    loadAdminHelpTexts();
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

async function loadAdminHelpTexts(){
  const container=document.getElementById('admin-help-texts-list');
  if(!container)return;
  try{
    const texts=await API.adminGetHelpTexts();
    container.innerHTML=texts.map(h=>`<div style="margin-bottom:16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">ID: <code>${esc(h.id)}</code></div>
      <div class="field-group"><label class="field-label">Titre</label><input type="text" class="field-input help-title-input" data-hid="${esc(h.id)}" value="${esc(h.title)}"/></div>
      <div class="field-group"><label class="field-label">Contenu (Markdown)</label><textarea class="field-textarea help-content-input" data-hid="${esc(h.id)}" style="min-height:80px;">${esc(h.content)}</textarea></div>
      <button class="btn btn-ghost btn-sm help-save-btn" data-hid="${esc(h.id)}">Sauvegarder</button>
    </div>`).join('');
    container.querySelectorAll('.help-save-btn').forEach(btn=>btn.addEventListener('click',async()=>{
      const id=btn.dataset.hid;
      const title=container.querySelector(`.help-title-input[data-hid="${id}"]`).value;
      const content=container.querySelector(`.help-content-input[data-hid="${id}"]`).value;
      try{await API.adminSaveHelpText(id,title,content);btn.textContent='✓ Sauvegardé';setTimeout(()=>btn.textContent='Sauvegarder',2000);}
      catch(e){alert(e.message);}
    }));
  }catch(e){container.innerHTML=`<p style="color:var(--danger);">Erreur : ${esc(e.message)}</p>`;}
}

function renderAdminTutorialSteps(){
  const container=document.getElementById('admin-tutorial-steps');
  container.innerHTML=`<div style="font-size:13px;color:var(--text3);margin-bottom:12px;">Modifie ou ajoute des étapes :</div>`+
    adminTutoSteps.map((s,i)=>`<div class="col-row" style="flex-direction:column;align-items:stretch;gap:6px;margin-bottom:12px;background:var(--bg3);border-radius:var(--radius-sm);padding:10px;border:1px solid var(--border);">
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" class="field-input tuto-icon" style="width:52px;font-size:20px;text-align:center;" value="${esc(s.icon||'📌')}" data-ti="${i}"/>
        <input type="text" class="field-input tuto-title" value="${esc(s.title)}" placeholder="Titre de l'étape" data-ti="${i}" style="flex:1;"/>
        <button class="btn-del tuto-del" data-ti="${i}">✕</button>
      </div>
      <textarea class="field-textarea tuto-content" style="min-height:60px;" data-ti="${i}" placeholder="Description…">${esc(s.content)}</textarea>
    </div>`).join('')+
    `<button class="btn btn-ghost" id="btn-add-tuto-step" style="width:100%;margin-top:4px;">+ Ajouter une étape</button>`;
  container.querySelectorAll('.tuto-icon').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].icon=e.target.value;}));
  container.querySelectorAll('.tuto-title').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].title=e.target.value;}));
  container.querySelectorAll('.tuto-content').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].content=e.target.value;}));
  container.querySelectorAll('.tuto-del').forEach(el=>el.addEventListener('click',e=>{adminTutoSteps.splice(+e.target.dataset.ti,1);renderAdminTutorialSteps();}));
  document.getElementById('btn-add-tuto-step')?.addEventListener('click',()=>{adminTutoSteps.push({icon:'📌',title:'',content:''});renderAdminTutorialSteps();});
}

async function loadAdminTutorial(){
  adminTutoSteps=await API.adminGetTutorial();
  renderAdminTutorialSteps();
}

function renderAdminUsers(users){
  const el=document.getElementById('admin-users-list');
  if(!users.length){el.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun utilisateur.</p>';return;}
  el.innerHTML=`<div class="admin-users-table">${users.map(u=>`<div class="admin-user-row"><div class="admin-user-avatar">${(u.username[0]||'?').toUpperCase()}</div><div class="admin-user-info"><strong>${esc(u.username)}</strong> <span class="col-tag">${u.role}</span><div style="font-size:12px;color:var(--text3);">${esc(u.email)}</div><div style="font-size:11px;color:var(--text3);">Inscrit ${new Date(u.created_at).toLocaleDateString('fr-FR')} · Connexion : ${u.last_login?new Date(u.last_login).toLocaleDateString('fr-FR'):'jamais'}</div></div><div class="admin-user-actions">${u.role!=='admin'?`<button class="btn btn-ghost btn-sm" data-uid="${u.id}" data-action="promote">Admin</button>`:''}${u.id!==currentUser.id?`<button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-uid="${u.id}" data-action="delete">✕</button>`:''}</div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer ?'))return;try{await API.adminDeleteUser(btn.dataset.uid);openAdminModal();}catch(e){alert(e.message);}}));
  el.querySelectorAll('[data-action="promote"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Promouvoir en admin ?'))return;try{await API.adminSetRole(btn.dataset.uid,'admin');openAdminModal();}catch(e){alert(e.message);}}));
}

