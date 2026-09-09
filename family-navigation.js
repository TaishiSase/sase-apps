// Keep the calendar mounted while moving between the three main destinations.
(() => {
 const embedded = window.parent !== window && new URLSearchParams(location.search).get('embed') === '1';
 if (embedded) document.documentElement.classList.add('family-embedded');
 document.addEventListener('DOMContentLoaded', () => {
  // One-finger horizontal gestures only; keep fields, controls and sheets native.
  let touch=null,suppressClickUntil=0;
  const blocked='input,textarea,select,button,[contenteditable],dialog,.modal-wrap,.modal-overlay,.sheet-overlay,.modal-backdrop,.week-scroll';
  document.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('touchstart',e=>{
   const t=e.touches[0];
   if(e.touches.length!==1 || e.target.closest(blocked) || t.clientX<28 || t.clientX>innerWidth-28){touch=null;return;}
   touch={x:t.clientX,y:t.clientY,time:Date.now()};
  },{passive:true});
  document.addEventListener('touchmove',e=>{if(touch && (e.touches.length!==1 || Math.abs(e.touches[0].clientY-touch.y)>28))touch=null;},{passive:true});
  document.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  document.addEventListener('touchend',e=>{
   if(!touch)return;const start=touch;touch=null;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
   if(Date.now()-start.time>700 || Math.abs(dx)<80 || Math.abs(dx)<Math.abs(dy)*2)return;
   const direction=dx<0?1:-1;
   if(embedded || document.getElementById('homePanel'))suppressClickUntil=Date.now()+350;
   if(embedded)parent.postMessage({type:'family-swipe',direction},location.origin);
   else if(document.getElementById('homePanel'))move(direction);
  },{passive:true});
  function move(direction){const panels=['home','schedule','apps'],i=panels.indexOf(document.body.dataset.mainPanel||'home'),next=panels[i+direction];if(next)location.hash=next;}
  window.addEventListener('message',e=>{const frame=document.getElementById('scheduleFrame');if(e.origin===location.origin && frame && e.source===frame.contentWindow && e.data?.type==='family-swipe' && [1,-1].includes(e.data.direction) && document.body.dataset.mainPanel==='schedule')move(e.data.direction);});
  const nav = document.querySelector('.home-nav');
  if (embedded) {
   document.addEventListener('click', e => {
    const a=e.target.closest('a'); if(!a)return;
    const u=new URL(a.href,location.href);
    if(u.origin===location.origin && !u.pathname.startsWith('/calendar')){e.preventDefault();window.top.location.href=u.href;}
   });
   return;
  }
  if(nav)return;
  if(!document.body.matches('[data-kind]') && !location.pathname.startsWith('/calendar'))return;
  const bar=document.createElement('nav');bar.className='home-nav';bar.setAttribute('aria-label','メインメニュー');
  const shapes=['<path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/>','<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2"/>','<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'];
  ['ホーム','予定','アプリ'].forEach((label,i)=>{const a=document.createElement('a');a.href=['/#home','/#schedule','/#apps'][i];a.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">'+shapes[i]+'</svg><span>'+label+'</span>';if(i===(location.pathname.startsWith('/calendar')?1:2))a.setAttribute('aria-current','page');bar.appendChild(a);});
  document.body.appendChild(bar);document.body.classList.add('with-family-nav');
 });
})();
