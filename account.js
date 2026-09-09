(async()=>{
 const status=document.getElementById('accountStatus');let member='',busy=false;
 function setBusy(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);document.querySelector('main').setAttribute('aria-busy',String(value));}
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
  document.getElementById('passkeyChoice').hidden=!supported;document.getElementById('registerPasskey').hidden=!supported;
  document.getElementById('passkeyHelp').textContent=supported?'ご本人のiPhoneで登録してください。次からFace IDなどでログインできます。暗証番号も引き続き使えます。':accounts.passkeysEnabled?'このブラウザーではパスキーを利用できません。iPhoneのSafariで開くか、暗証番号をご利用ください。':'';
  async function passkey(register){if(busy)return;setBusy(true);status.textContent='端末の確認画面で続けてください';try{const {error}=register?await client.auth.registerPasskey():await client.auth.signInWithPasskey();if(error)throw error;if(register){status.textContent='登録しました。次回から「Face ID・パスキーでログイン」が使えます。';document.getElementById('registerPasskey').textContent='別の端末にも登録する';}else location.replace(next);}catch{status.textContent=register?'登録は完了していません。SafariとiCloudキーチェーンの設定を確認してお試しください。':'ログインを完了できませんでした。未登録の場合は、暗証番号で入り、アカウント画面から登録してください。';}finally{setBusy(false);}}
  document.getElementById('passkeyLogin').onclick=()=>passkey(false);document.getElementById('registerPasskey').onclick=()=>passkey(true);
  document.getElementById('signout').onclick=async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error){status.textContent='ログアウトできませんでした';return;}await render();};
 }catch(e){status.textContent='接続できませんでした。再読み込みしてお試しください。';}
})();
