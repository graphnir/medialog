// ml-charts.js — Graphiques
'use strict';

function openStatsModal(){
  closeInlinePopup();openModal('modal-stats');
  const cat=getActiveCat();
  if(!cat){document.getElementById('stats-charts').innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Sélectionne une catégorie d\'abord.</p>';return;}
  renderStatsModal(cat);
}

function renderStatsModal(cat){
  const container=document.getElementById('stats-charts');
  const firstSelectCol=cat.columns.find(c=>c.type==='select')||cat.columns.find(c=>c.type==='text')||cat.columns[0];
  const hasTags=cat.entries.some(e=>e.tags?.length);
  const xOptions=(hasTags?[{id:'__tags__',name:'Tags'}]:[]).concat(cat.columns.filter(c=>c.type==='select'||c.type==='text'||c.type==='date')).map(c=>`<option value="${c.id}" ${c.id===firstSelectCol?.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const yOptions=cat.columns.filter(c=>c.type==='number'||c.type==='rating').map(c=>`<option value="${c.id}_avg">Moy. ${esc(c.name)}</option><option value="${c.id}_sum">Total ${esc(c.name)}</option>`).join('');
  container.innerHTML=`
    <div class="chart-builder" id="chart-builder-section">
      <div class="chart-builder-title">📐 Créer un graphique personnalisé</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center;">
        <select class="field-select" id="cb-type" style="flex:1;min-width:100px;">
          <option value="doughnut">Camembert</option>
          <option value="bar">Barres</option>
          <option value="line">Courbe</option>
        </select>
        <select class="field-select" id="cb-axis-x" style="flex:1;min-width:120px;">
          ${xOptions||'<option value="">— Aucune colonne —</option>'}
        </select>
      </div>
      <div id="cb-y-wrap" style="display:none;margin-bottom:8px;">
        <select class="field-select" id="cb-axis-y" style="width:100%;">
          <option value="count">Comptage (nombre d'entrées)</option>
          ${yOptions}
        </select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
        ${yOptions?`<button class="btn btn-ghost btn-sm" id="cb-toggle-y" style="font-size:12px;">+ Ajouter un axe Y</button>`:''}
        <button class="btn btn-primary btn-sm" id="cb-generate" style="margin-left:auto;">Générer</button>
      </div>
      <div id="cb-result"></div>
    </div>
    <div id="auto-charts-section"></div>`;

  document.getElementById('cb-toggle-y')?.addEventListener('click',()=>{
    const wrap=document.getElementById('cb-y-wrap');
    const btn=document.getElementById('cb-toggle-y');
    const visible=wrap.style.display!=='none';
    wrap.style.display=visible?'none':'';
    btn.textContent=visible?"+ Ajouter un axe Y":"− Retirer l'axe Y";
  });

  document.getElementById('cb-generate').addEventListener('click',()=>{
    const type=document.getElementById('cb-type').value;
    const axisX=document.getElementById('cb-axis-x').value;
    const yWrap=document.getElementById('cb-y-wrap');
    const axisY=yWrap?.style.display!=='none'?(document.getElementById('cb-axis-y')?.value||'count'):'count';
    const resultEl=document.getElementById('cb-result');
    if(!axisX){resultEl.innerHTML='<p style="color:var(--danger);font-size:13px;">Choisis une colonne pour l\'axe X.</p>';return;}
    const col=cat.columns.find(c=>c.id===axisX);
    const groups={};
    cat.entries.forEach(e=>{
      if(axisX==='__tags__'){
        (e.tags||['Sans tag']).forEach(t=>{if(!groups[t])groups[t]=[];groups[t].push(e);});
        return;
      }
      let key=e[axisX]||'—';
      if(col?.type==='date'&&key&&key!=='—')key=key.slice(0,7);
      if(!groups[key])groups[key]=[];
      groups[key].push(e);
    });
    if(axisX==='__tags__'){}// multi-value handled above
    const labels=Object.keys(groups).sort();
    let values;
    if(axisY==='count'){values=labels.map(l=>groups[l].length);}
    else{
      const[yColId,agg]=axisY.split('_');
      values=labels.map(l=>{
        const ns=groups[l].map(e=>Number(e[yColId]||0)).filter(n=>!isNaN(n));
        if(!ns.length)return 0;
        return agg==='avg'?+(ns.reduce((a,b)=>a+b,0)/ns.length).toFixed(2):ns.reduce((a,b)=>a+b,0);
      });
    }
    resultEl.innerHTML='<div style="position:relative;height:220px;margin-top:10px;"><canvas id="cb-canvas"></canvas></div>';
    const ctx=document.getElementById('cb-canvas').getContext('2d');
    const colors=['#7C6FE0','#E05252','#52C07A','#E09E52','#52A0E0','#C052E0','#52D4E0','#E05292'];
    const textColor='rgba(240,239,254,.65)',tickColor='rgba(240,239,254,.4)';
    new Chart(ctx,{type,data:{labels,datasets:[{data:values,backgroundColor:type==='line'?'transparent':labels.map((_,i)=>colors[i%colors.length]),borderColor:colors[0],borderWidth:type==='line'?2:0,fill:type==='line',tension:.3,pointBackgroundColor:colors[0]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==='doughnut',labels:{color:textColor,font:{size:11}}}},scales:type!=='doughnut'?{x:{ticks:{color:tickColor,font:{size:10}}},y:{ticks:{color:tickColor,font:{size:10}},beginAtZero:true}}:{}}});
  });

  setTimeout(()=>renderCharts(cat,document.getElementById('auto-charts-section')),100);
}

function renderCharts(cat,container){
  container=container||document.getElementById('stats-charts');
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
  // Pour les graphiques à barres/courbes avec beaucoup de données :
  // regrouper les petites valeurs en "Autres" si plus de 15 labels
  let finalLabels=[...labels],finalData=[...data];
  if(type!=='line'&&labels.length>15){
    // Trier par valeur décroissante, garder top 14, regrouper le reste
    const indexed=labels.map((l,i)=>({l,v:data[i]})).sort((a,b)=>b.v-a.v);
    const top=indexed.slice(0,14),rest=indexed.slice(14);
    finalLabels=top.map(x=>x.l);
    finalData=top.map(x=>x.v);
    if(rest.length>0){
      finalLabels.push(`Autres (${rest.length})`);
      finalData.push(rest.reduce((a,x)=>a+x.v,0));
    }
  }
  // Pour les courbes avec beaucoup de points : hauteur plus grande et scroll
  const needsScroll=type==='line'&&labels.length>20;
  const chartWidth=needsScroll?Math.max(600,labels.length*30):undefined;
  const wrap=document.createElement('div');wrap.className='chart-wrap';
  wrap.innerHTML=`<h4 class="chart-title">${title}</h4>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <div style="position:relative;height:220px;${chartWidth?`min-width:${chartWidth}px;`:''}" >
        <canvas></canvas>
      </div>
    </div>`;
  container.appendChild(wrap);
  const ctx=wrap.querySelector('canvas').getContext('2d');
  const tc2='rgba(240,239,254,.65)',kc2='rgba(240,239,254,.4)';
  new Chart(ctx,{type,data:{labels:finalLabels,datasets:[{data:finalData,backgroundColor:type==='line'?'transparent':finalLabels.map((_,i)=>colors[i%colors.length]),borderColor:colors[0],borderWidth:type==='line'?2:0,fill:type==='line',tension:.3,pointBackgroundColor:colors[0]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==='doughnut',labels:{color:tc2,font:{size:11}}}},scales:type!=='doughnut'?{x:{ticks:{color:kc2,font:{size:10},maxRotation:45,minRotation:0}},y:{ticks:{color:kc2,font:{size:10}},beginAtZero:true}}:{}}});
}

