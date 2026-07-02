// ml-entry.js — Modale d'entrée, popup inline, drag, autocomplétion
'use strict';

function openInlinePopup(entryId,colId,anchor){
  closeInlinePopup();
  const cat=getActiveCat(),entry=cat?.entries.find(e=>e.id===entryId),col=cat?.columns.find(c=>c.id===colId);
  if(!cat||!entry||!col)return;
  const val=entry[colId]??'';
  const popup=document.createElement('div');popup.className='inline-popup';popup.id='active-inline-popup';
  let fHTML='';
  if(col.type==='text')fHTML=`<input type="text" id="ip-f" class="ip-input" value="${esc(val)}" placeholder="${esc(col.name)}…"/>`;
  else if(col.type==='number')fHTML=`<input type="number" id="ip-f" class="ip-input" value="${val??''}" min="0" placeholder="0"/>`;
  else if(col.type==='date')fHTML=`<div style="display:flex;gap:6px;"><input type="date" id="ip-f" class="ip-input" value="${toInputDate(val)}" style="flex:1;"/><button class="btn-today ip-today">Auj.</button></div>`;
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
    if(col.type==='text')f=`<input type="text" class="field-input" id="field-${col.id}" value="${esc(val)}" placeholder="${esc(col.name)}…" autocomplete="off" ${col.required?'required':''}/>`;
    else if(col.type==='number')f=`<input type="number" class="field-input" id="field-${col.id}" value="${val??''}" min="0" placeholder="0"/>`;
    else if(col.type==='date')f=`<div class="date-input-wrap"><input type="date" class="field-input" id="field-${col.id}" value="${toInputDate(val)}"/><button type="button" class="btn-today" onclick="document.getElementById('field-${col.id}').value='${todayStr()}'">Aujourd'hui</button></div>`;
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

  // Attacher autocomplétion sur champs texte
  cat.columns.forEach(col=>{
    if(col.type!=='text')return;
    const inputEl=document.getElementById(`field-${col.id}`);
    if(inputEl)initAutocomplete(inputEl,col.id,cat);
  });

  // Bouton Wikipedia si catégorie activée
  if(cat.wikiEnabled){
    const wikiBar=document.createElement('div');
    wikiBar.style.cssText='padding:10px 0 4px;display:flex;align-items:center;gap:8px;';
    wikiBar.innerHTML=`<button class="btn btn-ghost" id="btn-wiki-search" style="flex:1;">🔍 Remplir depuis Wikipédia</button><button class="btn-help" data-help="wikipedia" style="width:32px;height:32px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg3);cursor:pointer;color:var(--text2);">?</button>`;
    body.prepend(wikiBar);
    document.getElementById('btn-wiki-search').addEventListener('click',()=>triggerWikiSearch(cat));
    wikiBar.querySelector('.btn-help').addEventListener('click',e=>showHelpPopup('wikipedia',e.target));
  }

  // Champ tags
  const existingTags=entry?([...(entry.tags||[])]):[];
  const allTagsInCat=[...new Set(cat.entries.flatMap(e=>e.tags||[]))].sort();
  const tagsWrap=document.createElement('div');
  tagsWrap.className='field-group';
  tagsWrap.innerHTML=`<label class="field-label">Tags</label>
    <div class="tags-input-wrap" id="tags-input-wrap">
      ${existingTags.map(t=>`<span class="tag-pill" data-tag="${esc(t)}">${esc(t)} <button class="tag-remove" data-tag="${esc(t)}">×</button></span>`).join('')}
      <input type="text" id="tags-input" class="tags-input-field" placeholder="Ajouter un tag…" autocomplete="off"/>
    </div>
    <div class="tags-autocomplete" id="tags-autocomplete" style="display:none;"></div>`;
  body.appendChild(tagsWrap);

  let currentTags=[...existingTags];
  const tagsInput=body.querySelector('#tags-input');
  const tagsAC=body.querySelector('#tags-autocomplete');
  const tagsWrapEl=body.querySelector('#tags-input-wrap');

  function renderTagPills(){
    tagsWrapEl.querySelectorAll('.tag-pill').forEach(p=>p.remove());
    currentTags.forEach(t=>{
      const pill=document.createElement('span');
      pill.className='tag-pill';pill.dataset.tag=t;
      pill.innerHTML=`${esc(t)} <button class="tag-remove" data-tag="${esc(t)}">×</button>`;
      tagsWrapEl.insertBefore(pill,tagsInput);
    });
    tagsWrapEl.querySelectorAll('.tag-remove').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();currentTags=currentTags.filter(t=>t!==btn.dataset.tag);renderTagPills();
    }));
  }

  function addTag(t){t=t.trim().toLowerCase();if(t&&!currentTags.includes(t)){currentTags.push(t);renderTagPills();}tagsInput.value='';}

  tagsInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===','){e.preventDefault();addTag(tagsInput.value);tagsAC.style.display='none';}
    if(e.key==='Backspace'&&!tagsInput.value.length&&currentTags.length){currentTags.pop();renderTagPills();}
  });
  tagsInput.addEventListener('input',()=>{
    const q=tagsInput.value.toLowerCase();
    const matches=allTagsInCat.filter(t=>t.includes(q)&&!currentTags.includes(t)).slice(0,6);
    if(matches.length&&q){
      tagsAC.innerHTML=matches.map(t=>`<div class="tags-ac-item" data-tag="${esc(t)}">${esc(t)}</div>`).join('');
      tagsAC.style.display='';
      tagsAC.querySelectorAll('.tags-ac-item').forEach(item=>item.addEventListener('click',()=>{addTag(item.dataset.tag);tagsAC.style.display='none';}));
    }else tagsAC.style.display='none';
  });

  if(!editingEntryId){
    const nameCol2=cat.columns.find(c=>c.required&&c.type==='text');
    if(nameCol2){
      document.getElementById(`field-${nameCol2.id}`)?.addEventListener('input',function(){
        const existing=cat.entries.find(e=>e[nameCol2.id]===this.value.trim()&&e.id!==editingEntryId);
        let warn=document.getElementById('dup-warn');
        if(existing){
          if(!warn){warn=document.createElement('div');warn.id='dup-warn';warn.style.cssText='font-size:12px;color:var(--danger);margin-top:4px;cursor:pointer;';this.parentNode.appendChild(warn);}
          warn.innerHTML=`⚠ "${esc(this.value.trim())}" existe déjà — <u>voir l'entrée</u>`;
          warn.onclick=()=>openEntryModal(existing.id);
        }else if(warn)warn.remove();
      });
    }
  }
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
  // Tags depuis le DOM
  const _tagPills=document.querySelectorAll('#tags-input-wrap .tag-pill');
  const _savedTags=[..._tagPills].map(p=>p.dataset.tag).filter(Boolean);
  if(tagsInputEl?.value?.trim())_savedTags.push(tagsInputEl.value.trim().toLowerCase());
  data.tags=_savedTags;
  if(editingEntryId){
    const idx=cat.entries.findIndex(e=>e.id===editingEntryId);
    if(idx!==-1){
      const snapshot={...cat.entries[idx]};
      pushHistory(`Modifié : ${data[cat.columns.find(c=>c.required)?.id]||'entrée'}`,()=>{cat.entries[idx]=snapshot;scheduleSave();});
      data._created=cat.entries[idx]._created;data._order=cat.entries[idx]._order;data.favorite=cat.entries[idx].favorite;cat.entries[idx]=data;
    }
  }else{
    pushHistory(`Ajouté : ${data[cat.columns.find(c=>c.required)?.id]||'entrée'}`,()=>{cat.entries=cat.entries.filter(e=>e.id!==data.id);scheduleSave();});
    data._order=cat.entries.length;cat.entries.push(data);
  }
  scheduleSave();closeModals();render();
}

function deleteEntry(){
  if(!editingEntryId)return;
  if(!confirm('Supprimer?'))return;
  const cat=getActiveCat();
  const entry=cat.entries.find(e=>e.id===editingEntryId);
  const snapshot=entry?{...entry}:null;
  pushHistory(`Supprimé : ${entry?.[cat.columns.find(c=>c.required)?.id]||'entrée'}`,()=>{if(snapshot){cat.entries.push(snapshot);scheduleSave();}});
  cat.entries=cat.entries.filter(e=>e.id!==editingEntryId);
  scheduleSave();closeModals();render();
}

function initAutocomplete(inputEl, colId, cat){
  if(!inputEl||!colId||!cat)return;
  const vals=[...new Set(cat.entries.map(e=>e[colId]).filter(v=>v&&typeof v==='string'&&v.trim()))].sort();
  if(!vals.length)return;

  const dropdown=document.createElement('div');
  dropdown.className='autocomplete-dropdown';
  dropdown.style.display='none';
  inputEl.parentNode.style.position='relative';
  inputEl.parentNode.appendChild(dropdown);

  function update(){
    const q=inputEl.value.trim().toLowerCase();
    if(!q){dropdown.style.display='none';return;}
    const matches=vals.filter(v=>v.toLowerCase().startsWith(q)&&v.toLowerCase()!==q).slice(0,6);
    if(!matches.length){dropdown.style.display='none';return;}
    dropdown.innerHTML=matches.map(v=>`<div class="autocomplete-item" data-val="${esc(v)}">${esc(v)}</div>`).join('');
    dropdown.style.display='';
    dropdown.querySelectorAll('.autocomplete-item').forEach(item=>{
      item.addEventListener('click',()=>{inputEl.value=item.dataset.val;dropdown.style.display='none';inputEl.dispatchEvent(new Event('input'));});
    });
  }

  inputEl.addEventListener('input',update);
  inputEl.addEventListener('keydown',e=>{
    const items=dropdown.querySelectorAll('.autocomplete-item');
    const active=dropdown.querySelector('.autocomplete-item.active');
    if(e.key==='ArrowDown'){e.preventDefault();const next=active?active.nextSibling:items[0];active?.classList.remove('active');next?.classList.add('active');}
    else if(e.key==='ArrowUp'){e.preventDefault();const prev=active?active.previousSibling:items[items.length-1];active?.classList.remove('active');prev?.classList.add('active');}
    else if((e.key==='Tab'||e.key==='Enter')&&active){e.preventDefault();inputEl.value=active.dataset.val;dropdown.style.display='none';}
    else if(e.key==='Escape'){dropdown.style.display='none';}
  });
  inputEl.addEventListener('blur',()=>setTimeout(()=>dropdown.style.display='none',150));
}

