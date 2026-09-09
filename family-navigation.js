// Keep the calendar mounted while moving between the three main destinations.
(() => {
 const embedded = window.parent !== window && new URLSearchParams(location.search).get('embed') === '1';
 if (embedded) document.documentElement.classList.add('family-embedded');
 document.addEventListener('DOMContentLoaded', () => {
  const panels=['home','schedule','apps'];
  let gesture=null,suppressClickUntil=0,dragged=null;
  const isShell=!!document.getElementById('homePanel');
  function activeIndex(){return panels.indexOf(document.body.dataset.mainPanel || (location.pathname.startsWith('/calendar')?'schedule':'apps'));}
  function publish(type,dx){if(embedded)parent.postMessage({type,dx},location.origin);else handle(type,dx);}
  function handle(type,dx){
   if(!isShell)return;
   const i=activeIndex(),direction=dx<0?1:-1,next=panels[i+direction];
   if(type==='family-drag'){
    dragged=document.getElementById(panels[i]+'Panel');dragged.classList.remove('panel-enter');dragged.style.transition='none';
    dragged.style.transform='translateX('+(next?dx:dx*.18)+'px)';
    document.body.classList.add('family-dragging');
    document.body.style.setProperty('--nav-drag',Math.max(-1,Math.min(1,-dx/innerWidth)));
   }else{
    if(dragged){dragged.style.transition=type==='family-settle'?'transform .22s ease':'';dragged.style.transform='';dragged=null;}
    document.body.classList.remove('family-dragging');document.body.style.setProperty('--nav-drag',0);
    if(type==='family-commit' && next){window.familySwipeEntry=(direction>0?1:-1)*Math.max(0,innerWidth-Math.abs(dx));location.hash=next;}
   }
  }
  document.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('dragstart',e=>{if(gesture)e.preventDefault();});
  document.addEventListener('pointerdown',e=>{
   if(gesture){publish('family-settle',0);gesture=null;return;}
   if(!e.isPrimary || e.button!==0)return;
   const inNav=e.target.closest('.home-nav');
   if(!inNav && e.target.closest('input,textarea,select,button,[contenteditable],dialog,.modal-wrap,.modal-overlay,.sheet-overlay,.modal-backdrop'))return;
   if(!inNav && (e.clientX<24 || e.clientX>innerWidth-24))return;
   const horizontal=e.target.closest('.agenda-board,.week-scroll');
   if(horizontal && horizontal.scrollWidth>horizontal.clientWidth+2)return;
   if(!isShell && !embedded && !inNav)return;
   gesture={id:e.pointerId,x:e.screenX,y:e.screenY,dx:0,time:e.timeStamp,locked:false,target:e.target};
  });
  document.addEventListener('pointermove',e=>{
   if(!gesture || e.pointerId!==gesture.id)return;
   const dx=e.screenX-gesture.x,dy=e.screenY-gesture.y;
   if(!gesture.locked){
    if(Math.abs(dy)>10 && Math.abs(dy)>=Math.abs(dx)){gesture=null;return;}
    if(Math.abs(dx)<10 || Math.abs(dx)<Math.abs(dy)*1.3)return;
    gesture.locked=true;gesture.target.setPointerCapture(e.pointerId);
   }
   e.preventDefault();gesture.dx=dx;publish('family-drag',dx);
  },{passive:false});
  function finish(e,cancelled){
   if(!gesture || e.pointerId!==gesture.id)return;
   const g=gesture;gesture=null;
   if(!g.locked)return;
   suppressClickUntil=Date.now()+400;
   if(g.target.hasPointerCapture(e.pointerId))g.target.releasePointerCapture(e.pointerId);
   const commit=!cancelled && (Math.abs(g.dx)>Math.min(80,innerWidth*.18) || (Math.abs(g.dx)>28 && Math.abs(g.dx)/Math.max(1,e.timeStamp-g.time)>.45));
   if(!embedded && !isShell && commit){const next=panels[activeIndex()+(g.dx<0?1:-1)];if(next)location.href='/#'+next;return;}
   publish(commit?'family-commit':'family-settle',g.dx);
  }
  document.addEventListener('pointerup',e=>finish(e,false));
  document.addEventListener('pointercancel',e=>finish(e,true));
  document.addEventListener('lostpointercapture',e=>finish(e,true));
  window.addEventListener('message',e=>{
   const frame=document.getElementById('scheduleFrame');
   if(e.origin!==location.origin || !frame || e.source!==frame.contentWindow || document.body.dataset.mainPanel!=='schedule')return;
   if(!['family-drag','family-commit','family-settle'].includes(e.data?.type) || !Number.isFinite(e.data.dx))return;
   handle(e.data.type,Math.max(-innerWidth,Math.min(innerWidth,e.data.dx)));
  });
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
