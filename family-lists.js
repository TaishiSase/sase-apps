(async()=>{
 const kind=document.body.dataset.kind,shopping=kind==='shopping',table=shopping?'family_shopping':'family_outings';
 const status=document.getElementById('listStatus'),host=document.getElementById('listItems'),form=document.getElementById('itemForm');let busy=false,rows=[],client,editingId=null;
 const submit=form.querySelector('[type=submit]');let filter='pending',query='';
 const tools=document.createElement('div');tools.className='list-tools';
 const search=document.createElement('input');search.type='search';search.placeholder=shopping?'買うものを検索':'場所やメモを検索';search.setAttribute('aria-label',search.placeholder);search.addEventListener('input',()=>{query=search.value.trim().toLocaleLowerCase();render();});tools.appendChild(search);
 const filters=document.createElement('div');filters.className='list-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','表示を切り替え');
 [['pending',shopping?'未購入':'行きたい'],['done',shopping?'購入済み':'行った'],['all','すべて']].forEach(([value,label])=>{const b=button(label,()=>{filter=value;render();});b.dataset.filter=value;b.dataset.label=label;filters.appendChild(b);});tools.appendChild(filters);host.before(tools);
 const cancel=button('編集をやめる',()=>{if(!busy)resetEditor();});cancel.hidden=true;form.appendChild(cancel);
 function resetEditor(){editingId=null;form.reset();submit.textContent='＋ 追加する';cancel.hidden=true;form.classList.remove('is-editing');}
 function edit(row){if(busy)return;if(editingId&&editingId!==row.id&&!confirm('編集中の内容を破棄して、別の項目を編集しますか？'))return;editingId=row.id;document.getElementById('itemTitle').value=row.title;if(!shopping){document.getElementById('itemNote').value=row.note||'';document.getElementById('itemUrl').value=row.url||'';}submit.textContent='変更を保存';cancel.hidden=false;form.classList.add('is-editing');form.scrollIntoView({block:'start'});document.getElementById('itemTitle').focus();message('内容を変更して保存してください');}
 function message(s){status.textContent=s;}
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
 function render(){host.replaceChildren();const key=shopping?'done':'visited',pending=rows.filter(r=>!r[key]).length;document.getElementById('listCount').textContent=shopping?'あと '+pending+' 個':'行きたい場所 '+pending+' 件';
  filters.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.filter===filter));const count=b.dataset.filter==='pending'?pending:b.dataset.filter==='done'?rows.length-pending:rows.length;b.textContent=b.dataset.label+' '+count;});
  const visible=rows.filter(r=>(filter==='all'||Boolean(r[key])===(filter==='done'))&&(!query||(r.title+' '+(r.note||'')).toLocaleLowerCase().includes(query)));
  if(!visible.length){const empty=document.createElement('p');empty.className='list-empty';empty.textContent=query?'見つかりませんでした。検索する言葉を変えてみてください。':!rows.length?(shopping?'買うものを追加して、ふたりで共有しましょう。':'気になる場所を、ひとつ保存してみましょう。'):filter==='done'?(shopping?'購入済みのものがここに並びます。':'行った場所がここに並びます。'):(shopping?'お買いもの、完了です。おつかれさまでした！':'気になる場所を追加して、次の楽しみを見つけましょう。');host.appendChild(empty);return;}
  [...visible].sort((a,b)=>Number(a[key])-Number(b[key])).forEach(row=>{
   const done=row[shopping?'done':'visited'],card=document.createElement('article');card.className='item'+(done?' done':'');
   const line=document.createElement('div');line.className='item-row';const check=button(done?'✓':shopping?'買った':'行った',()=>toggle(row,card));check.setAttribute('aria-pressed',String(done));check.setAttribute('aria-label',row.title+(done?'を未完了に戻す':shopping?'を買った':'に行った'));line.appendChild(check);const title=document.createElement(shopping?'span':'h2');title.className='item-title';title.textContent=row.title;line.appendChild(title);card.appendChild(line);
   if(!shopping){if(row.note){const note=document.createElement('p');note.textContent=row.note;card.appendChild(note);}const actions=document.createElement('div');actions.className='item-actions';
    const map=document.createElement('a');map.href=row.url||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row.title);map.target='_blank';map.rel='noopener noreferrer';map.textContent=row.url?'保存したリンクを開く':'地図で探す';actions.appendChild(map);
    const schedule=document.createElement('a');schedule.href='/calendar/?action=add&title='+encodeURIComponent(row.title)+'&place='+encodeURIComponent(row.title);schedule.textContent='予定にする';actions.appendChild(schedule);card.appendChild(actions);
   }
   const actions=document.createElement('div');actions.className='item-actions';actions.appendChild(button('編集',()=>edit(row)));actions.appendChild(button('削除',async()=>{if(busy||!confirm('「'+row.title+'」を削除しますか？'))return;const ok=await mutate(()=>client.from(table).delete().eq('id',row.id).select('id').single());if(ok&&editingId===row.id)resetEditor();}));card.appendChild(actions);host.appendChild(card);
  });
 }
 async function load(){const {data,error}=await client.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;rows=data||[];render();}
 async function mutate(fn){if(busy)return false;busy=true;try{const {error}=await fn();if(error)throw error;try{await load();message('保存しました');}catch{message('保存済みです。一覧を更新できなかったため「更新」を押してください');}return true;}catch{message('保存できませんでした。通信を確認してお試しください');return false;}finally{busy=false;}}
 async function toggle(row,card){if(busy)return;const key=shopping?'done':'visited',next=!row[key];card.style.opacity='.55';await mutate(()=>client.from(table).update({[key]:next}).eq('id',row.id).select('id').single());card.style.opacity='';}
 try{const cfg=await(await fetch('/config.json')).json();client=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);if(!(await FamilyAccount.requireSession(client)))return;await load();message('');
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;const title=document.getElementById('itemTitle').value.trim();if(!title)return;const record={title};if(!shopping){record.note=document.getElementById('itemNote').value.trim();record.url=document.getElementById('itemUrl').value.trim()||null;if(record.url){try{const u=new URL(record.url);if(!['https:','http:'].includes(u.protocol))throw Error();record.url=u.href;}catch{message('リンクは https:// から始まるURLを入力してください');return;}}}const submit=form.querySelector('[type=submit]');submit.disabled=true;const ok=await mutate(()=>editingId?client.from(table).update(record).eq('id',editingId).select('id').single():client.from(table).insert(record).select('id').single());if(ok){if(!editingId){filter='pending';query='';search.value='';render();}resetEditor();}submit.disabled=false;};
  document.getElementById('listRefresh').onclick=async()=>{if(busy)return;try{await load();message('最新の情報に更新しました');}catch{message('読み込めませんでした');}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy)load().catch(()=>message('更新できませんでした'));});
 }catch{message('読み込めませんでした。再読み込みしてください');}
})();
