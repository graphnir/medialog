// ml-table.js — Vue tableur, sélection cellules
'use strict';

function renderTableView(cat,entries,nameCol){
  const container=document.getElementById('view-container');
  const newRowCells=cat.columns.map(col=>`<td class="tbl-td tbl-new-cell" data-col="${col.id}" contenteditable="${col.type!=='rating'?'true':'false'}" data-type="${col.type}" placeholder="${esc(col.name)}…"></td>`).join('');

  container.innerHTML=`
    <div class="tbl-toolbar-sticky" id="tbl-sticky-bar">
      <div class="tbl-toolbar-left">
        <button class="filter-btn ${tableSelectMode?'active':''}" id="btn-tbl-select">☑ Sélection</button>
      </div>
      <div class="tbl-toolbar-right" id="tbl-selection-actions" style="display:none;">
        <span id="tbl-selected-count" style="font-size:13px;color:var(--text2);"></span>
        <button class="btn btn-ghost btn-sm" id="btn-tbl-fill">Remplir le champ</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" id="btn-tbl-clear-sel">Vider</button>
        <button class="btn btn-ghost btn-sm" id="btn-tbl-deselect">✕</button>
      </div>
    </div>
    <div class="table-wrapper" id="table-scroll-wrap">
      <table class="tbl" id="main-tbl">
        <thead id="tbl-head"><tr>
          <th class="tbl-th tbl-th-num">#</th>
          <th class="tbl-th" style="width:36px;">⭐</th>
          ${cat.columns.map(c=>`<th class="tbl-th">${esc(c.name)}</th>`).join('')}
          <th class="tbl-th">Tags</th>
          <th class="tbl-th tbl-th-act"></th>
        </tr></thead>
        <tbody id="tbl-body">
          ${entries.map((entry,idx)=>{
            const cells=cat.columns.map(col=>{
              const val=entry[col.id],raw=val===null||val===undefined||val===''?'':String(val);
              const cellKey=`${entry.id}:${col.id}`;
              const isCellSel=tableSelected.has(cellKey);
              const selClass=tableSelectMode&&isCellSel?' tbl-cell-selected':'';
              const selectableClass=tableSelectMode?' tbl-cell-selectable':'';
              if(col.type==='text'||col.type==='number'||col.type==='textarea'){
                return`<td class="tbl-td tbl-editable${selClass}${selectableClass}" data-col="${col.id}" data-entry="${entry.id}" data-type="${col.type}" contenteditable="${!tableSelectMode}">${esc(raw)}</td>`;
              }
              const display=raw===''?'':col.type==='date'?formatDate(val):col.type==='rating'?('★'.repeat(Number(val))+'☆'.repeat(5-Number(val))):esc(raw);
              return`<td class="tbl-td tbl-cell-click${selClass}${selectableClass}" data-col="${col.id}" data-entry="${entry.id}">${display}</td>`;
            }).join('');
            return`<tr class="tbl-row" data-entry-id="${entry.id}">
              <td class="tbl-td tbl-num">${idx+1}</td>
              <td class="tbl-td tbl-fav-cell"><button class="fav-btn ${entry.favorite?'active':''}" data-entry="${entry.id}">${entry.favorite?'⭐':'☆'}</button></td>
              ${cells}
              <td class="tbl-td tbl-tags-cell" data-entry="${entry.id}" style="cursor:pointer;" title="Cliquer pour éditer">
                ${(entry.tags||[]).map(t=>`<span class="entry-tag">${esc(t)}</span>`).join(' ')||'<span style="color:var(--text3);font-size:12px;">+</span>'}
              </td>
              <td class="tbl-td"><button class="tbl-del-btn" data-entry="${entry.id}">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr class="tbl-new-row" id="tbl-new-row">
          <td class="tbl-td tbl-num" style="color:var(--text3);">+</td>
          <td class="tbl-td"></td>
          ${newRowCells}
          <td class="tbl-td"><button class="tbl-add-btn" id="tbl-add-row-btn">Ajouter</button></td>
        </tr></tfoot>
      </table>
    </div>
    <p class="tbl-hint">${tableSelectMode?'Clique une cellule pour la sélectionner, Maj+clic pour étendre la sélection.':"Texte/nombres : éditable directement. Dates/notes/listes : cliquer. En-têtes et barre d'outils restent visibles."}</p>`;

  // Mode sélection toggle
  document.getElementById('btn-tbl-select').addEventListener('click',()=>{
    tableSelectMode=!tableSelectMode;tableSelected.clear();renderContent();
  });

  if(tableSelectMode){
    let lastClickedKey=null;
    const selectableCells=Array.from(container.querySelectorAll('.tbl-cell-selectable'));

    function cellKeyList(){return selectableCells.map(td=>`${td.dataset.entry}:${td.dataset.col}`);}

    function refreshCellClasses(){
      selectableCells.forEach(td=>{
        const key=`${td.dataset.entry}:${td.dataset.col}`;
        td.classList.toggle('tbl-cell-selected',tableSelected.has(key));
      });
      updateSelectionActions();
    }

    selectableCells.forEach(td=>{
      td.addEventListener('click',e=>{
        const key=`${td.dataset.entry}:${td.dataset.col}`;
        if(e.shiftKey&&lastClickedKey){
          const keys=cellKeyList();
          const i1=keys.indexOf(lastClickedKey),i2=keys.indexOf(key);
          if(i1!==-1&&i2!==-1){const[from,to]=i1<i2?[i1,i2]:[i2,i1];for(let k=from;k<=to;k++)tableSelected.add(keys[k]);}
        }else if(e.ctrlKey||e.metaKey){
          if(tableSelected.has(key))tableSelected.delete(key);else tableSelected.add(key);
        }else{
          // Clic simple sans modificateur : toggle la cellule
          if(tableSelected.has(key))tableSelected.delete(key);else tableSelected.add(key);
        }
        lastClickedKey=key;
        refreshCellClasses();
      });
    });
    refreshCellClasses();

    // Écriture dans toutes les cellules sélectionnées via mini popup
    function handleMultiCellTyping(e){
      if(!tableSelectMode||!tableSelected.size)return;
      if(document.activeElement&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;
      const ignored=['Tab','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
        'Shift','Control','Meta','Alt','CapsLock','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
      if(ignored.includes(e.key))return;
      const c=getActiveCat();
      const allEditable=[...tableSelected].every(key=>{
        const[,colId]=key.split(':');
        const col=c.columns.find(co=>co.id===colId);
        return col&&(col.type==='text'||col.type==='number'||col.type==='textarea');
      });
      if(!allEditable)return;
      if(e.key==='Backspace'||e.key==='Delete'){
        e.preventDefault();
        tableSelected.forEach(key=>{
          const[entryId,colId]=key.split(':');
          const entry=c.entries.find(en=>en.id===entryId);
          const col=c.columns.find(co=>co.id===colId);
          if(entry&&col)entry[colId]=col.type==='number'?null:'';
        });
        scheduleSave();renderContent();return;
      }
      e.preventDefault();
      const existing=document.getElementById('multi-cell-input-wrap');
      if(existing)existing.remove();
      const wrap=document.createElement('div');
      wrap.id='multi-cell-input-wrap';
      wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
      const initialChar=e.key.length===1?e.key:'';
      wrap.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--accent);border-radius:var(--radius);padding:20px;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,.5);">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Écrire dans ${tableSelected.size} cellule(s)</div>
        <input type="text" id="multi-cell-input" class="field-input" value="${initialChar}" autocomplete="off" style="margin-bottom:12px;"/>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" id="mci-cancel">Annuler</button>
          <button class="btn btn-primary btn-sm" id="mci-ok">Appliquer</button>
        </div>
      </div>`;
      document.body.appendChild(wrap);
      const inp=wrap.querySelector('#multi-cell-input');
      setTimeout(()=>{inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);},30);
      function applyMultiCell(){
        const val=inp.value;
        tableSelected.forEach(key=>{
          const[entryId,colId]=key.split(':');
          const entry=c.entries.find(en=>en.id===entryId);
          const col=c.columns.find(co=>co.id===colId);
          if(!entry||!col)return;
          entry[colId]=col.type==='number'?(parseFloat(val)||null):val;
        });
        scheduleSave();wrap.remove();renderContent();
      }
      wrap.querySelector('#mci-ok').addEventListener('click',applyMultiCell);
      wrap.querySelector('#mci-cancel').addEventListener('click',()=>wrap.remove());
      inp.addEventListener('keydown',e2=>{if(e2.key==='Enter'){e2.preventDefault();applyMultiCell();}if(e2.key==='Escape')wrap.remove();});
    }
    document.addEventListener('keydown',handleMultiCellTyping);
    const cleanupBtn=document.getElementById('btn-tbl-select');
    const cleanup=()=>{document.removeEventListener('keydown',handleMultiCellTyping);cleanupBtn.removeEventListener('click',cleanup);};
    cleanupBtn.addEventListener('click',cleanup);

    document.getElementById('btn-tbl-deselect').addEventListener('click',()=>{tableSelected.clear();refreshCellClasses();});
    document.getElementById('btn-tbl-clear-sel').addEventListener('click',()=>{
      if(!tableSelected.size||!confirm(`Vider le contenu de ${tableSelected.size} cellule(s) ?`))return;
      const c=getActiveCat();
      tableSelected.forEach(key=>{
        const[entryId,colId]=key.split(':');
        const entry=c.entries.find(e=>e.id===entryId);
        const col=c.columns.find(co=>co.id===colId);
        if(entry&&col)entry[colId]=col.type==='number'||col.type==='rating'?null:'';
      });
      scheduleSave();renderContent();
    });
    document.getElementById('btn-tbl-fill').addEventListener('click',()=>openFillSelectionModal(cat));
  }

  // Édition directe (désactivée en mode sélection)
  if(!tableSelectMode){
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
  }

  container.querySelectorAll('.fav-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const entry=getActiveCat().entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;entry.favorite=!entry.favorite;scheduleSave();renderContent();}));
  container.querySelectorAll('.tbl-del-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();if(!confirm('Supprimer?'))return;const c=getActiveCat();c.entries=c.entries.filter(en=>en.id!==btn.dataset.entry);scheduleSave();render();}));

  // Ajouter ligne
  container.querySelector('#tbl-add-row-btn').addEventListener('click',()=>{
    const cells=container.querySelectorAll('.tbl-new-cell');
    const entry={id:uid(),_created:Date.now(),_order:cat.entries.length};
    cells.forEach(cell=>{const col=cat.columns.find(c=>c.id===cell.dataset.col);let val=cell.textContent.trim();if(val){if(col.type==='number')val=parseFloat(val)||null;if(col.type==='rating')val=Math.min(5,Math.max(0,parseInt(val)||0));if(col.type==='date')val=toInputDate(val)||val;entry[col.id]=val;}else entry[col.id]=col.type==='number'||col.type==='rating'?null:'';});
    const nameC=cat.columns.find(c=>c.required);if(!entry[nameC?.id]){alert('Le titre est obligatoire.');return;}
    cat.entries.push(entry);scheduleSave();renderContent();
  });
  container.querySelectorAll('.tbl-new-cell').forEach((cell,i,all)=>{
    cell.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();all[i+1]?.focus();}if(e.key==='Enter'){e.preventDefault();container.querySelector('#tbl-add-row-btn').click();}});
    cell.addEventListener('paste',e=>{e.preventDefault();const text=(e.clipboardData||window.clipboardData).getData('text');if(text.includes('\n'))importTSV(text,cat);else document.execCommand('insertText',false,cell.dataset.type==='date'?(toInputDate(text.trim())||text.trim()):text);});
  });
}

function updateSelectionActions(){
  const actions=document.getElementById('tbl-selection-actions');
  const count=document.getElementById('tbl-selected-count');
  if(!actions||!count)return;
  if(tableSelected.size>0){actions.style.display='flex';count.textContent=`${tableSelected.size} cellule(s) sélectionnée(s)`;}
  else actions.style.display='none';
}

function openFillSelectionModal(cat){
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML=`<div style="background:var(--bg2);border-radius:var(--radius);padding:24px;width:100%;max-width:380px;border:1px solid var(--border);">
    <h3 style="font-family:var(--font-display);margin-bottom:8px;">Remplir ${tableSelected.size} cellule(s)</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:16px;">La même valeur sera appliquée à toutes les cellules sélectionnées (types compatibles uniquement).</p>
    <div class="field-group"><label class="field-label">Valeur</label><input type="text" class="field-input" id="fill-val" placeholder="Nouvelle valeur…"/></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-ghost" id="fill-cancel">Annuler</button>
      <button class="btn btn-primary" id="fill-ok">Appliquer</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#fill-cancel').addEventListener('click',()=>modal.remove());
  modal.querySelector('#fill-ok').addEventListener('click',()=>{
    const val=modal.querySelector('#fill-val').value.trim();
    tableSelected.forEach(key=>{
      const[entryId,colId]=key.split(':');
      const entry=cat.entries.find(e=>e.id===entryId);
      const col=cat.columns.find(c=>c.id===colId);
      if(!entry||!col)return;
      let v=val;
      if(col.type==='number')v=parseFloat(val)||null;
      if(col.type==='rating')v=Math.min(5,Math.max(0,parseInt(val)||0));
      entry[colId]=v;
    });
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

