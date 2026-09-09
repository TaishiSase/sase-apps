(async()=>{
 const status=document.getElementById('accountStatus');let member='',busy=false;
 try{
  const cfg=await(await fetch('/config.json')).json();
  const client=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{experimental:{passkey:true}}});
  const next=FamilyAccount.safeNext(new URLSearchParams(location.search).get('next'));
  document.getElementById('continueLink').href=next;
  const accounts=await(await fetch('/account-config.json')).json();
  if(!accounts.pinsEnabled){const input=document.getElementById('pinInput');input.removeAttribute('pattern');input.maxLength=128;input.inputMode='text';input.classList.remove('pin');input.previousSibling.textContent='現在のパスワード';}
  async function render(){const {data:{session}}=await client.auth.getSession();document.getElementById('loginPanel').hidden=!!session;document.getElementById('signedPanel').hidden=!session;if(session){const {data,error}=await client.from('sase_accounts').select('member').eq('user_id',session.user.id).maybeSingle();if(error||!data)throw Error('佐瀬家のアカウントを確認できません');document.getElementById('signedName').textContent=(data.member==='papa'?'パパ':'ママ')+'でログイン中';}status.textContent='';}
  await render();
  document.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{member=b.dataset.member;document.querySelectorAll('[data-member]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('pinInput').focus();});
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();if(busy)return;if(!member){status.textContent='パパかママを選んでください';return;}busy=true;document.getElementById('loginSubmit').disabled=true;status.textContent='確認しています…';try{const {error}=await client.auth.signInWithPassword({email:accounts[member],password:document.getElementById('pinInput').value});if(error)throw Error(error.status===429?'時間をおいて、もう一度お試しください':(accounts.pinsEnabled?'暗証番号を確認してください':'パスワードを確認してください'));document.getElementById('pinInput').value='';location.replace(next);}catch(err){status.textContent=err.message;}finally{busy=false;document.getElementById('loginSubmit').disabled=false;}};
  const supported=accounts.passkeysEnabled&&window.PublicKeyCredential&&client.auth.signInWithPasskey;
  document.getElementById('passkeyLogin').hidden=!supported;document.getElementById('registerPasskey').hidden=!supported;
  document.getElementById('passkeyHelp').textContent=supported?'初回だけ、ご本人のiPhoneでパスキーを登録してください。次からFace IDなどでログインできます。':'';
  async function passkey(register){if(busy)return;busy=true;status.textContent='iPhoneの確認画面で続けてください';try{const {error}=register?await client.auth.registerPasskey():await client.auth.signInWithPasskey();if(error)throw error;if(register)status.textContent='登録しました。次回からパスキーでログインできます。';else location.replace(next);}catch{status.textContent='完了しませんでした。暗証番号でもログインできます。';}finally{busy=false;}}
  document.getElementById('passkeyLogin').onclick=()=>passkey(false);document.getElementById('registerPasskey').onclick=()=>passkey(true);
  document.getElementById('signout').onclick=async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error){status.textContent='ログアウトできませんでした';return;}await render();};
 }catch(e){status.textContent='接続できませんでした。再読み込みしてお試しください。';}
})();
