window.FamilyAccount={
 async requireSession(client){
  const {data:{session}}=await client.auth.getSession();
  if(!session){location.replace('/account?next='+encodeURIComponent(location.pathname+location.search+location.hash));return false;}
  const {data,error}=await client.from('sase_accounts').select('member').eq('user_id',session.user.id).maybeSingle();
  if(error||!data){document.body.replaceChildren();const p=document.createElement('p');p.textContent='アカウントを確認できません。通信を確認して再読み込みしてください。';document.body.appendChild(p);return false;}
  if(!document.getElementById('familyAccountLink')){const bar=document.createElement('div');bar.className='family-account-bar';const a=document.createElement('a');a.id='familyAccountLink';a.href='/account?next='+encodeURIComponent(location.pathname+location.search);a.textContent=(data.member==='papa'?'パパ':'ママ')+'でログイン中 · アカウント';bar.appendChild(a);document.body.prepend(bar);}
  client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')location.replace('/account');});
  return true;
 },
 safeNext(raw){try{const u=new URL(raw||'/',location.origin);return u.origin===location.origin&&!u.pathname.startsWith('/account')?u.pathname+u.search+u.hash:'/';}catch{return '/';}}
};
