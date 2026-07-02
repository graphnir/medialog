// ml-roulette.js — Roulette
'use strict';

let rouletteCriteria=[];

function openRouletteModal(){
  closeInlinePopup();
  const cats=state.categories;
  const catOptions=cats.map(c=>`<option value="${c.id}" ${c.id===activeCatId?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join('');
  rouletteCriteria=[];
  document.getElementById('modal-roulette-body').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="font-family:var(--font-display);font-size:16px;font-weight:700;">Roulette</h3>
      <button class="btn-help" data-help="roulette" title="Aide roulette">?</button>
    </div>
    <div class="field-group">
      <label class="field-label">Catégorie</label>
      <select class="field-select field-input" id="roulette-cat">${catOptions}</select>
    </div>

    <div class="roulette-quick-btn-wrap">
      <button class="btn btn-primary" id="btn-quick-spin" style="width:100%;font-size:17px;padding:14px;">
        Choix au hasard <span style="font-size:13px;opacity:.7;">(œuvres non vues)</span>
      </button>
    </div>

    <div class="roulette-advanced-toggle" id="roulette-advanced-toggle">
      <button class="btn btn-ghost" id="btn-toggle-advanced" style="width:100%;font-size:13px;">▾ Critères avancés</button>
    </div>
    <div id="roulette-advanced" style="display:none;">
      <div id="roulette-criteria-list"></div>
      <button class="btn btn-ghost btn-sm" id="btn-add-criterion" style="margin-top:8px;">+ Ajouter un critère</button>
      <div style="text-align:center;margin-top:12px;">
        <button class="btn btn-primary" id="btn-advanced-spin" style="font-size:16px;padding:12px 32px;">Lancer avec ces critères</button>
      </div>
    </div>

    <div class="roulette-container" id="roulette-container" style="height:130px;overflow:hidden;">
      <div class="roulette-icon" id="roulette-icon-placeholder" style="opacity:.3;">🎰</div>
      <div id="roulette-result"></div>
    </div>`;

  // Quick spin (bouton principal)
  document.getElementById('btn-quick-spin').addEventListener('click',()=>{
    const catId=document.getElementById('roulette-cat').value;
    spinRoulette(catId,[{type:'unseen'}]);
  });

  // Toggle avancé
  document.getElementById('btn-toggle-advanced').addEventListener('click',()=>{
    const adv=document.getElementById('roulette-advanced');
    const spinWrap=document.getElementById('roulette-advanced-spin-wrap');
    const isOpen=adv.style.display!=='none';
    adv.style.display=isOpen?'none':'';
    spinWrap.style.display=isOpen?'none':'';
    document.getElementById('btn-toggle-advanced').textContent=isOpen?'▾ Critères avancés':'▴ Critères avancés';
    if(!isOpen)renderRouletteCriteria();
  });

  document.getElementById('btn-add-criterion').addEventListener('click',()=>{
    rouletteCriteria.push({colId:'',operator:'',value:''});
    renderRouletteCriteria();
  });

  document.getElementById('btn-advanced-spin').addEventListener('click',()=>{
    const catId=document.getElementById('roulette-cat').value;
    spinRoulette(catId,rouletteCriteria);
  });

  // Help button
  document.getElementById('modal-roulette-body').querySelectorAll('.btn-help').forEach(btn=>{
    btn.addEventListener('click',()=>showHelpPopup(btn.dataset.help,btn));
  });

  openModal('modal-roulette');
}

function renderRouletteCriteria(){
  const cat=getCat(document.getElementById('roulette-cat')?.value);
  if(!cat)return;
  const list=document.getElementById('roulette-criteria-list');
  if(!list)return;
  list.innerHTML=rouletteCriteria.map((crit,i)=>{
    const colOptions=`<option value="" disabled ${!crit.colId?'selected':''}>— Choisir une colonne —</option>`+[{id:'__tags__',name:'Tags',type:'tags'},...cat.columns.filter(c=>!c.required)].map(col=>`<option value="${col.id}" ${crit.colId===col.id?'selected':''}>${esc(col.name)}</option>`).join('');
    const col=cat.columns.find(c=>c.id===crit.colId);
    let opOptions='',valueField='';
    if(col){
      if(col.id==='__tags__'){
        opOptions='';
        const catTags=[...new Set(c.entries.flatMap(e=>e.tags||[]))].sort();
        valueField=`<div class="roul-multi-select" data-ci="${i}">${catTags.map(t=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;padding:3px 0;"><input type="checkbox" value="${esc(t)}" ${(Array.isArray(crit.value)&&crit.value.includes(t))?'checked':''}/> ${esc(t)}</label>`).join('')}</div>`;
      }else if(col.type==='text'||col.type==='textarea'){
        opOptions=`<option value="contains" ${crit.operator==='contains'?'selected':''}>contient</option><option value="notcontains" ${crit.operator==='notcontains'?'selected':''}>ne contient pas</option>`;
        valueField=`<input type="text" class="field-input roul-val" data-ci="${i}" value="${esc(crit.value||'')}" placeholder="mot-clé…"/>`;
      }else if(col.type==='select'&&col.options){
        opOptions='';
        valueField=`<div class="roul-multi-select" data-ci="${i}">${col.options.map(o=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;padding:3px 0;"><input type="checkbox" value="${esc(o)}" ${(Array.isArray(crit.value)&&crit.value.includes(o))?'checked':''}/> ${esc(o)}</label>`).join('')}</div>`;
      }else if(col.type==='number'||col.type==='rating'){
        const lbl=col.type==='rating'?'★':'';
        opOptions=`<option value="gte" ${crit.operator==='gte'?'selected':''}>≥</option><option value="lte" ${crit.operator==='lte'?'selected':''}>≤</option><option value="eq" ${crit.operator==='eq'?'selected':''}>= </option><option value="between" ${crit.operator==='between'?'selected':''}>entre</option>`;
        valueField=col.type==='rating'
          ?`<select class="field-select roul-val" data-ci="${i}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${crit.value==n?'selected':''}>${n}${lbl}</option>`).join('')}</select>`
          :`<input type="number" class="field-input roul-val" data-ci="${i}" value="${crit.value||''}" placeholder="valeur…" style="width:80px;"/>`;
      }else if(col.type==='date'){
        opOptions=`<option value="before" ${crit.operator==='before'?'selected':''}>avant</option><option value="after" ${crit.operator==='after'?'selected':''}>après</option><option value="thismonth" ${crit.operator==='thismonth'?'selected':''}>ce mois</option><option value="thisyear" ${crit.operator==='thisyear'?'selected':''}>cette année</option>`;
        valueField=`<input type="date" class="field-input roul-val" data-ci="${i}" value="${crit.value||''}"/>`;
      }else if(col.id==='favorite'||col.name.toLowerCase()==='favori'){
        opOptions=`<option value="yes">oui</option><option value="no">non</option>`;
      }
    }
    return`<div class="roul-crit-row" style="display:flex;flex-direction:column;gap:6px;background:var(--bg3);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px;">
      <div style="display:flex;gap:6px;align-items:center;">
        <select class="field-select field-input roul-col-sel" data-ci="${i}" style="flex:1;">${colOptions||'<option>— Choisir —</option>'}</select>
        <select class="field-select field-input roul-op-sel" data-ci="${i}" style="flex:1;">${opOptions||'<option>—</option>'}</select>
        <button class="btn-del" data-del="${i}">✕</button>
      </div>
      ${valueField?`<div>${valueField}</div>`:''}
    </div>`;
  }).join('');

  list.querySelectorAll('.roul-col-sel').forEach(el=>el.addEventListener('change',e=>{rouletteCriteria[+e.target.dataset.ci].colId=e.target.value;rouletteCriteria[+e.target.dataset.ci].operator='';rouletteCriteria[+e.target.dataset.ci].value='';renderRouletteCriteria();}));
  list.querySelectorAll('.roul-op-sel').forEach(el=>el.addEventListener('change',e=>{rouletteCriteria[+e.target.dataset.ci].operator=e.target.value;}));
  list.querySelectorAll('.roul-val').forEach(el=>el.addEventListener('input',e=>{rouletteCriteria[+e.target.dataset.ci].value=e.target.value;}));
  list.querySelectorAll('.roul-multi-select').forEach(wrap=>{
    wrap.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.addEventListener('change',()=>{
      const ci=+wrap.dataset.ci;
      rouletteCriteria[ci].value=Array.from(wrap.querySelectorAll('input:checked')).map(c=>c.value);
    }));
  });
  list.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',e=>{rouletteCriteria.splice(+e.target.dataset.del,1);renderRouletteCriteria();}));
}

function spinRoulette(catId,criteria){
  const c=getCat(catId);if(!c||!c.entries.length){alert('Aucune entrée.');return;}
  let pool=[...c.entries];

  for(const crit of criteria){
    if(crit.type==='unseen'){pool=pool.filter(e=>isUnseen(e));continue;}
    const col=c.columns.find(col=>col.id===crit.colId);
    if(!col||!crit.operator)continue;
    pool=pool.filter(e=>{
      const val=e[crit.colId];
      if(col.id==='__tags__'){
        opOptions='';
        const catTags=[...new Set(c.entries.flatMap(e=>e.tags||[]))].sort();
        valueField=`<div class="roul-multi-select" data-ci="${i}">${catTags.map(t=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;padding:3px 0;"><input type="checkbox" value="${esc(t)}" ${(Array.isArray(crit.value)&&crit.value.includes(t))?'checked':''}/> ${esc(t)}</label>`).join('')}</div>`;
      }else if(col.type==='text'||col.type==='textarea'){
        const v=String(val||'').toLowerCase(),kw=String(crit.value||'').toLowerCase();
        return crit.operator==='contains'?v.includes(kw):!v.includes(kw);
      }
      if(col.type==='select')return Array.isArray(crit.value)?crit.value.includes(val):val===crit.value;
      if(col.type==='number'||col.type==='rating'){
        const n=Number(val||0),v=Number(crit.value||0);
        if(crit.operator==='gte')return n>=v;
        if(crit.operator==='lte')return n<=v;
        if(crit.operator==='eq')return n===v;
        if(crit.operator==='between'){const[a,b]=(crit.value||'').toString().split('-').map(Number);return n>=a&&n<=b;}
      }
      if(col.type==='date'&&val){
        const d=parseDate(val),now=new Date();
        if(crit.operator==='before')return d<parseDate(crit.value||'');
        if(crit.operator==='after')return d>parseDate(crit.value||'');
        if(crit.operator==='thismonth'){const dt=new Date(d);return dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear();}
        if(crit.operator==='thisyear'){return new Date(d).getFullYear()===now.getFullYear();}
      }
      return true;
    });
  }

  if(!pool.length){
    const res=document.getElementById('roulette-result');res.style.display='';
    res.innerHTML='<div class="roulette-winner" style="color:var(--text3);">Aucune entrée ne correspond à ces critères.</div>';
    document.getElementById('roulette-icon-placeholder').style.display='none';
    return;
  }

  const nameCol=c.columns.find(col=>col.required&&col.type==='text')||c.columns[0];
  const resultEl=document.getElementById('roulette-result');
  resultEl.style.display='';
  document.getElementById('roulette-icon-placeholder').style.display='none';
  let spins=0;
  const interval=setInterval(()=>{
    const r=pool[Math.floor(Math.random()*pool.length)];
    resultEl.innerHTML=`<div class="roulette-spinning">${esc(r[nameCol?.id]||'?')}</div>`;
    spins++;
    if(spins>=25){
      clearInterval(interval);
      const winner=pool[Math.floor(Math.random()*pool.length)];
      const winnerName=winner[nameCol?.id]||'?';
      resultEl.innerHTML=`<div class="roulette-winner" title="${esc(winnerName)}">🎉 ${esc(winnerName)}</div>`;
      resultEl.querySelector('.roulette-winner').addEventListener('click',()=>{
        alert(winnerName);
      });
    }
  },80);
}

