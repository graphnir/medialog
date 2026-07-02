// ml-columns.js — Colonnes, catégories, présets
'use strict';

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


window.editOptions=function(i){
  const col=tempColumns[i];
  // Ouvrir modal inline pour éditer les options avec un + ergonomique
  const existing=document.getElementById('options-editor-wrap');
  if(existing)existing.remove();
  const wrap=document.createElement('div');
  wrap.id='options-editor-wrap';
  wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;';
  const opts=[...col.options];
  function renderOpts(){
    wrap.innerHTML=`<div style="background:var(--bg2);border-radius:var(--radius);padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;overflow-y:auto;">
      <h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:16px;">Options — ${esc(col.name)}</h3>
      <div id="opts-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
        ${opts.map((o,oi)=>`<div style="display:flex;gap:6px;"><input type="text" class="field-input" value="${esc(o)}" data-oi="${oi}" style="flex:1;"/><button class="btn-del" data-del="${oi}" style="flex-shrink:0;">✕</button></div>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <input type="text" id="new-opt-input" class="field-input" placeholder="Nouvelle option…" style="flex:1;"/>
        <button class="btn btn-ghost" id="btn-add-opt" style="flex-shrink:0;">+</button>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" id="opts-cancel">Annuler</button>
        <button class="btn btn-primary" id="opts-ok">Sauvegarder</button>
      </div>
    </div>`;
    wrap.querySelectorAll('[data-oi]').forEach(el=>el.addEventListener('input',e=>{opts[+e.target.dataset.oi]=e.target.value;}));
    wrap.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',e=>{opts.splice(+e.target.dataset.del,1);renderOpts();}));
    wrap.querySelector('#btn-add-opt').addEventListener('click',()=>{const v=wrap.querySelector('#new-opt-input').value.trim();if(v){opts.push(v);renderOpts();}});
    wrap.querySelector('#new-opt-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wrap.querySelector('#btn-add-opt').click();}});
    wrap.querySelector('#opts-cancel').addEventListener('click',()=>wrap.remove());
    wrap.querySelector('#opts-ok').addEventListener('click',()=>{
      const finals=opts.map(o=>o.trim()).filter(Boolean);
      if(!finals.length){alert('Au moins une option requise.');return;}
      col.options=finals;wrap.remove();renderColsList();
    });
  }
  renderOpts();
  document.body.appendChild(wrap);
};

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

function openColumnsModal(){
  const cat=getActiveCat();if(!cat)return;
  // Deep clone complet pour éviter les mutations accidentelles
  tempColumns=cat.columns.map(c=>({
    id:c.id, name:c.name, type:c.type,
    ...(c.required?{required:true}:{}),
    ...(c.options?{options:[...c.options]}:{}),
    ...(c.showIf?{showIf:{...c.showIf}}:{}),
    ...(c.wikiField?{wikiField:c.wikiField}:{}),
  }));
  document.getElementById('modal-columns-title').textContent=`${cat.icon} ${cat.name} — Colonnes`;
  // Sync toggle Wikipedia + sélecteur type de média AVANT renderColsList
  const wikiCb=document.getElementById('wiki-toggle-cb');
  if(wikiCb)wikiCb.checked=!!cat.wikiEnabled;
  const wikiWrap=document.getElementById('wiki-toggle-wrap');
  if(wikiWrap){
    let mediaTypeSel=document.getElementById('wiki-media-type-global');
    if(!mediaTypeSel){
      mediaTypeSel=document.createElement('select');
      mediaTypeSel.id='wiki-media-type-global';
      mediaTypeSel.className='field-select';
      mediaTypeSel.style.cssText='font-size:12px;padding:4px 8px;margin-left:8px;';
      const mediaEntries=Object.entries({film:'Film',serie:'Série',jeu:'Jeu vidéo',manga:'Manga',livre:'Livre',comics:'Comics',musique:'Musique',generic:'Générique'});
      mediaTypeSel.innerHTML=mediaEntries.map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
      wikiWrap.appendChild(mediaTypeSel);
      mediaTypeSel.addEventListener('change',()=>renderColsList());
    }
    mediaTypeSel.value=cat.wikiMediaType||'generic';
    mediaTypeSel.style.display=cat.wikiEnabled?'':'none';
  }
  // renderColsList après sync du toggle pour que wikiOn soit correct
  renderColsList();
  openModal('modal-columns');
}

function renderColsList(){
  const cat=getActiveCat();
  const wikiOn=!!cat?.wikiEnabled;
  const mediaType=cat?.wikiMediaType||'generic';
  const wikiFields=WIKI_MEDIA_TYPES[mediaType]?.fields||[];
  const list=document.getElementById('cols-list');

  list.innerHTML=tempColumns.map((col,i)=>{
    if(wikiOn&&!col.required){
      // Mode Wikipedia : nom grisé, dropdown wiki remplace le sélecteur de type
      const wikiOpts=`<option value="">— Aucun champ —</option>`+wikiFields.map(f=>`<option value="${esc(f)}" ${col.wikiField===f?'selected':''}>${esc(f)}</option>`).join('');
      return`<div class="col-row col-draggable col-wiki-mode" draggable="true" data-ci="${i}">
        <div class="col-drag-handle">⠿</div>
        <span class="tc-name-static" style="flex:1;font-size:14px;color:var(--text3);padding:8px 10px;background:var(--bg4);border-radius:var(--radius-sm);border:1px solid var(--border);">${esc(col.name)}</span>
        <select class="field-select" style="flex:1;font-size:13px;" data-wiki-col-id="${col.id}">${wikiOpts}</select>
      </div>`;
    }
    // Mode normal
    return`<div class="col-row col-draggable" draggable="true" data-ci="${i}">
      <div class="col-drag-handle">⠿</div>
      <input type="text" value="${esc(col.name)}" data-i="${i}" class="tc-name"/>
      <select data-i="${i}" class="tc-type" ${col.required?'disabled':''}>
        <option value="text" ${col.type==='text'?'selected':''}>Texte</option>
        <option value="number" ${col.type==='number'?'selected':''}>Nombre</option>
        <option value="date" ${col.type==='date'?'selected':''}>Date</option>
        <option value="rating" ${col.type==='rating'?'selected':''}>Note ★</option>
        <option value="select" ${col.type==='select'?'selected':''}>Liste</option>
        <option value="textarea" ${col.type==='textarea'?'selected':''}>Texte long</option>
      </select>
      ${col.required?'<span class="col-tag">obligatoire</span>':`<button class="btn-del" data-del="${i}">✕</button>`}
    </div>
    ${col.type==='select'&&col.options?`<div class="col-options-bar">Options : <em>${col.options.map(esc).join(', ')}</em> <button onclick="editOptions(${i})">Modifier</button></div>`:''}
    ${!col.required?`<div class="col-options-bar" style="margin-top:-6px;">
      ${col.showIf?`<span style="color:var(--accent);font-size:12px;">🔀 Visible si <strong>${esc(tempColumns.find(c=>c.id===col.showIf.colId)?.name||col.showIf.colId)}</strong> = "${esc(col.showIf.value)}"</span>`:'<span style="color:var(--text3);font-size:12px;">Toujours visible</span>'}
      <button onclick="editCondition(${i})" style="margin-left:8px;font-size:12px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;padding:2px 8px;">Condition</button>
    </div>`:''}`;
  }).join('');

  // Événements mode normal
  list.querySelectorAll('.tc-name').forEach(el=>el.addEventListener('input',e=>{tempColumns[+e.target.dataset.i].name=e.target.value;}));
  list.querySelectorAll('.tc-type').forEach(el=>el.addEventListener('change',e=>{const i=+e.target.dataset.i;tempColumns[i].type=e.target.value;if(e.target.value==='select'&&!tempColumns[i].options)tempColumns[i].options=['Option 1','Option 2'];renderColsList();}));
  list.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',e=>{tempColumns.splice(+e.target.dataset.del,1);renderColsList();}));

  // Événements mode Wikipedia
  list.querySelectorAll('[data-wiki-col-id]').forEach(sel=>sel.addEventListener('change',e=>{
    const colId=e.target.dataset.wikiColId;
    const col=tempColumns.find(c=>c.id===colId);
    if(col)col.wikiField=e.target.value||undefined;
  }));
  list.querySelectorAll('.col-draggable').forEach(row=>{
    row.addEventListener('dragstart',e=>{colDragSrcIdx=parseInt(row.dataset.ci);e.dataTransfer.effectAllowed='move';setTimeout(()=>row.classList.add('col-dragging'),0);});
    row.addEventListener('dragend',()=>{row.classList.remove('col-dragging');list.querySelectorAll('.col-drag-over').forEach(r=>r.classList.remove('col-drag-over'));if(colDragSrcIdx!==null&&colDragOverIdx!==null&&colDragSrcIdx!==colDragOverIdx){const[m]=tempColumns.splice(colDragSrcIdx,1);tempColumns.splice(colDragOverIdx,0,m);renderColsList();}colDragSrcIdx=null;colDragOverIdx=null;});
    row.addEventListener('dragover',e=>{e.preventDefault();const idx=parseInt(row.dataset.ci);if(idx===colDragSrcIdx)return;list.querySelectorAll('.col-drag-over').forEach(r=>r.classList.remove('col-drag-over'));row.classList.add('col-drag-over');colDragOverIdx=idx;});
    row.addEventListener('drop',e=>e.preventDefault());
  });
}

function saveColumns(){
  const cat=getActiveCat();if(!cat)return;
  // Lire les wikiFields depuis le DOM au moment de la sauvegarde (failsafe)
  document.querySelectorAll('[data-wiki-col-id]').forEach(sel=>{
    const colId=sel.dataset.wikiColId;
    const col=tempColumns.find(c=>c.id===colId);
    if(col)col.wikiField=sel.value||undefined;
  });
  cat.columns=tempColumns.filter(c=>c.name.trim()).map(c=>{
    const col={id:c.id,name:c.name.trim(),type:c.type};
    if(c.required)col.required=true;
    if(c.type==='select'&&Array.isArray(c.options)&&c.options.length>0)col.options=[...c.options];
    if(!c.required&&c.showIf&&c.showIf.colId&&c.showIf.value!==undefined)col.showIf={...c.showIf};
    if(c.wikiField)col.wikiField=c.wikiField;
    return col;
  });
  const wikiCb=document.getElementById('wiki-toggle-cb');
  if(wikiCb)cat.wikiEnabled=wikiCb.checked;
  const mediaTypeSel=document.getElementById('wiki-media-type-global');
  if(mediaTypeSel)cat.wikiMediaType=mediaTypeSel.value;
  console.log('[DEBUG] saveColumns — wikiEnabled:',cat.wikiEnabled,'mediaType:',cat.wikiMediaType,'cols avec wikiField:',cat.columns.filter(c=>c.wikiField).map(c=>c.name+':'+c.wikiField));
  scheduleSave();closeModals();render();
}

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

function deleteCategory(){const cat=getActiveCat();if(!cat)return;if(!confirm(`Supprimer "${cat.name}" ?`))return;state.categories=state.categories.filter(c=>c.id!==cat.id);activeCatId=state.categories[0]?.id||null;localStorage.setItem('ml_active_cat',activeCatId||'');loadSortForCat(activeCatId);scheduleSave();render();}

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

