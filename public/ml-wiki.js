// ml-wiki.js — Intégration Wikipedia
'use strict';

const WIKI_MEDIA_TYPES={
  'film':    {label:'Film',fields:['réalisateur','genre','durée','date de sortie','pays','langue','série','producteur']},
  'serie':   {label:'Série',fields:['créateur','genre','chaîne','saisons','épisodes','date de sortie','pays']},
  'jeu':     {label:'Jeu vidéo',fields:['développeur','éditeur','genre','plateforme','date de sortie','série']},
  'manga':   {label:'Manga',fields:['auteur','dessinateur','genre','éditeur','volumes','date de sortie','magazine']},
  'livre':   {label:'Livre',fields:['auteur','genre','éditeur','date de sortie','pages','série']},
  'comics':  {label:'Comics',fields:['auteur','dessinateur','genre','éditeur','numéros','univers']},
  'musique': {label:'Musique',fields:['artiste','genre','label','date de sortie','album','producteur']},
  'generic': {label:'Générique',fields:['créateur','genre','date de sortie','pays','langue']},
};


async function wikiSearch(query, lang='fr', mediaType='generic'){
  const d=await API.wikiSearch(query,lang,mediaType);
  return d.results||[];
}

async function wikiExtract(title, lang, activeFields, mediaType='generic'){
  return await API.wikiExtract(title,lang,activeFields.join(','),mediaType);
}

function openWikiDisambig(results, onSelect){
  const existing=document.getElementById('wiki-disambig-wrap');if(existing)existing.remove();
  const wrap=document.createElement('div');
  wrap.id='wiki-disambig-wrap';
  wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:flex-end;justify-content:center;padding:0;';
  wrap.innerHTML=`<div style="background:var(--bg2);border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:70vh;display:flex;flex-direction:column;border:1px solid var(--border);">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-family:var(--font-display);font-weight:700;">Plusieurs pages trouvées</div>
    <div style="overflow-y:auto;flex:1;padding:12px;">
      ${results.map((r,i)=>`<div class="wiki-result-item" data-i="${i}" style="display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;transition:background .12s;">
        ${r.thumbnail?`<img src="${esc(r.thumbnail)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;"/>` : `<div style="font-size:24px;flex-shrink:0;">${r.lang==='fr'?'🇫🇷':r.lang==='en'?'🇬🇧':r.lang==='es'?'🇪🇸':r.lang==='de'?'🇩🇪':r.lang==='ja'?'🇯🇵':'🌐'}</div>`}
        <div><div style="font-weight:600;font-size:14px;">${esc(r.title)}</div><div style="font-size:12px;color:var(--text3);margin-top:3px;">${esc(r.snippet)}</div></div>
      </div>`).join('')}
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);"><button class="btn btn-ghost" id="wiki-disambig-cancel" style="width:100%;">Annuler</button></div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('.wiki-result-item').forEach((item,i)=>{
    item.addEventListener('mouseenter',()=>item.style.background='var(--bg3)');
    item.addEventListener('mouseleave',()=>item.style.background='');
    item.addEventListener('click',()=>{wrap.remove();onSelect(results[i]);});
  });
  wrap.querySelector('#wiki-disambig-cancel').addEventListener('click',()=>wrap.remove());
}

function openWikiPreview(data, columnMappings, onImport, cat){
  const existing=document.getElementById('wiki-preview-wrap');if(existing)existing.remove();
  const mappedFields=Object.entries(columnMappings).filter(([wf])=>data.data[wf]!==undefined&&!wf.startsWith('_'));
  if(!mappedFields.length){alert('Aucun champ trouvé sur Wikipedia pour tes colonnes actives.');return;}
  const wrap=document.createElement('div');
  wrap.id='wiki-preview-wrap';
  wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:flex-end;justify-content:center;';
  wrap.innerHTML=`<div style="background:var(--bg2);border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:75vh;display:flex;flex-direction:column;border:1px solid var(--border);">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
      <div style="font-family:var(--font-display);font-weight:700;margin-bottom:4px;">Données trouvées sur Wikipédia</div>
      <div style="font-size:12px;color:var(--text3);">Coche les champs à importer</div>
    </div>
    <div style="overflow-y:auto;flex:1;padding:12px;">
      ${mappedFields.map(([wf,colId])=>`<label style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;">
        <input type="checkbox" data-wf="${esc(wf)}" data-col="${esc(colId)}" checked style="flex-shrink:0;width:16px;height:16px;"/>
        <div><div style="font-size:12px;color:var(--text3);">${esc(wf)}</div><div style="font-size:14px;font-weight:500;">${esc(String(data.data[wf]))}</div></div>
      </label>`).join('')}
      ${data.missingFields?.length?`<div style="font-size:12px;color:var(--text3);margin-top:8px;">Non trouvé : ${data.missingFields.map(esc).join(', ')}</div>`:''}
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;">
      <button class="btn btn-ghost" id="wiki-preview-cancel" style="flex:1;">Annuler</button>
      <button class="btn btn-primary" id="wiki-preview-import" style="flex:1;">Importer</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);

  wrap.querySelector('#wiki-preview-cancel').addEventListener('click',()=>wrap.remove());
  wrap.querySelector('#wiki-preview-import').addEventListener('click',()=>{
    const toImport={};
    wrap.querySelectorAll('input[type=checkbox]:checked').forEach(cb=>{
      const wf=cb.dataset.wf,colId=cb.dataset.col;
      if(!data.data[wf])return;
      const col=cat?.columns?.find(c=>c.id===colId);
      let val=data.data[wf];
      // Conversion selon le type de colonne
      const strVal=String(val).trim();
      if(col?.type==='date'){
        // "2021" → "2021-01-01", "2021-05-12" → "2021-05-12", "DD/MM/YYYY" → "YYYY-MM-DD"
        const converted=toInputDate(strVal);
        val=converted||(strVal.match(/^\d{4}$/)?strVal+'-01-01':'');
      }else if(col?.type==='number'){
        val=parseFloat(strVal.replace(',','.'))||null;
      }
      toImport[colId]=val;
    });
    wrap.remove();
    onImport(toImport);
  });
}

async function triggerWikiSearch(cat){
  // Toujours lire la catégorie courante pour avoir les associations à jour
  const currentCat=getActiveCat()||cat;
  const titleCol=currentCat.columns.find(c=>c.required&&c.type==='text')||currentCat.columns[0];
  const titleEl=document.getElementById(`field-${titleCol?.id}`);
  const title=titleEl?.value?.trim();
  if(!title){alert("Saisis d'abord le titre de l'œuvre.");return;}

  // Colonnes avec mapping wikipedia actif
  const columnMappings={};
  currentCat.columns.forEach(col=>{if(col.wikiField)columnMappings[col.wikiField]=col.id;});
  if(!Object.keys(columnMappings).length){alert("Aucune colonne n'est associée à un champ Wikipédia. Active le mode Wikipedia dans Colonnes et sauvegarde.");return;}

  const btn=document.getElementById('btn-wiki-search');
  if(btn){btn.textContent='Recherche…';btn.disabled=true;}

  try{
    const mediaType=currentCat.wikiMediaType||'generic';
    const results=await wikiSearch(title,'fr',mediaType);
    if(!results.length){
      const enResults=await wikiSearch(title,'en',mediaType);
      if(!enResults.length){alert('Aucun résultat trouvé sur Wikipédia pour ce titre.');return;}
      results.push(...enResults);
    }

    const proceed=async(result)=>{
      if(btn){btn.textContent='Extraction…';}
      const activeFields=Object.keys(columnMappings);
      const data=await wikiExtract(result.title,result.lang,activeFields,currentCat.wikiMediaType||'generic');
      openWikiPreview(data,columnMappings,(toImport)=>{
        Object.entries(toImport).forEach(([colId,val])=>{
          const el=document.getElementById(`field-${colId}`);
          if(el)el.value=val;
        });
        // Suggestion de nom sous le champ titre (après import)
        const WIKI_DISAMBIG_SUFFIXES=/\s*\((film|films|série|séries|série télévisée|jeu vidéo|jeux vidéo|manga|roman|album|bande dessinée|bd|comics|musique|movie|movies|film series|TV series|television series|video game|anime|OVA|ONA|light novel)s?\)\s*$/i;
        const wikiT=(data.data?._wikiTitle||'').replace(WIKI_DISAMBIG_SUFFIXES,'').trim();
        const titleColId=currentCat.columns.find(c=>c.required&&c.type==='text')?.id;
        console.log('[DEBUG SUGG] wikiT:', wikiT, 'titleColId:', titleColId);
        if(wikiT&&titleColId){
          const titleEl=document.getElementById('field-'+titleColId);
          const fieldWrap=document.getElementById('field-wrap-'+titleColId)||titleEl?.parentNode;
          console.log('[DEBUG SUGG] titleEl:', titleEl, 'fieldWrap:', fieldWrap, 'currentTitle:', titleEl?.value);
          if(titleEl&&fieldWrap&&wikiT!==titleEl.value){
            const existSugg=document.getElementById('wiki-name-suggest');
            if(existSugg)existSugg.remove();
            const sugg=document.createElement('div');
            sugg.id='wiki-name-suggest';
            sugg.style.cssText='font-size:12px;color:var(--text3);margin-top:6px;cursor:pointer;padding:6px 10px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);';
            sugg.innerHTML='Nom Wikipedia : <span style="color:var(--accent);font-weight:500;">'+esc(wikiT)+'</span> <span style="opacity:.5;font-size:11px;"> — cliquer pour utiliser</span>';
            sugg.addEventListener('click',()=>{titleEl.value=wikiT;sugg.style.opacity='.4';sugg.style.pointerEvents='none';sugg.innerHTML='✓ Nom mis à jour';});
            fieldWrap.appendChild(sugg);
            console.log('[DEBUG SUGG] suggestion ajoutée');
          }else{
            console.log('[DEBUG SUGG] condition non remplie — titleEl:', !!titleEl, 'fieldWrap:', !!fieldWrap, 'même titre:', wikiT.toLowerCase()===titleEl?.value?.toLowerCase());
          }
        }
      },currentCat);
    };

    if(results.length===1){
      await proceed(results[0]);
    }else{
      openWikiDisambig(results,proceed);
    }
  }catch(e){alert('Erreur Wikipedia : '+e.message);}
  finally{if(btn){btn.textContent='🔍 Remplir depuis Wikipédia';btn.disabled=false;}}
}

