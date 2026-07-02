// ml-share.js — Page de partage publique (lecture seule)
'use strict';

let shareReadOnly=false;

async function initSharePage(token){
  showPage('share');
  try{applySiteConfig(await API.getConfig());}catch{}
  try{
    const data=await API.getShareData(token);
    if(data.error)throw new Error(data.error);
    shareReadOnly=true;
    state.categories=data.categories||[];
    activeCatId=state.categories[0]?.id||null;
    searchQuery='';sortKey='';sortDir='desc';
    filterFav=false;filterStatus='all';
    document.getElementById('share-owner-name').textContent=`Collection de ${data.username}`;
    renderShareTabs();
    renderShareStats();
    renderShareMain();
    const fabTop=document.getElementById('share-fab-top');
    window.addEventListener('scroll',()=>{if(fabTop)fabTop.style.display=window.scrollY>300?'flex':'none';},{passive:true});
    fabTop?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  }catch(e){
    document.getElementById('share-main-content').innerHTML=`<div class="empty-state"><span class="empty-icon">🔒</span><h3>Collection introuvable</h3><p>${esc(e.message)}</p></div>`;
  }
}

function renderShareTabs(){
  const nav=document.getElementById('share-tabs-nav');
  nav.innerHTML=state.categories.map(cat=>`
    <button class="tab-btn ${cat.id===activeCatId?'active':''}" style="--tab-color:${cat.color}" data-id="${cat.id}">
      <span class="tab-icon">${cat.icon}</span>${esc(cat.name)}
    </button>`).join('');
  nav.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
    activeCatId=btn.dataset.id;searchQuery='';sortKey='';sortDir='desc';
    filterFav=false;filterStatus='all';
    renderShareTabs();renderShareStats();renderShareMain();
  }));
}

function renderShareStats(){
  const cat=getActiveCat();if(!cat)return;
  const total=cat.entries.length;
  const withNote=cat.entries.filter(e=>e.note>0);
  const moy=withNote.length?(withNote.reduce((a,e)=>a+e.note,0)/withNote.length).toFixed(1).replace('.',','):'—';
  const favs=cat.entries.filter(e=>e.favorite).length;
  document.getElementById('share-stats-bar').innerHTML=`
    <div class="stat-chip" style="--chip-color:${cat.color}"><span class="stat-num">${total}</span><span class="stat-lbl">Total</span></div>
    <div class="stat-chip" style="--chip-color:#F0C040"><span class="stat-num">${moy}${withNote.length?'★':''}</span><span class="stat-lbl">Moyenne</span></div>
    ${favs>0?`<div class="stat-chip" style="--chip-color:#E09E52"><span class="stat-num">${favs}</span><span class="stat-lbl">Favoris</span></div>`:''}`;
}

function renderShareMain(){
  const cat=getActiveCat();
  const main=document.getElementById('share-main-content');
  if(!cat){main.innerHTML='';return;}

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
  const visibleCols=cat.columns.filter(c=>!c.required);
  const sortOptions=cat.columns.map(c=>`<option value="${c.id}" ${sortKey===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  main.innerHTML=`
    <div class="toolbar" style="padding:12px 20px 8px;">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" class="search-input" id="share-search" placeholder="Rechercher…" value="${esc(searchQuery)}" />
      </div>
      <div class="sort-wrap">
        <select class="sort-select" id="share-sort"><option value="">Ordre manuel</option>${sortOptions}</select>
        <button class="sort-dir-btn" id="share-sort-dir">${sortDir==='asc'?'↑':'↓'}</button>
      </div>
    </div>
    <div class="filter-bar" style="padding:0 20px 12px;">
      <button class="filter-btn ${filterFav?'active':''}" id="share-filter-fav">⭐ Favoris</button>
      <button class="filter-btn ${filterStatus==='unseen'?'active':''}" id="share-filter-unseen">👁 À voir</button>
      <button class="filter-btn ${filterStatus==='hide-unseen'?'active':''}" id="share-filter-seen">✓ Vus</button>
    </div>
    <div class="view-toggle" style="padding:0 20px 12px;display:flex;gap:3px;">
      <button class="view-btn ${cardLayout==='cards-list'?'active':''}" id="share-vb-list" title="Liste"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <button class="view-btn ${cardLayout==='cards-grid'?'active':''}" id="share-vb-grid" title="Grille"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
      <button class="view-btn ${cardLayout==='cards-compact'?'active':''}" id="share-vb-compact" title="Compact"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="17" width="18" height="4"/></svg></button>
    </div>
    <div id="share-entries"></div>`;

  let sd=null;
  main.querySelector('#share-search').addEventListener('input',e=>{clearTimeout(sd);sd=setTimeout(()=>{searchQuery=e.target.value;renderShareMain();},180);});
  main.querySelector('#share-sort').addEventListener('change',e=>{sortKey=e.target.value;renderShareMain();});
  main.querySelector('#share-sort-dir').addEventListener('click',()=>{sortDir=sortDir==='asc'?'desc':'asc';renderShareMain();});
  main.querySelector('#share-filter-fav').addEventListener('click',()=>{filterFav=!filterFav;renderShareMain();renderShareStats();});
  main.querySelector('#share-filter-unseen').addEventListener('click',()=>{filterStatus=filterStatus==='unseen'?'all':'unseen';renderShareMain();});
  main.querySelector('#share-filter-seen').addEventListener('click',()=>{filterStatus=filterStatus==='hide-unseen'?'all':'hide-unseen';renderShareMain();});
  main.querySelector('#share-vb-list').addEventListener('click',()=>{cardLayout='cards-list';renderShareMain();});
  main.querySelector('#share-vb-grid').addEventListener('click',()=>{cardLayout='cards-grid';renderShareMain();});
  main.querySelector('#share-vb-compact').addEventListener('click',()=>{cardLayout='cards-compact';renderShareMain();});

  const entriesContainer=main.querySelector('#share-entries');
  const isCompact=cardLayout==='cards-compact',isGrid=cardLayout==='cards-grid';
  const listClass=isGrid?'entries-grid':isCompact?'entries-compact':'entries-list';

  entriesContainer.innerHTML=`<div class="${listClass}">
    ${entries.length===0
      ?`<div class="empty-state"><span class="empty-icon">${cat.icon}</span><h3>Aucun résultat</h3></div>`
      :entries.map((entry,idx)=>{
        const name=entry[nameCol?.id]||'(sans titre)';
        let progressBar='';
        const sucObt=Number(entry.succes||0),sucTot=Number(entry.succes_tot||0);
        if(sucTot>0){const pct=Math.min(100,Math.round((sucObt/sucTot)*100));const trophy=pct>=100?' 🏆':'';progressBar=`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;${pct>=100?'background:var(--success);':''}"></div></div><span class="progress-lbl">${sucObt}/${sucTot}${trophy}</span></div>`;}
        const fields=isCompact?'':visibleCols.map(col=>{
          const val=entry[col.id];if(val===null||val===undefined||val==='')return'';
          if(col.type==='rating'){const n=Number(val);return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-rating">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>`;}
          if(col.type==='textarea')return`<div class="entry-field entry-field-full"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val entry-text-preview">${esc(val)}</span></div>`;
          const display=col.type==='date'?formatDate(val):esc(String(val));
          return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val">${display}</span></div>`;
        }).filter(Boolean).join('');
        return`<div class="entry-card${isCompact?' entry-compact':''}" style="--card-accent:${cat.color};animation-delay:${Math.min(idx*.02,.3)}s">
          <div class="entry-card-header">
            <div class="entry-card-name">${esc(name)}</div>
            ${entry.favorite?'<span class="fav-badge" style="font-size:18px;">⭐</span>':''}
          </div>
          ${progressBar}
          <div class="entry-fields">${fields}</div>
        </div>`;
      }).join('')}
  </div>`;
}
