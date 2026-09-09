(async()=>{
 const kind=document.body.dataset.kind,shopping=kind==='shopping',table=shopping?'family_shopping':'family_outings';
 const status=document.getElementById('listStatus'),host=document.getElementById('listItems'),form=document.getElementById('itemForm');let busy=false,rows=[],client;
 function message(s){status.textContent=s;}
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
 function render(){host.replaceChildren();const pending=rows.filter(r=>!r[shopping?'done':'visited']).length;document.getElementById('listCount').textContent=shopping?'あと '+pending+' 個':'行きたい場所 '+pending+' 件';
  if(!rows.length){host.textContent=shopping?'買うものを追加して、ふたりで共有しましょう。':'気になる場所を、ひとつ保存してみましょう。';return;}
  [...rows].sort((a,b)=>Number(a[shopping?'done':'visited'])-Number(b[shopping?'done':'visited'])).forEach(row=>{
   const done=row[shopping?'done':'visited'],card=document.createElement('article');card.className='item'+(done?' done':'');
   const line=document.createElement('div');line.className='item-row';const check=button(done?'✓':shopping?'買った':'行った',()=>toggle(row,card));check.setAttribute('aria-pressed',String(done));check.setAttribute('aria-label',row.title+(done?'を未完了に戻す':shopping?'を買った':'に行った'));line.appendChild(check);const title=document.createElement(shopping?'span':'h2');title.className='item-title';title.textContent=row.title;line.appendChild(title);card.appendChild(line);
   if(!shopping){if(row.note){const note=document.createElement('p');note.textContent=row.note;card.appendChild(note);}const actions=document.createElement('div');actions.className='item-actions';
    const map=document.createElement('a');map.href=row.url||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row.title);map.target='_blank';map.rel='noopener noreferrer';map.textContent=row.url?'保存したリンクを開く':'地図で探す';actions.appendChild(map);
    const schedule=document.createElement('a');schedule.href='/calendar/?action=add&title='+encodeURIComponent(row.title)+'&place='+encodeURIComponent(row.title);schedule.textContent='予定にする';actions.appendChild(schedule);card.appendChild(actions);
   }
   const actions=document.createElement('div');actions.className='item-actions';actions.appendChild(button('削除',async()=>{if(!confirm('「'+row.title+'」を削除しますか？'))return;await mutate(()=>client.from(table).delete().eq('id',row.id).select('id').single());}));card.appendChild(actions);host.appendChild(card);
  });
 }
 async function load(){const {data,error}=await client.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;rows=data||[];render();}
 async function mutate(fn){if(busy)return false;busy=true;try{const {error}=await fn();if(error)throw error;await load();message('保存しました');return true;}catch{message('保存できませんでした。通信を確認してお試しください');return false;}finally{busy=false;}}
 async function toggle(row,card){if(busy)return;const key=shopping?'done':'visited',next=!row[key];card.style.opacity='.55';await mutate(()=>client.from(table).update({[key]:next}).eq('id',row.id).select('id').single());card.style.opacity='';}
 try{const cfg=await(await fetch('/config.json')).json();client=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);if(!(await FamilyAccount.requireSession(client)))return;await load();message('');
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;const title=document.getElementById('itemTitle').value.trim();if(!title)return;const record={title};if(!shopping){record.note=document.getElementById('itemNote').value.trim();record.url=document.getElementById('itemUrl').value.trim()||null;if(record.url){try{const u=new URL(record.url);if(!['https:','http:'].includes(u.protocol))throw Error();record.url=u.href;}catch{message('リンクは https:// から始まるURLを入力してください');return;}}}const submit=form.querySelector('[type=submit]');submit.disabled=true;const ok=await mutate(()=>client.from(table).insert(record).select('id').single());if(ok)form.reset();submit.disabled=false;};
  document.getElementById('listRefresh').onclick=async()=>{if(busy)return;try{await load();message('最新の情報に更新しました');}catch{message('読み込めませんでした');}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy)load().catch(()=>message('更新できませんでした'));});
 }catch{message('読み込めませんでした。再読み込みしてください');}
})();
